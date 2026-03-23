# Formspec and Compliance: A Deep Exploration

## 1. Current State -- Compliance-Adjacent Features Already in Formspec

Formspec already has a surprisingly deep foundation of primitives that are directly relevant to compliance use cases. These were not designed as "compliance features," but they constitute the building blocks that make formspec uniquely well-positioned in this space.

### 1.1 Structured Validation with Machine-Readable Results

The `ValidationResult` schema (`schemas/validationResult.schema.json`) produces structured JSON objects -- not boolean pass/fail -- with `severity`, `constraintKind`, `code`, `message`, `path`, `source`, `sourceId`, `value`, and `context`. This is already an audit-grade finding format. The `external` source type allows server-side compliance systems to inject validation results that participate equally in conformance determination. The `ValidationReport` adds `timestamp` for point-in-time snapshots. This is *far* more structured than what any commercial form platform produces.

### 1.2 Response Pinning and Immutable Version Identity

The `(url, version)` identity tuple, the Pinning Rule (VP-01), and the `status` lifecycle (`draft` -> `active` -> `retired`) mean that responses are always validated against their exact pinned definition version. Active definitions are immutable. This is exactly the kind of version-locking that FDA 21 CFR Part 11 and SOX require -- you can prove what form was used, what version of the rules applied, and that the rules did not change retroactively. The `authored` timestamp on every response creates a temporal audit trail.

### 1.3 Validation Shapes (SHACL-Inspired)

Shapes (`specs/core/spec.md` section 5) provide composable, named, cross-field validation rules with explicit severity levels and timing control (`continuous`/`submit`/`demand`). The `activeWhen` guard allows conditional activation. The existing multi-state tax fixture already demonstrates compliance-relevant patterns: shape `tax-electronic-consent` enforces electronic filing consent at submit time. Shapes compose via `and`/`or`/`not`/`xone`, enabling arbitrarily complex regulatory rule trees.

### 1.4 Semantic Type Annotations

The `semanticType` field property (`definition.schema.json`) is described as a "domain meaning annotation" supporting "data classification and interoperability mapping." Examples include `us-gov:ein`, `ietf:email`, `iso:phone-e164`. This is a metadata-only annotation that explicitly must NOT affect validation. It is the seed of a data classification system, though it has no structural enforcement today.

### 1.5 Extension Registry with Sensitive Data Markers

The `formspec-common.registry.json` already contains entries with `"sensitive": true` in their metadata (the SSN and credit card types). The `displayMask` metadata property demonstrates awareness of data masking for sensitive fields. The `x-formspec-mask()` function allows FEL expressions to mask values. This is rudimentary PII handling.

### 1.6 References Specification (Sidecar)

The References spec (`specs/core/references-spec.md`) is perhaps the most underappreciated compliance primitive. It defines a `"regulation"` reference type explicitly for "Laws, regulations, compliance standards (e.g., 2 CFR 200, HIPAA)." It also defines `"policy"` for organizational SOPs. The `rel` relationship types include `"authorizes"` (a regulation authorizing a cost category), `"constrains"` (imposing limits on valid values), and `"defines"` (defining terms). This creates a formal, machine-readable link between form fields and the regulatory text that governs them.

### 1.7 Screener Routing

The screener mechanism allows conditional routing to different form definitions based on initial answers. This naturally maps to jurisdiction-based or risk-based compliance routing -- different regulatory paths based on initial screening questions.

### 1.8 Modular Composition and Derivation

`$ref` composition and `derivedFrom` lineage tracking enable form variant management. A base compliance form can produce jurisdiction-specific variants with full lineage tracking.

### 1.9 Static Linter (Multi-Pass Pipeline)

The Rust-based linter (`crates/formspec-lint/`) runs multiple passes with coded diagnostics (`E100`, `W300`, `E600`, etc.), severity levels, and JSON-path locations. This architecture is directly extensible for compliance-specific lint rules.

### 1.10 Mapping DSL

