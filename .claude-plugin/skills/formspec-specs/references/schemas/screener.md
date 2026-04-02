# Screener Schema Reference Map

> schemas/screener.schema.json -- 286 lines -- Standalone screener document for respondent classification and routing

## Overview

The Screener schema describes a freestanding routing instrument that classifies respondents and directs them to appropriate Formspec Definitions, external URIs, or named outcomes. Unlike the inline `screener` property within a Definition, this is a standalone document with its own identity (`url`, `version`), lifecycle primitives (availability windows, result validity durations, evaluation version binding), and an ordered evaluation pipeline with pluggable strategies. Screener items reuse the standard Formspec Item and Bind schemas from the Definition spec but are evaluated in an isolated scope -- they do not interact with any Definition's data or binds.

## Top-Level Structure

| Property | Type | Required | Description |
|---|---|---|---|
| `$formspecScreener` | `string` (const `"1.0"`) | Yes | Screener specification version. MUST be `"1.0"`. Processors MUST reject screeners with an unrecognized version. |
| `url` | `string` (format: `uri`) | Yes | Canonical, stable URI identifying this screener. MUST be globally unique. The pair `(url, version)` uniquely identifies a specific screener revision. URN syntax is acceptable. |
| `version` | `string` (minLength: 1) | Yes | Semantic version of this Screener Document (semver 2.0.0). Independent of any Definition version. |
| `title` | `string` | Yes | Human-readable name for the screener. |
| `description` | `string` | No | Purpose description for the screener. |
| `availability` | `$ref: Availability` | No | Calendar window during which the screener accepts new respondents. When omitted, the screener is always available. |
| `resultValidity` | `string` (pattern: ISO 8601 duration) | No | ISO 8601 duration declaring how long a completed Determination Record remains valid before re-screening is required. When omitted, no expiration. |
| `evaluationBinding` | `string` (enum) | No | Which version of the screener's evaluation logic governs when updated between session start and completion. Default: `"submission"`. |
| `items` | `array` of `$ref: definition#/$defs/Item` | Yes | Screening items using the standard Formspec Item schema (core S4.2). NOT part of any form's instance data -- exist only for routing classification. Item keys MUST be unique within the Screener Document. |
| `binds` | `array` of `$ref: definition#/$defs/Bind` | No | Bind declarations scoped to screener items using the standard Formspec Bind schema (core S4.3). Paths reference screener item keys. Evaluated in the screener's own scope -- do NOT interact with any Definition's binds. |
| `evaluation` | `array` of `$ref: Phase` | Yes | Ordered evaluation pipeline. Phases execute in declaration order. Override routes are hoisted and evaluated before all phases. |
| `extensions` | `object` (propertyNames: `^x-`) | No | Extension declarations. Uses the same extension mechanism as Definition (core S4.6). |

The root object has `additionalProperties: false` -- no unlisted properties are allowed.

## Key Type Definitions ($defs)

| Definition | Description | Key Properties | Used By |
|---|---|---|---|
| **Availability** | Calendar window during which the screener accepts new respondents. Either or both properties may be omitted for open-ended windows. | `from`, `until` | `properties.availability` |
| **Phase** | A single stage in the evaluation pipeline. Declares a strategy that determines how its routes are evaluated. Phases execute in declaration order and produce independent results aggregated into the Determination Record. | `id`, `label`, `description`, `strategy`, `routes`, `activeWhen`, `config` | `properties.evaluation` (array items) |
| **Route** | A single routing rule within an evaluation phase. Combines a condition or score expression with a target destination. Override routes are hoisted out of their phase and evaluated before all phases. | `condition`, `score`, `threshold`, `target`, `label`, `message`, `metadata`, `override`, `terminal` | `Phase.routes` (array items) |

## Required Fields

### Top-Level (Screener Root)
- `$formspecScreener`, `url`, `version`, `title`, `items`, `evaluation`

### Phase
- `id`, `strategy`, `routes`

### Route
- `target`

## Enums and Patterns

