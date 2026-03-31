# Ontology Specification Reference Map

> specs/ontology/ontology-spec.md -- 782 lines, ~38K -- Companion: Semantic Binding, Concept Alignment, Vocabulary Mapping

## Overview

The Ontology specification defines a standalone JSON sidecar document for binding form fields to concepts in external ontologies and standards (schema.org, FHIR, ICD-10, Dublin Core, etc.). It is a companion to the Formspec v1.0 core specification and does not modify the core processing model -- ontology metadata is pure metadata that MUST NOT affect data capture, validation, or processing. The spec covers three binding mechanisms (concept bindings by path, vocabulary bindings by option set name, and typed cross-system alignments), a JSON-LD context fragment for linked data export, and a resolution cascade that layers ontology bindings over registry concept entries and raw semanticType values. Multiple Ontology Documents MAY target the same Definition for different domains or interoperability contexts.

## Section Map

### Front Matter and Preamble (Lines 1-83)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| Abstract | Abstract | Explains that Ontology Documents are standalone sidecar JSON files that bind form fields to external ontology concepts by IRI -- they reference existing concepts, they do not define new ones. Multiple documents MAY target the same Definition for different domains. | Ontology Document, Concept Binding, Vocabulary Binding, Alignment, sidecar document, IRI | Understanding the purpose and scope of the ontology spec |
| Status | Status of This Document | Draft status disclaimer. States this is a companion to Formspec v1.0 and does not modify or extend the core processing model. | Draft specification, companion document | Checking spec maturity level |
| Conventions | Conventions and Terminology | Defines RFC 2119/8174 keyword interpretation, JSON/URI/IRI standards, and five new terms. Inherits terms from Formspec v1.0 including conformant processor, Definition document, extension, FEL expression, semanticType. | Ontology Document, Concept Binding, Vocabulary Binding, Alignment, Ontology-aware processor | Looking up what a term means |
| BLUF | Bottom Line Up Front | Eight-bullet summary covering sidecar nature, concept URIs with SKOS equivalents, vocabulary bindings, alignments for cross-form data science, additive merge semantics, pure metadata constraint, OWL-integrative positioning, and governing schema. | BLUF, SKOS, OWL-integrative, additive merge, pure metadata | Quick orientation on what the spec requires |

### Section 1: Purpose and Scope (Lines 87-174)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 1 | Purpose and Scope | Enumerates the five things this spec defines (concept bindings, vocabulary bindings, alignments, JSON-LD context generation, conformance requirements) and explicitly excludes (ontology language, reasoning engine, terminology service). Clarifies that the name "Ontology Document" reflects purpose (connecting to ontologies) not nature (it is a binding document). | semanticType, concept binding, vocabulary binding, alignment, JSON-LD, binding document | Understanding what is and is not in scope |
| 1.0.1 | Relationship to Registry Concept and Vocabulary Entries | Explains how shared concept/vocabulary metadata can be published as registry entries (category "concept" and "vocabulary"), while the Ontology Document handles per-form bindings, alignments, JSON-LD context, and bespoke vocabulary overrides. When both apply, Ontology Document takes precedence. | Registry entries, concept category, vocabulary category, precedence, per-form vs org-level | Understanding the split between registry-level and document-level concept metadata |
| 1.1 | Design Principles | Six principles: (1) Binding not definition -- references external concepts, (2) Sidecar not embedded -- versioned independently, (3) Different authority -- may be authored by standards bodies, (4) Different cadence -- terminology systems update independently, (5) Pure metadata -- MUST NOT affect processing, (6) Graceful degradation -- every property optional except structural minimum. | Sidecar, binding, pure metadata, graceful degradation, independent versioning | Understanding architectural rationale and constraints |
| 1.2 | Relationship to OWL and the Semantic Web | States the spec is OWL-integrative not OWL-compatible: uses IRIs for identity and SKOS for alignment types but does not implement OWL formal semantics, open-world reasoning, or class hierarchies. Points to Appendix B for detail. | OWL, IRI, SKOS, OWL-integrative, semantic web | Understanding what degree of OWL/RDF integration is supported |

