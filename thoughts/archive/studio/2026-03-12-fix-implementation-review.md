# Formspec Studio Fix Implementation Review

Date: 2026-03-12
Commit reviewed: `dfcb383` (`fix: resolve all 47 studio coverage gaps — 268 unit + 141 E2E green`)

## Purpose

This review checks whether the implementation behind the new green tests actually resolves the original bugs in a durable way, consistent with `CLAUDE.md`.

The bar here is:

- no dead controls
- no UI-only patches that do not write back to state
- no view-layer path guessing when the model layer owns identity
- no preview workarounds that bypass the real artifact path

## Bottom line

The main pattern in this commit is not “wrong tests”; the tests mostly codify real missing surfaces. The problem is that a meaningful subset of the fixes satisfy the new assertions by making controls appear, while leaving the underlying workflow incomplete or introducing new ambiguity.

The biggest technical-debt risks are:

1. path normalization is still fragmented across Studio
2. several new authoring controls are cosmetic only
3. preview for paged forms works by bypassing the component tree instead of fixing the planner/rendering path
4. some editor flows still guess inserted paths in the UI instead of consuming canonical results from studio-core

## Findings

### P1 — `New Form` and `Export` are still dead controls

Files:

- `packages/formspec-studio/src/components/Header.tsx`
- `packages/formspec-studio/src/components/Shell.tsx`

Details:

- `Header` renders first-class `New Form` and `Export` buttons.
- `Shell` does not pass `onNew` or `onExport`.
- The buttons are visible, but clicking them does nothing.

Why this matters:

- This is the exact failure mode the bug sweep was supposed to remove.
- It improves screenshots and presence-based tests, but not product behavior.

Key refs:

- `packages/formspec-studio/src/components/Header.tsx:103`
- `packages/formspec-studio/src/components/Header.tsx:110`
- `packages/formspec-studio/src/components/Shell.tsx:111`

### P1 — Inspector cardinality and choice-option editors are cosmetic only

File:

- `packages/formspec-studio/src/workspaces/editor/ItemProperties.tsx`

Details:

- `Min Repeat` / `Max Repeat` inputs render with no `onBlur` or dispatch path.
- Choice option value/label inputs also render with no persistence path.
- Users can type into the fields, but the data never reaches the definition.

Why this matters:

- This turns a missing feature into a misleading feature.
- The inspector now suggests authoring support that does not exist.

Key refs:

- `packages/formspec-studio/src/workspaces/editor/ItemProperties.tsx:184`
- `packages/formspec-studio/src/workspaces/editor/ItemProperties.tsx:218`

### P1 — `+ Add Rule` is still not a real authoring flow

File:

- `packages/formspec-studio/src/workspaces/editor/ItemProperties.tsx`

Details:

- Clicking `+ Add Rule` dispatches `definition.setBind` with `required: binds.required ?? 'true()'`.
- The adjacent “Rule expression” input is never read.
- The button does not open a composer, append an editable row, or let the user choose rule type.

Why this matters:

- This is worse than the original dead button because it now mutates state in a misleading way.
- It can silently add the wrong rule type.

Key refs:

- `packages/formspec-studio/src/workspaces/editor/ItemProperties.tsx:248`
- `packages/formspec-studio/src/workspaces/editor/ItemProperties.tsx:259`

### P1 — Bind lookup still uses an ambiguous leaf-key fallback

File:

- `packages/formspec-studio/src/lib/field-helpers.ts`

Details:

- `arrayBindsFor()` first tries the full path, then falls back to `path.split('.').pop()`.
- That means `app.name` and `household.name` can collide on `name`.

Why this matters:

- This is a monkey-patch for the seeded fixture, not a real normalization strategy.
- It reintroduces correctness bugs as soon as forms reuse keys across groups.

Key refs:

- `packages/formspec-studio/src/lib/field-helpers.ts:48`

### P1 — Add-item and wrap-in-group still guess inserted paths in the view layer

File:

- `packages/formspec-studio/src/workspaces/editor/EditorCanvas.tsx`

Details:

- `handleAddItem()` computes `itemPath` locally before the handler has finalized uniqueness.
- `wrapInGroup` computes `targetParentPath` from an optimistic `wrapperKey` before the inserted group is canonicalized.

Why this matters:

- studio-core already owns sibling-key uniquification.
- Any collision can put selection or move targets onto paths that do not actually exist.
- This is the same category of bug that previously broke inspector selection after renames.

Key refs:

- `packages/formspec-studio/src/workspaces/editor/EditorCanvas.tsx:179`
- `packages/formspec-studio/src/workspaces/editor/EditorCanvas.tsx:261`

### P1 — Paged preview works by discarding the component tree

File:

- `packages/formspec-studio/src/workspaces/preview/preview-documents.ts`

Details:

- For wizard/tab forms, `normalizeComponentDoc()` strips `component.tree` when the doc lacks `$formspecComponent`.
- Studio-authored docs currently fall into that case.
- Preview then falls back to definition planning instead of rendering the component artifact.

Why this matters:

- It gets paging back, but only by bypassing the real component-tree path.
- Any layout or widget overrides in the tree are ignored in preview for paged forms.

