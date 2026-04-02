# Determination Schema Reference Map

> schemas/determination.schema.json -- 235 lines -- Formspec Determination Record

## Overview

The Determination schema describes the structured output artifact produced by evaluating a Screener Document against respondent inputs. A Determination Record captures the complete evaluation outcome: which routes matched, which were eliminated and why, computed scores, the respondent's input values with answer states, and evaluation metadata. The record references the specific screener version that produced it via the `(screener.url, screener.version)` tuple. Determination Records are immutable once produced; status may transition from `completed` to `expired` when the screener's `resultValidity` duration elapses, but the evaluation data itself is never modified.

## Top-Level Structure

| Property | Type | Required | Description |
|---|---|---|---|
| `$formspecDetermination` | `string` (const `"1.0"`) | Yes | Determination Record specification version. MUST be `"1.0"`. |
| `screener` | `object` | Yes | Reference to the Screener Document that produced this record. The `(url, version)` tuple uniquely identifies the screener revision. |
| `timestamp` | `string` (format: `date-time`) | Yes | ISO 8601 date-time when the evaluation completed. |
| `evaluationVersion` | `string` | Yes | Version of the Screener Document's evaluation logic applied. Reflects `evaluationBinding` policy (`submission` vs `completion`). |
| `status` | `string` (enum: `completed`, `partial`, `expired`, `unavailable`) | Yes | Evaluation outcome status. Consuming applications MUST check status before acting on matched routes. |
| `overrides` | `object` | Yes | Results of override route evaluation. Override routes are hoisted out of their declaring phase and evaluated before all phases. |
| `phases` | `array` of `$ref: PhaseResult` | Yes | Per-phase evaluation results in declaration order. Empty array if overrides halted the pipeline. |
| `inputs` | `object` (additionalProperties: `$ref: InputEntry`) | Yes | Map of item path to `{ value, state }` for every screener item. Keys use Formspec path syntax including indexed repeat paths. |
| `validity` | `object` | No | Expiration metadata derived from the screener's `resultValidity` duration. Omitted when the screener does not declare `resultValidity`. |
| `extensions` | `object` (propertyNames: `^x-`) | No | Extension data on the Determination Record. Uses the same `x-` prefixed extension mechanism as other Formspec documents. |

The root object has `additionalProperties: false` -- no unlisted properties are allowed.

### screener Sub-Properties

| Property | Type | Required | Description |
|---|---|---|---|
| `url` | `string` (format: `uri`) | Yes | Canonical URI of the screener that produced this record. |
| `version` | `string` | Yes | Semantic version of the screener that produced this record. |

`screener` has `additionalProperties: false`.

### overrides Sub-Properties

| Property | Type | Required | Description |
|---|---|---|---|
| `matched` | `array` of `$ref: RouteResult` | Yes | Override routes that fired. Empty array when no overrides matched. |
| `halted` | `boolean` | Yes | `true` if a terminal override halted the pipeline. When `true`, the `phases` array is empty because no phases were evaluated. |

`overrides` has `additionalProperties: false`.

### validity Sub-Properties

| Property | Type | Required | Description |
|---|---|---|---|
| `validUntil` | `string` (format: `date-time`) | No | When this Determination Record expires. Computed as `timestamp + resultValidity`. |
| `resultValidity` | `string` | No | The original ISO 8601 duration from the Screener Document. |

`validity` has `additionalProperties: false`.

## Key Type Definitions ($defs)

| Definition | Description | Key Properties | Used By |
|---|---|---|---|
| **PhaseResult** | Evaluation result for a single phase in the pipeline. Captures the phase's status, strategy, matched and eliminated routes, and any phase-level warnings. | `id`, `status`, `strategy`, `matched`, `eliminated`, `warnings` | `properties.phases.items` |
| **RouteResult** | A single route's evaluation outcome within a phase or override block. Present in both `matched` and `eliminated` arrays. Eliminated results include a reason. | `target`, `label`, `message`, `score`, `reason`, `metadata` | `PhaseResult.matched`, `PhaseResult.eliminated`, `overrides.matched` |
| **InputEntry** | A single screener item's captured value and answer state at evaluation time. The key in the `inputs` map is the item's Formspec path. | `value`, `state` | `properties.inputs` (as additionalProperties) |

### PhaseResult Properties