### Section 2: Ontology Document Format (Lines 178-226)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 2 | Ontology Document Format | Defines the top-level JSON structure with 16 properties. Three required: `$formspecOntology` (must be "1.0"), `version`, `targetDefinition`. Recommended: `title`. Optional: `$schema`, `url`, `name`, `description`, `publisher`, `published`, `defaultSystem`, `concepts`, `vocabularies`, `alignments`, `context`, `extensions`. | $formspecOntology, version, targetDefinition, defaultSystem, concepts, vocabularies, alignments, context | Building or validating an Ontology Document's top-level structure |
| 2.1 | Target Definition | Defines the binding to the target Definition: `url` (required, canonical URL) and `compatibleVersions` (optional, semver range). | targetDefinition, url, compatibleVersions, semver range | Specifying which Definition an ontology document binds to |
| 2.2 | Publisher Object | Defines publisher sub-object: `name` (required), `url` (required), `contact` (optional). | Publisher, name, url, contact | Constructing or validating publisher metadata |
| 2.3 | Validation Rules | Seven validation rules: paths use Bind.path syntax, vocabulary keys must match optionSets names, alignment fields use Bind.path syntax, all values are static (no FEL), x-prefixed extensions preserved on round-trip, empty collections are valid, context @context must be string/object/array per JSON-LD. | Path syntax, Bind.path, static values, no FEL, x- extensions, round-trip preservation | Understanding what makes an Ontology Document valid or invalid |

### Section 3: Concept Bindings (Lines 229-342)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 3 | Concept Bindings | Defines the `concepts` map: keys are item paths (Bind.path syntax), values are Concept Binding objects with `concept` IRI (required), `system` URI (recommended, falls back to defaultSystem), `display` (recommended), `code` (optional), and `equivalents` array (optional). Shows path syntax examples including `#` for form-level binding and `[*]` for repeatable groups. | concepts, concept IRI, system URI, defaultSystem fallback, display, code, item path, form-level binding (#), repeatable group path ([*]) | Binding a field to an external ontology concept |
| 3.1 | Equivalents | Defines each equivalents array element: `system` (required), `code` (required), `display` (optional), `type` (optional -- defaults to "exact" when absent as a processing-model default, not schema default). | equivalents, system, code, display, type, exact default | Declaring cross-system equivalences for a concept |
| 3.2 | Relationship Types (SKOS-Inspired) | Defines five SKOS-inspired relationship types: exact (identical, default), close (very similar), broader (source more specific), narrower (source more general), related (associatively related). Custom types MUST be x-prefixed. | exact, close, broader, narrower, related, SKOS, exactMatch, closeMatch, broadMatch, narrowMatch, relatedMatch, x- custom types | Choosing the right relationship type for an equivalence or alignment |
| 3.3 | Example | Complete JSON example showing concept bindings for mrn (with FHIR system and schema.org equivalent), dob (schema.org), and demographics.ssn (IRS with broader schema.org equivalent). | mrn, dob, ssn, FHIR, schema.org, equivalents example | Understanding how concept bindings look in practice |
| 3.4 | Resolution Cascade | Three-tier precedence for concept identity: (1) Ontology Document binding (highest), (2) Registry concept entry matching semanticType, (3) Raw semanticType literal (lowest). All three MAY coexist -- no warning needed. Ontology binding provides richer metadata while registry provides shared baseline. | Resolution cascade, precedence, semanticType, registry concept entry, coexistence | Understanding which source wins when multiple concept sources apply to the same field |

