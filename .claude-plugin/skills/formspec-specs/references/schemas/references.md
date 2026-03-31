# References Schema Reference Map

> schemas/references.schema.json -- 324 lines -- A standalone sidecar document attaching external resources (documentation, regulations, knowledge bases, tool schemas) to a Formspec Definition.

## Overview

The References schema defines a companion document that binds external or inline resources to items within a Formspec Definition. Like Theme (Tier 2) and Component (Tier 3) documents, a References Document targets a Definition but lives alongside it. References are strictly static -- FEL expressions MUST NOT appear in any reference property, and references MUST NOT alter core behavioral semantics (required, relevant, readonly, calculate, validation). Multiple References Documents may target the same Definition (e.g., different audiences, languages, or domains). Each reference declares an `audience` (`human`, `agent`, or `both`) to control whether it is rendered in the UI or consumed programmatically by AI agents.

## Top-Level Structure

| Property | Type | Required | Description |
|---|---|---|---|
| `$formspecReferences` | `string` (const: `"1.0"`) | Yes | References specification version. MUST be `"1.0"`. |
| `url` | `string` (format: `uri`) | No | Canonical URI identifier for this References Document. |
| `name` | `string` (pattern: `^[a-zA-Z][a-zA-Z0-9_\-]*$`) | No | Machine-readable short name. Letters, digits, hyphens, underscores; must start with a letter. |
| `title` | `string` | No | Human-readable name for this References Document. |
| `description` | `string` | No | Human-readable description of this document's purpose and scope. |
| `version` | `string` (minLength: 1) | Yes | Version of this References Document. |
| `targetDefinition` | `$ref` -> component schema `TargetDefinition` | Yes | Binding to the target Formspec Definition and optional compatibility range. |
| `referenceDefs` | `$ref` -> `#/$defs/ReferenceDefs` | No | Registry of reusable Reference objects. Entries in `references` may use `{"$ref": "#/referenceDefs/{key}"}` to include a definition from this registry with optional property overrides. |
| `references` | `array` of `BoundReference` | Yes | Ordered list of references bound to the target Definition. Each entry specifies a target path (item key or `#` for form-level) and a reference or `$ref` pointer. |

## Key Type Definitions ($defs)

| Definition | Description | Key Properties | Used By |
|---|---|---|---|
| **BoundReference** | A reference bound to a specific location in the target Definition. Uses Bind.path syntax (core section 4.3.3). `#` targets the entire form. | `target` (required); inherits all Reference properties via `allOf` with `ReferenceOrRef` | `references` array items |
| **Reference** | A single reference to an external or inline resource. At least one of `uri` or `content` MUST be present. | `type`, `audience` (required); `id`, `title`, `uri`, `content`, `mediaType`, `language`, `description`, `tags`, `priority`, `rel`, `selector`, `extensions` (optional) | Inline in `BoundReference` via `ReferenceOrRef`, entries in `ReferenceDefs` |
| **ReferenceOrRef** | Polymorphic: either a full inline Reference or a `$ref` pointer to a `referenceDefs` entry with optional property overrides. `id` MUST NOT appear alongside `$ref`. | `oneOf`: full `Reference` OR object with `$ref` (required) plus optional override properties | `BoundReference` (via `allOf`) |
| **ReferenceDefs** | Registry of reusable Reference objects keyed by identifier. Entries MUST NOT use `$ref` to other entries (no recursion). The key becomes the resolved reference's `id`. | `propertyNames` pattern: `^[a-zA-Z][a-zA-Z0-9_-]*$`; each value is a `Reference` | Top-level `referenceDefs` property |

### BoundReference Detail

| Property | Type | Required | Description |
|---|---|---|---|
| `target` | `string` (minLength: 1) | Yes | Path identifying which Definition item(s) this reference applies to. Uses dot notation for nesting and `[*]` for all instances of a repeatable group. `#` means form-level. Multiple references may target the same path. |
| *(all Reference or $ref properties)* | *(inherited via ReferenceOrRef)* | *(per ReferenceOrRef rules)* | Inline reference properties or a `$ref` pointer with optional overrides. |

**`unevaluatedProperties: false`** -- no additional properties beyond `target` and those from `ReferenceOrRef`.

### Reference Detail