The Mapping spec enables bidirectional transforms between formspec responses and external systems. This is directly relevant for compliance reporting -- transforming collected data into regulatory submission formats (XML for government filings, specific JSON schemas for API submissions).

---

## 2. Regulatory Landscape Analysis

Each regulatory framework has specific data handling requirements that map (or could map) to formspec primitives.

### 2.1 HIPAA (Health Insurance Portability and Accountability Act)

**What it requires for forms:**
- Identification and protection of Protected Health Information (PHI) -- 18 specific identifier types
- Minimum necessary disclosure (collect only what is needed)
- Patient authorization for certain disclosures
- Audit trails for access and modification of PHI
- Business Associate Agreements for third parties handling PHI

**Current formspec coverage:**
- `semanticType` could tag PHI fields, but there is no enumeration or enforcement
- The `sensitive` metadata flag in registry entries covers only display masking
- No field-level access control model
- Response `authored` and `author` provide minimal audit trail
- The `nonRelevantBehavior: "remove"` default actually supports minimum necessary -- non-relevant PHI fields are stripped from responses

**Gaps:**
- No formal PHI classification taxonomy
- No per-field access control or de-identification policy
- No audit event model (who viewed, modified, exported which fields)
- No consent management flow (beyond using a boolean field + shape)
- No data-at-rest encryption annotations

### 2.2 GDPR / CCPA (Data Privacy)

**What it requires for forms:**
- Lawful basis for processing each piece of personal data
- Purpose limitation -- data collected only for stated purposes
- Explicit consent with granular opt-in/opt-out
- Right to access, rectification, erasure, portability
- Data minimization
- Retention period limits
- Data Protection Impact Assessments (DPIA) for high-risk processing

**Current formspec coverage:**
- `nonRelevantBehavior: "remove"` supports data minimization
- Extension properties could annotate purpose and lawful basis
- The mapping spec could export data in portable formats (right to portability)
- References spec can link fields to privacy notices

**Gaps:**
- No formal consent model (consent is currently just a boolean field)
- No retention policy annotations
- No erasure/redaction model (what happens to a response when erasure is requested?)
- No purpose-limitation annotations on fields
- No data subject rights workflow support

### 2.3 Section 508 / WCAG 2.x (Accessibility)

**Current formspec coverage:**
- Theme spec section 9.2 provides WCAG guidance (contrast ratios, font minimums, label visibility)
- Component spec requires ARIA roles on built-in components (Alert uses `role="alert"`)
- Core spec includes `presentation.accessibility` with `role`, `description`, `liveRegion`
- Item `labels.accessibility` provides screen-reader-specific text
- The features page claims WCAG 2.1 AA targeting

**Gaps:**
- No *normative* WCAG requirement (spec section 9.2 is explicitly informative)
- No static analysis pass that checks WCAG compliance of definitions
- No runtime accessibility conformance reporting
- No machine-readable accessibility conformance claim in the definition or theme

### 2.4 FDA 21 CFR Part 11 (Electronic Records and Signatures)

**What it requires:**
- Electronic signatures must be legally binding and attributable
- Audit trails for creation, modification, and deletion of records
- Record integrity (detecting unauthorized changes)
- System validation (documented evidence the system works correctly)
- Authority checks (only authorized personnel can sign)
- Time-stamped, immutable audit events

**Current formspec coverage:**
- Signature component exists (`component-spec.md` section 6.8) but captures only a drawn image
- Response pinning provides version immutability
- `authored` timestamp on responses
- `author` object on responses
- `status` lifecycle with `amended` state preserves original

**Gaps:**
- The Signature component captures a *drawing*, not a legally binding electronic signature
- No signer identity binding (who signed, their role, their authority)
- No signature meaning declarations (intent of the signature)
- No counter-signature or multi-party signing workflow
- No tamper-evident seals or integrity hashes
- No audit trail event model
- No time-stamping authority integration

### 2.5 SOX (Sarbanes-Oxley)

**Relevant for:** Financial reporting forms, internal controls.