### Section 4: Vocabulary Bindings (Lines 345-416)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 4 | Vocabulary Bindings | Defines the `vocabularies` map: keys are option set names (matching Definition optionSets), values have `system` URI (required), `version` (recommended), `display` (recommended), `filter` (optional), `valueMap` (optional -- maps option values to external terminology codes). | vocabularies, optionSets, system URI, version, display, filter, valueMap | Binding an option set to an external terminology system |
| 4.1 | Filter Object | Defines hierarchical filtering: `ancestor` (root code), `maxDepth` (max depth from ancestor), `include` (explicit codes), `exclude` (explicit exclusions). All optional. | filter, ancestor, maxDepth, include, exclude, hierarchical filtering | Constraining which subset of a large vocabulary applies |
| 4.2 | Example | JSON example showing ICD-10 vocabulary with hierarchical filter (ancestor F00-F99, maxDepth 3) and administrative gender vocabulary with valueMap translating short codes (m/f/o/u) to terminology codes. | ICD-10, administrative-gender, valueMap, filter example | Understanding how vocabulary bindings look in practice |
| 4.3 | Interaction with Option Sets | Clarifies that vocabulary bindings do NOT replace option set values -- they add metadata enabling: terminology version tracking, cross-vocabulary alignment, hierarchical context, and code normalization via valueMap. | Metadata overlay, version tracking, cross-vocabulary alignment, code normalization | Understanding the relationship between vocabulary bindings and Definition option sets |
| 4.4 | Dynamic Option Sources | States that vocabulary bindings target static optionSets only. Fields using `choicesFrom` for dynamic options are out of scope. Dynamic vocabulary resolution is the host environment's responsibility. | choicesFrom, dynamic options, static optionSets, host environment | Understanding what vocabulary bindings cannot target |

### Section 5: Alignments (Lines 419-487)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 5 | Alignments | Defines the `alignments` array for cross-system field relationships. Each alignment has: `field` (required, item path), `target` object with `system`/`code`/`display`, `type` (required, relationship type from 3.2), `bidirectional` (optional, default false), `notes` (optional). Enables cross-form data merging when two forms align to the same external concept. | alignments, field, target, system, code, type, bidirectional, notes, cross-form data science | Declaring typed relationships between form fields and external system concepts |
| 5.1 | Example | JSON example showing four FHIR R4 alignments (mrn, dob, gender as exact+bidirectional) and a broader schema.org gender alignment with explanatory notes. | FHIR R4, Patient.identifier, Patient.birthDate, Patient.gender, bidirectional, notes | Understanding how alignments look in practice |
| 5.2 | Alignment vs. Concept Equivalents | Explains the distinction: concept equivalents (3.1) declare equivalences from the concept's perspective ("EIN is also known as taxID"), while alignments declare from the field's perspective ("this field maps to that system's field"). Alignments support notes, directionality, and fields with no concept binding (pure structural alignment). Both are valid; equivalents are simpler for common cases. | Concept equivalents vs alignments, concept perspective vs field perspective, structural alignment | Choosing between concept equivalents and alignments for cross-system mapping |

### Section 6: JSON-LD Context Fragment (Lines 490-525)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 6 | JSON-LD Context Fragment | Defines the `context` property containing a JSON-LD @context fragment that, when applied to a response document, makes it valid JSON-LD for linked data ecosystems. | context, @context, JSON-LD, linked data, response export | Adding linked data capability to form responses |
| 6.1 | Example | JSON example showing @context with @vocab base URI and per-field @id/@type mappings (mrn as xsd:string, dob as xsd:date, gender as @vocab). | @vocab, @id, @type, xsd:string, xsd:date, @vocab type | Understanding how JSON-LD context fragments look |
| 6.2 | Auto-Generation | States that ontology-aware tooling SHOULD auto-generate JSON-LD context from concept and vocabulary bindings. Explicit context entries override auto-generated ones. | Auto-generation, explicit override | Understanding tooling expectations for JSON-LD context generation |

### Section 7: Relationship to Existing Properties (Lines 528-563)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 7 | Relationship to Existing Properties | Provides a layering table from structural typing through semantic identity: dataType (Definition), semanticType (Definition), extensions (Registry), concept entries (Registry), vocabulary entries (Registry), concept bindings (Ontology), vocabulary bindings (Ontology), alignments (Ontology). Explains how each layer relates and when Ontology Document bindings override registry entries. | dataType, semanticType, extensions, concept entries, vocabulary entries, concept bindings, vocabulary bindings, alignments, layering | Understanding the full property stack from structural typing to semantic identity |

