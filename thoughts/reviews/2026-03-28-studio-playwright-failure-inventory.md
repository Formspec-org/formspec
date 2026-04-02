# Studio Playwright Failure Inventory

## Context

After completing the Editor/Layout split implementation and the follow-up Studio cleanup pass, the Vitest suites are green:

- `@formspec-org/studio`: 92 files passed, 745 tests passed, 2 skipped
- `@formspec-org/studio-core`: passing
- `@formspec-org/core`: passing
- `@formspec-org/layout`: passing
- `make api-docs`: passing

The next verification step was the full Studio Playwright suite:

```bash
npm run --workspace=@formspec-org/studio test:e2e
```

That suite now passes completely after the stabilization and rewrite work
described below.

This note records the failures originally observed during the run, the actual
root causes, and the fixes that returned the suite to green.

## Update After Investigation

The initial inventory correctly identified a high-value shared seam, but the
root cause was more specific than “the inspector is broadly broken.”

A targeted stabilization pass confirmed that the failure cluster had **two**
main causes:

1. **Stale Playwright contract after the Editor/Layout split**
   - many tests were still querying `data-testid="properties"` even though the
     runtime now exposes the right rail as `data-testid="properties-panel"`
   - several tests assumed the inspector is visible in non-Editor workspaces,
     but [Shell.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/Shell.tsx)
     only mounts the right rail for `Editor` and `Layout`
   - several row-count/order assertions used overly broad selectors like
     `[data-testid^="field-"]`, which now match nested summary/detail nodes in
     addition to top-level editor rows

2. **Incomplete migration to scoped selection**
   - the selection provider is per-tab scoped in
     [useSelection.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/state/useSelection.tsx)
   - however, some surfaces were still writing selection into the default scope
     instead of the editor scope:
     - [StructureTree.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/blueprint/StructureTree.tsx)
     - [CommandPalette.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/CommandPalette.tsx)
     - [LogicTab.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/logic/LogicTab.tsx)
   - the Editor inspector also needed to read the editor-scoped selection
     explicitly rather than relying on the “active scope” alias:
     - [EditorPropertiesPanel.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/editor/properties/EditorPropertiesPanel.tsx)
     - [DefinitionTreeEditor.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/editor/DefinitionTreeEditor.tsx)

### What Was Fixed

The following cluster is now stabilized:

- Blueprint selection -> Properties panel
- selection persistence back to Editor
- command palette selection -> Editor inspector
- Logic bind-row selection -> Editor inspector after returning to Editor
- add-item selection/focus in the Editor inspector
- inspector safety cluster A (`#22`, `#25`, `#32`, `#12`, `#52`, `#53`, `#57`)
- editor duplicate/delete/property-edit flows
- interaction-pattern duplicate/wrap/move-down flows

Verification completed:

- targeted Playwright subset: `23 passed`
- targeted Vitest subset (`shell.test.tsx`, `selection-scoping.test.tsx`): `29 passed`
- preview normalization Vitest reproduction: `preview-documents.test.ts` passed
- full Studio Playwright suite now passes completely:
  - `190 passed`
  - `0 skipped`
  - `0 failed`

Additional fixes completed after the first stabilization pass:

- Preview now synthesizes preview-only `Page` wrappers for paged definitions
  that have `formPresentation.pageMode` but no authored component `Page` nodes,
  in
  [preview-documents.ts](/Users/mikewolfd/Work/formspec/packages/formspec-studio-core/src/preview-documents.ts)
  - this restored actual wizard Preview behavior for definition-only imports
- Editor blank-space deselection now works on the centered editor shell and the
  definition surface:
  - [Shell.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/Shell.tsx)
  - [DefinitionTreeEditor.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/editor/DefinitionTreeEditor.tsx)
- Editor keyboard tab flow now advances to the next row selector instead of
  falling into inline controls, and drag handles are removed from the default
  tab order until keyboard reordering exists:
  - [ItemRow.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/editor/ItemRow.tsx)
  - [DragHandle.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/ui/DragHandle.tsx)
- Layout context-menu wrapping now preserves full nested definition paths and
  selects the newly-created wrapper, which fixed the remaining wizard/layout
  wrap failures during the page-mode rewrite:
  - [FieldBlock.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/layout/FieldBlock.tsx)
  - [LayoutContainer.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/layout/LayoutContainer.tsx)
  - [render-tree.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/layout/render-tree.tsx)
  - [layout-context-operations.ts](/Users/mikewolfd/Work/formspec/packages/formspec-studio-core/src/layout-context-operations.ts)
  - [LayoutCanvas.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/layout/LayoutCanvas.tsx)

