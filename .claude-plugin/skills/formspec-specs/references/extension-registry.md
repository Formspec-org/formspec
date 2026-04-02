# Extension Registry Specification Reference Map

> specs/registry/extension-registry.md -- 584 lines, ~24K -- Companion: Extension Publishing, Discovery, Lifecycle

## Overview

The Extension Registry specification defines a static JSON document format for publishing, discovering, and validating Formspec extensions and semantic metadata. It is a companion to the Formspec v1.0 core specification Section 8, which defines extension categories with `x-` prefixed identifiers but deliberately leaves publication and discovery out of scope. This spec fills that gap with a machine-readable catalog format, naming rules, a well-known URL discovery mechanism, a four-state lifecycle model, and conformance requirements for registry-aware processors. It covers seven entry categories: the five original extension categories (dataType, function, constraint, property, namespace) plus two ontology-tier categories (concept, vocabulary) that carry pure metadata without affecting the processing model.

## Section Map

### Front Matter (Lines 1-63)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| Abstract | Abstract | Defines what a Registry Document is: a JSON catalog of named entries with metadata, version history, compatibility bounds, and schemas. Clarifies this is a static document format, not a runtime service. Enumerates all seven entry categories including concept identities and vocabulary bindings. | Registry Document, extension categories (dataType, function, constraint, property, namespace, concept, vocabulary), machine-readable schemas, semantic metadata | Understanding the purpose and scope of the registry spec |
| Status | Status of This Document | Draft status disclaimer. States this is a companion to core v1.0 and does not modify core extension mechanisms from Section 8. | Draft specification, companion document | Checking spec maturity level |
| Conventions | Conventions and Terminology | Defines RFC 2119/8174 keyword interpretation, JSON/URI/Semver standards, and three new terms. Inherits terms from Formspec v1.0. | Registry Document, Registry Entry, Registry-aware processor, conformant processor | Looking up what a term means |
| BLUF | Bottom Line Up Front | Four-bullet summary: defines registry format, required top-level fields, purpose of entries, and governing schema. | `$formspecRegistry`, `publisher`, `published`, `entries` | Quick orientation on what the spec requires |

### 1. Purpose and Scope (Lines 66-86)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 1 | Purpose and Scope | Enumerates the six things this spec defines (entry format, document format, naming rules, discovery, lifecycle, conformance) and what it explicitly does NOT define (centralized service, governance board). Any organization MAY publish its own Registry Document; interoperability comes from the common format, not centralized authority. | Decentralized publishing, organizational autonomy, six deliverables | Understanding what is and is not in scope |

### 2. Registry Document Format (Lines 89-117)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 2 | Registry Document Format | Defines the top-level JSON structure with six properties via a schema-ref generated table as the canonical structural contract. Four required fields: `$formspecRegistry` (must be "1.0"), `publisher`, `published` (ISO 8601), `entries` (array). Two optional: `$schema`, `extensions` (vendor metadata, x-prefixed keys). Within a document, the (name, version) tuple MUST be unique. | `$formspecRegistry`, `$schema`, `entries`, `publisher`, `published`, `extensions`, (name,version) uniqueness | Building or validating a registry document's top-level structure |
| 2.1 | Publisher Object | Defines the publisher sub-object schema: `name` (required, string), `url` (required, URI), `contact` (optional, email or URI). Used at both document and entry level. | Publisher, name, url, contact | Constructing or validating publisher metadata |

### 3. Registry Entry Format (Lines 119-213)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 3 | Registry Entry Format | Defines the full property set for each entry in the `entries` array. Thirteen properties covering identity, lifecycle, compatibility, documentation, and extensibility. Entry-level `publisher` overrides document-level publisher for that entry only. `deprecationNotice` is conditionally required when status is "deprecated". | name, category, version, status, publisher (override), description, specUrl, schemaUrl, compatibility, license (SPDX), deprecationNotice, examples, extensions | Creating or validating a single registry entry |
| 3.1 | Compatibility Object | Defines the version compatibility bounds sub-object: `formspecVersion` (required, semver range) and `mappingDslVersion` (optional, semver range). | formspecVersion, mappingDslVersion, semver range | Specifying or checking which Formspec versions an extension supports |
| 3.2 | Category-Specific Properties | Defines additional required/optional properties per category for all seven categories. `dataType`: baseType (required), constraints, metadata. `function`: parameters (required), returns (required). `constraint`: parameters (required). `property`: no additional required (schemaUrl recommended). `namespace`: members (optional, array of x-prefixed names). `concept`: conceptUri (required), conceptSystem (recommended), conceptCode, equivalents (with SKOS relationship types), metadata. `vocabulary`: vocabularySystem (required), vocabularyVersion (recommended), filter (subset constraints), metadata. Concept and vocabulary entries MUST NOT affect the processing model. | baseType, constraints, metadata, parameters, returns, members, conceptUri, conceptSystem, conceptCode, equivalents, SKOS semantics, vocabularySystem, vocabularyVersion, filter, semanticType | Adding category-specific fields to an entry, understanding what is required per category, building ontology-tier entries |