**What it requires:**
- Internal controls over financial reporting (ICFR)
- Management assertions about accuracy
- Segregation of duties
- Change management controls
- Audit trails

**Current formspec coverage:**
- Validation shapes can encode financial controls (budget sum checks, variance warnings)
- The grant report examples already demonstrate `YOY_VARIANCE` warnings
- Version immutability ensures forms do not change under active use
- Derived-from lineage tracks form evolution

**Gaps:**
- No role-based field-level authorization
- No approval workflow or sign-off model
- No segregation-of-duties enforcement
- No control attestation mechanism

### 2.6 FedRAMP / NIST 800-53

**Relevant for:** Government forms and systems.

**Current formspec coverage:**
- Client-side processing means no data leaves the user's environment
- USWDS adapter already exists for federal design standards
- Extension properties support `x-gov-grants` namespace patterns
- References spec links to regulations

**Gaps:**
- No formal security control annotations
- No data classification level markers (CUI, FOUO, etc.)
- No boundary and authorization annotations

### 2.7 PCI-DSS

**Current formspec coverage:**
- `x-formspec-credit-card` registry entry exists with `"sensitive": true`
- Display masking via `displayMask`

**Gaps:**
- No cardholder data environment (CDE) boundary concept
- No tokenization annotations
- No prohibition on storing full card data in responses
- No post-authorization data handling rules

### 2.8 Industry-Specific (KYC/AML, FERPA, Insurance)

**KYC (Know Your Customer):**
- Identity verification workflows, document collection, risk assessment
- Formspec's screener routing naturally models tiered KYC (simplified vs. enhanced due diligence)
- No identity verification integration model

**FERPA (Education):**
- Student record privacy, consent for disclosure
- Similar to HIPAA gaps -- no formal data classification, no consent model

**Insurance:**
- Actuarial data collection, claims forms, policy applications
- Formspec's calculated fields and money type are well-suited
- No underwriting-specific workflow model

---

## 3. Creative Possibilities

This is where things get interesting. Formspec's existing architecture, particularly its strict separation of structure/behavior/presentation, its extension system, and its sidecar document pattern, enables compliance models that are fundamentally different from anything existing form platforms offer.

### 3.1 Compliance-as-Code: Declarative Regulatory Requirements

**The big idea:** Regulatory requirements can be expressed as formspec artifacts -- registry entries, validation shapes, reference bindings, and lint rules -- that are versioned, composable, and machine-executable. A "compliance package" is not documentation; it is executable constraint code.

**Concrete implementation:**

A compliance registry (analogous to `formspec-common.registry.json`) could publish regulatory constraints as extension entries:

```json
{
  "$formspecRegistry": "1.0",
  "publisher": {
    "name": "HHS Office for Civil Rights",
    "url": "https://hhs.gov/hipaa"
  },
  "entries": [
    {
      "name": "x-hipaa-phi-identifier",
      "category": "property",
      "version": "1.0.0",
      "status": "stable",
      "description": "Marks a field as containing one of the 18 HIPAA PHI identifiers.",
      "compatibility": { "formspecVersion": ">=1.0.0" },
      "schemaUrl": "https://hhs.gov/formspec/x-hipaa-phi-identifier.schema.json"
    },
    {
      "name": "x-hipaa-minimum-necessary",
      "category": "constraint",
      "version": "1.0.0",
      "status": "stable",
      "description": "Validates that PHI fields are relevant only when their collection is justified by the stated purpose.",
      "parameters": [
        { "name": "purpose", "type": "string" },
        { "name": "justification", "type": "string" }
      ]
    }
  ]
}
```

Then a compliance-aware linter pass could statically verify that every field tagged with `x-hipaa-phi-identifier` also has appropriate protections declared. This transforms compliance from a documentation exercise into a testable, automatable property of the form definition itself.

### 3.2 Data Classification Annotations (Field-Level)

**The idea:** Extend `semanticType` or introduce a dedicated `classification` property (via extension) that tags fields with standardized data sensitivity levels.