| Property | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | Phase identifier, matching the `id` of the corresponding Phase in the Screener Document. |
| `status` | `string` (enum: `evaluated`, `skipped`, `unsupported-strategy`) | Yes | `evaluated`: phase ran normally. `skipped`: phase's `activeWhen` was false. `unsupported-strategy`: processor does not support this strategy (Core conformance only requires `first-match`). |
| `strategy` | `string` | Yes | The evaluation strategy that was used (or would have been used if skipped/unsupported). |
| `matched` | `array` of `$ref: RouteResult` | Yes | Routes that matched in this phase. |
| `eliminated` | `array` of `$ref: RouteResult` | Yes | Routes that did not match in this phase, with reasons for elimination. |
| `warnings` | `array` of `string` (default: `[]`) | No | Phase-level warnings emitted during evaluation (e.g., `below-minimum` when fan-out matches fewer than `config.minMatches`). |

`PhaseResult` has `additionalProperties: false`.

### RouteResult Properties

| Property | Type | Required | Description |
|---|---|---|---|
| `target` | `string` | Yes | The route's target URI. Matches the `target` property of the corresponding Route in the Screener Document. |
| `label` | `string` | No | The route's human-readable label, copied from the Screener Document. |
| `message` | `string` | No | The route's respondent-facing message. If the Screener Route contained `{{expression}}` interpolation sequences, the message is the post-interpolation result. |
| `score` | `number` | No | The computed score for score-threshold routes. Present only when the route was evaluated under a `score-threshold` strategy. |
| `reason` | `string` | No | Why the route was eliminated: `condition-false`, `below-threshold`, `max-exceeded`, `null-score`. Present only in the `eliminated` array. |
| `metadata` | `object` (additionalProperties: `true`) | No | The route's arbitrary metadata, copied from the Screener Document without interpretation. |

`RouteResult` has `additionalProperties: false`.

### InputEntry Properties

| Property | Type | Required | Description |
|---|---|---|---|
| `value` | any JSON type | No | The item's value at evaluation time. May be string, number, boolean, array, object, or null. `null` when state is `declined` or `not-presented`. |
| `state` | `string` (enum: `answered`, `declined`, `not-presented`) | Yes | `answered`: respondent provided a value. `declined`: item was presented but respondent explicitly declined. `not-presented`: item was not shown (e.g., relevance was false). |

`InputEntry` has `additionalProperties: false`.

## Required Fields

### Top-Level (Determination Root)
- `$formspecDetermination`, `screener`, `timestamp`, `evaluationVersion`, `status`, `overrides`, `phases`, `inputs`

### screener
- `url`, `version`

### overrides
- `matched`, `halted`

### PhaseResult
- `id`, `status`, `strategy`, `matched`, `eliminated`

### RouteResult
- `target`

### InputEntry
- `state`

## Enumerations

| Enum | Allowed Values | Used At |
|---|---|---|
| `status` | `completed`, `partial`, `expired`, `unavailable` | Top-level `status` |
| PhaseResult `status` | `evaluated`, `skipped`, `unsupported-strategy` | `PhaseResult.status` |
| InputEntry `state` | `answered`, `declined`, `not-presented` | `InputEntry.state` |

## Enums and Patterns

| Property Path | Type | Values/Pattern | Description |
|---|---|---|---|
| `status` | enum | `completed`, `partial`, `expired`, `unavailable` | Evaluation outcome status |
| `PhaseResult.status` | enum | `evaluated`, `skipped`, `unsupported-strategy` | Phase evaluation outcome |
| `InputEntry.state` | enum | `answered`, `declined`, `not-presented` | Item answer state at evaluation time |
| `RouteResult.reason` | string (not enum-constrained) | `condition-false`, `below-threshold`, `max-exceeded`, `null-score` (documented values) | Why a route was eliminated. Not schema-enforced as an enum but documented with these expected values. |
| `extensions` propertyNames | pattern | `^x-` | Extension key prefix requirement |

## Cross-References

### Internal $refs (within determination.schema.json)
- `properties.phases.items` -> `#/$defs/PhaseResult`
- `PhaseResult.matched.items` -> `#/$defs/RouteResult`
- `PhaseResult.eliminated.items` -> `#/$defs/RouteResult`
- `overrides.matched.items` -> `#/$defs/RouteResult`
- `properties.inputs.additionalProperties` -> `#/$defs/InputEntry`

