# Ontology Schema Reference Map

> schemas/ontology.schema.json -- 429 lines -- Formspec Ontology Document

## Overview

The Ontology schema defines a standalone sidecar document that attaches semantic concept identifiers, cross-system equivalences, vocabulary bindings, and alignment metadata to a Formspec Definition. Like Theme, Component, and References documents, an Ontology Document targets a Definition but lives alongside it -- it does not alter core behavioral semantics (required, relevant, readonly, calculate, validation). Multiple Ontology Documents MAY target the same Definition (e.g., different domains, standards bodies, or interoperability contexts). All ontology property values are static -- FEL expressions MUST NOT appear in any ontology property.

## Top-Level Structure

| Property | Type | Required | Description |
|---|---|---|---|
| `$formspecOntology` | `string` (const `"1.0"`) | Yes | Ontology specification version. MUST be `"1.0"`. |
| `$schema` | `string` (format: `uri`) | No | Optional JSON Schema URI for editor validation and autocompletion. |
| `version` | `string` (minLength: 1) | Yes | Version of this Ontology Document. |
| `url` | `string` (format: `uri`) | No | Canonical URI identifier for this Ontology Document. |
| `name` | `string` (pattern: `^[a-zA-Z][a-zA-Z0-9_\-]*$`) | No | Machine-readable short name. Letters, digits, hyphens, underscores; must start with a letter. |
| `targetDefinition` | `$ref: TargetDefinition` (from component schema) | Yes | Binding to the target Formspec Definition and optional compatibility range. |
| `title` | `string` | No | Human-readable name for this Ontology Document. |
| `description` | `string` | No | Human-readable description of this document's purpose and scope. |
| `publisher` | `$ref: #/$defs/Publisher` | No | Organization publishing this ontology document. |
| `published` | `string` (format: `date-time`) | No | ISO 8601 timestamp indicating when this ontology document was published. |
| `defaultSystem` | `string` (format: `uri`) | No | Default concept system URI. Applied when a concept binding omits `system`. |
| `concepts` | `object` (additionalProperties: `$ref: ConceptBinding`) | No | Map of item paths to Concept Bindings. Keys use the same path syntax as Bind.path in Core. |
| `vocabularies` | `object` (additionalProperties: `$ref: VocabularyBinding`) | No | Map of option set names to Vocabulary Bindings. Keys match names in the Definition's optionSets. |
| `alignments` | `array` of `$ref: Alignment` | No | Array of cross-system alignment declarations. Each declares a typed relationship between a Definition field and an external concept. |
| `context` | `object` | No | JSON-LD context fragment for response export. Enables form responses to participate in linked data ecosystems. |
| `extensions` | `object` (propertyNames: `^x-`) | No | Document-level extension properties. All keys MUST be x-prefixed. |

The root object has `additionalProperties: false` with a `patternProperties` allowance for `^x-` prefixed properties.

### context Sub-Properties

| Property | Type | Description |
|---|---|---|
| `@context` | `oneOf: string, object, array` | JSON-LD @context fragment. When applied to a response document, makes the response a valid JSON-LD document. May be a URI string, a context object, or an array of both. |

`context` has `additionalProperties: false`.

## Key Type Definitions ($defs)

| Definition | Description | Key Properties | Used By |
|---|---|---|---|
| **Publisher** | Organization publishing this ontology document. | `name` (required), `url` (required, format: uri), `contact` | `properties.publisher` |
| **ConceptBinding** | Associates a Definition item with a concept in an external ontology or standard. | `concept` (required, format: uri), `system` (format: uri), `display`, `code`, `equivalents` (array of ConceptEquivalent) | `properties.concepts` (as additionalProperties) |
| **ConceptEquivalent** | Declares that the bound concept is equivalent to a concept in another system. | `system` (required, format: uri), `code` (required), `display`, `type` | `ConceptBinding.equivalents` items |
| **VocabularyBinding** | Associates a named option set with an external terminology system. | `system` (required, format: uri), `version`, `display`, `filter` ($ref: VocabularyFilter), `valueMap` (object, additionalProperties: string) | `properties.vocabularies` (as additionalProperties) |
| **VocabularyFilter** | Constrains which portion of a terminology is in scope for this option set. | `ancestor`, `maxDepth` (integer, minimum: 1), `include` (array of string, minItems: 1), `exclude` (array of string, minItems: 1) | `VocabularyBinding.filter` |
| **Alignment** | Declares a typed relationship between a Definition field and a concept in an external system. | `field` (required, minLength: 1), `target` (required, object), `type` (required), `bidirectional` (boolean), `notes` | `properties.alignments` items |

## Required Fields

### Top-Level (Ontology Root)
- `$formspecOntology`, `version`, `targetDefinition`

### Publisher
- `name`, `url`

### ConceptBinding
- `concept`

### ConceptEquivalent
- `system`, `code`

### VocabularyBinding
- `system`

### Alignment
- `field`, `target`, `type`

### Alignment.target (inline object)
- `system`, `code`

## Enums and Patterns

