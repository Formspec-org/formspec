# Response, Validation, Changelog, and Conformance Schema Reference Maps

This grouped reference covers the five schemas that deal with form output, validation findings, version change tracking, and cross-runtime conformance testing. They form the "data capture and quality" layer of Formspec:

- **Response** -- the filled-in form, pinned to a Definition version.
- **ValidationResult** -- a single structured validation finding.
- **ValidationReport** -- an aggregate snapshot of all validation findings for a Response.
- **Changelog** -- a diff document between two Definition versions.
- **Conformance Suite** -- the cross-runtime test case contract for Python/TypeScript parity.

---

# Response Schema Reference Map

> schemas/response.schema.json -- 214 lines -- A completed or in-progress form submission pinned to a specific Definition version.

## Overview

The Response schema represents a filled-in form -- the unit of data capture in Formspec. It references exactly one Definition by the immutable tuple `(definitionUrl, definitionVersion)`, enforcing the Response Pinning Rule (VP-01): a Response is always validated against its pinned Definition version, never a newer one. The tuple `(definitionUrl, definitionVersion, id)` uniquely identifies a single form submission across all systems. The schema enforces `additionalProperties: false` and carries lifecycle status, form data, timestamps, optional author/subject metadata, embedded validation results, and an extension point.

## Top-Level Structure

| Property | Type | Required | Description |
|---|---|---|---|
| `$formspecResponse` | `string` (const: `"1.0"`) | Yes | Response specification version. MUST be `"1.0"`. |
| `definitionUrl` | `string` (format: `uri`) | Yes | Canonical URL of the Definition this Response was created against. Stable logical-form identifier shared across versions. |
| `definitionVersion` | `string` (minLength: 1) | Yes | Exact version of the Definition. Immutable after creation. Interpretation governed by the Definition's `versionAlgorithm`. |
| `status` | `string` (enum) | Yes | Lifecycle status: `in-progress`, `completed`, `amended`, `stopped`. |
| `data` | `object` (additionalProperties: true) | Yes | Primary Instance -- the form data. Structure mirrors the Definition's item tree. |
| `authored` | `string` (format: `date-time`) | Yes | ISO 8601 last-modified timestamp. Updated on every save. |
| `id` | `string` | No | Globally unique identifier (e.g., UUID v4). Implementations SHOULD generate one. |
| `author` | `object` | No | Person or system that authored the Response. |
| `subject` | `object` | No | Entity the Response is about (grant, patient, project, etc.). Distinct from author. |
| `validationResults` | `array` of ValidationResult | No | Most recent validation findings. Snapshot that may be stale if data changed since last validation. |
| `extensions` | `object` | No | Implementor-specific data. Keys MUST start with `x-`. |

### author Object

| Property | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | Unique identifier of the author within the host system. |
| `name` | `string` | No | Display name of the author. For human authors, typically their full name. |

### subject Object

| Property | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | Unique identifier of the subject entity within the host system. |
| `type` | `string` | No | Type of the subject entity (e.g., Grant, Patient, Organization, Project). |

## Key Type Definitions ($defs)

This schema has no `$defs` block. The `author` and `subject` sub-objects are defined inline.

| Inline Object | Description | Key Properties | Used By |
|---|---|---|---|
| **author** | Author of the Response | `id` (required, string), `name` (optional, string) | Top-level `author` property |
| **subject** | Entity the Response describes | `id` (required, string), `type` (optional, string) | Top-level `subject` property |

## Required Fields

- `$formspecResponse`
- `definitionUrl`
- `definitionVersion`
- `status`
- `data`
- `authored`

Within `author`: `id` is required.
Within `subject`: `id` is required.

## Enums and Patterns

| Property Path | Type | Values/Pattern | Description |
|---|---|---|---|
| `$formspecResponse` | const | `"1.0"` | Spec version pin. |
| `status` | enum | `in-progress`, `completed`, `amended`, `stopped` | Lifecycle status controlling completion semantics. |
| `extensions` (propertyNames) | pattern | `^x-` | All extension keys must start with `x-`. |

## Cross-References

- `validationResults[*]` references `https://formspec.org/schemas/validationResult/1.0` (validationResult.schema.json).
- Core spec sections: Response Pinning Rule VP-01, VE-05 (saving must never be blocked by validation status).

## Extension Points

- `extensions` object with `propertyNames.pattern: "^x-"` allows implementor-specific data.
- `data` has `additionalProperties: true` -- its shape is governed by the Definition's item tree, not this schema.