```json
{
  "key": "ssn",
  "type": "field",
  "dataType": "string",
  "label": "Social Security Number",
  "extensions": {
    "x-formspec-ssn": true,
    "x-data-classification": {
      "level": "restricted",
      "categories": ["pii", "phi-identifier"],
      "regulations": ["hipaa", "ccpa"],
      "retentionDays": 2555,
      "requiresEncryptionAtRest": true,
      "requiresMaskedDisplay": true,
      "exportable": false
    }
  }
}
```

A classification registry could publish standardized taxonomies:
- `public` / `internal` / `confidential` / `restricted` (corporate)
- `CUI` / `FOUO` / `classified` (government)
- `non-sensitive` / `sensitive` / `highly-sensitive` (GDPR)

The key insight is that this classification lives *in the definition*, not in a separate security document. When the form definition is the source of truth for data structure, it should also be the source of truth for data classification. This is something no existing form platform does.

### 3.3 Consent Management as a First-Class Pattern

Current formspec handles consent as "just another boolean field with a shape validation." But consent is fundamentally different from other form data -- it has temporal scope, granularity, revocability, and legal implications.

**A consent model could leverage existing primitives:**

The *definition* side uses standard items and shapes:

```json
{
  "key": "consentMedicalRecords",
  "type": "field",
  "dataType": "boolean",
  "label": "I consent to the collection and processing of my medical records for the purpose of...",
  "extensions": {
    "x-consent": {
      "purpose": "medical-treatment",
      "lawfulBasis": "explicit-consent",
      "dataCategories": ["health-data", "genetic-data"],
      "retentionPeriod": "P7Y",
      "revocable": true,
      "thirdPartyRecipients": ["insurance-provider", "specialist-referral"],
      "jurisdictions": ["gdpr-eu", "ccpa-ca"]
    }
  }
}
```

The *response* side could carry consent metadata:

```json
{
  "extensions": {
    "x-consent-record": {
      "consents": [
        {
          "field": "consentMedicalRecords",
          "granted": true,
          "timestamp": "2026-03-23T14:30:00Z",
          "version": "1.0.0",
          "ipAddress": "10.0.0.1",
          "userAgent": "Mozilla/5.0..."
        }
      ]
    }
  }
}
```

This is not reinventing a consent management platform -- it is embedding consent semantics into the form layer where they originate, so that downstream systems have machine-readable consent records alongside the data they govern.

### 3.4 Audit Trail Generation

Formspec responses already have `authored`, `author`, `status`, and `id`. But a compliance-grade audit trail requires event-level granularity.

**An audit event extension on the Response:**

```json
{
  "extensions": {
    "x-audit-trail": {
      "events": [
        {
          "type": "create",
          "timestamp": "2026-03-23T10:00:00Z",
          "actor": { "id": "user-42", "name": "Ada Lovelace" },
          "definitionVersion": "2.1.0"
        },
        {
          "type": "field-modify",
          "timestamp": "2026-03-23T10:05:00Z",
          "actor": { "id": "user-42" },
          "path": "ssn",
          "previousValue": null,
          "classified": true
        },
        {
          "type": "validate",
          "timestamp": "2026-03-23T10:10:00Z",
          "actor": { "id": "system:validation-engine" },
          "result": { "valid": false, "errorCount": 2 }
        },
        {
          "type": "sign",
          "timestamp": "2026-03-23T10:15:00Z",
          "actor": { "id": "user-42" },
          "signatureField": "approverSignature",
          "meaning": "approval",
          "method": "drawn-signature"
        },
        {
          "type": "submit",
          "timestamp": "2026-03-23T10:16:00Z",
          "actor": { "id": "user-42" },
          "validationReport": { "valid": true, "counts": { "error": 0, "warning": 1, "info": 0 } }
        }
      ]
    }
  }
}
```

The crucial design choice is that `field-modify` events on classified fields would record `"classified": true` and omit the actual value, while non-classified field changes could include the before/after values. The classification annotations from section 3.2 directly drive audit trail behavior.

### 3.5 Electronic Signature Beyond Image Capture