| Property Path | Type | Values/Pattern | Description |
|---|---|---|---|
| `$formspecOntology` | const | `"1.0"` | Fixed ontology specification version. |
| `name` | pattern | `^[a-zA-Z][a-zA-Z0-9_\-]*$` | Machine-readable short name; letters, digits, hyphens, underscores; must start with a letter. |
| `extensions` (propertyNames) | pattern | `^x-` | All extension keys must be x-prefixed. |
| `ConceptEquivalent.type` | string (documented enum) | `exact`, `close`, `broader`, `narrower`, `related`; custom types MUST be `x-` prefixed | SKOS-inspired relationship type. When absent, processors MUST treat as `exact`. |
| `Alignment.type` | string (documented enum) | `exact`, `close`, `broader`, `narrower`, `related`; custom types MUST be `x-` prefixed | SKOS-inspired relationship type qualifying the nature of the alignment. |

Note: `ConceptEquivalent.type` and `Alignment.type` are not schema-level `enum` constraints -- they are documented convention with examples. Custom x-prefixed values are permitted.

## Cross-References

- **`targetDefinition`** uses `$ref: "https://formspec.org/schemas/component/1.0#/$defs/TargetDefinition"` from the Component schema. This is the same binding mechanism used by Theme and Component documents to declare which Definition they target.
- **`concepts` keys** use the same path syntax as `Bind.path` in Core spec section 4.3.3 (dot notation for nesting, `[*]` for all repeat instances).
- **`vocabularies` keys** match names in the Definition's `optionSets` property.
- **`context.@context`** bridges to the JSON-LD ecosystem, enabling form responses to become valid linked data documents.
- **`ConceptEquivalent.type` and `Alignment.type`** use SKOS-inspired relationship vocabulary (exact, close, broader, narrower, related).
- Ontology metadata MUST NOT alter core behavioral semantics defined in the Core spec (required, relevant, readonly, calculate, validation).

## Extension Points

- **Root-level `patternProperties`**: `^x-` allows arbitrary extension properties at the document root.
- **`extensions` property**: Dedicated object for document-level extensions. All keys MUST be x-prefixed (`propertyNames: { "pattern": "^x-" }`).
- **`ConceptEquivalent.type`**: Custom relationship types MUST be x-prefixed (e.g., `"x-domain-specific-relationship"`).
- **`Alignment.type`**: Custom alignment types MUST be x-prefixed.

All $defs objects (Publisher, ConceptBinding, ConceptEquivalent, VocabularyBinding, VocabularyFilter, Alignment, Alignment.target) have `additionalProperties: false` -- no extension properties are allowed within type definitions themselves.

## Validation Constraints

- **`$formspecOntology`**: `const: "1.0"` -- must be exactly the string `"1.0"`.
- **`version`**: `minLength: 1` -- cannot be an empty string.
- **`name`**: `pattern: "^[a-zA-Z][a-zA-Z0-9_\\-]*$"` -- must start with a letter, followed by letters, digits, underscores, or hyphens.
- **`$schema`**, **`url`**, **`defaultSystem`**: `format: "uri"`.
- **`published`**: `format: "date-time"` -- ISO 8601 timestamp.
- **`ConceptBinding.concept`**: `format: "uri"` -- globally unique concept identifier.
- **`ConceptBinding.system`**, **`ConceptEquivalent.system`**, **`VocabularyBinding.system`**, **`Alignment.target.system`**: `format: "uri"`.
- **`Publisher.url`**: `format: "uri"`.
- **`VocabularyFilter.maxDepth`**: `type: "integer"`, `minimum: 1`.
- **`VocabularyFilter.include`**: `minItems: 1` -- if present, must contain at least one code.
- **`VocabularyFilter.exclude`**: `minItems: 1` -- if present, must contain at least one code.
- **`Alignment.field`**: `minLength: 1` -- cannot be an empty string.
- **`VocabularyBinding.valueMap`**: `additionalProperties: { "type": "string" }` -- all values must be strings (maps option values to terminology codes).
- **`context`**: `additionalProperties: false` -- only `@context` is allowed inside.
- **`context.@context`**: `oneOf: [string, object, array]` -- polymorphic JSON-LD context (URI string, context object, or array of both).
- **Root**: `additionalProperties: false` with `patternProperties: { "^x-": {} }` -- only declared properties and x-prefixed extensions allowed.

## x-lm Critical Annotations

The following properties are marked `x-lm.critical: true`, meaning they MUST include both `description` and at least one `examples` entry per the spec authoring contract:

| Property Path | Intent |
|---|---|
| `$formspecOntology` | Version pin for ontology document compatibility. |
| `version` | Revision identifier for the ontology document. |
| `targetDefinition` | Declares which Definition this ontology document is designed for. |
| `defaultSystem` | Behavioral default that determines concept system for bindings that omit system. |
| `concepts` | The concept bindings that connect Definition fields to external ontology concepts. |
| `vocabularies` | Vocabulary bindings that connect option sets to external terminology systems. |
| `alignments` | Explicit alignment declarations for cross-form and cross-system data interoperability. |
| `context.@context` | The JSON-LD bridge that enables form responses to participate in linked data ecosystems. |
| `ConceptBinding.concept` | The globally unique identifier for the concept this field represents. |
| `VocabularyBinding.system` | Identifies which external terminology system this option set comes from. |
| `Alignment.field` | Identifies which Definition field this alignment applies to. |
| `Alignment.target` | Identifies the concept in the external system that this field aligns with. |
| `Alignment.type` | Qualifies the nature of the alignment -- identical concept, broader, narrower, or related. |
