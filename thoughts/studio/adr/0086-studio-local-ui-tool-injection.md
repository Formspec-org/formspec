# ADR 0086: Studio-Local UI Tool Injection

**Status:** Proposed
**Date:** 2026-04-28
**Scope:** `formspec-studio` (L6) chat surface; `formspec-mcp` (L4) dispatch boundary; `formspec-chat` (L5) `ToolContext` composition
**Related:** [ADR 0082 (lift ChatSession)](./0082-lift-chat-session-above-studio.md); [ADR 0083 (right-panel live preview companion)](./0083-right-panel-live-preview-companion.md); [ADR 0085 (`ToolContext` workspace-selection read seam)](./0085-toolcontext-workspace-selection.md) — D-4 (synchronous selection clear) is a prerequisite for `revealField` not landing on dangling paths; [ADR 0040 (MCP tool consolidation)](./0040-mcp-tool-consolidation.md) — disambiguation-cross-reference convention applies to declarations in D-1; [`thoughts/studio/2026-04-28-prd-chatgpt-forms-ide.md`](../studio/2026-04-28-prd-chatgpt-forms-ide.md) §7.4 (proposed `switchWorkspaceTab` / `highlightField` / `openPreview` — this ADR corrects their layering); [`thoughts/studio/2026-04-26-studio-unified-feature-matrix.md`](../studio/2026-04-26-studio-unified-feature-matrix.md) §M3 — `LayoutDocument` milestone referenced in D-3

## Context

The Studio PRD §7.4 (`thoughts/studio/2026-04-28-prd-chatgpt-forms-ide.md:278-280`) lists `switchWorkspaceTab`, `highlightField`, and `openPreview` as "MCP tools." That layering is wrong. `formspec-mcp` (L4) is a pure data-tools package: every entry in `TOOL_HANDLERS` (`packages/formspec-mcp/src/dispatch.ts:52-94`) is a `(registry, projectId, args) => result` handler over `ProjectRegistry` — schema mutation, FEL analysis, audit, query, changeset bracketing. None take a UI handle; none touch React state. Spot-check: `packages/formspec-mcp/src/tools/structure.ts:1-30` declares `field` / `content` / `group` / `place` / `edit` as data mutations on the project bundle. `formspec-mcp` has no UI vocabulary and no extension point for one — `createToolDispatch` (`dispatch.ts:120-149`) hard-codes the handler table at module load.

Studio composes the tool surface today at `packages/formspec-studio/src/components/ChatPanel.tsx:303` — `tools: dispatch.declarations` flows into a `ToolContext` consumed by `ChatSession.setToolContext` (`packages/formspec-chat/src/chat-session.ts:77`). That seam is the right place to inject UI tools: it is L6, owns the React tree, and already mediates between MCP dispatch and the session.

Adding UI tools to L4 would require the MCP package to either depend on Studio React state (layer inversion) or define an open plug-in registry (the kind of seam item-2 of the development philosophy forbids unless the spec demands it). Neither is tolerable.

## Decision

### D-1. New module `packages/formspec-studio/src/chat/studio-ui-tools.ts`

Closed taxonomy of workspace-navigation tools, exported as `{ declarations, handlers }`:

- **`revealField({ path: string })`** — scrolls the structure tree to `path`, expands any collapsed parent groups. Does NOT change selection (selection is the user's; reveal is the AI's pointer gesture). Declaration MUST cross-reference selection: "to change what the user has selected, ask them to click — this tool is a pointer gesture, not a selection mutator" (ADR 0040 disambiguation convention).
- **`setRightPanelOpen({ open: boolean })`** — toggles the preview companion (ADR 0083) visibility via the `showPreview` signal in `useShellPanels`.

New tools require a new ADR slot. The taxonomy is intentionally minimal.

### D-2. Studio composes the tool surface

`ChatPanel` merges MCP dispatch and Studio UI tools before handing them to the session:

```typescript
const declarations = [...mcpDispatch.declarations, ...studioUITools.declarations];
const callTool = (name, args) =>
  studioUITools.handlers[name]?.(args) ?? mcpDispatch.callTool(name, args);
```

The merged surface populates `ToolContext.tools` and `ToolContext.callTool` at `ChatPanel.tsx:303-305`. MCP tools stay UI-blind. Studio UI tools never enter `formspec-mcp`.

### D-3. `switchWorkspaceTab` is rejected

The unified surface (ADR 0083) has no top-level tab abstraction; there is nothing to switch to. This is a closed-taxonomy commitment, not a deferred slot — `LayoutDocument` ([M3](../studio/2026-04-26-studio-unified-feature-matrix.md) of the studio unified feature matrix) is named here only as the explicit *reopening trigger*. If M3 lands and reintroduces a tab-like construct, a fresh ADR MUST justify and bound any new tool before it ships; this ADR does not pre-authorize the expansion.

### D-4. `openPreview` collapses to `setRightPanelOpen({ open: true })`

Same effect, smaller surface, no new noun.

### D-5. Handlers run synchronously over React state

`revealField` requires a small extension to `packages/formspec-studio/src/state/useSelection.tsx`: a new `reveal(path)` method that emits a scroll-and-expand intent without touching `select`/`deselect` state. The structure tree subscribes and scrolls into view. `setRightPanelOpen` invokes `setShowPreview(boolean)` from `useShellPanels`. Handlers MUST NOT silently no-op when the target surface is unavailable — `revealField` with a collapsed sidebar expands the sidebar first, then returns a structured response (`{ ok: true, recovered: "sidebar collapsed; expanded it before revealing" }`) the AI can use to acknowledge the recovery. If the path no longer resolves (because an accepted changeset removed it), return `{ ok: false, reason: "path not found" }` — the synchronous-clear invariant from ADR 0085 D-4 means stale-path calls should be rare, but the handler still fails cleanly.

## Consequences

- Layer rule preserved: `formspec-mcp` (L4) stays UI-blind; UI navigation lives at L6 where the React tree exists.
- Closed, named taxonomy — no open-ended "AI controls the UI" surface; each tool is a deliberate ADR-gated decision.
- MCP dispatch surface stays focused on form-data tools; its declaration list does not grow with UI features.
- Test surface: each UI tool is a thin function over Studio state — unit-testable without booting MCP.
- The `setToolContext` seam is unchanged; only the composition feeding it changes.

## Kill criteria

- A non-trivial set of UI tools accumulates (>5 tools without ADRs) → the closed-taxonomy claim is false. Either ADR-gate retroactively or move to a registry-with-policy.
- AI hallucinates UI tool calls that don't exist (`switchTab`, `openModal`) → the tool surface needs better closure: declarations move into the system prompt verbatim, not just the tool list.