### Section 8: Conformance (Lines 566-589)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 8 | Conformance | Introduces conformance requirements for ontology document handling. | Conformance | Understanding processor requirements |
| 8.1 | Core Processor Requirements | Three rules: Core processors MAY ignore ontology documents entirely; MUST NOT use ontology bindings to alter data capture/validation/processing; ontology metadata MUST NOT appear in Response data. | Core processor, ignore, pure metadata, Response data | Implementing a core processor that does not support ontology |
| 8.2 | Extended Processor Requirements | Eleven rules for processors that support ontology documents: must validate against schema, must verify targetDefinition.url match (mismatch = must not apply + should error), should check compatibleVersions (mismatch = warn-and-continue), must resolve defaultSystem, missing path = warning not rejection, missing optionSet = warning not rejection, load order implementation-defined with last-loaded wins, unrecognized non-x type = warning + treat as related, must preserve x-prefixed properties on round-trip, ontology binding takes precedence over registry concept entry, ontology vocabulary binding takes precedence over registry vocabulary entry. | Extended processor, targetDefinition.url match, compatibleVersions, defaultSystem resolution, last-loaded wins, merge semantics, warning vs error, round-trip preservation, precedence over registry | Implementing a conformant ontology-aware processor |

### Section 9: Schema (Lines 592-598)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 9 | Schema | Placeholder for schema-ref generated table from schemas/ontology.schema.json. | ontology.schema.json, schema-ref | Looking up the machine-readable structural contract |

### Section 10: Security Considerations (Lines 601-608)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 10 | Security Considerations | Five security concerns: (1) URI resolution -- concept URIs are identifiers not fetch targets, use allowlists for enrichment; (2) JSON-LD context injection -- validate context structure, restrict to trusted patterns; (3) Alignment target trust -- system values don't authenticate, verify provenance; (4) Document provenance -- untrusted sources could inject misleading metadata; (5) Information disclosure -- concept URIs may reveal domain/data model details. | URI resolution, allowlist, JSON-LD injection, alignment trust, document provenance, information disclosure | Understanding security implications of ontology document handling |

### Section 11: Complete Example (Lines 611-713)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 11 | Complete Example | Full end-to-end JSON example of a clinical intake FHIR R4 ontology overlay including all features: targetDefinition with version range, publisher, defaultSystem, four concept bindings (mrn, dob, gender, ssn with equivalents), two vocabulary bindings (ICD-10 with filter, administrative-gender), five alignments (FHIR and schema.org with bidirectional and notes), and JSON-LD context fragment. | Clinical intake, FHIR R4, complete example, all features | Using as a template for creating ontology documents |

### Appendices (Lines 717-782)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| Appendix A | References | Seven normative/informative references: RFC 2119, RFC 8174, RFC 8259 (JSON), RFC 3986 (URI), RFC 3987 (IRI), SKOS (W3C), JSON-LD 1.1 (W3C). | RFC references, SKOS, JSON-LD, IRI | Looking up underlying standards |
| Appendix B | Relationship to OWL and the Semantic Web | Detailed discussion of what this spec shares with OWL (IRI-based identity, SKOS alignment vocabulary, JSON-LD bridge) and what it does NOT do (no open-world assumption, no logical reasoning, no class hierarchy, no property restrictions). States that tooling MAY generate derived OWL/RDFS from ontology documents but round-trip fidelity is not guaranteed. | OWL-integrative, IRI, SKOS, JSON-LD bridge, closed-world, no reasoning, no class hierarchy, no property restrictions, derived OWL output | Understanding the philosophical and technical boundary between this spec and OWL/RDF |

## Cross-References