The current Signature component captures a drawn image as an `attachment`. For 21 CFR Part 11 compliance, an electronic signature needs to be much more:

**An enhanced signature model (via extension property on the component or definition level):**

```json
{
  "key": "approverSignature",
  "type": "field",
  "dataType": "attachment",
  "extensions": {
    "x-esignature": {
      "legally-binding": true,
      "meaning": "approval",
      "meaningText": "I certify that the information provided is accurate and complete to the best of my knowledge.",
      "signerIdentification": "authenticated-session",
      "requiresReauthentication": true,
      "timestampAuthority": "rfc3161",
      "counterSignatures": [
        {
          "role": "supervisor",
          "required": true,
          "meaning": "review-and-approval"
        }
      ]
    }
  }
}
```

The form engine does not need to implement the cryptographic signing -- that is the host environment's responsibility. But the *declaration* of signature requirements, signer roles, and signature meanings should live in the form definition. This allows static analysis to verify that a form meets 21 CFR Part 11 requirements *before deployment*.

### 3.6 Retention Policy Annotations

Field-level retention policies enable automated data lifecycle management:

```json
{
  "extensions": {
    "x-retention": {
      "policy": "regulatory-minimum",
      "retentionPeriod": "P7Y",
      "retentionBasis": "hipaa-164.530",
      "onExpiry": "redact",
      "redactionStrategy": "replace-with-hash",
      "expiryNotification": true
    }
  }
}
```

This is more powerful at the field level than at the form level. A single form might have financial fields (retain 7 years per SOX), medical fields (retain 6 years per HIPAA), and marketing consent fields (delete on revocation per GDPR). Field-level retention policies expressed in the definition mean that the downstream data store has explicit, machine-readable instructions for each data element.

### 3.7 Cross-Jurisdiction Compliance via Screener + Derivation

**The idea:** Forms that dynamically adapt their compliance posture based on jurisdiction, using formspec's existing screener routing and derived-from lineage.

```json
{
  "screener": {
    "items": [
      {
        "key": "jurisdiction",
        "type": "field",
        "dataType": "choice",
        "label": "Where are you located?",
        "options": [
          { "value": "eu", "label": "European Union" },
          { "value": "us-ca", "label": "California, USA" },
          { "value": "us-other", "label": "Other US State" },
          { "value": "other", "label": "Other" }
        ]
      }
    ],
    "routes": [
      {
        "condition": "$jurisdiction = 'eu'",
        "target": "https://example.org/forms/intake-gdpr",
        "label": "GDPR-compliant intake"
      },
      {
        "condition": "$jurisdiction = 'us-ca'",
        "target": "https://example.org/forms/intake-ccpa",
        "label": "CCPA-compliant intake"
      },
      {
        "condition": "true",
        "target": "https://example.org/forms/intake-standard",
        "label": "Standard intake"
      }
    ]
  }
}
```

Each target form is a `derivedFrom` variant of a base form, with jurisdiction-specific consent fields, data classification annotations, and retention policies. The screener routing is already in the spec; the only new piece is the discipline of using it for compliance routing.

But the more sophisticated approach avoids multiple form definitions entirely. A single definition uses FEL relevance expressions to conditionally show jurisdiction-specific sections:

```json
{
  "binds": [
    {
      "path": "gdprConsent",
      "relevant": "$jurisdiction = 'eu'",
      "required": "$jurisdiction = 'eu'"
    },
    {
      "path": "ccpaOptOut",
      "relevant": "$jurisdiction = 'us-ca'"
    }
  ]
}
```

This is already possible. The creative extension is adding compliance metadata that explains *why* these sections exist:

```json
{
  "binds": [
    {
      "path": "gdprConsent",
      "relevant": "$jurisdiction = 'eu'",
      "required": "$jurisdiction = 'eu'",
      "extensions": {
        "x-compliance": {
          "regulation": "gdpr-art-6",
          "requirement": "explicit-consent-for-processing",
          "jurisdictions": ["eu"]
        }
      }
    }
  ]
}
```