### External References (semantic, not $ref)
- `screener.url` + `screener.version` tuple references the Screener Document that produced this record (defined in `schemas/definition.schema.json` under `$defs/Screener`, or as a standalone screener schema).
- `PhaseResult.id` matches the `id` of the corresponding Phase in the Screener Document.
- `RouteResult.target` matches the `target` property of the corresponding Route in the Screener Document.
- `inputs` keys use Formspec path syntax (defined in the Core spec) including indexed repeat paths (e.g., `group[0].field`).
- `evaluationVersion` reflects the screener's `evaluationBinding` policy (`submission` or `completion`), defined in the Screener specification.
- `validity.resultValidity` is the ISO 8601 duration from the Screener Document's `resultValidity` field.

### No external schema $refs
The Determination schema is self-contained. It does not `$ref` any other schema files at the JSON Schema level.

## Extension Points

### Extension Object (propertyNames pattern: `^x-`)
Extensions are supported at one level:

1. **Top-level** `extensions` -- determination-wide domain-specific data

All extension keys MUST be prefixed with `x-`. Processors MUST ignore unrecognized extensions without error. Extensions MUST NOT alter core semantics.

### RouteResult metadata
`RouteResult.metadata` has `additionalProperties: true` -- it accepts arbitrary key-value pairs copied from the Screener Document without interpretation. This is an open object, not an `x-` prefixed extension point.

## Validation Constraints

### Const Values
| Property | Const |
|---|---|
| `$formspecDetermination` | `"1.0"` |

### Format Constraints
| Format | Applied To |
|---|---|
| `uri` | `screener.url` |
| `date-time` | `timestamp`, `validity.validUntil` |

### Default Values
| Property | Default |
|---|---|
| `PhaseResult.warnings` | `[]` (empty array) |

### additionalProperties Restrictions
All definitions use `additionalProperties: false`, meaning only declared properties are allowed:
- Root Determination object
- `screener`
- `overrides`
- `validity`
- `PhaseResult`
- `RouteResult`
- `InputEntry`

**Exception**: `RouteResult.metadata` has `additionalProperties: true` -- it is an open object for arbitrary route metadata.

### Non-Obvious Behavioral Rules (from descriptions, not schema-enforceable)
- Determination Records are **immutable** once produced. The evaluation data is never modified.
- `status` may transition from `completed` to `expired` when the screener's `resultValidity` duration elapses, but this is the only permitted post-production status change.
- `status: "unavailable"` means the screener was outside its availability window and **no evaluation was performed** -- the `phases` and `overrides.matched` arrays will be empty.
- `status: "partial"` means not all items were answered; evaluation ran on available data.
- When `overrides.halted` is `true`, the `phases` array is empty because override termination short-circuits all phase evaluation.
- `RouteResult.score` is only present for routes evaluated under a `score-threshold` strategy.
- `RouteResult.reason` is only present in the `eliminated` array, never in `matched`.
- `RouteResult.reason: "null-score"` indicates the score expression evaluated to null (e.g., due to non-relevant items).
- `RouteResult.message` contains post-interpolation text -- any `{{expression}}` sequences in the Screener Route have already been resolved.
- `InputEntry.value` is `null` when `state` is `declined` or `not-presented`.
- `inputs` keys use Formspec path syntax and may include indexed repeat paths (e.g., `group[0].field`).
- `evaluationVersion` depends on the screener's `evaluationBinding` policy: `submission` freezes the version at session start; `completion` uses the version at evaluation time.
- `validity.validUntil` is computed as `timestamp + resultValidity`; it is not independently authored.

## x-lm Annotations

### x-lm.critical = true

| Property Path | Intent |
|---|---|
| `$formspecDetermination` | Version pin for Determination Record compatibility. Processors MUST reject records with an unrecognized version. |
| `screener` | Provenance link to the exact screener revision. Enables auditing and reproducibility. |
| `status` | Evaluation outcome status. Consuming applications MUST check status before acting on matched routes. |
| `inputs` | Complete snapshot of respondent inputs at evaluation time. Enables auditing and replay without re-collecting data. |

### x-lm.intent
Every `x-lm.critical` node also has an `x-lm.intent` string explaining why that property is critical. See the table above for the intent values.
