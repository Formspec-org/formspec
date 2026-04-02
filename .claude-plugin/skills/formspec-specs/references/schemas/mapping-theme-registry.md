# Mapping Schema Reference Map

> schemas/mapping.schema.json -- 817 lines -- Bidirectional data transformation DSL between Formspec Responses and external schemas

## Overview

The Mapping Document is a standalone JSON artifact that declares field-level correspondences, structural reorganizations, type coercions, value translations, and conditional logic sufficient to convert a Formspec Response into an API payload, database record, CSV export, or XML document, and to reverse that transformation when importing. All computed transforms use the Formspec Expression Language (FEL). The DSL generalizes the version-migration fieldMap from the core specification.

**$id**: `https://formspec.org/schemas/mapping/v1`

## Top-Level Structure

| Property | Type | Required | Description |
|---|---|---|---|
| `$formspecMapping` | string (const `"1.0"`) | **Yes** | Mapping specification version pin. MUST be `"1.0"` |
| `$schema` | string (uri) | No | URI identifying the Mapping DSL spec version |
| `version` | string (semver) | **Yes** | Semantic version of this Mapping Document (independent of definition version) |
| `definitionRef` | string (uri, minLength 1) | **Yes** | URI/stable identifier of the target Formspec Definition (matches Definition's `url`) |
| `definitionVersion` | string (minLength 1) | **Yes** | Semver range of compatible Definition versions (node-semver syntax). Processor MUST reject when out of range |
| `targetSchema` | TargetSchema | **Yes** | External system schema descriptor; determines adapter and path syntax |
| `direction` | string (enum) | No | Execution direction. Default: `"forward"` |
| `defaults` | object | No | Leaf values applied to target before rules execute (forward direction only) |
| `autoMap` | boolean | No | When true, generates synthetic `preserve` rules at priority -1 for uncovered fields. Default: `false` |
| `conformanceLevel` | string (enum) | No | Minimum conformance level required to process this mapping |
| `rules` | array of FieldRule (minItems 1) | **Yes** | Ordered array of Field Rule objects, sorted by priority descending |
| `adapters` | object | No | Adapter-specific config keyed by adapter identifier (`json`, `xml`, `csv`, or `x-` custom) |

**Top-level required**: `["$formspecMapping", "version", "definitionRef", "definitionVersion", "targetSchema", "rules"]`

**additionalProperties**: false
**patternProperties**: `"^x-": {}` (extension properties allowed)

## Key Type Definitions ($defs)

| Definition | Description | Key Properties | Used By |
|---|---|---|---|
| **TargetSchema** | External target schema descriptor | `format` (required), `name`, `url`, `rootElement`, `namespaces` | `targetSchema` property |
| **FieldRule** | Atomic field mapping rule | `sourcePath`, `targetPath`, `transform` (required), `expression`, `coerce`, `valueMap`, `reverse`, `bidirectional`, `condition`, `default`, `array`, `separator`, `description`, `priority`, `reversePriority` | `rules[]` items |
| **Coerce** | Type conversion descriptor | `from` (required), `to` (required), `format` | `FieldRule.coerce`, `InnerRule.coerce`, `ReverseOverride.coerce` |
| **ValueMap** | Lookup table for value substitution | `forward` (required), `reverse`, `unmapped`, `default` | `FieldRule.valueMap`, `InnerRule.valueMap`, `ReverseOverride.valueMap` |
| **ArrayDescriptor** | Array handling for repeat groups | `mode` (required), `separator`, `innerRules` | `FieldRule.array`, `InnerRule.array`, `ReverseOverride.array` |
| **InnerRule** | Field Rule within array context | Same as FieldRule + `index` property | `ArrayDescriptor.innerRules[]` |
| **ReverseOverride** | Reverse-direction override config | `transform`, `expression`, `coerce`, `valueMap`, `condition`, `default`, `bidirectional`, `array`, `separator`, `priority`, `reversePriority`, `description` | `FieldRule.reverse`, `InnerRule.reverse` |
| **JsonAdapter** | JSON format adapter config | `pretty`, `sortKeys`, `nullHandling` | `adapters.json` |
| **XmlAdapter** | XML format adapter config | `declaration`, `indent`, `cdata` | `adapters.xml` |
| **CsvAdapter** | CSV format adapter config | `delimiter`, `quote`, `header`, `encoding`, `lineEnding` | `adapters.csv` |

## Required Fields

**Document level**: `$formspecMapping`, `version`, `definitionRef`, `definitionVersion`, `targetSchema`, `rules`

**TargetSchema**: `format`

**FieldRule**: `transform` + at least one of `sourcePath` or `targetPath` (via anyOf)
- Conditional: when transform is `expression`/`constant`/`concat`/`split` -> `expression` required
- Conditional: when transform is `coerce` -> `coerce` required
- Conditional: when transform is `valueMap` -> `valueMap` required

**Coerce**: `from`, `to`

**ValueMap**: `forward`

**ArrayDescriptor**: `mode`

**InnerRule**: `transform` + at least one of `sourcePath` or `targetPath`
- Same conditional requirements as FieldRule

## Enumerations

| Enum | Values | Used By |
|---|---|---|
| `$formspecMapping` | `"1.0"` (const) | Top-level version pin |
| `direction` | `forward`, `reverse`, `both` | Top-level `direction` |
| `conformanceLevel` | `core`, `bidirectional`, `extended` | Top-level `conformanceLevel` |
| `targetSchema.format` | `json`, `xml`, `csv` (+ `x-` custom via pattern) | `TargetSchema.format` |
| `transform` | `preserve`, `drop`, `expression`, `coerce`, `valueMap`, `flatten`, `nest`, `constant`, `concat`, `split` | `FieldRule.transform`, `InnerRule.transform`, `ReverseOverride.transform` |
| `coerce` (shorthand) | `string`, `number`, `boolean`, `date`, `datetime`, `integer`, `array`, `object`, `money` | `FieldRule.coerce`, `InnerRule.coerce`, `ReverseOverride.coerce` (string form) |
| `Coerce.from` / `Coerce.to` | `string`, `number`, `boolean`, `date`, `datetime`, `integer`, `array`, `object`, `money` | `Coerce` object |
| `ValueMap.unmapped` | `error`, `drop`, `passthrough`, `default` | `ValueMap.unmapped` |
| `ArrayDescriptor.mode` | `each`, `whole`, `indexed` | `ArrayDescriptor.mode` |
| `nullHandling` | `include`, `omit` | `JsonAdapter.nullHandling` |
| `lineEnding` | `crlf`, `lf` | `CsvAdapter.lineEnding` |

## Cross-References

- Internal `$ref` usage: FieldRule, TargetSchema, Coerce, ValueMap, ArrayDescriptor, InnerRule, ReverseOverride, JsonAdapter, XmlAdapter, CsvAdapter all referenced via `#/$defs/...`
- No external `$ref` to other Formspec schemas
- FEL expressions referenced in: `FieldRule.expression`, `FieldRule.condition`, `InnerRule.expression`, `InnerRule.condition`, `ReverseOverride.expression`, `ReverseOverride.condition`
- `definitionRef` links to Definition `url` property
- `definitionVersion` uses semver range matching against Definition `version`

## Extension Points

- **Top-level**: `patternProperties: { "^x-": {} }` allows arbitrary extension properties
- **TargetSchema**: `patternProperties: { "^x-": {} }`, `additionalProperties: false`
- **TargetSchema.format**: accepts `x-` prefixed custom formats via `anyOf[{ pattern: "^x-" }]`
- **adapters**: `patternProperties: { "^x-": { type: "object" } }` for custom adapters
- **FieldRule**: `patternProperties: { "^x-": {} }`
- **InnerRule**: `patternProperties: { "^x-": {} }`
- **ReverseOverride**: `patternProperties: { "^x-": {} }`

## x-lm Annotations

| Path | critical | intent |
|---|---|---|
| `$formspecMapping` | true | Version pin for mapping document compatibility |
| `version` | true | Version identifier for the mapping document itself, independent of the definition version |
| `definitionRef` | true | Canonical identifier of the definition this mapping targets |
| `definitionVersion` | true | Compatibility window; processor MUST reject execution when definition version is out of range |
| `targetSchema` | true | Declares the output format and shape that transform rules must produce |
| `direction` | true | Controls whether forward, reverse, or bidirectional execution is permitted |
| `rules` | true | Declarative transform pipeline from source paths to target paths |
| `FieldRule` (def) | true | Atomic unit of the mapping -- binds a source path to a target path with a declared transform, condition, and reversibility |
| `FieldRule.transform` | true | Core discriminator that determines which properties are required and how the value flows from source to target |

## Validation Constraints

- **$formspecMapping**: `const: "1.0"` (exact value)
- **version**: pattern `^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$` (strict semver)
- **definitionRef**: minLength 1, format uri
- **rules**: minItems 1 (at least one rule required)
- **FieldRule**: anyOf `[{ required: ["sourcePath"] }, { required: ["targetPath"] }]` -- at least one path required
- **FieldRule conditional allOf**: three if/then blocks enforce `expression`, `coerce`, `valueMap` required based on `transform` value
- **InnerRule**: same anyOf and conditional allOf as FieldRule, plus `index` (integer, minimum 0) for indexed mode
- **TargetSchema conditional**: when `format = "xml"`, `rootElement` is required
- **targetPath**: type `["string", "null"]` -- allows null for drop rules
- **CsvAdapter**: delimiter/quote have `minLength: 1, maxLength: 1` (single character)
- **XmlAdapter.indent**: minimum 0
- **reversePriority**: minimum 0 (in both FieldRule and InnerRule)
- **All adapter types**: `additionalProperties: false`

---

# Theme Schema Reference Map

> schemas/theme.schema.json -- 658 lines -- Visual presentation sidecar for Formspec Definitions

## Overview

A Formspec Theme document is a sidecar JSON file that controls the visual presentation of a Formspec Definition without modifying it. It binds to a Definition by URL, overrides inline Tier 1 presentation hints through a three-level cascade (defaults -> selectors -> item overrides), assigns widgets with typed configuration and fallback chains, defines page layout on a 12-column grid, and provides design tokens for visual consistency. Multiple Theme documents may target the same Definition for platform-specific rendering. A Theme MUST NOT affect data collection, validation, or behavioral semantics.

**$id**: `https://formspec.org/schemas/theme/1.0`

## Top-Level Structure

| Property | Type | Required | Description |
|---|---|---|---|
| `$formspecTheme` | string (const `"1.0"`) | **Yes** | Theme specification version pin. MUST be `"1.0"` |
| `url` | string (uri) | No | Canonical theme identifier. Stable across versions; (url, version) should be globally unique |
| `version` | string (minLength 1) | **Yes** | Theme document version. SemVer recommended |
| `name` | string | No | Machine-friendly short identifier |
| `title` | string | No | Human-readable display name |
| `description` | string | No | Human-readable purpose/audience description |
| `targetDefinition` | TargetDefinition | **Yes** | Binding to target Definition URL and compatible version range |
| `platform` | string | No | Target rendering platform (informational). Well-known: `web`, `mobile`, `pdf`, `print`, `kiosk`, `universal` |
| `tokens` | Tokens | No | Design tokens -- named values (colors, spacing, typography) referenced via `$token.<key>` |
| `defaults` | PresentationBlock | No | Cascade level 1: form-wide baseline applied to every item |
| `selectors` | array of Selector | No | Cascade level 2: type/dataType-based presentation overrides |
| `items` | object (additionalProperties: PresentationBlock) | No | Cascade level 3: per-item overrides keyed by Definition item key |
| `pages` | array of PageLayout | No | Page layout with 12-column grid |
| `breakpoints` | Breakpoints | No | Named responsive breakpoints as min-width pixel values |
| `extensions` | object (propertyNames: `^x-`) | No | Vendor-specific extension metadata |
| `stylesheets` | array of string (uri-reference) | No | External CSS stylesheet URIs loaded in order |

**Top-level required**: `["$formspecTheme", "version", "targetDefinition"]`

**additionalProperties**: false

## Key Type Definitions ($defs)

| Definition | Description | Key Properties | Used By |
|---|---|---|---|
| **TargetDefinition** | Definition binding | External `$ref` to `component/1.0#/$defs/TargetDefinition` | `targetDefinition` |
| **Tokens** | Design token map | External `$ref` to `component/1.0#/$defs/Tokens` | `tokens` |
| **PresentationBlock** | Bundle of presentation properties | `widget`, `widgetConfig`, `labelPosition`, `style`, `accessibility`, `fallback`, `cssClass` | `defaults`, `selectors[].apply`, `items.*` |
| **AccessibilityBlock** | Accessibility metadata | External `$ref` to `component/1.0#/$defs/AccessibilityBlock` | `PresentationBlock.accessibility` |
| **Selector** | Type/dataType-based presentation rule | `match` (required), `apply` (required) | `selectors[]` |
| **SelectorMatch** | Selector criteria | `type`, `dataType` (at least one required) | `Selector.match` |
| **PageLayout** | Logical page with grid layout | `id` (required), `title` (required), `description`, `regions` | `pages[]` |
| **Region** | Item-to-grid assignment | `key` (required), `span`, `start`, `responsive` | `PageLayout.regions[]` |
| **Breakpoints** | Responsive breakpoints | External `$ref` to `component/1.0#/$defs/Breakpoints` | `breakpoints` |

## Required Fields

**Document level**: `$formspecTheme`, `version`, `targetDefinition`

**Selector**: `match`, `apply`

**SelectorMatch**: at least one of `type` or `dataType` (via anyOf)

**PageLayout**: `id`, `title`

**Region**: `key`

**PresentationBlock**: no required properties (all optional)

## Enumerations

| Enum | Values | Used By |
|---|---|---|
| `$formspecTheme` | `"1.0"` (const) | Top-level version pin |
| `labelPosition` | `top`, `start`, `hidden` | `PresentationBlock.labelPosition` |
| `SelectorMatch.type` | `group`, `field`, `display` | Selector match criteria |
| `SelectorMatch.dataType` | `string`, `text`, `integer`, `decimal`, `boolean`, `date`, `dateTime`, `time`, `uri`, `attachment`, `choice`, `multiChoice`, `money` (13 values) | Selector match criteria |

## Cross-References

**External $ref (to component schema)**:
- `$defs/TargetDefinition` -> `https://formspec.org/schemas/component/1.0#/$defs/TargetDefinition`
- `$defs/Tokens` -> `https://formspec.org/schemas/component/1.0#/$defs/Tokens`
- `$defs/AccessibilityBlock` -> `https://formspec.org/schemas/component/1.0#/$defs/AccessibilityBlock`
- `$defs/Breakpoints` -> `https://formspec.org/schemas/component/1.0#/$defs/Breakpoints`

**Internal $ref**: PresentationBlock, Selector, SelectorMatch, PageLayout, Region

**Binding**: `targetDefinition.url` links to Definition's `url` property; `targetDefinition.compatibleVersions` uses semver range matching

**Token references**: String values in `style` and `widgetConfig` may contain `$token.<key>` syntax resolved at theme-application time

## Extension Points

- **`extensions`**: object with `propertyNames: { pattern: "^x-" }` -- vendor-specific metadata
- **`widget`**: Custom widgets MUST use `x-` prefix (e.g., `x-map-picker`) and include fallback chain
- **`widgetConfig`**: `additionalProperties: true` -- open for widget-specific properties
- **`PresentationBlock.style`**: `additionalProperties: { oneOf: [string, number] }` -- open for any style property
- **`items`**: `additionalProperties: { $ref: PresentationBlock }` -- any item key accepted

## x-lm Annotations

| Path | critical | intent |
|---|---|---|
| `$formspecTheme` | true | Version pin for theme document compatibility. Processors MUST reject themes with an unrecognized version |
| `version` | true | Theme revision identifier. Enables cache-busting and auditing which theme version was applied |
| `targetDefinition` | true | Declares which form definition this theme can be applied to. Prevents accidental application to unrelated definitions |
| `tokens` | true | Central design vocabulary referenced via `$token.<key>`. Enables consistent theming and easy rebrand. RECOMMENDED prefixes: `color.*`, `spacing.*`, `typography.*`, `border.*`, `elevation.*`, `x-*` |
| `defaults` | true | Cascade level 1. Form-wide presentation baseline |
| `selectors` | true | Cascade level 2. Pattern-based overrides by item type or dataType |
| `items` | true | Cascade level 3. Highest specificity -- surgical per-item presentation control |
| `PresentationBlock.widget` | true | Primary presentation output -- determines which UI control renders the item |
| `PresentationBlock.cssClass` | true | CSS class assignment with unique union merge semantics (accumulates across cascade levels, unlike all other properties which use shallow replacement) |

## Validation Constraints

- **$formspecTheme**: `const: "1.0"` (exact value)
- **version**: `minLength: 1`
- **PageLayout.id**: pattern `^[a-zA-Z][a-zA-Z0-9_\-]*$` (starts with letter, alphanumeric/underscore/hyphen)
- **Region.span**: integer, minimum 1, maximum 12, default 12
- **Region.start**: integer, minimum 1, maximum 12
- **Region.responsive.*.span**: integer, minimum 1, maximum 12
- **Region.responsive.*.start**: integer, minimum 1, maximum 12
- **SelectorMatch**: `anyOf [{ required: ["type"] }, { required: ["dataType"] }]` -- at least one criterion required
- **PresentationBlock.style values**: `oneOf [{ type: "string" }, { type: "number" }]`
- **PresentationBlock.cssClass**: `oneOf [string, array of strings]`
- **All objects with additionalProperties: false**: TargetDefinition (via external ref), Selector, SelectorMatch, PageLayout, Region, PresentationBlock, Publisher (via external ref)

### Cascade Merge Semantics (critical behavioral constraint)

- Cascade order: Tier 1 inline hints (level 0) < `defaults` (level 1) < `selectors` (level 2) < `items` (level 3)
- Merge is **shallow per-property**: higher level replaces same property from lower level
- Nested objects (`widgetConfig`, `style`, `accessibility`) are replaced **as a whole**, NOT deep-merged
- **Exception**: `cssClass` uses **union semantics** -- classes accumulate across all cascade levels with duplicates removed
- Fallback resolution does NOT carry `widgetConfig` forward -- each fallback widget uses its own default config

---

# Registry Schema Reference Map

> schemas/registry.schema.json -- 647 lines -- Extension publishing, discovery, validation, and semantic metadata catalog

## Overview

A Registry Document is a static JSON document format for publishing, discovering, and validating Formspec extensions and semantic metadata. It enumerates named entries -- custom data types, functions, constraints, properties, namespaces, concept identities, and vocabulary bindings -- with metadata, version history, compatibility bounds, and machine-readable schemas. Any organization may publish its own Registry Document; interoperability is achieved through the common format, not centralized authority.

**$id**: `https://formspec.org/schemas/registry/v1.0/registry.json`

## Top-Level Structure

| Property | Type | Required | Description |
|---|---|---|---|
| `$formspecRegistry` | string (const `"1.0"`) | **Yes** | Registry specification version pin. MUST be `"1.0"` |
| `$schema` | string (uri) | No | JSON Schema URI for editor validation and autocompletion |
| `publisher` | Publisher | **Yes** | Organization publishing this registry. Provides provenance for all entries unless overridden |
| `published` | string (date-time) | **Yes** | ISO 8601 timestamp of publication. Used for freshness/cache validation |
| `entries` | array of RegistryEntry | **Yes** | Array of extension registry entries. (name, version) MUST be unique within document |
| `extensions` | object (propertyNames: `^x-`) | No | Registry-level vendor-specific metadata |

**Top-level required**: `["$formspecRegistry", "publisher", "published", "entries"]`

**additionalProperties**: false

## Key Type Definitions ($defs)

| Definition | Description | Key Properties | Used By |
|---|---|---|---|
| **Publisher** | Organization identity and contact | `name` (required), `url` (required, uri), `contact` | Top-level `publisher`, `RegistryEntry.publisher` |
| **RegistryEntry** | Single extension or semantic metadata record | `name` (required), `category` (required), `version` (required), `status` (required), `description` (required), `compatibility` (required), plus category-specific: `baseType`, `constraints`, `metadata`, `parameters`, `returns`, `members`, `conceptUri`, `conceptSystem`, `conceptCode`, `equivalents`, `vocabularySystem`, `vocabularyVersion`, `filter` | `entries[]` |
| **ConceptEquivalent** | Cross-system concept equivalence | `system` (required, uri), `code` (required), `display`, `type` | `RegistryEntry.equivalents[]` |
| **VocabularyFilter** | Terminology subset constraints | `ancestor`, `maxDepth`, `include`, `exclude` | `RegistryEntry.filter` |

## RegistryEntry Properties (complete)

| Property | Type | Required | Description |
|---|---|---|---|
| `name` | string (pattern) | **Yes** | x-prefixed extension identifier. Lowercase ASCII, hyphen-separated. `x-formspec-` reserved |
| `category` | string (enum) | **Yes** | Entry category discriminator. Drives conditional required properties |
| `version` | string (semver pattern) | **Yes** | Semver version of the extension itself (not the Formspec version) |
| `status` | string (enum) | **Yes** | Lifecycle status. Transitions: draft -> stable -> deprecated -> retired |
| `publisher` | Publisher | No | Entry-level publisher override (takes precedence over document-level publisher) |
| `description` | string (minLength 1) | **Yes** | Human-readable summary of the extension's purpose |
| `specUrl` | string (uri) | No | Link to human-readable extension documentation |
| `schemaUrl` | string (uri) | No | Link to JSON Schema for validating extension data in Definitions |
| `compatibility` | object | **Yes** | Version compatibility bounds (`formspecVersion` required, `mappingDslVersion` optional) |
| `license` | string (SPDX pattern) | No | SPDX license identifier |
| `deprecationNotice` | string (minLength 1) | Conditional | Required when `status = "deprecated"`. Human-readable deprecation message |
| `examples` | array (items: true) | No | Free-form JSON values demonstrating extension usage |
| `extensions` | object (propertyNames: `^x-`) | No | Entry-level vendor-specific metadata |
| `baseType` | string (enum) | Conditional | Required when `category = "dataType"`. Core type this custom type extends |
| `constraints` | object | No | Default constraint values for dataType entries |
| `metadata` | object | No | Presentation/descriptive metadata (open object, no restrictions) |
| `parameters` | array of Parameter | Conditional | Required when `category = "function"` or `"constraint"`. Positional signature |
| `returns` | string | Conditional | Required when `category = "function"`. Return type for FEL type checking |
| `members` | array of string (pattern) | No | x-prefixed names grouped under a namespace entry |
| `conceptUri` | string (uri) | Conditional | Required when `category = "concept"`. Globally unique IRI for the concept |
| `conceptSystem` | string (uri) | No | Ontology or concept system URI. Recommended for concept entries |
| `conceptCode` | string | No | Short code within the concept system (e.g., `EIN`, `MR`) |
| `equivalents` | array of ConceptEquivalent | No | Cross-system equivalences for concept entries |
| `vocabularySystem` | string (uri) | Conditional | Required when `category = "vocabulary"`. External terminology system URI |
| `vocabularyVersion` | string | No | Version of the external terminology |
| `filter` | VocabularyFilter | No | Subset constraints for vocabulary entries |

### Parameter Object (within `parameters` array)

| Property | Type | Required | Description |
|---|---|---|---|
| `name` | string | **Yes** | Parameter name for documentation and error messages |
| `type` | string | **Yes** | Core Formspec data type name for this parameter |
| `description` | string | No | Human-readable explanation of the parameter |

### ConceptEquivalent Object

| Property | Type | Required | Description |
|---|---|---|---|
| `system` | string (uri) | **Yes** | Target system URI |
| `code` | string | **Yes** | Concept code within the target system |
| `display` | string | No | Human-readable name in the target system |
| `type` | string | No | Relationship type (SKOS-inspired). Default: `exact`. Standard values: `exact`, `close`, `broader`, `narrower`, `related`. Custom types MUST be x-prefixed |

### VocabularyFilter Object

| Property | Type | Required | Description |
|---|---|---|---|
| `ancestor` | string | No | Root code for hierarchical filtering. Only descendants included |
| `maxDepth` | integer (minimum 1) | No | Maximum depth from the ancestor code |
| `include` | array of string (minItems 1) | No | Explicit list of codes to include |
| `exclude` | array of string (minItems 1) | No | Explicit list of codes to exclude |

## Required Fields

**Document level**: `$formspecRegistry`, `publisher`, `published`, `entries`

**Publisher**: `name`, `url`

**RegistryEntry**: `name`, `category`, `version`, `status`, `description`, `compatibility`

**RegistryEntry.compatibility**: `formspecVersion`

**RegistryEntry conditional requirements** (via allOf if/then):
- When `category = "dataType"`: `baseType` required
- When `category = "function"`: `parameters` and `returns` required
- When `category = "constraint"`: `parameters` required
- When `category = "concept"`: `conceptUri` required
- When `category = "vocabulary"`: `vocabularySystem` required
- When `status = "deprecated"`: `deprecationNotice` required

**RegistryEntry.parameters[] items**: `name`, `type`

**ConceptEquivalent**: `system`, `code`

## Enumerations

| Enum | Values | Used By |
|---|---|---|
| `$formspecRegistry` | `"1.0"` (const) | Top-level version pin |
| `category` | `dataType`, `function`, `constraint`, `property`, `namespace`, `concept`, `vocabulary` | `RegistryEntry.category` (discriminator) |
| `status` | `draft`, `stable`, `deprecated`, `retired` | `RegistryEntry.status` |
| `baseType` | `string`, `integer`, `decimal`, `boolean`, `date`, `dateTime`, `time`, `uri` | `RegistryEntry.baseType` (for dataType category) |

## Cross-References

- **No external $ref** -- self-contained schema
- Internal `$ref`: Publisher, RegistryEntry, ConceptEquivalent, VocabularyFilter
- `compatibility.formspecVersion` uses semver range matching against Formspec core spec version
- `compatibility.mappingDslVersion` uses semver range matching against Mapping DSL version
- `RegistryEntry.schemaUrl` points to external JSON Schema for validating extension data in Definition documents
- `RegistryEntry.specUrl` points to external human-readable documentation
- `RegistryEntry.name` pattern matches extension names used in Definition `extensions` objects
- `RegistryEntry.members` references other entry names (for namespace category)
- `RegistryEntry.conceptUri` links to external ontology IRIs
- `RegistryEntry.conceptSystem` identifies the ontology or standard the concept belongs to
- `RegistryEntry.equivalents` cross-references concepts in other systems (schema.org, FHIR, etc.)
- `RegistryEntry.vocabularySystem` links to external terminology systems (ICD-10, FHIR ValueSets, etc.)

## Extension Points

- **Top-level `extensions`**: object with `propertyNames: { pattern: "^x-" }` -- registry-level vendor metadata
- **`RegistryEntry.extensions`**: object with `propertyNames: { pattern: "^x-" }` -- entry-level vendor metadata
- **Extension name pattern**: `^x-[a-z][a-z0-9]*(-[a-z][a-z0-9]*)*$` -- `x-formspec-` prefix reserved for core promotion
- **`RegistryEntry.metadata`**: open `type: "object"` with no additionalProperties restriction -- freeform presentation-layer metadata for dataType, concept, and vocabulary extensions
- **`RegistryEntry.constraints`**: open `type: "object"` -- freeform constraint defaults for dataType extensions
- **`RegistryEntry.examples`**: `items: true` -- freeform JSON values demonstrating extension usage
- **`ConceptEquivalent.type`**: accepts custom relationship types with `x-` prefix beyond the standard SKOS values

## x-lm Annotations

| Path | critical | intent |
|---|---|---|
| `$formspecRegistry` | true | Version pin for registry document compatibility |
| `publisher` | true | Publisher identity and contact provenance for this registry |
| `published` | true | Publication timestamp used for freshness and cache validation |
| `entries` | true | Primary catalog of extension definitions exposed by the registry |
| `RegistryEntry.name` | true | Globally unique extension identifier used for resolution and collision avoidance |
| `RegistryEntry.category` | true | Discriminator that drives conditional required properties and tells processors how to consume the extension |
| `RegistryEntry.version` | true | Extension version for uniqueness, ordering, and compatibility resolution |
| `RegistryEntry.status` | true | Lifecycle stage governing processor behavior -- warnings for retired, notices for deprecated |
| `RegistryEntry.compatibility` | true | Compatibility bounds that processors MUST check before accepting an extension |
| `RegistryEntry.baseType` | true | Base type inheritance for custom dataType extensions -- determines serialization and operator semantics |
| `RegistryEntry.parameters` | true | Function/constraint signature for arity checking and type validation in FEL expressions |
| `RegistryEntry.returns` | true | Return type declaration enabling static type checking of custom function calls in FEL |
| `RegistryEntry.conceptUri` | true | The globally unique IRI for the concept this registry entry represents |
| `RegistryEntry.vocabularySystem` | true | Identifies which external terminology system this vocabulary entry represents |

## Validation Constraints

- **$formspecRegistry**: `const: "1.0"` (exact value)
- **published**: `format: "date-time"` (ISO 8601)
- **RegistryEntry.name**: pattern `^x-[a-z][a-z0-9]*(-[a-z][a-z0-9]*)*$` -- lowercase, hyphen-separated, x-prefixed
- **RegistryEntry.version**: pattern `^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$` (strict semver)
- **RegistryEntry.description**: `minLength: 1`
- **RegistryEntry.deprecationNotice**: `minLength: 1`
- **RegistryEntry.license**: pattern `^[A-Za-z0-9][A-Za-z0-9.\-]*[A-Za-z0-9]$` (SPDX-style)
- **RegistryEntry.members items**: pattern `^x-[a-z][a-z0-9]*(-[a-z][a-z0-9]*)*$` (same as entry name)
- **RegistryEntry.parameters items**: `additionalProperties: false` with required `name` and `type`
- **VocabularyFilter.maxDepth**: integer, minimum 1
- **VocabularyFilter.include**: array of strings, minItems 1
- **VocabularyFilter.exclude**: array of strings, minItems 1
- **Publisher**: `additionalProperties: false`
- **RegistryEntry**: `additionalProperties: false`
- **ConceptEquivalent**: `additionalProperties: false`
- **VocabularyFilter**: `additionalProperties: false`
- **RegistryEntry.compatibility**: `additionalProperties: false`

### Conditional Validation (allOf if/then discriminators)

Six conditional validation blocks on RegistryEntry, all using `allOf`:

1. **category = "dataType"** -> requires `baseType`
2. **category = "function"** -> requires `parameters` and `returns`
3. **category = "constraint"** -> requires `parameters`
4. **category = "concept"** -> requires `conceptUri`
5. **category = "vocabulary"** -> requires `vocabularySystem`
6. **status = "deprecated"** -> requires `deprecationNotice`

### Lifecycle Transitions

Status transitions MUST NOT skip states: `draft -> stable -> deprecated -> retired`

- **draft**: Interface not frozen; breaking changes permitted
- **stable**: Interface frozen for the major version
- **deprecated**: MUST have `deprecationNotice`; processors SHOULD surface the notice
- **retired**: Processors SHOULD emit a warning

### Uniqueness Constraint (document-level)

Within a single Registry Document, the `(name, version)` tuple MUST be unique. This is a semantic constraint not enforceable by JSON Schema alone.