Key refs:

- `packages/formspec-studio/src/workspaces/preview/preview-documents.ts:28`

### P1 — Wizard preview is still unsubmittable

File:

- `packages/formspec-webcomponent/src/components/interactive.ts`

Details:

- On the last wizard step, `nextBtn.disabled = step === total - 1`.
- The same button is then relabeled from `Next` to `Submit`.
- Result: the user sees `Submit`, but it is disabled.

Why this matters:

- Bug `#68` is still present in behavior.
- The visible label changed, but the underlying workflow did not.

Key refs:

- `packages/formspec-webcomponent/src/components/interactive.ts:223`
- `packages/formspec-webcomponent/src/components/interactive.ts:233`

### P1 — Component-tree rebuild can now preserve orphaned display nodes

File:

- `packages/formspec-studio-core/src/project.ts`

Details:

- The rebuild correctly moved toward path-based display-node identity.
- But unmatched display nodes are appended back to the root instead of being dropped or reconciled.

Why this matters:

- A renamed, moved, or deleted display item can survive as a ghost node in the component tree.
- Preview and component-tree state can diverge from the definition.

Key refs:

- `packages/formspec-studio-core/src/project.ts:1772`

### P1 — Variable hits in the command palette are still inert

File:

- `packages/formspec-studio/src/components/CommandPalette.tsx`

Details:

- Variable results are indexed and rendered.
- Their `onSelect` only closes the palette.

Why this matters:

- The row looks implemented, but it still does not navigate, select, or open an editor.

Key refs:

- `packages/formspec-studio/src/components/CommandPalette.tsx:75`
- `packages/formspec-studio/src/components/CommandPalette.tsx:81`

### P2 — Bind hits in the command palette still navigate with unresolved paths

File:

- `packages/formspec-studio/src/components/CommandPalette.tsx`

Details:

- Bind hits call `select(bind.path, 'field')`.
- In this codebase, many binds are still stored as relative keys rather than flattened editor paths.

Why this matters:

- The palette can now list rules, but activation can still fail to find the owning field.
- This is another symptom of missing central path normalization.

Key refs:

- `packages/formspec-studio/src/components/CommandPalette.tsx:86`

### P2 — Logic “editing” is still read-only

File:

- `packages/formspec-studio/src/workspaces/logic/VariablesSection.tsx`

Details:

- Double-click swaps the expression display into an `<input>`.
- The input is explicitly `readOnly`.
- There is no save path.

Why this matters:

- The UI now matches the shape of “an editor opened,” but the logic workspace remains read-only.

Key refs:

- `packages/formspec-studio/src/workspaces/logic/VariablesSection.tsx:21`
- `packages/formspec-studio/src/workspaces/logic/VariablesSection.tsx:25`

### P1 — Theme workspace “add” affordances are dead buttons

Files:

- `packages/formspec-studio/src/workspaces/theme/TokenEditor.tsx`
- analogous pattern across the other theme editors added in this sweep

Details:

- Empty states now render `+ Add ...` buttons.
- The buttons have no handler and no authoring flow behind them.

Why this matters:

- This hides a stub behind a fake affordance instead of making the missing feature explicit.

Key refs:

- `packages/formspec-studio/src/workspaces/theme/TokenEditor.tsx:11`

### P1 — Data workspace option set cards are still read-only

File:

- `packages/formspec-studio/src/workspaces/data/OptionSets.tsx`

Details:

- Cards were converted to `<button>` elements.
- They still have no `onClick`, no selection behavior, and no edit route.

Why this matters:

- This strengthens the illusion of interactivity while leaving the authoring gap untouched.

Key refs:

- `packages/formspec-studio/src/workspaces/data/OptionSets.tsx:41`

### P1 — Data Sources and Test Response gained dead controls instead of workflows

Files:

- `packages/formspec-studio/src/workspaces/data/DataSources.tsx`
- `packages/formspec-studio/src/workspaces/data/TestResponse.tsx`

Details:

- `Add Data Source` renders with no action.
- `Run Test Response` renders with no action.

Why this matters:

- These are polished placeholders, not implemented workflows.

Key refs:

- `packages/formspec-studio/src/workspaces/data/DataSources.tsx:23`
- `packages/formspec-studio/src/workspaces/data/TestResponse.tsx:9`

### P2 — Workspace-state persistence was only partially fixed

Files:

- `packages/formspec-studio/src/components/Shell.tsx`
- `packages/formspec-studio/src/workspaces/theme/ThemeTab.tsx`
- `packages/formspec-studio/src/workspaces/mapping/MappingTab.tsx`
- `packages/formspec-studio/src/workspaces/preview/PreviewTab.tsx`

Details:

- `DataTab` persistence was hoisted.
- `Theme`, `Mapping`, and `Preview` still own local tab/mode state and are still unmounted by `Shell`.

Why this matters:

- The original reset bug remains structurally unresolved in those workspaces.

Key refs:

- `packages/formspec-studio/src/workspaces/theme/ThemeTab.tsx:29`
- `packages/formspec-studio/src/workspaces/preview/PreviewTab.tsx:15`

