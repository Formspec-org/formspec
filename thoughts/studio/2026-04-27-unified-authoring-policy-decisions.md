# Unified Authoring Policy Decisions

## Scope

Resolves PRD open questions for confirmation requirements, cross-domain proposal batching, and manual-pane visibility defaults.

## UA-401: Mandatory Human Confirmation Policy

- **Always require explicit confirmation**
  - export/publish-adjacent actions
  - evidence conflict-resolution actions
  - multi-item destructive actions (delete, unplace, bulk override)
- **Diff-review confirmation sufficient**
  - metadata updates
  - bind/rule edits
  - layout placements and mapping transforms

## UA-402: Cross-Domain Batching Policy

- **Default:** single-domain proposals (`metadata`, `bind`, `layout`, `mapping`, `evidence`, `export_publish`).
- **Allowed:** cross-domain batches only when explicitly requested and presented as grouped dependency blocks.
- **Guardrail:** each domain block must show an impacted-scope summary and independent accept/reject controls where possible.

## UA-403: Manual Pane Visibility Default

- **Default shell posture:** AI-first with manual panes discoverable but not forced open.
- **Behavioral rule:** no required workflow step may depend on opening manual panes.
- **Discoverability rule:** retain contextual CTAs (for example, `Open manual controls`) without implying mandatory phase transition.

## Gate Enforcement Checklist

A capability row may be marked `parity-ready` only after all checklist entries are linked:

1. Unit equivalence test reference
2. Integration parity test reference
3. E2E AI-only path reference
4. Telemetry validation evidence (`method + fallback` semantics)
5. Accessibility/usability note reference
