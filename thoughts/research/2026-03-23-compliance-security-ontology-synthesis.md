# Compliance, Security, and Data Ontology: Synthesis

A cross-cutting analysis of how compliance, security, and data ontology relate to formspec -- what exists, what could be, and where the three domains converge.

## The Core Thesis

Formspec's declarative, JSON-native architecture is a **structural advantage** for compliance, security, and ontology that imperative form builders cannot replicate. Declarative definitions are signable, statically analyzable, and semantically annotatable in ways that executable code fundamentally resists.

---

## Compliance

**What exists:** Formspec already has surprisingly rich compliance primitives -- structured `ValidationResult` with severity/code/path, response pinning with `(url, version)` immutability, SHACL-inspired validation shapes with `activeWhen` guards, `semanticType` annotations, `sensitive` metadata in registry entries, and the References spec with explicit `"regulation"` and `"policy"` reference types.

**What could be:**

- **Compliance-as-code** -- Regulatory requirements published as registry entries (e.g., a HIPAA compliance registry with PHI classifier extensions and consent shape patterns). A compliance linter pass with coded diagnostics (`C001: PHI field lacks classification annotation`).
- **Consent management** -- `x-consent` extension declaring purpose, lawful basis, revocability, third-party recipients, and jurisdictions per consent field. Consent metadata in responses with timestamp/version/actor.
- **Data classification annotations** -- Field-level `x-data-classification` with sensitivity levels, retention periods, encryption requirements, and export restrictions.
- **Compliance sidecar document** -- A new `$formspecCompliance` sidecar (parallel to theme/component/references) declaring applicable regulations, field classifications, retention policies, and required controls. Different compliance contexts overlay the same form.
- **Cross-jurisdiction routing** -- Already possible via screener + FEL relevance binds. The creative extension is attaching `x-compliance` metadata explaining *why* sections exist.
- **21 CFR Part 11 electronic signatures** -- Extending the Signature component with signer identity binding, meaning declarations, counter-signatures, and timestamp authority references.

**The gap formspec fills:** Every existing platform (JotForm, FormStack, Google Forms) treats compliance as an *infrastructure* feature (encrypted storage, BAAs). None treat it as a *specification* feature -- metadata that travels with the form definition and remains meaningful regardless of hosting platform.

---

## Security

**What exists:** FEL is already a well-sandboxed expression language (no eval, no I/O, no host interop, no side effects, deterministic). The Rust evaluator applies ReDoS mitigation (`regex size_limit`). HTML sanitization in the webcomponent escapes entities before markdown processing. Extensions cannot alter core semantics.

**Threat model highlights:**

- **ReDoS** -- Rust mitigates it, but the *spec* doesn't mandate regex limits. Conformant Python/Java implementations could be vulnerable.
- **Data exfiltration via form design** -- Calculated fields can concatenate PII into innocuous-looking fields. `source` URLs have no allowlisting. Mapping rules can route data anywhere.
- **Definition tampering** -- No cryptographic integrity verification. The immutability rule is governance, not cryptography.
- **Static instance cache** -- `FormEngine.instanceSourceCache` is shared across all engine instances in a process (multi-tenant leakage risk).

**What could be:**

- **Definition signing** -- JWS signatures on canonical JSON (RFC 8785). Uniquely feasible because definitions are data, not code.
- **Field-level encryption policies** -- Declarative `x-formspec-classification` with behavioral implications (audit logging, redaction, export restrictions).
- **Zero-knowledge validation** -- FEL constraints compiled into arithmetic circuits for range proofs. Feasible for simple constraints because FEL is not Turing-complete.
- **Capability-based access control** -- Fine-grained permissions on form sections mapped to FEL relevance/readonly binds. Capabilities are IN the definition, not in application code around it.
- **Static data flow analysis** -- Because FEL is decidable, taint tracking from classified fields through calculate binds and mapping rules is tractable. This is *impossible* for imperative form builders.
- **FEL resource bounds** -- Normative spec section mandating regex limits, expression depth, array size caps, and evaluation timeouts.
- **Redaction policies** -- Declarative rules for what to redact in different contexts (display: mask SSN, export: hash, audit: preserve).

**The declarative advantage:** Static analysis, signing, taint tracking, and termination guarantees are all *decidable* for formspec because FEL is not Turing-complete. You cannot do this with forms built in JavaScript.

---

## Data Ontology

**What exists:** Every form definition IS already an implicit ontology -- concepts (items), properties (fields), relationships (groups/FEL refs), cardinality (minRepeat/maxRepeat), constraints (shapes), derived properties (calculate), controlled vocabularies (option sets), and provenance (derivedFrom). The mapping spec is already an ontology alignment tool -- `valueMap` is concept translation, `coerce` is type bridging, bidirectional mapping is equivalence assertion.