| Property | Type | Required | Description |
|---|---|---|---|
| `id` | `string` (pattern: `^[a-zA-Z][a-zA-Z0-9_-]*$`) | No (RECOMMENDED) | Unique identifier within this References Document. When used as a `referenceDefs` key, key and `id` MUST match. |
| `type` | `string` | Yes | Classification of the referenced resource. See Enums section for known values. Custom types MUST be prefixed with `x-`. |
| `audience` | `string` (enum) | Yes | Who consumes this reference: `human`, `agent`, or `both`. |
| `title` | `string` | No (RECOMMENDED) | Human-readable label for this reference. |
| `uri` | `string` (format: `uri`) | Conditional | URI of the referenced resource. REQUIRED unless `content` is provided. Supports `https:`, `vectorstore:`, `kb:`, `formspec-fn:`, and `urn:` schemes. |
| `content` | `string` or `object` (oneOf) | Conditional | Inline content. REQUIRED unless `uri` is provided. May be plain text, markdown, or structured JSON. |
| `mediaType` | `string` | No | MIME type of the referenced resource (RFC 2045). |
| `language` | `string` | No | BCP 47 language tag for the referenced content. |
| `description` | `string` | No | Longer explanation of what this reference provides and why it is relevant. |
| `tags` | `array` of `string` | No | Categorization tags for filtering and grouping references. |
| `priority` | `string` (enum) | No | Relative importance: `primary`, `supplementary` (implicit default), `background`. |
| `rel` | `string` | No | Semantic relationship to the target. See Enums section for known values. Default is `see-also`. Custom types MUST be prefixed with `x-`. |
| `selector` | `string` | No | Fragment-targeting hint for resources without native fragment semantics. |
| `extensions` | `object` (propertyNames pattern: `^x-`) | No | Reference-level extension data. All keys MUST be prefixed with `x-`. |

**`additionalProperties: false`** on Reference. **`anyOf`**: at least one of `uri` or `content` MUST be present.

### ReferenceOrRef -- $ref Branch Detail

When `$ref` is present, the base object from `referenceDefs` is shallow-merged with sibling override properties (overrides win).

| Property | Type | Required | Description |
|---|---|---|---|
| `$ref` | `string` (pattern: `^#/referenceDefs/[a-zA-Z][a-zA-Z0-9_-]*$`) | Yes | JSON Pointer (RFC 6901) to a `referenceDefs` entry. Resolved at load time. |
| `title` | `string` | No | Override title. |
| `uri` | `string` (format: `uri`) | No | Override URI. |
| `content` | `string` or `object` (oneOf) | No | Override content. |
| `mediaType` | `string` | No | Override MIME type. |
| `language` | `string` | No | Override language tag. |
| `description` | `string` | No | Override description. |
| `tags` | `array` of `string` | No | Override tags. |
| `priority` | `string` (enum: `primary`, `supplementary`, `background`) | No | Override priority. |
| `rel` | `string` | No | Override relationship. |
| `selector` | `string` | No | Override selector. |
| `audience` | `string` (enum: `human`, `agent`, `both`) | No | Override audience. |
| `type` | `string` | No | Override type. |
| `extensions` | `object` (propertyNames pattern: `^x-`) | No | Override extensions. |

**`not: { required: ["id"] }`** -- `id` MUST NOT appear alongside `$ref` (the `referenceDefs` key becomes the resolved `id`).
**`additionalProperties: false`** on the `$ref` branch.

**MAINTENANCE NOTE**: The `$ref` branch explicitly lists override properties. If a property is added to Reference, it must also be added to the `$ref` branch or overrides for that property will be silently rejected.

## Required Fields

- `$formspecReferences`
- `version`
- `targetDefinition`
- `references`

Within each `BoundReference`: `target` is required.
Within each `Reference`: `type` and `audience` are required; additionally at least one of `uri` or `content` must be present (`anyOf`).
Within a `$ref`-style `ReferenceOrRef`: `$ref` is required; `id` is forbidden.

## Enums and Patterns

