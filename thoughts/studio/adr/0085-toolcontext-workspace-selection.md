# ADR 0085: ToolContext Workspace Selection

**Status:** Proposed
**Date:** 2026-04-28
**Scope:** `packages/formspec-chat` (L5) — `ToolContext` interface; `packages/formspec-studio` (L6) — implementation site
**Related:** ADR 0082 (lift `ChatSession` — prereq); ADR 0086 (Studio-local UI tools — consumer of this seam); [`thoughts/studio/2026-04-28-prd-chatgpt-forms-ide.md`](../studio/2026-04-28-prd-chatgpt-forms-ide.md) §7.4 (proposes the extension this ADR corrects in layering and shape)

## Context

The chat AI cannot currently see what the user has selected in Studio. PRD §7.4 proposed extending `ToolContext` with workspace state — but as drafted it placed the implementation in the wrong layer and shipped fields that have no coherent value across surface configurations (`mode`, `activeTab`).

The seam exists. `ToolContext` already lives in `formspec-chat` (`packages/formspec-chat/src/types.ts:107`) and already carries one optional snapshot accessor — `getProjectSnapshot?(): Promise<...>` (`packages/formspec-chat/src/types.ts:111`). All three production adapters (`gemini-adapter.ts:175`, `openai-adapter.ts:162`, `mock-adapter.ts:60`) consume `ToolContext`; the `getProjectSnapshot?` precedent shows optional accessors flow through them without a break. `ChatSession` reads it conditionally at `chat-session.ts:514`.

Selection state lives in `packages/formspec-studio/src/state/useSelection.tsx`, scoped per-tab via `selectedKeyForTab` (line 38) / `selectedTypeForTab` (line 39). The committing event is `select(key, type, opts)` (line 82) — explicit click. Scroll/hover/keyboard nav do not call it.

## Decision

### D-1. Optional `getWorkspaceContext?` on `ToolContext`

`ToolContext` (`packages/formspec-chat/src/types.ts:107`) gains:

```typescript
getWorkspaceContext?(): {
  selection: { path: string; sourceTab: 'editor' | 'layout' | 'mapping' } | null;
  viewport: 'desktop' | 'tablet' | 'mobile' | null;
};
```

Optional, matching the `getProjectSnapshot?` precedent at line 111. Adapters that ignore it work unchanged — same conditional pattern as `chat-session.ts:514`. Synchronous (selection lookup is in-memory; no async round-trip).

### D-2. `mode` and `activeTab` excluded

`mode` has no coherent value when the surface is one workspace with fluid layout — there is no discrete mode the AI can read without lying about state. `activeTab` is meaningless in chat-heavy layouts (no tabs visible) and incoherent across tabs in IDE-heavy layouts (multiple tabs visible at once). Selection + viewport is the smallest set the AI can interpret without ambiguity. The PRD §7.4 draft proposed both; both are excluded for the reasons above.

### D-3. `sourceTab` preserves per-tab scoping

`selection.sourceTab` mirrors `useSelection`'s existing per-tab keying (`useSelection.tsx:38`, `selectedKeyForTab`). The AI can disambiguate "you have `applicant.ssn` selected in the Editor tab" vs the Layout tab. The existing selection store remains the single source of truth — no new global selection signal, no parallel store.

### D-4. Selection clears synchronously on path removal

When an accepted changeset removes the field at the selected path, `selection` MUST reset to `null` before the next `getWorkspaceContext()` call returns. Implementation: `useSelection` subscribes to definition changes; if the active `primaryKey` no longer resolves in the new definition, clear the tab's `TabSelection` (`useSelection.tsx:13`). The AI never sees a dangling path.

### D-5. Only committed clicks propagate

`useSelection.select(key, type, opts)` (`useSelection.tsx:82`) is the sole event that updates what `getWorkspaceContext()` returns. Scroll position, hover, and structure-tree keyboard arrow-navigation do NOT propagate. The AI sees what the user clicked, not what their cursor brushed past.

## Consequences

- Layer-clean: an L5 interface change with an L6 implementation. No layer violation.
- All three adapters tolerate the new optional field via the existing `getProjectSnapshot?` pattern (`chat-session.ts:514`). No adapter edits required.
- The AI gains contextual selection without inheriting fields it cannot interpret.
- Foundation for ADR 0086 (Studio-local UI tools), which will *write* selection back through the same plumbing.

## Kill criteria

- Adapters require a non-optional shape (e.g., AI prompts degrade meaningfully without selection): revisit and gate a required form behind a feature flag. Do not break the optional contract for adapters that ignore it.
- `selection.sourceTab` causes AI confusion (the AI references tab names users do not see in chat-heavy layouts): drop `sourceTab`, ship `path` only.
