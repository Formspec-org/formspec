# Formspec Studio Fix Implementation Review - Second-pass addendum

Date: 2026-03-12
Commit reviewed: `dfcb383` (`fix: resolve all 47 studio coverage gaps — 268 unit + 141 E2E green`)

After the first review, an explicit second pass was run over the remaining implementation files from `dfcb383` that had not been directly opened in the initial sweep.

Only a small number of additional findings emerged.

### P1 — `definition.moveItem` changes canonical paths without rewriting references

File:

- `packages/formspec-studio-core/src/handlers/definition-items.ts`

Details:

- `moveItem` removes an item from one parent and inserts it into another.
- It returns a `newPath`, but intentionally does not rewrite bind/shape/mapping/theme/component references that still point at the old path.

Why this matters:

- Moving a nested item changes its canonical path even if the leaf key is unchanged.
- Any bind, shape, mapping rule, or component binding keyed by path can now silently point at the old location.
- This is a structural correctness issue, not just UI debt.

Key refs:

- `packages/formspec-studio-core/src/handlers/definition-items.ts:559`
- `packages/formspec-studio-core/src/handlers/definition-items.ts:565`

### P1 — `definition.duplicateItem` renames child keys without rewriting internal references

File:

- `packages/formspec-studio-core/src/handlers/definition-items.ts`

Details:

- `duplicateItem` deep-clones a subtree.
- It suffixes all descendant keys with `"_copy"`.
- It does not rewrite any item-level FEL expressions or other descendant references inside the cloned subtree.

Why this matters:

- Any cloned child that references a sibling by key can now point at the original key instead of the copied one.
- The duplication logic changes identity but does not preserve the clone’s internal semantics.

Key refs:

- `packages/formspec-studio-core/src/handlers/definition-items.ts:649`
- `packages/formspec-studio-core/src/handlers/definition-items.ts:652`

### P1 — The layout planner resolves scoped items by leaf key instead of full scoped path

File:

- `packages/formspec-layout/src/planner.ts`

Details:

- The planner correctly computes `fullBindPath`.
- It then calls `ctx.findItem(bindKey)` instead of `ctx.findItem(fullBindPath)`.

Why this matters:

- In nested component scopes, repeated leaf keys can resolve to the wrong item.
- That affects repeat-group detection, field snapshots, and presentation resolution.
- This is the same class of path-ambiguity problem seen elsewhere in Studio, but here it sits below Studio in the planning layer.

Key refs:

- `packages/formspec-layout/src/planner.ts:179`
- `packages/formspec-layout/src/planner.ts:185`

### P2 — StructureTree add-item flow still ignores the canonical inserted path

File:

- `packages/formspec-studio/src/components/blueprint/StructureTree.tsx`

Details:

- `handleAddPage()` correctly consumes `result.insertedPath`.
- `handleAddFromPalette()` does not.
- It dispatches `definition.addItem` and throws away the command result.

Why this matters:

- The same optimistic-identity pattern that already exists in `EditorCanvas` is present in the sidebar flow too.
- New items added from Blueprint are not anchored to canonical inserted identity or selection.

Key refs:

- `packages/formspec-studio/src/components/blueprint/StructureTree.tsx:175`
- `packages/formspec-studio/src/components/blueprint/StructureTree.tsx:197`

### P1 — Screener enable/disable is implemented as destructive delete/recreate

Files:

- `packages/formspec-studio/src/components/blueprint/ScreenerSection.tsx`
- `packages/formspec-studio-core/src/handlers/definition-screener.ts`

Details:

- The newly clickable Screener badge dispatches `definition.setScreener`.
- In core, turning the screener off deletes `definition.screener` entirely instead of marking it disabled.

Why this matters:

- The UI presents a reversible toggle.
- The model behavior is destructive removal.
- A single click can wipe screener items and routes with no warning or recovery cue beyond global undo.

Key refs:

- `packages/formspec-studio/src/components/blueprint/ScreenerSection.tsx:35`
- `packages/formspec-studio-core/src/handlers/definition-screener.ts:37`