### P2 — Mapping direction still has inconsistent defaults across tabs

Files:

- `packages/formspec-studio/src/workspaces/mapping/MappingConfig.tsx`
- `packages/formspec-studio/src/workspaces/mapping/MappingPreview.tsx`

Details:

- `MappingConfig` treats missing direction as `unset`.
- `MappingPreview` treats missing direction as `outbound`.

Why this matters:

- The inconsistency was preserved and is now exposed through more interactive UI.

Key refs:

- `packages/formspec-studio/src/workspaces/mapping/MappingConfig.tsx:18`
- `packages/formspec-studio/src/workspaces/mapping/MappingPreview.tsx:12`

## Recommended next pass

If this work is resumed, the next pass should be organized around model-level fixes rather than surface-level assertions:

1. Introduce one canonical path-normalization layer for items, binds, and selection targets.
2. Move add-item / wrap-in-group flows onto command results from studio-core instead of reconstructing paths in React.
3. Replace cosmetic inputs/buttons with either:
   - real write-back flows, or
   - explicit non-authoring copy with no fake affordance.
4. Fix paged preview in the planner/rendering path so Preview still exercises the component document.
5. Revisit component-tree rebuild semantics for unmatched display nodes so removed/moved items do not survive as ghosts.

## Architectural theme

Stepping back from the individual bugs, the broader problem is that Studio is compensating for missing domain seams in React components.

Today, `packages/formspec-studio` is doing too much artifact-semantic work in the view layer:

- normalizing bind paths
- guessing inserted item paths
- deriving response-schema / logic / inspector projections
- rewriting preview artifacts to work around renderer behavior

That is the main reason the code drifted toward monkey-patch fixes. The UI can make a test pass by changing what it renders, even when the underlying artifact logic is still wrong or duplicated elsewhere.

### What should move into `studio-core`

`studio-core` should own authoring-domain semantics for artifact editing and lookup.

This includes:

- canonical item/bind/shape lookup helpers
- canonical path resolution for authoring targets
- command results that return final canonical paths/ids after mutation
- higher-level authoring commands such as:
  - add item and return canonical inserted path
  - wrap item in group
  - rename item and return canonical renamed path
  - add page and return canonical page key/path
- shared projections used by multiple Studio surfaces:
  - inspector model
  - command palette index
  - response schema rows
  - logic workspace rows

The important boundary is:

- if logic reads or mutates `definition`, `component`, `theme`, or `mapping`, it probably belongs in `studio-core`
- if it is only about panel visibility, selection, focus, or temporary UI state, it belongs in Studio

There is already evidence that `studio-core` is the correct home for this seam:

- `definition.addItem` already returns `insertedPath`
- the core project model already owns undo/redo and structural mutation semantics

The problem is that Studio often ignores those core results and recomputes identity locally.

### What should move into `webcomponents` / rendering

Preview correctness should be owned by the renderer, not patched in Studio.

That means the rendering layer should correctly handle:

- wizard/tabs page planning
- last-step submit behavior
- component-document rendering for paged forms
- preview fidelity for layout/widget overrides

If Studio has to rewrite or strip `component.tree` before preview works, the rendering boundary is wrong.

The specific anti-pattern in the current fixes is:

- Studio preview strips `component.tree` for paged forms so the renderer falls back to definition planning

That recovers wizard behavior, but only by bypassing the actual component artifact. The planner/rendering path should be fixed instead.

### What should move into `engine`

Less should move into `formspec-engine` than into `studio-core`, but pure definition semantics are strong candidates.

Good candidates for `engine`:

- canonical path normalization utilities
- pure definition walkers/indexers
- bind/shape/dependency indexing helpers
- response-shape derivation based only on definition semantics

Bad candidates for `engine`:

- editor commands
- selection/focus state
- component-tree authoring behavior
- workspace-specific UI workflows

The rule of thumb is:

- if it is true for any Formspec definition independent of Studio, it can live in `engine`
- if it is about editing a project bundle and coordinating artifact mutations, it belongs in `studio-core`

### What should stay in Studio

These should remain in the React app:

- selection
- focus
- active workspace
- sub-tab state
- command palette open/close state
- responsive shell layout

Studio should own UI state.
It should not own canonical artifact semantics.

### Recommended architectural direction

If this is revisited structurally, the clean boundary would be:

1. `formspec-engine`
   - pure definition semantics
   - path normalization
   - dependency / bind / shape indexing

2. `formspec-studio-core`
   - authoring commands
   - canonical project queries and selectors
   - command results with canonical inserted/renamed/moved paths

3. `formspec-webcomponent`
   - faithful rendering of definition + component + theme
   - wizard/tab navigation
   - submit behavior
   - no Studio-specific preview hacks

4. `formspec-studio`
   - UI composition
   - transient UI state only

### Highest-value first move

The single most valuable cleanup would be to add a canonical query layer in `studio-core` and remove Studio-local artifact math from React components.

That would directly address the recurring class of bugs behind this review:

- stale or ambiguous path resolution
- command palette mis-navigation
- inspector bind mismatches
- optimistic path guessing after mutations
- duplicated projections across editor/data/logic surfaces