### 4. Naming Rules (Lines 216-249)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 4 | Naming Rules | Six normative rules: (1) all identifiers must start with `x-`, (2) regex pattern `^x-[a-z][a-z0-9]*(-[a-z][a-z0-9]*)*$`, (3) `x-formspec-` prefix reserved for future core promotion, (4) (name,version) uniqueness within a document, (5) cross-registry collision avoidance via `x-{org}-{domain}` pattern, (6) concept entries SHOULD use `x-onto-` prefix and vocabulary entries SHOULD use `x-vocab-` prefix (advisory). | x- prefix, naming regex, x-formspec- reservation, uniqueness constraint, org-domain pattern, x-onto- prefix, x-vocab- prefix | Choosing extension names, validating identifiers, resolving naming conflicts, naming concept/vocabulary entries |

### 5. Discovery (Lines 252-273)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 5 | Discovery | Defines the well-known URL convention `https://{host}/.well-known/formspec-extensions.json`. Four requirements: Content-Type must be application/json, must be valid Registry Document, should support conditional GET, processors may also accept URIs from config/CLI/Definition metadata. The well-known URL is OPTIONAL (SHOULD-level). | Well-known URL, .well-known/formspec-extensions.json, conditional GET, Content-Type | Implementing automated extension discovery, serving a registry document |

### 6. Extension Lifecycle (Lines 276-297)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 6 | Extension Lifecycle | Defines four lifecycle states (draft, stable, deprecated, retired) and normative transition rules. Includes ASCII state diagram. Key rules: transitions must not skip states, deprecated requires deprecationNotice, retired triggers processor warnings, new major version may re-enter draft. The draft-to-stable transition means the interface is frozen for the given major version. | draft, stable, deprecated, retired, deprecationNotice, state transitions, no-skip rule, interface freeze | Managing extension maturity, deprecating or retiring extensions, understanding what warnings processors must emit |

### 7. Conformance (Lines 299-349)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 7 | Conformance | Eight numbered conformance requirements for registry-aware processors: (1) Loading/parsing against Appendix A schema, (2) Resolution by name+category from configured Registry Documents, (3) Compatibility version check (mismatch = warning unless x-formspec-strict), (4) Status enforcement (retired = warning, deprecated = info), (5) Schema validation via schemaUrl, (6) Unresolved extensions must emit UNRESOLVED_EXTENSION error (enabled only, disabled extensions exempt), (7) Concept resolution: semanticType matching loaded concept entries makes concept metadata available to downstream tooling (unresolved semanticType is NOT an error), (8) Vocabulary resolution: vocabulary entries complement Ontology Document bindings with shared terminology metadata, Ontology Document values take precedence when both present. | Registry-aware processor, resolution, compatibility check, status enforcement, schema validation, UNRESOLVED_EXTENSION, x-formspec-strict, enabled vs disabled extensions, concept resolution, semanticType, vocabulary resolution, Ontology Document precedence | Implementing a conformant registry-aware processor, understanding error/warning emission rules, handling concept and vocabulary resolution |

### 8. Examples (Lines 351-430)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 8 | Examples | Introductory heading for worked examples. | -- | -- |
| 8.1 | Registry Document with Two Entries | Complete JSON example: a `namespace` entry (x-gov-grants, stable, with members array) and a `dataType` entry (x-currency-usd, stable, extending decimal with constraints and metadata). Demonstrates publisher, compatibility, license, examples fields. | x-gov-grants, x-currency-usd, namespace members, dataType baseType/constraints/metadata | Understanding how a real registry document looks, using as a template |