| Property Path | Type | Values/Pattern | Description |
|---|---|---|---|
| `$formspecReferences` | const | `"1.0"` | Locked version string |
| `name` | pattern | `^[a-zA-Z][a-zA-Z0-9_\-]*$` | Machine-readable identifier |
| `Reference.id` | pattern | `^[a-zA-Z][a-zA-Z0-9_-]*$` | Reference identifier |
| `Reference.audience` | enum | `human`, `agent`, `both` | Who consumes this reference |
| `Reference.priority` | enum | `primary`, `supplementary`, `background` | Relative importance |
| `ReferenceOrRef.$ref` | pattern | `^#/referenceDefs/[a-zA-Z][a-zA-Z0-9_-]*$` | JSON Pointer to referenceDefs entry |
| `ReferenceDefs` propertyNames | pattern | `^[a-zA-Z][a-zA-Z0-9_-]*$` | Valid referenceDefs keys |
| `BoundReference.target` | examples | `#`, `indirectCostRate`, `budget.lineItems`, `lineItems[*].amount` | Bind.path syntax; `#` = form-level |
| `Reference.type` | known values (not enum) | `documentation`, `example`, `regulation`, `policy`, `glossary`, `schema`, `vector-store`, `knowledge-base`, `retrieval`, `tool`, `api`, `context`; custom: `x-` prefix | Classification of the referenced resource |
| `Reference.rel` | known values (not enum) | `authorizes`, `constrains`, `defines`, `exemplifies`, `supersedes`, `superseded-by`, `derived-from`, `see-also` (default); custom: `x-` prefix | Semantic relationship to the target |
| Top-level `patternProperties` | pattern | `^x-` | Extension properties allowed at document root |
| `Reference.extensions` propertyNames | pattern | `^x-` | Extension keys must start with `x-` |

**Note on `type` and `rel`**: These are NOT schema-enforced enums. The schema declares them as `type: string` with known values listed in the `description` and `examples`. Unrecognized non-`x-` values cause a processor SHOULD warn / MAY skip behavior. Custom values MUST be prefixed with `x-`.

## Cross-References

| Property | $ref Target |
|---|---|
| `targetDefinition` | `https://formspec.org/schemas/component/1.0#/$defs/TargetDefinition` (component.schema.json) |

- The `BoundReference.target` path syntax follows the same rules as `Bind.path` defined in core spec section 4.3.3.
- References Documents are companion sidecar documents in the same tier pattern as Theme and Component documents.
- The `TargetDefinition` type (from component schema) includes `url` (URI of the targeted Definition) and `compatibleVersions` (semver range).
- The `audience` field controls integration with rendering pipelines (`human`) and AI agent context pipelines (`agent`).
- URI schemes `vectorstore:`, `kb:`, and `formspec-fn:` connect references to external AI/retrieval infrastructure.

## Extension Points

- **Document-level extensions**: Top-level `patternProperties` allows any property matching `^x-` (no type constraint).
- **Reference-level extensions**: Each `Reference` has an `extensions` object where all keys MUST match `^x-`.
- **Custom `type` values**: Any string prefixed with `x-` is a valid custom reference type.
- **Custom `rel` values**: Any string prefixed with `x-` is a valid custom relationship type.
- **Custom URI schemes**: The `uri` field uses `format: uri` with no scheme restriction -- `vectorstore:`, `kb:`, `formspec-fn:`, `urn:`, and any other valid URI scheme are accepted.

## Validation Constraints

- `additionalProperties: false` at the top level (with `patternProperties: "^x-"` for extensions).
- `additionalProperties: false` on `Reference`.
- `additionalProperties: false` on the `$ref` branch of `ReferenceOrRef`.
- `unevaluatedProperties: false` on `BoundReference`.
- `version` enforces `minLength: 1`.
- `BoundReference.target` enforces `minLength: 1`.
- `Reference` enforces `anyOf: [{ required: ["uri"] }, { required: ["content"] }]` -- at least one of `uri` or `content` must be present.
- `Reference.content` is `oneOf: [string, object]` -- must be exactly one of a string or a JSON object.
- `ReferenceOrRef` is `oneOf` -- either a full `Reference` or a `$ref` pointer object. These are mutually exclusive.
- The `$ref` branch enforces `not: { required: ["id"] }` -- `id` and `$ref` are incompatible.
- `$ref` pattern enforces `^#/referenceDefs/[a-zA-Z][a-zA-Z0-9_-]*$` -- must point to a valid `referenceDefs` key.
- `ReferenceDefs` enforces `propertyNames.pattern: "^[a-zA-Z][a-zA-Z0-9_-]*$"` on all keys.
- `ReferenceDefs` entries (`additionalProperties`) must each be a valid `Reference`.
- Semantic invariants (not schema-enforceable):
  - When a `referenceDefs` entry declares `id`, it MUST match the entry key (processing-time validation).
  - Broken `$ref` pointers (pointing to nonexistent `referenceDefs` entries) are document errors.
  - `referenceDefs` entries MUST NOT use `$ref` to other entries (no recursion).
  - References MUST NOT alter core behavioral semantics (required, relevant, readonly, calculate, validation).
  - FEL expressions MUST NOT appear in any reference property.
  - Reference properties are static -- resolved at load time, not reactive.
