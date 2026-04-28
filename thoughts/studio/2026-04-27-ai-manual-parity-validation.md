# AI/Manual Parity Validation Log

## Accessibility and keyboard checks

- [x] Assistant composer remains keyboard-first (`Enter` send, `Shift+Enter` newline).
- [x] Review controls remain reachable after AI capability commands open a changeset.
- [x] Command palette open/close parity (`Cmd/Ctrl+K`, `Escape`) still passes in assistant surface e2e.
- [x] Assistant-to-manual CTA remains explicit (`Open manual controls`) without forced transition language.

## AI-only usability runbook

Scripted journeys validated:

1. AI capability command for mapping creates reviewable proposal and can be accepted without opening manual panes.
2. AI capability command for evidence links creates reviewable proposal and persists evidence linkage after accept.
3. AI capability command for layout edits creates reviewable proposal and follows the same accept/reject flow.
4. AI capability command for metadata/bind/export follows the same review or explicit confirmation pattern.

Observed dead-end/fallback expectations:

- Invalid capability payloads produce system errors and emit fallback telemetry (`capability_command_parse_error`).
- Execution failures (invalid targets, missing pages) emit fallback telemetry (`capability_command_execution_error`).

## Notes

- This log is evidence input for the matrix gate (`unit + integration + e2e + telemetry`) and PRD acceptance review.
- Policy decisions for confirmation, batching, and pane visibility: `thoughts/studio/2026-04-27-unified-authoring-policy-decisions.md`.

## Telemetry audit checklist

- [x] Capability method events emit `ai_only/manual_only/mixed` semantics.
- [x] Fallback events emit normalized reasons from `authoring-fallback-reasons`.
- [x] Outcome values remain constrained to `open|accepted|rejected|applied|fallback`.
- [x] Export confirmation/cancel path emits method/fallback telemetry consistently.