## Validation Constraints

- `additionalProperties: false` at top level, on `author`, and on `subject`.
- `data` has `additionalProperties: true` -- open object whose shape is governed by the Definition's item tree.
- `definitionVersion` enforces `minLength: 1`.
- `definitionUrl` enforces `format: uri`.
- `authored` enforces `format: date-time`.
- `extensions` enforces `propertyNames.pattern: "^x-"`.
- Semantic invariant (not schema-enforceable): a Response with error-severity results MUST NOT have `status: "completed"`. Saving data MUST never be blocked by validation status (VE-05).

---

# ValidationResult Schema Reference Map

> schemas/validationResult.schema.json -- 178 lines -- A single structured validation finding produced during constraint evaluation.

## Overview

The ValidationResult schema defines the structure of an individual validation finding produced during the Revalidate phase. Every failed constraint -- bind constraint, required check, type check, cardinality violation, validation shape, or external injection -- produces exactly one ValidationResult. Results are structured JSON objects carrying severity, a resolved instance path, a human-readable message, and machine-readable codes. The absence of a result for a given path means all constraints on that path passed. Six `constraintKind` values partition results into categories mapping 1:1 to the six validation mechanisms plus external injection.

## Top-Level Structure

| Property | Type | Required | Description |
|---|---|---|---|
| `$formspecValidationResult` | `string` (const: `"1.0"`) | Yes | Validation result specification version. MUST be `"1.0"`. |
| `path` | `string` | Yes | Resolved instance path with concrete repeat indexes (dot-notation, 1-based brackets). Never wildcards. |
| `severity` | `string` (enum) | Yes | `error`, `warning`, or `info`. Only `error` blocks submission. |
| `constraintKind` | `string` (enum) | Yes | Category of constraint that produced this result. |
| `message` | `string` | Yes | Human-readable description, suitable for end users. All `{{expression}}` interpolation fully resolved. |
| `code` | `string` | No | Machine-readable identifier. Seven built-in codes are RESERVED. |
| `shapeId` | `string` | No | ID of the Validation Shape that produced this result. Present only when `constraintKind` is `shape`. |
| `source` | `string` (enum) | No | Origin category: `bind`, `shape`, or `external`. |
| `sourceId` | `string` | No | Specific origin identifier within the source category. |
| `value` | any | No | Actual value at validation failure time. Any JSON type. |
| `constraint` | `string` | No | FEL constraint expression that failed. Diagnostic only -- MUST NOT be shown to users. |
| `context` | `object` | No | Additional structured diagnostic data. For shapes: propagated context with FEL evaluated. For external: system metadata. |
| `extensions` | `object` | No | Extension data. Keys MUST start with `x-`. |

## Key Type Definitions ($defs)

This schema has no `$defs` block. All properties are defined inline at the top level.

## Required Fields

- `$formspecValidationResult`
- `path`
- `severity`
- `constraintKind`
- `message`

## Enums and Patterns

| Property Path | Type | Values/Pattern | Description |
|---|---|---|---|
| `$formspecValidationResult` | const | `"1.0"` | Spec version pin. |
| `severity` | enum | `error`, `warning`, `info` | Severity level. Only `error` blocks completion. |
| `constraintKind` | enum | `required`, `type`, `cardinality`, `constraint`, `shape`, `external` | Category of constraint mechanism. |
| `source` | enum | `bind`, `shape`, `external` | Origin subsystem of the finding. |
| `extensions` (propertyNames) | pattern | `^x-` | All extension keys must start with `x-`. |

### Reserved Built-In Codes

| Code | constraintKind | Description |
|---|---|---|
| `REQUIRED` | `required` | Required field has null or empty string |
| `TYPE_MISMATCH` | `type` | Value doesn't conform to declared dataType |
| `MIN_REPEAT` | `cardinality` | Fewer repeat instances than minRepeat |
| `MAX_REPEAT` | `cardinality` | More repeat instances than maxRepeat |
| `CONSTRAINT_FAILED` | `constraint` | Bind constraint returned false |
| `SHAPE_FAILED` | `shape` | Shape constraint returned false (generic default) |
| `EXTERNAL_FAILED` | `external` | External system reported failure (generic default) |

Shape-level codes (e.g., `BUDGET_SUM_MISMATCH`) and external system codes (e.g., `EIN_NOT_FOUND`) override the generic defaults.

## Cross-References