### Appendices (Lines 434-585)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| Appendix A | Registry Entry JSON Schema | Full JSON Schema for a single Registry Entry. Defines all properties, the naming regex, category-conditional requirements via `allOf`/`if`/`then` (dataType requires baseType; function requires parameters+returns; constraint requires parameters; deprecated status requires deprecationNotice), the Publisher `$def`, and `additionalProperties: false`. This is the machine-readable contract. Note: the Appendix A schema covers the five original extension categories; concept and vocabulary category-specific properties are defined by the Ontology specification. | JSON Schema, allOf conditional requirements, $defs/publisher, additionalProperties:false, category enum (5 values in schema) | Programmatic validation of registry entries, understanding exact type constraints and conditional requirements |
| Appendix B | References | Normative and informative references: RFC 2119, RFC 8174, RFC 8259 (JSON), RFC 3986 (URI), Semver 2.0.0, SPDX License List, RFC 8615 (Well-Known URIs). | RFC references, Semver, SPDX, Well-Known URIs | Looking up underlying standards |

## Cross-References

| Referenced Spec / Resource | Context |
|----------------------------|---------|
| Formspec v1.0 Section 8 | Core extension mechanism: defines the extension categories and the `x-` prefix requirement. This registry spec is explicitly a companion to Section 8. |
| Formspec v1.0 Section 8.1 | Custom data types -- referenced in category-specific properties for `dataType` entries (baseType, constraints, metadata). |
| Formspec v1.0 Section 8.2 | Custom functions -- referenced in category-specific properties for `function` entries (parameters, returns). |
| Formspec v1.0 Section 8.3 | Custom validation constraints -- referenced in category-specific properties for `constraint` entries (parameters). |
| Formspec v1.0 Section 8.4 | Extension properties -- referenced in category-specific properties for `property` entries. |
| Formspec v1.0 Section 8.5 | Extension namespaces -- referenced for namespace entries (members) and the `x-{org}-{domain}` naming pattern. |
| Formspec v1.0 Section 1 | Defines "conformant processor" -- reused in Section 7 conformance requirements. |
| Formspec v1.0 Section 2.4 | Referenced in the note on concept/vocabulary entries: they MUST NOT affect the processing model defined in Section 2.4. |
| Ontology specification | Concept entries (category `concept`) and vocabulary entries (category `vocabulary`) are defined by the Ontology specification. Section 3.2 references it for both category-specific property sets. |
| Ontology Document vocabulary bindings | Section 7 rule 8 states vocabulary registry entries complement Ontology Document vocabulary bindings. Ontology Document values take precedence when both are present. |
| schemas/registry.schema.json | Governs the structural contract for registry documents. Referenced in the BLUF and Section 2 schema-ref block. |
| Mapping DSL | Referenced in compatibility object (Section 3.1) -- `mappingDslVersion` allows declaring compatibility with Mapping DSL versions. |
| SKOS semantics | Concept entry `equivalents` relationship types follow SKOS semantics: exact, close, broader, narrower, related. Custom types MUST be `x-`-prefixed. (Section 3.2, concept category) |

## Key Schemas Defined

| Schema | Location | Purpose |
|--------|----------|---------|
| Registry Document (top-level) | Section 2 (schema-ref generated table) + `schemas/registry.schema.json` | Top-level structure: `$formspecRegistry`, `$schema`, `publisher`, `published`, `entries`, `extensions` |
| Publisher | Section 2.1 + Appendix A `$defs/publisher` | Reusable sub-object: `name` (required), `url` (required), `contact` (optional) |
| Registry Entry | Section 3 + Appendix A (full JSON Schema) | Per-entry structure: identity, category, version, status, compatibility, documentation, category-specific fields |
| Compatibility | Section 3.1 + Appendix A | Version bounds: `formspecVersion` (required semver range), `mappingDslVersion` (optional) |
| Category-specific conditional schemas | Section 3.2 + Appendix A `allOf` | `dataType` requires `baseType`; `function` requires `parameters` + `returns`; `constraint` requires `parameters`; `deprecated` status requires `deprecationNotice` |

## Extension Categories Quick Reference

| Category | Required Category Properties | Optional Category Properties | Source Spec |
|----------|------------------------------|------------------------------|-------------|
| `dataType` | `baseType` | `constraints`, `metadata` | Core v1.0 Section 8.1 |
| `function` | `parameters`, `returns` | -- | Core v1.0 Section 8.2 |
| `constraint` | `parameters` | -- | Core v1.0 Section 8.3 |
| `property` | -- | `schemaUrl` (recommended) | Core v1.0 Section 8.4 |
| `namespace` | -- | `members` | Core v1.0 Section 8.5 |
| `concept` | `conceptUri` | `conceptSystem`, `conceptCode`, `equivalents`, `metadata` | Ontology spec |
| `vocabulary` | `vocabularySystem` | `vocabularyVersion`, `filter`, `metadata` | Ontology spec |