The Layout/page rewrite also moved a substantial portion of the old skipped
coverage back into the active suite:

- `layout-components.spec.ts` now runs its rewritten Layout-tab wrap/unwrap and
  inspector scenarios against current UI affordances
- `layout-wizard-mode.spec.ts` now runs its rewritten wizard-layout coverage
  against the current page-scoped Layout canvas
- `wizard-mode.spec.ts` now runs the former page-tab rewrite backlog as active
  coverage, including page-label rendering, inline page rename, and add-page
  flows

Final Layout/page-tab fixes completed after that pass:

- Layout step navigation now exposes stable page-tab test ids and supports
  inline rename for the active page in
  [LayoutStepNav.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/layout/LayoutStepNav.tsx)
- Layout now exposes an explicit add-page control in
  [LayoutCanvas.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/layout/LayoutCanvas.tsx)
- Layout properties now expose active unwrap/delete buttons for selected layout
  nodes in
  [ComponentProperties.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/layout/properties/ComponentProperties.tsx)
- definition-only paged imports now synthesize stable Layout page navigation for
  viewing, while mutating actions materialize authored pages on demand in
  [LayoutCanvas.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/layout/LayoutCanvas.tsx)
- `layout-wizard-mode.spec.ts` now uses an authored wizard project fixture for
  layout-editing coverage instead of relying on the old definition-only import
  contract

### Reclassified Findings

Some failures in the original inventory were **not** real product regressions:

- `Structure Tree click populates the Properties panel`
- `Selection persists across tab switches`
- command-palette inspector tests
- most of the original Inspector Safety cluster
- duplicate/wrap/move-down context-menu failures

These were stale tests or stale locators, not broken runtime behavior.

### Still Unresolved

- `project.import` / undo-history semantics remain inconsistent across product
  docs, tests, and implementation
- no Studio Playwright cases remain skipped; the former wizard page-tab backlog
  (`BUG-010`, `BUG-044`, `BUG-074`) is now active and passing

## Important Scope Note

This inventory is based on the live Playwright run output observed during the session. It captures the failures surfaced before stopping to document them. It is therefore a **high-signal partial inventory**, not a line-by-line postmortem of every single failure artifact or trace file.

Even so, the failure pattern is clear enough to diagnose the problem shape:

- this is **not** a small one-off regression in the recent Layout naming pass
- this is a broader E2E failure cluster around authoring, selection, inspector, and interaction flows

## Command Run

```bash
npm run --workspace=@formspec-org/studio test:e2e
```

Observed startup:

- Playwright launched `191` tests
- many early tests passed
- failures then clustered in Blueprint, Editor Authoring, Inspector Safety, Interaction Patterns, and some Layout Components scenarios

## What Still Passes

Many E2E flows continue to pass, which is important context. The app is not catastrophically broken.

Observed passing areas included:

- many Blueprint sidebar tests
- changeset review flows
- multiple command palette tests
- data workspace flows
- several logic workspace flows
- mapping workspace flows
- preview workspace flows
- shell responsive and smoke tests
- theme workspace flows
- some interaction-pattern tests
- some layout-components tests

This means the failure surface is more likely concentrated in:

- selection propagation
- inspector population
- Editor-side property editing
- context-menu action effects
- certain navigation assumptions in Blueprint/Structure

## Observed Failure Clusters

### 1. Blueprint

#### `blueprint-sidebar.spec.ts`

Observed failing test:

- `Bug #14 — Component Tree count badge is always 0`
  - test: `count badge on the "Component Tree" nav row reflects actual node count (non-zero)`

Relevant context:

- [Blueprint.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/Blueprint.tsx) computes the badge from:
  - `countComponentNodes((project.component as any)?.tree)`
- the test imports a definition and expects the component tree count badge to be non-zero once fields are rendered

Likely implication:

- either the effective component tree is no longer being populated as this test expects
- or the test’s expectation is stale under the newer authored-component/current-component model
- this needs trace-level confirmation rather than guesswork

#### `blueprint-selection-sync.spec.ts`

Observed failing tests:

