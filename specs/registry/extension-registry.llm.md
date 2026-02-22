# Formspec Extension Registry (LLM Reference)

A JSON document format for publishing, discovering, and validating Formspec extensions. Not a runtime service — a static document that can be served over HTTPS, bundled in a package, or checked into a repository. Any organization may publish its own Registry Document.

## Registry Document Structure

| Property | Required | Description |
|----------|----------|-------------|
| `$formspecRegistry` | REQUIRED | Must be "1.0" |
| `$schema` | RECOMMENDED | URI of the JSON Schema |
| `publisher` | REQUIRED | Object: `name` (string), `url` (URI), optional `contact` |
| `published` | REQUIRED | ISO 8601 timestamp |
| `entries` | REQUIRED | Array of Registry Entry objects |
| `extensions` | OPTIONAL | Extension properties (`x-` prefixed keys) |

## Registry Entry Structure

| Property | Required | Description |
|----------|----------|-------------|
| `name` | REQUIRED | `x-` prefixed identifier matching `^x-[a-z][a-z0-9]*(-[a-z][a-z0-9]*)*$` |
| `category` | REQUIRED | "dataType", "function", "constraint", "property", "namespace" |
| `version` | REQUIRED | SemVer of the extension |
| `status` | REQUIRED | "draft", "stable", "deprecated", "retired" |
| `description` | REQUIRED | Human-readable summary |
| `compatibility` | REQUIRED | Object: `formspecVersion` (semver range, REQUIRED), optional `mappingDslVersion` |
| `publisher` | OPTIONAL | Entry-level override |
| `specUrl` | RECOMMENDED | Link to full documentation |
| `schemaUrl` | RECOMMENDED | Link to JSON Schema for extension data |
| `license` | RECOMMENDED | SPDX identifier |
| `examples` | OPTIONAL | Array of JSON usage examples |

### Category-Specific Properties

**dataType**: `baseType` (REQUIRED — core type being extended: string/integer/decimal/boolean/date/dateTime/time/uri), optional `constraints`, optional `metadata`.

**function**: `parameters` (REQUIRED — array of `{name, type, description?}`), `returns` (REQUIRED — core data type).

**constraint**: `parameters` (REQUIRED — array of `{name, type, description?}`).

**property**: No additional required properties. `schemaUrl` recommended.

**namespace**: Optional `members` (array of `x-` prefixed extension names grouped under this namespace).

## Naming Rules

1. All extension identifiers must start with `x-`
2. Pattern: `^x-[a-z][a-z0-9]*(-[a-z][a-z0-9]*)*$` (lowercase, hyphen-separated segments)
3. `x-formspec-` prefix reserved for potential future core promotions — third parties must not use it
4. `(name, version)` pair must be unique within a Registry Document
5. Cross-registry collision avoidance: use `x-{org}-{domain}` pattern

## Discovery

Well-known URL: `https://{host}/.well-known/formspec-extensions.json`

- Response must be `application/json` and a valid Registry Document
- Servers should support conditional GET for efficient polling
- Processors may also accept Registry Document URIs from configuration/CLI/Definition metadata

## Extension Lifecycle

```
draft → stable → deprecated → retired
```

| Transition | Rule |
|------------|------|
| draft → stable | Interface frozen for major version |
| stable → deprecated | Must publish deprecation notice (`x-formspec-deprecation`); should identify replacement |
| deprecated → retired | Extension should not be used; processors should warn |
| (any) → draft | New major version may re-enter draft |

Transitions must not skip states (no draft → deprecated, no stable → retired).

## Conformance (Registry-Aware Processors)

1. **Loading**: Parse and validate Registry Documents
2. **Resolution**: Locate matching entry by `name` + `category` when Definition references an extension
3. **Compatibility check**: Verify current Formspec version satisfies `compatibility.formspecVersion` range. Mismatch → warning (hard error only if `x-formspec-strict: true`)
4. **Status enforcement**: `retired` → warning, `deprecated` → informational notice
5. **Schema validation**: If entry has `schemaUrl`, validate extension data against it
6. **Passthrough**: If no registry entry found, fall back to core §8 behavior (ignore-and-preserve for properties, error for unknown types/functions/constraints)