### 3.8 Compliance Validation as a Linter Pass

The Rust linter already has a multi-pass architecture with coded diagnostics. A compliance pass could statically analyze definitions for regulatory conformance:

**Example lint rules for HIPAA:**
- `C001`: Field with `semanticType` matching a PHI identifier (name, DOB, SSN, MRN, etc.) lacks `x-data-classification` annotation. (Warning)
- `C002`: PHI-classified field is in a group with `nonRelevantBehavior: "keep"` -- non-relevant PHI data may be retained unnecessarily. (Warning)
- `C003`: Form collects PHI fields but has no consent shape with `timing: "submit"`. (Error)
- `C004`: Response extensions lack `x-audit-trail` event schema. (Info)

**Example lint rules for GDPR:**
- `C010`: Field has `x-data-classification.categories` containing `"personal-data"` but no `x-consent` extension declaring `lawfulBasis`. (Error)
- `C011`: `x-consent` extension specifies `"revocable": true` but the definition has no mechanism to handle revocation (no `stopped` status transition path). (Warning)
- `C012`: Field has `x-retention` annotation exceeding jurisdiction maximum retention period. (Error)

**Example lint rules for accessibility:**
- `C020`: Field has `presentation.accessibility.role` but no `labels.accessibility`. (Warning)
- `C021`: Display item of type `heading` lacks a label (empty or missing), violating WCAG 1.3.1. (Error)

This is uniquely powerful because the lint rules operate on the *declarative definition*, not on rendered HTML. A form can be checked for compliance before it is ever deployed, across all possible rendering targets simultaneously.

### 3.9 Compliance Reporting Artifacts

The Mapping DSL could transform formspec responses into compliance reporting formats. For example:

- Transform grant report responses into SF-425 XML submissions
- Transform clinical intake responses into FHIR resources
- Transform financial forms into XBRL reports
- Transform privacy-annotated responses into Article 30 GDPR processing records

The existing mapping spec already supports `transform: "expression"` with FEL expressions, `transform: "coerce"` for type conversions, and adapter targets for JSON/XML/CSV. A compliance mapping could include:

```json
{
  "$formspecMapping": "1.0",
  "definitionRef": "https://example.org/forms/clinical-intake",
  "definitionVersion": ">=1.0.0 <2.0.0",
  "targetSchema": { "format": "json", "schemaUri": "https://hl7.org/fhir/R5/questionnaireresponse.schema.json" },
  "rules": [
    {
      "sourcePath": "demographics.dob",
      "targetPath": "subject.birthDate",
      "transform": "preserve"
    },
    {
      "sourcePath": "demographics.ssn",
      "targetPath": null,
      "transform": "drop",
      "extensions": {
        "x-compliance-note": "SSN excluded from FHIR export per minimum necessary principle"
      }
    }
  ]
}
```

The `drop` transform with a compliance annotation creates an explicit, auditable record of *why* data is excluded from exports.

### 3.10 Chain of Custody for Form Data

Combining audit trails, electronic signatures, response pinning, and version immutability creates a chain of custody:

1. **Definition authored** -- versioned, immutable once active, with full change history via changelog spec
2. **Response created** -- pinned to exact definition version, timestamped, author identified
3. **Data collected** -- every modification logged in audit trail
4. **Validation executed** -- validation report timestamped, definition version recorded
5. **Signatures applied** -- signer identity, meaning, timestamp, method recorded
6. **Response submitted** -- status transition logged, final validation report preserved
7. **Data exported** -- mapping rules applied, compliance transforms documented
8. **Data retained/disposed** -- retention policy governs lifecycle

Each step produces a machine-readable artifact. The chain is verifiable end-to-end.

---

## 4. Spec Extension Opportunities -- Where Compliance Features Fit

Formspec's tiered architecture creates natural homes for different compliance concerns:

### Tier 1 (Core -- Definition/Response)

This is where *data semantics and behavioral constraints* live. The following compliance features belong here because they affect what data is collected and how it behaves:

- **Data classification annotations** -- `extensions` on fields declaring sensitivity, categories, and regulatory applicability. These are metadata that must travel with the definition.
- **Consent semantics** -- `extensions` on consent fields declaring purpose, lawful basis, revocability. These affect how consent data is interpreted.
- **Retention policy annotations** -- `extensions` on fields or the definition declaring retention periods and expiry behavior.
- **Electronic signature declarations** -- `extensions` declaring signature requirements, signer roles, and legal meaning.
- **Audit trail extensions** -- `extensions` on the Response carrying event logs.
- **Compliance shapes** -- validation shapes encoding regulatory constraints (consent-before-submit, PHI-justification, signature-required-for-completion).

### Tier 2 (Theme)

This is where *presentation of compliance elements* lives:

- **Consent presentation** -- specific widget styling for consent checkboxes (larger, more prominent, legally distinct visual treatment)
- **Sensitivity indicators** -- visual markers on fields containing classified data (lock icons, "Confidential" badges)
- **Accessibility compliance** -- WCAG-conformant color tokens, font sizes, contrast ratios, skip navigation patterns
- **Privacy notice integration** -- styled inline privacy notices tied to consent fields

### Tier 3 (Component)

This is where *interaction patterns for compliance* live:

- **ConsentBlock component** -- a specialized component that renders consent text with required acknowledgment, distinct from a simple checkbox
- **SignatureBlock component** -- enhanced signature component with signer identification, meaning declaration, and timestamp display
- **PrivacyNotice component** -- expandable/collapsible privacy notice with acknowledgment tracking
- **AuditBadge component** -- displays data classification level, last-modified timestamp, modification count
- **DataExportControl component** -- user-facing control for exercising data subject rights (export, erasure request)

### Sidecar Documents

- **References document** -- linking fields to regulations, policies, and compliance standards (already specified)
- **Compliance manifest** -- a new sidecar document type declaring the form's compliance posture, applicable regulations, and compliance validation results. This would parallel the theme, component, and references sidecars:

```json
{
  "$formspecCompliance": "1.0",
  "targetDefinition": {
    "url": "https://example.org/forms/clinical-intake",
    "versionRange": ">=1.0.0 <2.0.0"
  },
  "applicableRegulations": [
    {
      "id": "hipaa",
      "title": "HIPAA Privacy Rule",
      "citation": "45 CFR 164",
      "jurisdiction": "us-federal"
    }
  ],
  "classifications": {
    "demographics.ssn": { "level": "restricted", "categories": ["phi-identifier"] },
    "demographics.dob": { "level": "confidential", "categories": ["phi-identifier"] },
    "chiefComplaint": { "level": "confidential", "categories": ["phi"] }
  },
  "retentionPolicies": {
    "default": { "period": "P6Y", "basis": "hipaa-164.530" },
    "demographics.ssn": { "period": "P6Y", "onExpiry": "redact" }
  },
  "requiredControls": [
    { "id": "consent-before-phi", "type": "consent", "enforced": true },
    { "id": "signature-on-submit", "type": "signature", "enforced": true },
    { "id": "audit-trail", "type": "audit", "enforced": true }
  ]
}
```

A compliance sidecar keeps compliance metadata *separate from the definition* (maintaining the structure/behavior/presentation separation) while being *formally linked* to it. This means the same clinical intake form could have different compliance sidecars for different deployment contexts (hospital vs. research institution vs. telehealth).

---

## 5. Competitive Landscape and Differentiation

### 5.1 What Existing Platforms Do

**Typeform:** Zero compliance features beyond GDPR cookie consent banners. No data classification, no audit trails, no validation shapes.

**JotForm:** HIPAA-compliant paid tier (encrypted submissions, BAA available). But compliance is an infrastructure feature, not a form specification feature. The form definition itself carries no compliance metadata.

**FormStack:** HIPAA and GDPR compliance marketed. Offers encrypted fields, audit logs, and access controls. But these are platform features, not portable artifacts. If you leave FormStack, your compliance posture leaves with it.