- `Structure Tree click populates the Properties panel`
- `Selection persists across tab switches`
- `Clicking canvas background deselects the item`
- `Clicking a structure item in another layout step activates that step and selects the field`

Relevant context:

- The Structure tree is now definition-only in Studio’s architecture.
- The test still exercises selection synchronization between:
  - Blueprint Structure
  - Editor canvas
  - Layout step scoping
  - Properties panel

Likely implication:

- there is a break in one of:
  - selection state propagation
  - properties panel selection scoping
  - sidebar structure scoping for paged/layout-step forms
  - canvas deselection behavior

This cluster strongly suggests a shared seam rather than four unrelated bugs.

### 2. Command Palette

Observed failing tests:

- `click result selects item and closes palette`
- `keyboard navigation selects the highlighted result`

Likely implication:

- command-palette selection or close behavior no longer triggers the downstream selection/navigation effects that the test expects
- could share root cause with the selection/inspector cluster

### 3. Cross-Workspace Authoring

Observed failing test:

- `Full authoring cycle — all workspaces show seeded content`

Likely implication:

- a broad state-projection expectation is stale or broken
- likely downstream of selection/inspector/state-sync issues rather than a single workspace-specific bug

### 4. Editor Authoring

Observed failing tests:

- `adding an item in wizard mode selects the new field in the inspector`
- `adding a Single Choice field immediately focuses the key input for renaming`
- `select a field — Properties panel populates`
- `rename a field via Properties panel`
- `duplicate a field via Properties panel`
- `delete a field via Properties panel`
- `add a group, then add another item with the group selected`

Notable detail:

- several of these hit full `30.0s` timeouts

Likely implication:

- the inspector population / selection contract is broken in E2E, even though the component/unit tests are green
- focus handoff after add-item flows is also failing
- anything that depends on selecting a newly-created or currently-selected Editor node is suspect

This is one of the highest-value clusters to attack first.

### 5. Import

Observed failing test:

- `import does not clear undo history (bug #18)`

Likely implication:

- import/undo history semantics differ from what the E2E expects
- this may be a real regression or a behavior change that unit tests did not catch

### 6. Inspector Safety / Inspector Bug Cluster A

Observed failing tests:

- `non-Editor workspaces do not expose Duplicate and Delete inspector actions for the last Editor selection`
- `#22 KEY input updates when switching selection between fields`
- `#25 inspector still shows the renamed item after editing KEY with Tab`
- `#32 Behavior Rules section is visible in inspector when a field has binds`
- `#12 clicking "+ add behavior rule" opens a behavior type menu`
- `#52 inspector shows min/max cardinality controls for a repeatable group`
- `#53 inspector shows a Choices/Options section for a Select One field`
- `#57 inspector shows a Label/Title input for editing a field label`

Likely implication:

- the right-hand properties/inspector panel is a major fault domain
- either the panel is not receiving current selection properly in E2E
- or parts of the Editor properties UI are not mounted/rendered under the same conditions the tests assume

Given the quantity and consistency here, this cluster should probably be attacked before any isolated layout test.

### 7. Interaction Patterns

Observed failing tests:

- `clicking Duplicate in context menu duplicates the field`
- `clicking Wrap in Group wraps the selected field in a new group`
- `clicking Move Down changes the field order`
- `Tab moves focus to the next field card instead of jumping into the inspector`

Observed passing tests in the same file:

- context menu opens
- Escape closes context menu
- empty-canvas right click does not show field menu
- viewport-bounded context menu behavior
- Delete/Backspace shortcuts
- command palette autofocus shortcuts

Likely implication:

- context menu visibility is fine
- execution of certain Editor actions is not producing the expected model/UI updates
- reorder/duplicate/wrap likely intersect the same selection/state-sync seam as Editor Authoring

### 8. Layout Components

Observed state at the time:

- several Layout Components tests were marked with `-` during the first run
- several specific content/palette tests failed:
  - `adds a Heading display item`
  - `adds a Divider display item`
  - `adds a Spacer display item`
  - `searching "card" in palette filters to the Card option`

Final outcome:

- the Layout Components suite was rewritten against the current Layout-tab and
  properties-panel affordances
- wrap/unwrap/delete/property scenarios are now active and passing
- the smaller content/palette failures were also resolved during the broader
  rewrite

### 9. Logic Workspace

Observed failing test:

- `clicking a bind row selects the related field in the inspector`

