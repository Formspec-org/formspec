# Studio Root-Domino Recovery

## Summary
- Recover the Studio by fixing the smallest set of product-level dominoes that explain the current failures in this worktree.
- Use the current app behavior and specs as source of truth, not stale Playwright DOM contracts.
- Separate failures into three buckets before coding:
  1. real product gaps,
  2. stale tests that encode obsolete UI,
  3. mixed cases where a real product gap and a stale assertion overlap.
- Do not preserve obviously wrong abstractions. If a subsystem is fighting the fix, replace the local abstraction instead of layering compatibility around it.
- Do not spend this pass on full PRD completion of registries, subforms, full data authoring, or broad workflow expansion.

## Current Reality
- The Data workspace is not a classic sub-tab workspace anymore. It is a section-filtered pillar layout.
- The Logic workspace is also no longer shaped like the old “Binds / Shapes buttons” model.
- The webcomponent wizard already has final-step submit behavior; the current failure is duplicate rendering, not missing submit wiring.
- Playwright tests still encode several stale contracts:
  - read-only Settings summaries,
  - informational-only variable rows,
  - tabbed Data workspace,
  - exact old placeholder strings in the add-item palette,
  - placeholder Response Schema table markup.
- Real product gaps still exist:
  - inspector editing is still incomplete,
  - context menu still overflows viewport,
  - drag affordance is missing,
  - generated component output is too stub-like in preview,
  - wizard preview can render duplicate submit controls.

## Recovery Goal
Stabilize Studio around one coherent internal model:
- normalized project state in core,
- one authoritative generated component tree path,
- editable Settings and Item inspector surfaces,
- one insertion-target rule for authoring in paged mode,
- tests rewritten to current product intent instead of old placeholder DOM.

## Workstreams

### Workstream A — Core normalization and generated model
Scope:
- `packages/formspec-studio-core`
- any directly dependent Studio read paths that must switch to the new core APIs immediately

Deliver:
- Add one central normalization pass used by:
  - project construction,
  - `project.import`,
  - any seed/bootstrap path that can inject legacy shapes.
- Normalize only the legacy shapes currently causing drift:
  - `instances[] -> instances{}`
  - object-form `binds -> binds[]`
- Add one public query:
  - `Project.responseSchemaRows()`
- `responseSchemaRows()` returns:
  - `path`
  - `key`
  - `label`
  - `depth`
  - `jsonType`
  - `required`
  - `calculated`
  - `conditional`
- Define `jsonType` once in core:
  - scalar fields from data type
  - group -> `object`
  - repeatable group -> `array<object>`
- Ensure seeded/imported definitions with items synthesize a generated component tree when no authored tree exists.
- Treat `_rebuildComponentTree()` as replaceable if needed.
- Keep the synthetic internal root.
- Make the generated tree authoritative enough that Preview can stop showing stub component JSON for meaningful definitions.

Constraints:
- Do not normalize unrelated aliases or historical edge shapes in this pass.
- Do not leave dual-shape tolerance scattered across Studio after core normalization lands.
- If generated-tree changes affect Studio page-mode rendering, update Studio consumers in the same pass. This is not separable work.

### Workstream B — Studio editing surfaces
Scope:
- Settings in Blueprint
- Item inspector in Editor
- no broad redesign outside those surfaces

Deliver:
- Replace the current read-only Settings summary with an actual editor model.
- Add one reusable inline-edit row component:
  - display by default
  - `title` attribute for string values
  - click to edit
  - Enter or blur commits
  - Escape cancels
- Support only needed editor types:
  - text
  - textarea
  - select
  - JSON textarea
- Rebuild `SettingsSection` around real grouped editing using the existing `Section` primitive.
- Cover:
  - definition metadata
  - presentation defaults
  - behavioral defaults
  - lineage
  - present `x-*` extensions
- Commit through existing commands only:
  - `definition.setDefinitionProperty`
  - `definition.setFormPresentation`
- Do not route new Settings editing through `definition.setFormTitle`.

Inspector:
- Replace summary-first `ItemProperties` behavior with a minimal real editor.
- Implement a real `+ Add Rule` draft flow that saves through `definition.setBind`.
- Add a real Options section for choice/select fields using:
  - `definition.setFieldOptions`
  - `definition.promoteToOptionSet`
- If the current inspector composition resists this, replace the section structure instead of appending more summary widgets.