- This schema is referenced by both the Response schema (`validationResults` array) and the ValidationReport schema (`results` array).
- Core spec: Revalidate phase (section 2.4 Phase 3), VE-05, section 5.6 rule 1 (non-relevant fields must not produce results).

## Extension Points

- `extensions` object with `propertyNames.pattern: "^x-"` allows implementor-specific data on individual results.

## Validation Constraints

- `additionalProperties: false` at top level.
- `path` uses concrete indexed paths (e.g., `lineItems[3].quantity`), not definition-time wildcards.
- `value` has no type constraint -- any JSON type is valid (string, number, boolean, null, object, array).
- `extensions` enforces `propertyNames.pattern: "^x-"`.
- Semantic constraints (not schema-enforceable):
  - `shapeId` MUST be present when `constraintKind` is `shape` and MUST be absent for other constraint kinds.
  - Severity ordering: `error` > `warning` > `info`. Only `error` blocks completion.
  - Message interpolation MUST be fully resolved before surfacing to consumers.
  - Processors MUST use the seven reserved codes for corresponding built-in constraints.

---

# ValidationReport Schema Reference Map

> schemas/validationReport.schema.json -- 169 lines -- Aggregates all validation results for a Response at a point in time.

## Overview

The ValidationReport schema defines a standalone validation summary document produced by the Revalidate phase (section 2.4 Phase 3). It aggregates all validation results from bind constraints, required checks, type checks, cardinality checks, validation shapes, and external validation injections. The report is the sole input to conformance determination: `valid = (zero error-severity results)`. Reports may be persisted alongside a Response as a snapshot but may become stale if data changes after the timestamp. Three validation modes (continuous, deferred, disabled) control when reports are generated but not their structure (section 5.5).

## Top-Level Structure

| Property | Type | Required | Description |
|---|---|---|---|
| `$formspecValidationReport` | `string` (const: `"1.0"`) | Yes | Validation report specification version. MUST be `"1.0"`. |
| `definitionUrl` | `string` (format: `uri`) | No | Canonical URL of the Definition validated against. |
| `definitionVersion` | `string` | No | Version of the Definition validated against. Always the pinned version (VP-01). |
| `valid` | `boolean` | Yes | `true` iff zero error-severity results. Sole conformance indicator. Warnings and info never affect validity. |
| `results` | `array` of ValidationResult | Yes | Complete ordered set of validation findings across all sources. |
| `counts` | `object` | Yes | Pre-aggregated counts by severity level. |
| `timestamp` | `string` (format: `date-time`) | Yes | ISO 8601 timestamp of validation run. Used for staleness detection. |
| `extensions` | `object` | No | Implementor-specific data. Keys MUST start with `x-`. |

### counts Object

| Property | Type | Required | Description |
|---|---|---|---|
| `error` | `integer` (minimum: 0) | Yes | Count of error-severity results. When > 0, `valid` MUST be `false`. |
| `warning` | `integer` (minimum: 0) | Yes | Count of warning-severity results. Never blocks submission. |
| `info` | `integer` (minimum: 0) | Yes | Count of info-severity results. Informational only. |

## Key Type Definitions ($defs)

This schema has no `$defs` block. The `counts` sub-object is defined inline.

| Inline Object | Description | Key Properties | Used By |
|---|---|---|---|
| **counts** | Pre-aggregated severity breakdown | `error`, `warning`, `info` (all required integers >= 0) | Top-level `counts` property |

## Required Fields

- `$formspecValidationReport`
- `valid`
- `results`
- `counts`
- `timestamp`

Within `counts`: `error`, `warning`, `info` are all required.

## Enums and Patterns

| Property Path | Type | Values/Pattern | Description |
|---|---|---|---|
| `$formspecValidationReport` | const | `"1.0"` | Spec version pin. |
| `extensions` (propertyNames) | pattern | `^x-` | All extension keys must start with `x-`. |

This schema defines no enum properties directly. Enumerations are inherited from the referenced ValidationResult schema.

## Cross-References

- `results[*]` references `https://formspec.org/schemas/validationResult/1.0` (validationResult.schema.json).
- Core spec: Revalidate phase (section 2.4 Phase 3), Response Pinning Rule VP-01, section 5.5 (validation modes), section 5.6 rule 1 (non-relevant field suppression).

## Extension Points

- `extensions` object with `propertyNames.pattern: "^x-"` allows implementor-specific data on the report itself.

## Validation Constraints