**What could be:**

- **Structured `semanticType`** -- From free-text (`"us-gov:ein"`) to FHIR-style Coding objects with concept IRI, system, display, and cross-system equivalences. Two independently authored forms declaring the same concept IRI are mechanically alignable.
- **Vocabulary binding** -- Option sets bound to external terminologies (ICD-10, NAICS, MeSH) with hierarchical navigation, version pinning, and terminology server integration.
- **Form-as-ontology export** -- Auto-generating OWL/RDF or JSON-LD contexts from annotated definitions. Responses become linked data artifacts automatically.
- **Ontology-driven form generation** -- Given a FHIR StructureDefinition or OWL class, generate a formspec definition with semantic annotations already wired.
- **Cross-form semantic alignment** -- Index fields by `semanticType` across a corpus of definitions. Auto-generate mapping documents. Flag concept gaps between forms.
- **Data contracts** -- Definitions as machine-readable promises between systems. A downstream consumer declares required concepts; a linter verifies the definition satisfies the contract.
- **Mapping rules with SKOS alignment types** -- Annotating each rule as `exact`, `narrower`, `broader`, `related`, or `noMatch` -- connecting formspec to semantic web alignment infrastructure.
- **`definedBy` on field items** -- Borrowing from FHIR Questionnaire's `item.definition`: linking a field to an external schema element, enabling type/cardinality/value-set inheritance.

**Formspec's unique position:** It sits at an intersection no other tool occupies -- XForms has the processing model but not the mapping layer; FHIR Questionnaire has semantic annotations but is domain-locked; JSON Schema validates structure but not behavior; OWL/SHACL are ontologically expressive but aren't data collection tools. Formspec can be the **operational bridge** between domain ontologies and data systems.

---

## Cross-Cutting Convergence

All three domains converge on the same architectural insight: **formspec's existing extension system, sidecar documents, and mapping spec are the natural homes for these capabilities.** The changes needed:

| Feature | Where it lives | Mechanism |
|---------|---------------|-----------|
| Data classification | Definition (field extension) | `x-data-classification` |
| Consent management | Definition (field extension) | `x-consent` |
| Definition integrity | Definition (top-level property) | `integrity { digest, signature }` |
| Compliance posture | New sidecar | `$formspecCompliance` |
| Semantic concepts | Definition (structured `semanticType`) | Concept IRI + system + equivalents |
| Vocabulary binding | Definition (option set property) | `vocabulary { system, version }` |
| Ontology export | Tooling | JSON-LD context generator |
| Data contracts | New artifact | Required concepts + version range |
| Compliance linting | Linter pass | Coded diagnostics (C-series) |
| Data flow analysis | Tooling | Taint tracking through FEL DAG |
| FEL resource bounds | Core spec section | Normative limits |
| Redaction policies | Definition/sidecar extension | Context-dependent strategies |

## Implementation Sequence

The implementation order is natural, each layer building on the previous:

**Phase 1: Semantic annotations and classification** (small schema extensions)
- Structured `semanticType` with concept IRI + system + equivalents
- `x-data-classification` extension vocabulary
- `vocabulary` binding on option sets

**Phase 2: Compliance/security extensions** (registry packages)
- HIPAA compliance registry with PHI classifiers
- `x-consent` extension with purpose/basis/revocability
- `x-retention` extension with retention periods
- Enhanced Signature component with e-signature metadata
- Definition `integrity` property (digest + signature)

**Phase 3: Sidecar specifications** (new spec documents)
- `$formspecCompliance` sidecar document
- Data contracts artifact
- SKOS alignment types on mapping rules

**Phase 4: Tooling** (linters, generators, analyzers)
- Compliance linter pass (C-series diagnostics)
- Static data flow / taint analysis
- FEL resource bounds enforcement
- JSON-LD context generator
- Ontology-driven form generation
- Cross-form semantic alignment index

---

## Detailed Explorations

- [Compliance deep dive](./2026-03-23-compliance-exploration.md) -- Regulatory landscape, consent management, audit trails, electronic signatures, compliance-as-code
- [Security deep dive](./2026-03-23-security-exploration.md) -- Threat model, definition signing, zero-knowledge validation, capability-based access control, data flow analysis
- [Data ontology deep dive](./2026-03-23-data-ontology-exploration.md) -- Semantic types, vocabulary binding, form-as-ontology, knowledge graph integration, data contracts