Constraints:
- Do not add speculative authoring for full Data Sources or full Option Set management here.
- Do not add Response Schema click-to-navigate in this pass.

### Workstream C — Studio interaction wiring and runtime cleanup
Scope:
- Studio interaction logic
- paged insertion behavior
- preview/runtime duplication issues
- no speculative feature additions

Deliver:
- Extract one shared insertion-target helper used by every “add item” entrypoint that can create definition items.
- In paged mode, insertion must consistently target the active page/group.
- Collapse split add-item logic where possible instead of patching only `EditorCanvas`.
- Clamp editor context-menu coordinates to the visible viewport before rendering.
- Add hover-only drag handles and `draggable="true"` affordance on field, group, and display cards.
- Fix preview/wizard duplication so the last wizard step exposes one effective submit action, not duplicate visible submit controls.
- Align preview/component JSON output with the generated component tree so Preview stops surfacing trivial stubs for populated forms.

Constraints:
- Do not reopen webcomponent final-submit behavior unless a real current bug proves it broken.
- Do not add full drag-drop reordering in this pass.
- Do not force Data workspace back into its old tabbed layout just to satisfy stale tests.

## Test Strategy

### Keep and strengthen
- Core tests for:
  - `instances[]` normalization
  - object-form `binds` normalization
  - generated tree synthesis on seeded definitions without a tree
  - `responseSchemaRows()` including repeatable groups as `array<object>`
  - default widget mapping for boolean, temporal, choice, multi-choice, attachment, money
- Studio tests for:
  - editable Settings rows
  - tooltip/title behavior
  - collapsible Settings sections
  - `+ Add Rule` draft/save flow
  - select/choice Options editing
  - paged add-item insertion
  - context-menu viewport clamping
  - draggable affordance on item cards
- Preview/runtime tests for:
  - non-stub component output for populated definitions
  - single final wizard submit path

### Rewrite as stale
Rewrite tests that currently preserve obsolete UI contracts:
- read-only Settings section expectations
- variable rows treated as inert/read-only
- tabbed Data workspace assumptions
- old Response Schema table assumptions
- old add-item palette placeholder assumptions
- old Logic workspace button/section assumptions

### Delete outright when they encode the wrong abstraction
Delete or replace tests that only assert placeholder behavior that the current product should not preserve:
- informational-only variable behavior
- placeholder Data tab contracts that no longer exist
- fake “not implemented” surfaces if the product now intentionally exposes real editing

## File Clusters To Triage First

### Real product-first
- `packages/formspec-studio/tests/e2e/playwright/inspector-safety.spec.ts`
- `packages/formspec-studio/tests/e2e/playwright/interaction-patterns.spec.ts`
- `packages/formspec-studio/tests/e2e/playwright/preview-workspace.spec.ts`
- `packages/formspec-studio/tests/e2e/playwright/wizard-mode.spec.ts`

### Stale-contract-first
- `packages/formspec-studio/tests/e2e/playwright/data-workspace.spec.ts`
- `packages/formspec-studio/tests/e2e/playwright/workspace-navigation.spec.ts`
- `packages/formspec-studio/tests/e2e/playwright/workspace-state-persistence.spec.ts`
- `packages/formspec-studio/tests/e2e/playwright/blueprint-sidebar.spec.ts`
- `packages/formspec-studio/tests/e2e/playwright/logic-authoring.spec.ts`

## Sequencing
1. Add core normalization and `responseSchemaRows()`.
2. Update Studio readers to remove local dual-shape branching.
3. Fix generated tree / preview output enough to eliminate stub component JSON.
4. Rebuild Settings editing.
5. Rebuild inspector rule/options editing.
6. Fix shared paged insertion targeting.
7. Fix context-menu clamping and drag affordance.
8. Fix wizard duplicate submit rendering.
9. Rewrite stale Playwright suites to current product intent.
10. Re-run the mixed suite and only then decide if any remaining failures justify additional product work.

## Non-Goals
- Full Data Sources authoring redesign
- Full Option Sets management UX
- Full Test Response implementation
- Registry workflows
- Subform workflows
- Broad spec/schema changes

## Working Rules
- Current product intent beats stale DOM contracts.
- Replace wrong local abstractions instead of adding compatibility branches.
- When core and Studio share a broken contract, fix both in the same change stream.
- Every touched area should end simpler than it started.