**Google Forms / Microsoft Forms:** Enterprise compliance (SOC 2, ISO 27001 at the platform level). No form-level compliance annotations. No data classification. No audit trails on individual form submissions.

**forms.gov / MAX.gov (Government):** Paper-form digitization with minimal smart logic. Strong infrastructure compliance (FedRAMP) but weak form-level compliance features.

**FHIR Questionnaire (Healthcare):** The closest comparator. Supports extensions, coded values, and structured data capture. But FHIR Questionnaires lack: composable validation shapes, FEL-style computed constraints, bidirectional mapping, and the sidecar architecture. FHIR Questionnaires are also XML-heritage and complex.

**ODK / XLSForm (Field Data Collection):** Strong offline support but minimal compliance features. No data classification, no audit trails, no electronic signature support.

### 5.2 The Gap Formspec Could Fill

Every existing platform treats compliance as an **infrastructure concern** -- encrypted storage, access controls, audit logs at the platform level. None of them treat compliance as a **specification concern** -- metadata that travels with the form definition and remains meaningful regardless of the hosting platform.

This is the fundamental insight: **compliance metadata should be declarative and portable, not locked into a platform's implementation.**

When you express data classification, consent requirements, retention policies, and audit obligations in the form definition itself (or its sidecar documents), you get:

1. **Portability** -- Move between form engines and hosting environments without losing your compliance posture
2. **Static analysis** -- Validate compliance before deployment, across all rendering targets
3. **Auditability** -- The compliance requirements are inspectable JSON, not hidden in platform configuration
4. **Composability** -- Compliance registries can publish reusable regulatory constraint packages
5. **Version tracking** -- Compliance requirements evolve with the form definition through the standard versioning/changelog mechanisms
6. **Automation** -- Downstream systems receive machine-readable compliance metadata alongside the data, enabling automated data lifecycle management

No existing form platform offers this. The closest analog is how infrastructure-as-code (Terraform, CloudFormation) brought compliance to infrastructure declarations -- formspec could do the same for data collection.

### 5.3 The Unique Formspec Advantage

Formspec's architecture is *uniquely suited* to this because of three properties no competitor shares:

1. **The sidecar document pattern** -- compliance metadata can be separated from the form definition without losing the formal binding. Different compliance contexts can overlay the same form.

2. **The extension registry** -- compliance constraints can be published as versioned, discoverable, reusable packages with formal compatibility bounds. A government agency publishes a HIPAA compliance registry; every healthcare form that references it inherits the constraints.

3. **The multi-tier architecture** -- compliance concerns are cleanly separated: data classification in Tier 1, sensitivity display in Tier 2, consent interaction patterns in Tier 3. This prevents the common problem where "adding compliance" means scattering compliance logic throughout the codebase.

---

## Summary of Highest-Impact Opportunities

Ranked by impact, feasibility, and alignment with formspec's existing architecture:

**Immediate (using existing primitives, no spec changes):**
1. Publish a **HIPAA compliance registry** with PHI classifier extensions and consent shape patterns
2. Create **compliance reference examples** showing consent management with existing shapes and extensions
3. Add a **compliance lint pass** to the existing linter architecture with coded diagnostics
4. Write **compliance mapping templates** transforming formspec responses into regulatory submission formats

**Near-term (minor spec extensions):**
5. Formalize `x-data-classification` as a recommended extension property schema
6. Formalize `x-consent` as a recommended extension property schema with purpose, lawful basis, and revocability
7. Formalize `x-retention` as a recommended extension property schema
8. Extend the Signature component spec with electronic signature metadata properties

**Strategic (new sidecar specification):**
9. A **Compliance Manifest** sidecar document specification (parallel to Theme, Component, References)
10. A **Compliance Conformance Level** system (analogous to Core/Extended processor conformance) defining what a "compliance-aware processor" must implement

The key principle throughout is: compliance metadata is *declarative data about data collection*, and formspec is a *declarative data collection specification*. They belong together.