### P1 — Paged fallback preview restores visibility by changing item order

File:

- `packages/formspec-layout/src/planner.ts`

Details:

- The fallback planner now wraps top-level page groups in a `Wizard` or `Tabs` node.
- It separately collects non-page root nodes as `orphans`.
- It returns `[..., orphans, wizardNode]`, which hoists all root non-page content ahead of the paged container.

Why this matters:

- This fixes “root items disappear in paged mode” by changing author order rather than preserving it.
- A definition that interleaves root items and pages now previews in a different sequence than authored.

Key refs:

- `packages/formspec-layout/src/planner.ts:323`
- `packages/formspec-layout/src/planner.ts:341`

### P2 — Blueprint variable rows are still not target-specific

File:

- `packages/formspec-studio/src/components/blueprint/VariablesList.tsx`

Details:

- Variable rows now click through to the Logic workspace.
- Every row dispatches the same `openLogicWorkspace()` action.
- The clicked variable name is not carried through to selection, focus, or editor state.

Why this matters:

- The rows are no longer inert, but they still are not meaningful navigation targets.
- This is a partial affordance fix, not a complete authoring/navigation fix.

Key refs:

- `packages/formspec-studio/src/components/blueprint/VariablesList.tsx:27`

### P1 — Repeat rendering in `emit-node` goes stale after non-tail deletions

File:

- `packages/formspec-webcomponent/src/rendering/emit-node.ts`

Details:

- Repeat instances are emitted once with fixed `instancePrefix` values and fixed `idx` remove handlers.
- When the repeat shrinks, the renderer only removes DOM nodes from the end of the container.
- Existing DOM instances are never rebuilt when indexes shift.

Why this matters:

- Removing a middle repeat instance leaves later DOM instances carrying stale prefixes and stale remove handlers.
- Subsequent edits and remove actions can target the wrong repeat index.
- This is a correctness bug in the renderer, not just a preview affordance issue.

Key refs:

- `packages/formspec-webcomponent/src/rendering/emit-node.ts:86`
- `packages/formspec-webcomponent/src/rendering/emit-node.ts:97`
- `packages/formspec-webcomponent/src/rendering/emit-node.ts:106`

### P2 — Logic bind-row selection still uses unresolved bind paths

Files:

- `packages/formspec-studio/src/workspaces/logic/LogicTab.tsx`
- `packages/formspec-studio/src/workspaces/logic/BindsSection.tsx`

Details:

- `LogicTab.normalizeBinds()` preserves raw `bind.path` values from array-form binds.
- `BindsSection` passes those raw values back through `onSelectPath`.
- `LogicTab` then forwards them straight into `select(path, 'field')`.

Why this matters:

- If binds are stored as relative keys, clicking a bind row still does not reliably select the owning field.
- This means the bind-row fix remains incomplete for the same path-normalization reason already seen in the command palette.

Key refs:

- `packages/formspec-studio/src/workspaces/logic/LogicTab.tsx:16`
- `packages/formspec-studio/src/workspaces/logic/LogicTab.tsx:47`
- `packages/formspec-studio/src/workspaces/logic/BindsSection.tsx:30`

### P2 — FEL reference is still a hand-maintained catalog instead of the engine’s real function list

File:

- `packages/formspec-studio/src/components/ui/FELReferencePopup.tsx`

Details:

- The popup ships its own hard-coded `FEL_CATALOG`.
- `formspec-engine` already exposes the built-in FEL function catalog.

Why this matters:

- The UI reference can drift from the actual runtime implementation.
- Copying function signatures from this panel can produce stale or misleading guidance even if the click affordance now does something.

Key refs:

- `packages/formspec-studio/src/components/ui/FELReferencePopup.tsx:14`

## Method

This document was produced from clustered code review of `dfcb383`, with sub-agent assistance and local verification of the highest-risk code paths.

No additional full test-suite run was performed as part of this review pass.