- `additionalProperties: false` at top level and on `counts`.
- `counts.error`, `counts.warning`, `counts.info` all enforce `minimum: 0` and `type: integer`.
- `timestamp` enforces `format: date-time`.
- `definitionUrl` enforces `format: uri`.
- `extensions` enforces `propertyNames.pattern: "^x-"`.
- Structural invariants (not schema-enforceable):
  - `valid = (counts.error === 0)` -- processors MUST ensure this.
  - `counts.error + counts.warning + counts.info = results.length` -- processors MUST ensure this.
  - A Response with `valid: false` MUST NOT transition to `completed` status.
  - Non-relevant fields are guaranteed absent from results.
- Three validation modes (`continuous`, `deferred`, `disabled`) control when reports are generated but not their structure.

---

# Changelog Schema Reference Map

> schemas/changelog.schema.json -- 204 lines -- Enumerates differences between two versions of a Formspec Definition for migration and governance.

## Overview

The Changelog schema describes a diff document comparing two versions of a Formspec Definition. Each atomic Change record describes an addition, removal, modification, move, or rename of a definition element (item, bind, shape, optionSet, dataSource, screener, migration, or metadata). Impact classification (`breaking`/`compatible`/`cosmetic`) drives semver governance and migration generation. The document-level `semverImpact` must equal the maximum impact across all changes.

## Top-Level Structure

| Property | Type | Required | Description |
|---|---|---|---|
| `$formspecChangelog` | `string` (const: `"1.0"`) | Yes | Changelog specification version. MUST be `"1.0"`. |
| `$schema` | `string` (format: `uri`) | No | JSON Schema self-reference. |
| `definitionUrl` | `string` (format: `uri`) | Yes | Canonical URL of the Definition whose versions are compared. |
| `fromVersion` | `string` (minLength: 1) | Yes | Base version (before changes). Interpreted per the Definition's `versionAlgorithm`. |
| `toVersion` | `string` (minLength: 1) | Yes | Target version (after changes). Interpreted per the Definition's `versionAlgorithm`. |
| `generatedAt` | `string` (format: `date-time`) | No | ISO 8601 timestamp when this changelog was generated. |
| `semverImpact` | `string` (enum) | Yes | Maximum impact across all changes: `major`, `minor`, or `patch`. |
| `summary` | `string` | No | Human-readable summary for release notes. |
| `changes` | `array` of Change | Yes | Ordered array of atomic Change objects. |

## Key Type Definitions ($defs)

| Definition | Description | Key Properties | Used By |
|---|---|---|---|
| **Change** | A single atomic modification to a definition element. The combination of type + target + path uniquely identifies what changed. | `type`, `target`, `path`, `impact` (required); `key`, `description`, `before`, `after`, `migrationHint` (optional) | `changes` array items |

### Change Object Detail

| Property | Type | Required | Description |
|---|---|---|---|
| `type` | `string` (enum) | Yes | Kind of change: `added`, `removed`, `modified`, `moved`, `renamed`. |
| `target` | `string` (enum) | Yes | Category of affected element. |
| `path` | `string` (minLength: 1) | Yes | Dot-path to the affected element within the definition. |
| `key` | `string` | No | Item's key property when target is `item`. Stable identifier for cross-version matching. |
| `impact` | `string` (enum) | Yes | Severity: `breaking`, `compatible`, `cosmetic`. |
| `description` | `string` | No | Human-readable description for release notes and reviewer context. |
| `before` | any | No | Previous value/structural fragment. Present for `modified`, `removed`, `renamed`, `moved`. Omitted for `added`. |
| `after` | any | No | New value/structural fragment. Present for `added`, `modified`, `renamed`, `moved`. Omitted for `removed`. |
| `migrationHint` | `string` | No | Suggested transform: `drop`, `preserve`, or a FEL expression referencing `$old` (e.g., `$old.cost`, `string($old.amount)`). |

## Required Fields

- Top level: `$formspecChangelog`, `definitionUrl`, `fromVersion`, `toVersion`, `semverImpact`, `changes`
- Each Change: `type`, `target`, `path`, `impact`

## Enums and Patterns

| Property Path | Type | Values/Pattern | Description |
|---|---|---|---|
| `$formspecChangelog` | const | `"1.0"` | Spec version pin. |
| `semverImpact` | enum | `major`, `minor`, `patch` | Aggregate semantic-version impact for the release. |
| `Change.type` | enum | `added`, `removed`, `modified`, `moved`, `renamed` | Kind of change. |
| `Change.target` | enum | `item`, `bind`, `shape`, `optionSet`, `dataSource`, `screener`, `migration`, `metadata` | Category of affected definition element. |
| `Change.impact` | enum | `breaking`, `compatible`, `cosmetic` | Severity classification driving semver bump. |

