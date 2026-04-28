# Manual → AI Capability Parity Matrix

| Field | Value |
| --- | --- |
| Status | Draft |
| Scope | `packages/formspec-studio` |
| Source PRD | `2026-04-27-prd-unified-authoring-ai-manual-parity.md` |

## Legend

- **Parity status**: `parity-ready`, `partial`, `missing`
- **Confidence**: `high`, `medium`, `low`

## Matrix

| Capability | Parity status | Manual path | AI path | Touched objects | Validation/policy gates | Confidence | Missing primitives / gap | Owner | Milestone |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Definition metadata (title, status, presentation) | parity-ready | `SettingsDialog` via [`Header.tsx`](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/Header.tsx) and [`SettingsDialog.tsx`](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/SettingsDialog.tsx) | Capability command path in [`ChatPanel.tsx`](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/ChatPanel.tsx): `/metadata {"action":"set",...}` | `definition` object, patches/provenance | `project.diagnose()`, merge replay checks | high | Maintain deterministic metadata summary copy in review cards | Studio app | M2 |
| Field/group create/edit/delete/reorder | parity-ready | Editor tree + properties (e.g. [`ItemRow.tsx`](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/editor/ItemRow.tsx), properties panels) | Chat tool execution through `ProjectRegistry` dispatch + capability telemetry in [`ChatPanel.tsx`](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/ChatPanel.tsx) | `definition.items`, provenance/patch refs | Proposal merge/replay checks, diagnostics | high | Expand AI command shortcuts for bulk reorder ergonomics | Studio app | M2 |
| Bind/rule edits | parity-ready | Editor/manual controls + definition properties | Capability command path in [`ChatPanel.tsx`](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/ChatPanel.tsx): `/bind {"action":"showWhen-or-require-or-calculate",...}` | `definition.binds`, provenance + patches | merge replay + structural/expression diagnostics | high | Add batch bind editing ergonomics (multi-target commands) | Studio app | M2 |
| Layout placement and overrides | parity-ready | Layout workspace direct manipulation in Shell tab stack (`Layout` tab in [`Shell.tsx`](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/Shell.tsx)) | Capability command path in [`ChatPanel.tsx`](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/ChatPanel.tsx): `/layout` with `place`, `hide`, and `unhide` actions | layout docs in `x-studio` extension + component/layout trees | layout validity + drift checks (where present) | medium | Expand move/reorder ergonomics in follow-up command set | Layout owners | M3 |
| Mapping transforms | parity-ready | Mapping tab manual editing (`activeMappingTab` in [`Shell.tsx`](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/Shell.tsx)) | Capability command path in [`ChatPanel.tsx`](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/ChatPanel.tsx): `/mapping` with `setProperty`, `addRule`, `setAdapter`, and `updateDefaults` actions | mapping config docs + patch/provenance | mapping schema validity checks | medium | Expand rule-update/delete command ergonomics | Mapping owners | M3 |
| Evidence links/citations | parity-ready | Evidence workspace and provenance display surfaces | Capability command path in [`ChatPanel.tsx`](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/ChatPanel.tsx): `/evidence` with `link`, `markConflict`, and `resolve` actions | `x-studio.evidence.documents`, provenance `sourceRefs` | evidence consistency checks | medium | Add richer multi-source conflict merge UI | Evidence owners | M4 |
| Patch lifecycle (open/accept/reject/revert) | parity-ready | Manual edits use `recordManualPatchAndProvenance` in [`studio-intelligence-writer.ts`](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/shared/studio-intelligence-writer.ts) | AI changesets in [`ChatPanel.tsx`](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/ChatPanel.tsx) emit open/accept/reject patches through `recordAiPatchLifecycle` | `x-studio.patches`, `x-studio.provenance` | merge replay + diagnostic gates | high | Keep fallback reason taxonomy stable as command catalog grows | Studio app | M2 |
| Export/publish-adjacent actions | parity-ready | Header account menu `Export` in [`Header.tsx`](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/Header.tsx) wired by [`Shell.tsx`](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/Shell.tsx) | Capability command path in [`ChatPanel.tsx`](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/ChatPanel.tsx): `/export {"action":"prepare","format":"zip"}` + explicit confirmation | exported bundle/archive artifacts | export schema validation + explicit confirmation gate | high | Add provider-specific publish adapters as a separate milestone | Studio app | M2 |

## Notes

1. Current chat integration already routes through MCP dispatch (`ProjectRegistry` + `createToolDispatch`), which is the strongest foundation for parity work.
2. Highest-leverage gap to close first: normalize AI patch/provenance writes via shared writer helpers, then add capability telemetry.
3. Remaining deficits are primarily command ergonomics (bulk/move/update variants), not missing AI paths.

## Release Readiness Gate (Parity)

A capability row can move to `parity-ready` only when all checks pass:

- unit equivalence coverage for manual vs AI handler semantics
- integration evidence that both methods emit compatible patch/provenance objects
- e2e evidence that the capability can be completed in AI-only flow
- telemetry observed for `authoring_capability_method_used` with no unresolved fallback spikes

## Evidence Links

- Unit/integration: `packages/formspec-studio/tests/workspaces/shared/studio-intelligence-writer.test.ts`
- Capability command integration: `packages/formspec-studio/tests/components/chat-panel-scaffold.test.tsx`
- AI-first e2e: `packages/formspec-studio/tests/e2e/playwright/onboarding.spec.ts`
- Accessibility/usability validation log: `thoughts/studio/2026-04-27-ai-manual-parity-validation.md`
- Policy decisions + gate checklist: `thoughts/studio/2026-04-27-unified-authoring-policy-decisions.md`

## Release Gate Review (Current)

- **Pass**: Shared patch/provenance writer used by manual + AI paths.
- **Pass**: Capability-level telemetry includes method + fallback with normalized taxonomy.
- **Pass**: Diff-first proposal review enforced for AI capability commands (`/layout`, `/mapping`, `/evidence`).
- **Pass**: Matrix now meets >=80% `parity-ready` threshold with linked evidence and policy checklist.