## Lifecycle State Transitions

| From | To | Rule |
|------|----|------|
| draft | stable | Publisher asserts interface is frozen for the given major version |
| stable | deprecated | Publisher MUST provide `deprecationNotice`; SHOULD identify replacement |
| deprecated | retired | Publisher asserts extension SHOULD NOT be used; MAY stop supporting it |
| (any) | draft | New version with incremented major version MAY re-enter draft |
| draft | ~~deprecated~~ | FORBIDDEN -- transitions MUST NOT skip states |
| stable | ~~retired~~ | FORBIDDEN -- transitions MUST NOT skip states |

## Critical Behavioral Rules

1. **UNRESOLVED_EXTENSION is an error, not a warning.** When an item declares `"extensions": { "x-example": true }` and no matching registry entry is found, processors MUST emit an error with code `UNRESOLVED_EXTENSION`. This is the strictest enforcement in the spec. Disabled extensions (`false`) are exempt. (Section 7, rule 6)

2. **Lifecycle transitions must not skip states.** An extension cannot jump from `draft` to `deprecated` or from `stable` to `retired`. The only valid transitions are: draft->stable, stable->deprecated, deprecated->retired, and any state can re-enter draft with a new major version. (Section 6)

3. **`deprecationNotice` is conditionally required.** When `status` is `"deprecated"`, the `deprecationNotice` string is REQUIRED (enforced via JSON Schema `allOf`/`if`/`then`). (Section 3, Section 6)

4. **Compatibility mismatch is a warning, not an error** -- unless `"x-formspec-strict": true` is present in the entry's `extensions`, in which case it SHOULD be a hard error. (Section 7, rule 3)

5. **`x-formspec-` prefix is reserved.** Third-party publishers must not register identifiers starting with `x-formspec-`. This prefix is reserved for extensions that may be promoted into future core versions. (Section 4, rule 3)

6. **Name+version uniqueness is per-document.** Within a single Registry Document, no two entries may share the same `(name, version)` tuple. Cross-document conflicts are resolved by publisher authority, not by any global uniqueness rule. (Section 4, rules 4-5)

7. **Extension identifier regex is strict.** Names must match `^x-[a-z][a-z0-9]*(-[a-z][a-z0-9]*)*$` -- lowercase ASCII only, hyphen-separated segments, each segment starts with a letter. No uppercase, no underscores, no dots. (Section 4, rule 2)

8. **Entry-level publisher overrides document-level.** Each entry may include its own `publisher` object, which overrides the document-level publisher for that entry only. (Section 3)

9. **`retired` status triggers a warning; `deprecated` triggers an informational notice.** These are distinct severity levels with different conformance requirements (MUST vs SHOULD). (Section 7, rule 4)

10. **Discovery is optional.** The well-known URL `/.well-known/formspec-extensions.json` is a SHOULD-level recommendation. Processors may accept registry URIs from any source (config, CLI, Definition metadata). (Section 5, rule 4)

11. **`additionalProperties: false` on the entry schema.** The Appendix A schema disallows unrecognized properties on registry entries. All vendor-specific data must go in the `extensions` sub-object with x-prefixed keys. (Appendix A)

12. **Concept and vocabulary entries MUST NOT affect the processing model.** They are pure metadata consumed by ontology-aware tooling, data science pipelines, and interoperability layers -- not by the core form processing engine. (Section 3.2 note, referencing Formspec v1.0 Section 2.4)

13. **Unresolved semanticType is NOT an error.** When a field's `semanticType` does not match any loaded concept entry, the processor does not emit an error -- `semanticType` remains a freeform string for processors that do not support concept resolution. This is the opposite of the UNRESOLVED_EXTENSION rule. (Section 7, rule 7)

14. **Ontology Document values take precedence over registry vocabulary entries.** When both an Ontology Document vocabulary binding and a registry vocabulary entry provide metadata for the same system, the Ontology Document's values win. Registry entries provide defaults only. (Section 7, rule 8)

15. **Concept entries SHOULD use `x-onto-` prefix; vocabulary entries SHOULD use `x-vocab-` prefix.** This is advisory (SHOULD-level), not enforced by the naming regex. It distinguishes ontology-tier entries from extension entries by convention. (Section 4, rule 6)