| Property Path | Type | Values/Pattern | Description |
|---|---|---|---|
| `$formspecScreener` | const | `"1.0"` | Screener specification version pin. |
| `evaluationBinding` | enum | `submission`, `completion` | Which version of evaluation logic governs when screener is updated mid-session. |
| `resultValidity` | pattern | `^P(?:\d+Y)?(?:\d+M)?(?:\d+W)?(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+S)?)?$` | ISO 8601 duration for Determination Record validity. |
| `Phase.id` | pattern | `^[a-zA-Z][a-zA-Z0-9_-]*$` | Phase identifier within the screener. Alphanumeric, hyphens, underscores. |
| `Phase.strategy` | pattern | `^(first-match\|fan-out\|score-threshold\|x-.+)$` | Evaluation strategy. Normative: `first-match`, `fan-out`, `score-threshold`. Extensions: `x-` prefix. |

## Detailed Type Structures

### Availability

| Property | Type | Required | Description |
|---|---|---|---|
| `from` | `string` (format: `date`) | No | Earliest date (inclusive) on which the screener accepts respondents. If omitted, no start constraint. |
| `until` | `string` (format: `date`) | No | Latest date (inclusive) on which the screener accepts respondents. If omitted, no end constraint. |

`additionalProperties: false`.

### Phase

| Property | Type | Required | Description |
|---|---|---|---|
| `id` | `string` (pattern: `^[a-zA-Z][a-zA-Z0-9_-]*$`) | Yes | Unique identifier for this phase within the Screener. |
| `label` | `string` | No | Human-readable name for this phase. |
| `description` | `string` | No | Description of this phase's purpose. |
| `strategy` | `string` (pattern: `^(first-match\|fan-out\|score-threshold\|x-.+)$`) | Yes | Evaluation strategy. Core conformance requires `first-match`. Complete conformance requires all three normative strategies. |
| `routes` | `array` of `$ref: Route` | Yes | Routes to evaluate using this phase's strategy. |
| `activeWhen` | `$ref: definition#/$defs/FELExpression` | No | When present, the phase is evaluated only when this expression evaluates to true. When absent, the phase always evaluates. |
| `config` | `object` | No | Strategy-specific configuration. See config sub-properties below. |

`additionalProperties: false`.

#### Phase.config Sub-Properties

| Property | Type | Description | Strategy |
|---|---|---|---|
| `minMatches` | `integer` (minimum: 0) | Minimum routes that must match for success. | fan-out |
| `maxMatches` | `integer` (minimum: 1) | Maximum matched routes to include. | fan-out |
| `topN` | `integer` (minimum: 1) | Return only the top N scoring routes. | score-threshold |
| `normalize` | `boolean` (default: `false`) | When true, normalize scores to 0.0-1.0 range before threshold comparison. | score-threshold |

`Phase.config` has `additionalProperties: true` -- extension strategies may add custom config properties.

### Route

| Property | Type | Required | Description |
|---|---|---|---|
| `condition` | `$ref: definition#/$defs/FELExpression` | No | Boolean FEL expression evaluated against screener item values. Required for `first-match` and `fan-out` strategies. |
| `score` | `$ref: definition#/$defs/FELExpression` | No | Numeric FEL expression evaluated against screener item values. Required for `score-threshold` strategy. |
| `threshold` | `number` | No | Minimum score required for this route to match (`score >= threshold`). Required for `score-threshold` strategy. |
| `target` | `string` | Yes | Route destination URI. May be a Definition reference (`url\|version`), an external URI, or a named outcome (`outcome:name`). |
| `label` | `string` | No | Human-readable route description. |
| `message` | `string` | No | Human-readable message displayed to the respondent when this route matches. MAY contain `{{expression}}` interpolation sequences. |
| `metadata` | `object` (additionalProperties: `true`) | No | Arbitrary key-value metadata attached to the route. Preserved in the Determination Record without interpretation by the processor. |
| `override` | `boolean` (default: `false`) | No | When true, this route is an override route. Override routes are hoisted out of their phase and evaluated before all phases. |
| `terminal` | `boolean` (default: `false`) | No | When true and the override matches, the entire evaluation pipeline halts. Ignored when `override` is false. |

`additionalProperties: false`.

## Cross-References