| Referenced Spec/Standard | Context |
|--------------------------|---------|
| Formspec v1.0 Core Specification | Parent spec. Ontology Document is a companion that does not modify the core processing model. `semanticType` property on Field items is defined in Core as a domain annotation that is purely metadata. |
| Formspec v1.0 Core Section 4.3.3 (Bind.path) | Path syntax for concept binding keys, vocabulary binding keys, and alignment field values. Referenced in Sections 2.3, 3, and 5. |
| Extension Registry Specification Section 3.2 | Registry `concept` and `vocabulary` entry categories. Registry-published concepts provide org-level metadata; Ontology Document provides per-form overrides. Referenced in Section 1.0.1. |
| schemas/ontology.schema.json | Governs the structural contract for Ontology Documents. Referenced in Section 9 schema-ref block and BLUF. |
| Theme Document | Mentioned as an analogous sidecar document that lives alongside the Definition. Referenced in Abstract. |
| Component Document | Mentioned as an analogous sidecar document. Referenced in Abstract. |
| References Document | Mentioned as an analogous sidecar document with similar "pure metadata" property. Referenced in Section 1.1. |
| Definition Document (optionSets) | Vocabulary binding keys must match names in the Definition's optionSets. Referenced in Sections 4 and 4.3. |
| RFC 2119 / RFC 8174 (BCP 14) | Keyword interpretation for requirement levels (MUST, SHOULD, etc.). Referenced in Conventions section. |
| RFC 8259 | JSON syntax and data types. Referenced in Conventions section. |
| RFC 3986 | URI syntax. Referenced in Conventions section. |
| RFC 3987 | IRI syntax. Referenced in Conventions section. |
| SKOS (W3C Recommendation) | Source of relationship type vocabulary (exactMatch, closeMatch, broadMatch, narrowMatch, relatedMatch). Referenced in Sections 3.2, Appendix B. |
| JSON-LD 1.1 (W3C Recommendation) | Context fragment format and linked data bridge. Referenced in Section 6 and Appendix B. |
| OWL / RDF / RDFS | Appendix B discusses the relationship: OWL-integrative not OWL-compatible. Tooling MAY generate derived OWL/RDFS. |
| schema.org | Used in examples as a concept system (birthDate, gender, taxID). |
| FHIR R4 (HL7) | Used in examples as a concept/alignment system (Patient.identifier, Patient.birthDate, Patient.gender). |
| ICD-10 (WHO) | Used in examples as a vocabulary system for diagnosis codes. |

## Quick Reference: SKOS Relationship Types

| Type | SKOS Equivalent | Direction | Meaning |
|------|-----------------|-----------|---------|
| `exact` | `skos:exactMatch` | Symmetric | Identical concept. **Default when type is omitted.** |
| `close` | `skos:closeMatch` | Symmetric | Very similar but not identical. |
| `broader` | `skos:broadMatch` | Source is more specific than target | e.g., SSN -> taxID |
| `narrower` | `skos:narrowMatch` | Source is more general than target | Inverse of broader |
| `related` | `skos:relatedMatch` | Associative | Related but not hierarchically |
| `x-*` | Custom | Custom | Must be x-prefixed |

## Quick Reference: Resolution Cascade

| Priority | Source | Scope | When Used |
|----------|--------|-------|-----------|
| 1 (highest) | Ontology Document `concepts` binding | Per-form, per-path | Tooling that loads ontology documents |
| 2 | Registry concept entry (matching `semanticType`) | Org-level, per-semanticType | Tooling that loads registries but not ontology documents |
| 3 (lowest) | Raw `semanticType` literal | Per-field, inline | Processors with neither registries nor ontology documents |

## Quick Reference: Property Layering Stack

| Layer | Property | Source Document | Purpose |
|-------|----------|-----------------|---------|
| Structural | `dataType` | Definition | Type constraint (string, date, money) |
| Annotation | `semanticType` | Definition | Freeform domain meaning |
| Extension | `x-formspec-*` | Registry | Validation constraints + presentation |
| Concept (shared) | concept entry | Registry | Shared concept identity + equivalences |
| Vocabulary (shared) | vocabulary entry | Registry | Shared terminology + version tracking |
| Concept (per-form) | Concept Binding | Ontology Document | Path-based concept binding |
| Vocabulary (per-form) | Vocabulary Binding | Ontology Document | Per-form valueMap + metadata |
| Alignment | Alignment | Ontology Document | Typed cross-system field relationships |