### Impact Classification Rules

| Impact | Semver | Examples |
|---|---|---|
| `breaking` | major | Item removed, key renamed, dataType changed, required added to existing field, repeat toggled, itemType changed, option removed from closed set. |
| `compatible` | minor | Optional item added, option added, constraint relaxed, item moved, new shape/bind. |
| `cosmetic` | patch | Label/hint/description/help changed, display order changed. |

## Cross-References

- The Changelog schema is self-contained. The `Change` type is defined in `$defs` and referenced internally via `$ref: "#/$defs/Change"`.
- Changelog spec (section 6.7): migration `fieldMap` entries can be auto-generated from `migrationHint` values.

## Extension Points

None -- the Changelog schema does not include an `extensions` property.

## Validation Constraints

- `additionalProperties: false` at top level and on `Change`.
- `fromVersion` and `toVersion` enforce `minLength: 1`.
- `Change.path` enforces `minLength: 1`.
- `definitionUrl` enforces `format: uri`.
- `generatedAt` enforces `format: date-time`.
- `before` and `after` have no type constraint -- any JSON value is valid (structural fragments).
- Semantic invariant (not schema-enforceable): `semverImpact` must equal the maximum `impact` across all changes (`breaking` -> `major`, `compatible` -> `minor`, `cosmetic` -> `patch`).

---

# Conformance Suite Schema Reference Map

> schemas/conformance-suite.schema.json -- 158 lines -- Defines shared conformance test cases executed by both Python and TypeScript runners.

## Overview

The Conformance Suite schema defines the canonical contract for cross-runtime conformance test cases. Each case is executed by both the Python and TypeScript test runners to ensure behavioral parity between implementations. Cases are identified by a stable `id`, categorized by `kind` (determining execution mode), and carry expected outputs for assertion. The schema uses conditional validation (`allOf` with `if/then`) to require different properties based on the `kind` value.

## Top-Level Structure

| Property | Type | Required | Description |
|---|---|---|---|
| `id` | `string` (minLength: 1, pattern: `^[a-z0-9][a-z0-9._-]*$`) | Yes | Stable, unique case identifier. Lowercase alphanumeric with dots, underscores, hyphens. |
| `kind` | `string` (enum) | Yes | Execution mode for this case. |
| `definitionPath` | `string` (minLength: 1) | Conditional | Repository-relative path to the form definition fixture. Required for ENGINE_PROCESSING, VALIDATION_REPORT, RESPONSE_VALIDATION. |
| `registryPaths` | `array` of `string` (minItems: 1) | No | Repository-relative registry fixtures to load. |
| `payloadPath` | `string` (minLength: 1) | Conditional | Repository-relative path to the input payload fixture. Required (or `inputData`) for non-FEL kinds. |
| `inputData` | any | Conditional | Inline input payload. Alternative to `payloadPath` for non-FEL kinds. |
| `mode` | `string` (enum) | No | Validation mode: `continuous` or `submit`. For processing/report/response kinds. |
| `skipScreener` | `boolean` | No | When true, skip screener entry before evaluating the main definition. |
| `expression` | `string` (minLength: 1) | Conditional | FEL expression to evaluate. Required for FEL_EVALUATION. |
| `comparator` | `string` (enum) | Conditional | Comparison strategy. Required for FEL_EVALUATION. |
| `fields` | `array` of field objects | No | Field declarations and values for FEL_EVALUATION cases. |
| `compareResponseData` | `boolean` | No | When true, RESPONSE_VALIDATION also compares normalized response.data. |
| `expected` | `object` | Yes | Canonical expected output after shared normalization. Open object -- structure depends on `kind`. |
| `legacyCoverage` | `array` of coverage entries (minItems: 1) | Yes | Mapping of this case to replaced legacy test surfaces. |

### Field Object (within `fields` array)

| Property | Type | Required | Description |
|---|---|---|---|
| `key` | `string` (minLength: 1) | Yes | Field key identifier. |
| `dataType` | `string` (minLength: 1) | No | Data type of the field. |
| `value` | any | No | Value to assign to the field. |

### Legacy Coverage Entry

| Property | Type | Required | Description |
|---|---|---|---|
| `path` | `string` (minLength: 1) | Yes | Repository-relative path of the replaced legacy test surface. |
| `check` | `string` (minLength: 1) | Yes | Legacy test id/name/check this case replaces. |