Likely implication:

- again points back to cross-workspace selection + inspector sync

## High-Signal Pattern

The failures are not random.

They cluster around a few likely seams:

### A. Selection propagation is broken or inconsistent in browser flows

Evidence:

- Blueprint selection sync failures
- Editor field selection -> inspector population failures
- Logic bind row -> inspector selection failure
- selection persistence across tab switches failure

### B. Inspector rendering/editing is broken or stale in browser flows

Evidence:

- multiple inspector safety tests fail
- Editor authoring actions that depend on inspector inputs fail
- rename/duplicate/delete via properties time out

### C. Editor-side action results are not surfacing correctly in the DOM

Evidence:

- duplicate/wrap/move-down context menu action failures
- add-item focus/select failures
- group-followed-by-add-item failure

### D. A smaller layout-palette/content-item issue also exists

Evidence:

- heading/divider/spacer/card-search Layout Components failures

## Why This Is Probably Not Caused Solely by the Recent Layout Cleanup

The recent Studio cleanup in this session was mostly:

- wording cleanup
- symbol renames:
  - `PageNav` -> `LayoutStepNav`
  - `PageSection` -> `LayoutPageSection`
  - `usePageStructure` -> `useLayoutPageStructure`

Those changes are behavior-neutral and the Studio Vitest suite remained green after them.

The Playwright failures span older Editor and Inspector flows that are not tightly coupled to those renames.

So the more plausible reading was:

- the E2E suite was already behind the real current behavior in some places, and
- there is an existing browser-only regression cluster that unit/component tests do not expose

Either way, this is a broader E2E stabilization task, not a single cleanup revert.

## Files Most Likely Relevant to the Root Cause

### Studio shell / workspace wiring

- [packages/formspec-studio/src/components/Shell.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/Shell.tsx)
- [packages/formspec-studio/src/components/Blueprint.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/Blueprint.tsx)
- [packages/formspec-studio/src/components/PropertiesPanel.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/PropertiesPanel.tsx)

### Selection state and scoping

- [packages/formspec-studio/src/state/useSelection.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/state/useSelection.tsx)
- [packages/formspec-studio/src/state/useActiveGroup.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/state/useActiveGroup.tsx)

### Editor workspace and inspector

- [packages/formspec-studio/src/workspaces/editor/DefinitionTreeEditor.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/editor/DefinitionTreeEditor.tsx)
- [packages/formspec-studio/src/workspaces/editor/properties/EditorPropertiesPanel.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/editor/properties/EditorPropertiesPanel.tsx)
- [packages/formspec-studio/src/workspaces/editor/EditorContextMenu.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/editor/EditorContextMenu.tsx)

### Layout page/structure projection

- [packages/formspec-studio/src/workspaces/layout/LayoutCanvas.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/layout/LayoutCanvas.tsx)
- [packages/formspec-studio/src/workspaces/layout/useLayoutPageStructure.ts](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/layout/useLayoutPageStructure.ts)
- [packages/formspec-studio-core/src/project.ts](/Users/mikewolfd/Work/formspec/packages/formspec-studio-core/src/project.ts)
- [packages/formspec-studio-core/src/page-structure.ts](/Users/mikewolfd/Work/formspec/packages/formspec-studio-core/src/page-structure.ts)

### Command palette / interaction flows

- [packages/formspec-studio/src/components/CommandPalette.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/CommandPalette.tsx)

## Recommended Next Steps

The most efficient recovery path is:

1. Re-run a small failing subset with traces:
   - `blueprint-selection-sync.spec.ts`
   - `editor-authoring.spec.ts`
   - `inspector-safety.spec.ts`
   - `interaction-patterns.spec.ts`

2. Prioritize the shared seam:
   - selection propagation
   - properties panel population
   - cross-tab persistence

3. Only after that, tackle the smaller layout-palette/content-item failures.

4. Re-run the full Playwright suite after the shared seam is fixed.

## Bottom Line

The Studio unit/component tests are green, but the full Playwright suite currently exposes a significant browser-level regression cluster.

This cluster is concentrated in:

- selection synchronization
- inspector rendering/editing
- Editor-side action execution and focus behavior
- some Blueprint assumptions
- a smaller set of layout-palette flows

This is not yet a single diagnosed root cause, but it is narrow enough to attack systematically. The highest-value place to start is the shared selection/inspector seam.