## Critical Behavioral Rules

1. **Ontology metadata is pure metadata -- it MUST NOT affect processing.** An Ontology Document MUST NOT alter data capture, validation, calculation, or any behavioral semantics. A processor that does not understand ontology documents MUST ignore them without error. Ontology metadata MUST NOT appear in Response data. (Sections 1.1 principle 5, 8.1)

2. **Ontology Document binding takes precedence over registry concept entries.** When a field has both a registry concept entry (via semanticType match) and an Ontology Document binding for the same path, the ontology binding wins for concept identity. The registry entry MAY still provide supplementary metadata not overridden by the ontology binding. (Section 3.4, 8.2)

3. **Last-loaded document wins for same-path concept bindings.** Load order of multiple Ontology Documents is implementation-defined. When multiple documents bind the same path, the last-loaded binding takes precedence. Vocabulary bindings merge additively (last-loaded overrides for same option set name). Alignments concatenate. (Section 8.2)

4. **targetDefinition.url mismatch is a hard stop.** An Extended processor MUST verify that `targetDefinition.url` matches the loaded Definition's `url`. On mismatch, the processor MUST NOT apply the ontology bindings and SHOULD emit an error. This is stricter than version mismatch, which is warn-and-continue. (Section 8.2)

5. **Missing item paths and option set names produce warnings, not errors.** When a concept binding references a Definition path that does not exist, or a vocabulary binding references a nonexistent option set, the processor MUST emit a warning but MUST NOT reject the document. This supports forward compatibility and multi-version ontology documents. (Sections 2.3, 8.2)

6. **FEL expressions MUST NOT appear anywhere in an Ontology Document.** All ontology property values are static. No calculated values, no conditional expressions, no dynamic content. (Section 2.3)

7. **Absent equivalents type defaults to "exact" as a processing-model rule.** When an equivalent omits the `type` property, processors MUST treat the relationship as `exact`. This is a processing-model default, not a JSON Schema `default` -- the property is genuinely absent in the document. (Section 3.1)

8. **Unrecognized non-x-prefixed relationship types fall back to "related".** An Extended processor that encounters an unrecognized relationship type that does not start with `x-` SHOULD emit a warning and treat it as `"related"`. Custom types MUST use the `x-` prefix. (Sections 3.2, 8.2)

9. **x-prefixed properties MUST be preserved on round-trip.** Both at the document root and within individual binding objects, unrecognized `x-`-prefixed properties MUST survive serialization/deserialization cycles. (Sections 2.3, 8.2)

10. **defaultSystem provides a fallback for concept bindings that omit system.** When a concept binding does not include a `system` property, the document-level `defaultSystem` URI is used. An Extended processor MUST resolve this fallback. (Section 2, 8.2)

11. **Vocabulary bindings do NOT replace option set values.** They are a metadata overlay: terminology version tracking, cross-vocabulary alignment, hierarchical context, and code normalization via valueMap. The Definition's option set values remain the structural truth. (Section 4.3)

12. **Dynamic option sources (choicesFrom) are out of scope.** Vocabulary Bindings target static optionSets only. Dynamic vocabulary resolution is the host environment's responsibility, not the ontology document's. (Section 4.4)

13. **Concept URIs are identifiers, not fetch targets.** Processors MUST NOT blindly dereference concept URIs. Implementations that resolve URIs for enrichment SHOULD maintain an allowlist of trusted domains. (Section 10)

14. **JSON-LD context injection is a security concern.** The context @context property could inject unexpected @type or @id mappings. Implementations that apply contexts to response data MUST validate the structure and SHOULD restrict to trusted patterns. (Section 10)