## Key Type Definitions ($defs)

| Definition | Description | Key Properties | Used By |
|---|---|---|---|
| **standardValidationCode** | Standard validation result codes that both runtimes MUST emit identically. | enum of 14 string values | Not `$ref`'d in this schema -- serves as a normative vocabulary contract for test runners. |

### standardValidationCode Enum (exhaustive)

| Code | Category |
|---|---|
| `REQUIRED` | Built-in (validationResult reserved) |
| `TYPE_MISMATCH` | Built-in (validationResult reserved) |
| `MIN_REPEAT` | Built-in (validationResult reserved) |
| `MAX_REPEAT` | Built-in (validationResult reserved) |
| `CONSTRAINT_FAILED` | Built-in (validationResult reserved) |
| `PATTERN_MISMATCH` | Built-in (validationResult reserved) |
| `MAX_LENGTH_EXCEEDED` | Built-in (validationResult reserved) |
| `RANGE_UNDERFLOW` | Built-in (validationResult reserved) |
| `RANGE_OVERFLOW` | Built-in (validationResult reserved) |
| `SHAPE_FAILED` | Built-in (validationResult reserved) |
| `UNRESOLVED_EXTENSION` | Registry extension code |
| `EXTENSION_COMPATIBILITY_MISMATCH` | Registry extension code |
| `EXTENSION_RETIRED` | Registry extension code |
| `EXTENSION_DEPRECATED` | Registry extension code |

## Required Fields

- Always required: `id`, `kind`, `expected`, `legacyCoverage`
- When `kind` is `FEL_EVALUATION`: `expression`, `comparator` (additional)
- When `kind` is `ENGINE_PROCESSING`, `VALIDATION_REPORT`, or `RESPONSE_VALIDATION`: `definitionPath`, and one of (`payloadPath` or `inputData`)

## Enums and Patterns

| Property Path | Type | Values/Pattern | Description |
|---|---|---|---|
| `id` | pattern | `^[a-z0-9][a-z0-9._-]*$` | Must start with lowercase letter or digit, then only lowercase letters, digits, dots, underscores, hyphens. |
| `kind` | enum | `FEL_EVALUATION`, `ENGINE_PROCESSING`, `VALIDATION_REPORT`, `RESPONSE_VALIDATION` | Execution mode. |
| `mode` | enum | `continuous`, `submit` | Validation mode for processing/report/response kinds. |
| `comparator` | enum | `exact`, `normalized`, `tolerant-decimal` | Comparison strategy for FEL_EVALUATION cases. |
| `$defs.standardValidationCode` | enum | `REQUIRED`, `TYPE_MISMATCH`, `MIN_REPEAT`, `MAX_REPEAT`, `CONSTRAINT_FAILED`, `PATTERN_MISMATCH`, `MAX_LENGTH_EXCEEDED`, `RANGE_UNDERFLOW`, `RANGE_OVERFLOW`, `SHAPE_FAILED`, `UNRESOLVED_EXTENSION`, `EXTENSION_COMPATIBILITY_MISMATCH`, `EXTENSION_RETIRED`, `EXTENSION_DEPRECATED` | Standard codes both runtimes must emit identically. |

## Cross-References

- The Conformance Suite schema is self-contained. It references external fixture files by repository-relative path (strings), not by `$ref`.
- The `standardValidationCode` $def cross-references the reserved codes from `validationResult.schema.json` plus registry extension codes from the extension registry spec.

## Extension Points

None -- the Conformance Suite schema does not include an `extensions` property.

## Validation Constraints

- `additionalProperties: false` at top level, on field objects, and on legacy coverage entries.
- `id` enforces both `minLength: 1` and `pattern: "^[a-z0-9][a-z0-9._-]*$"`.
- `registryPaths` enforces `minItems: 1` when present (if provided, must have at least one entry).
- `legacyCoverage` enforces `minItems: 1` -- every case must document at least one replaced legacy check.
- `expected` is an open object (`type: object` with no `additionalProperties` restriction on its contents) -- its structure depends on the `kind`.
- `inputData` has no type constraint -- any JSON value is valid.
- Conditional validation via `allOf` with `if/then`:
  - **FEL_EVALUATION cases**: `expression` and `comparator` become required. `fields` is allowed as an array.
  - **ENGINE_PROCESSING / VALIDATION_REPORT / RESPONSE_VALIDATION cases**: `definitionPath` becomes required. Exactly one of `payloadPath` or `inputData` must be present (`oneOf`).