- **Items**: `items` array references `https://formspec.org/schemas/definition/1.0#/$defs/Item` -- the standard Formspec Item schema from the Definition (core S4.2).
- **Binds**: `binds` array references `https://formspec.org/schemas/definition/1.0#/$defs/Bind` -- the standard Formspec Bind schema (core S4.3).
- **FEL Expressions**: `Route.condition`, `Route.score`, and `Phase.activeWhen` all reference `https://formspec.org/schemas/definition/1.0#/$defs/FELExpression` for FEL expression strings.
- **Extensions**: Uses the same `x-` prefix extension mechanism as Definition (core S4.6).
- **Screener Spec**: Behavioral semantics for evaluation strategies (`first-match`, `fan-out`, `score-threshold`), override hoisting, Determination Record structure, and lifecycle primitives are defined in the screener specification (`specs/screener/`).
- **Determination Schema**: The output of screener evaluation is a Determination Record, defined in a separate schema (`schemas/determination.schema.json`).
- **Route Targets**: Three categories of `target` values -- Definition references (`url|version`), external URIs, and named outcomes (`outcome:name`) -- with behavioral semantics defined in the screener spec.

## Extension Points

- **`extensions`** (top-level): Object with `propertyNames: "^x-"` pattern. Arbitrary extension data using the standard Formspec extension mechanism.
- **`Phase.strategy`**: Extension strategies MUST use the `x-` prefix (e.g., `x-constraint-satisfaction`). The pattern `^(first-match|fan-out|score-threshold|x-.+)$` enforces this.
- **`Phase.config`**: Has `additionalProperties: true`, allowing extension strategies to define custom configuration properties.
- **`Route.metadata`**: Has `additionalProperties: true`, allowing arbitrary key-value pairs preserved in the Determination Record without processor interpretation.

## Validation Constraints

- **`$formspecScreener`**: Must be exactly `"1.0"` (const).
- **`url`**: Must be a valid URI (format: `uri`).
- **`version`**: Must have `minLength: 1` (non-empty string).
- **`resultValidity`**: Must match ISO 8601 duration pattern `^P(?:\d+Y)?(?:\d+M)?(?:\d+W)?(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+S)?)?$`.
- **`Phase.id`**: Must match `^[a-zA-Z][a-zA-Z0-9_-]*$` (starts with letter, alphanumeric/hyphen/underscore).
- **`Phase.strategy`**: Must match `^(first-match|fan-out|score-threshold|x-.+)$` (normative or extension prefix).
- **`Phase.config.minMatches`**: Integer, minimum 0.
- **`Phase.config.maxMatches`**: Integer, minimum 1.
- **`Phase.config.topN`**: Integer, minimum 1.
- **`Availability.from` / `Availability.until`**: Must be valid dates (format: `date`).
- **Root, Availability, Phase, Route**: All have `additionalProperties: false` (strict property sets).
- **Strategy-route alignment** (spec-level, not schema-enforced): `first-match` and `fan-out` routes require `condition`; `score-threshold` routes require `score` and `threshold`. The schema does not enforce this per-strategy requirement -- it is a behavioral contract in the spec.

## Evaluation Strategy Summary

| Strategy | Required Route Properties | Config Properties | Behavior |
|---|---|---|---|
| `first-match` | `condition` | -- | Evaluates routes in order; first matching route wins. |
| `fan-out` | `condition` | `minMatches`, `maxMatches` | Evaluates all routes; collects all matches (bounded by config). |
| `score-threshold` | `score`, `threshold` | `topN`, `normalize` | Evaluates score expressions; routes with `score >= threshold` match. |
| `x-*` (extension) | strategy-defined | strategy-defined (via `additionalProperties`) | Extension-specific behavior. |

## x-lm Critical Annotations

The following properties are annotated with `x-lm.critical: true`, meaning they MUST include both `description` and at least one `examples` entry:

| Property | Intent |
|---|---|
| `$formspecScreener` | Version pin for screener document compatibility. Processors MUST reject screeners with an unrecognized version. |
| `url` | Stable identifier of the screener across versions. |
| `version` | Screener revision identifier. Enables auditing which screener version produced a given Determination Record. |
| `title` | Display name shown to respondents and in authoring tools. |
| `items` | The data collection elements of the screener. Same schema as Definition items but evaluated in an isolated scope. |
| `evaluation` | The routing logic of the screener. Each phase declares a strategy and a set of routes. |
| `Phase.strategy` | Determines how routes in this phase are evaluated. Core conformance requires `first-match`. Complete conformance requires all three normative strategies. |
| `Route.target` | Where the respondent is directed when this route matches. Three categories: Definition references, external URIs, and named outcomes. |
