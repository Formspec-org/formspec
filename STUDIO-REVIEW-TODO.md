# Studio review — task list

**Scope:** `packages/formspec-studio/`, `packages/formspec-studio-core/`
**Goal:** Remove dead code, document real gaps, cut correctness and dependency risk, ship PRD-aligned features.
**Last validated:** 2026-04-22 (full refactoring audit of 175+ files / ~29k lines in `packages/formspec-studio/`; P6 added).

Use this file as a **backlog**: each `- [ ]` is one shippable task unless noted as a multi-step epic.

---

## Active work (open tasks, priority order)

---

### P3 — `project.ts` modularization (epic — one item remains)

**Context:** `project.ts` remains large (~4.4k lines after helper extraction). Preserve `src/index.ts` public API.

- [x] **Split remaining `Project` responsibilities** into focused modules: layout/page/region operations, theme/breakpoint/locale, screener/phases, mapping — re-export or compose from `project.ts` without breaking consumers.

---

### P4 — Types, tests, and polish

- [x] Extend **`ChatState`** (or equivalent) so `FormPreviewV2.tsx` does not need `(state as any).screener` — the screener section was dead code (`ChatState` never had a `screener` field; removed the entire block + `ItemPreview` component).
- [x] Reduce **`any`** in `FormPreviewV2.tsx` — replaced `ItemLike` with `FieldMockupItem` (typed `PresentationBlock`), fixed `findItem` to use `FormItem[]`, removed all `as any` casts (8 → 0). Remaining `any` reduction in other files deferred.
- [ ] Reduce **`any`** in remaining hot UI files: `OutputBlueprint.tsx`, `RuleCard.tsx`, `MultiSelectSummary.tsx`, `DefinitionProperties.tsx` (counts from audit: ~24 studio, ~14 studio-core).
- [x] **chat-v2 a11y:** Added `aria-pressed` to mode toggles in `FormPreviewV2.tsx`; added `type="button"` and `aria-label` to all header buttons in `ChatShellV2.tsx` (back, issue badge, studio, export, settings, close sidebar).
- [ ] **`mapping-serialization.ts`:** Sanitize or validate **XML element names** derived from user-controlled keys (today `escapeXml` covers text, not tag names); document client-only risk if server exposure is out of scope.
- [ ] **`lib.ts` / `registerFormspecRender`:** Either add a real consumer + test, remove from public surface, or document as experimental embed API.
- [ ] Add **targeted tests** for largest untested UI modules (pick order): `FormPreviewV2.tsx`, `ItemRow.tsx`, `GroupNode.tsx`, `DisplayBlock.tsx`, `OptionsModal.tsx`.
- [ ] Replace hardcoded **`VITE_GEMINI_DEV_KEY=mock-key-for-playwright`** in `playwright-chat.config.ts` (~24) with a dedicated mock server or Playwright network interception pattern.
- [ ] If profiling shows pain: evaluate **structural sharing** (e.g. Immer) for ProposalManager / partial merge paths that clone full `ProjectState` multiple times per operation (`_partialMerge` etc.).

---

### P5 — PRD-aligned next steps (from thoughts/studio/ synthesis)

Squashed from all markdown files in `thoughts/studio/` (oldest → newest), cross-referenced against the current implementation in `packages/formspec-studio/`. Ordered by impact.

#### 5.1 Visual Logic Builder (highest impact)

Shipped. The ConditionBuilder component provides guided/advanced FEL editing for all bind types. Integrated into `ItemRowCategoryPanel` (relevant/required/readonly/constraint) and `RouteCard` (screener route conditions). Core logic in `fel-condition-builder.ts`, UI in `ConditionBuilder.tsx` + `GuidedBindEditor.tsx`.

- [x] Build a reusable **ConditionBuilder** component (field / operator / value rows → FEL)
- [x] Apply to: `relevant`, `required`, `readonly`, `constraint` (`calculate` uses InlineExpression)
- [x] "Advanced" toggle to raw FEL for power users
- [x] Screener route conditions use the same ConditionBuilder (see 5.2)
- [x] 79 core tests + 14 UI tests, all green

#### 5.2 Screener: condition builder + test routing

Screener CRUD works with raw FEL. Steps 3–5 of `thoughts/studio/2026-03-30-screener-authoring-design.md` remain.

- [x] **Condition builder** for route conditions (visual field/operator/value rows generating FEL)
- [ ] **Test routing panel** — interactive verifier that evaluates routes against sample answers
- [x] **Blueprint summary** — already exists as `ScreenerSummary`; verify completeness

#### 5.3 Definition assembler FEL rewriting

Already implemented in Rust (`crates/formspec-core/src/assembler.rs` + `assembly_fel_rewrite.rs`). The assembler was migrated from TS to Rust/WASM after the TDD plan was written, and FEL rewriting was included in the migration. All bind types (relevant, required, readonly, calculate, constraint), default expressions, shapes, and variables are rewritten. WASM exposes `rewriteFelForAssembly` for standalone use.

- [x] Phase 1: `rewriteFEL(expression, keyMap)` core — implemented in Rust
- [x] Phase 2: Bind FEL integration (relevant, required, readonly, calculate, constraint) — `rewrite_bind()` at `assembler.rs:763`
- [x] Phase 3: Shape FEL integration (target paths, composition expressions) — `rewrite_shape()` at `assembler.rs:792`
- [x] Phase 4: Variable import (key remapping in expressions) — `import_variables()` at `assembler.rs:560`
- [x] Phase 5: Full integration smoke tests — covered by Rust tests in `formspec-core`

#### 5.4 "Effective value" display in properties panel

Show which tier (Definition → Theme → Component) produced each presentation decision. Makes the 3-tier cascade comprehensible to non-technical users. The cascade resolver was extended from 3 theme levels to the full 5 spec levels (formPresentation → item.presentation → theme defaults → selectors → item overrides).

- [x] Extend `resolveThemeCascade` to 5-level cascade with definition-level inputs
- [x] Add `getPresentationCascade` convenience wrapper in studio-core
- [x] Compute and display **source layer** for each property in the inspector
- [x] Visual indicator (color-coded badges) showing "Form Default", "Definition", "Theme Default", "Selector", "Override"
- [x] `PresentationCascadeSection` in Editor properties panel
- [x] Tests: 11 cascade resolver + 6 wrapper + 7 UI = 24 tests, all green

#### 5.5 Widget constraints → semantic enforcement

Widget properties (min/max, step, date ranges) generate bind constraints at the definition level with two-way sync. Custom constraints are detected and preserved. Implemented as `widget-constraints.ts` (pure FEL conversion) + `Project.setWidgetConstraints`/`getWidgetConstraints` + `WidgetConstraintSection` UI.

- [x] When widget sets `min`/`max`/`step` → generate corresponding bind `constraint` expression
- [x] Guard optional values: `not(present($)) or <constraint>`
- [x] Two-way sync: editing the widget updates the constraint; custom FEL constraints are preserved (not overwritten)
- [x] UI: `WidgetConstraintSection` in properties panel for NumberInput/MoneyInput/Slider/DatePicker
- [x] Tests: 49 core + 10 UI = 59 tests, all green

#### 5.6 Document-first editing (longer term)

The PRD's most ambitious UX goal. Transform from "tree + inspector" to Notion-like document. Approach incrementally.

- [ ] Inline label editing on the form surface (click label → edit in place)
- [ ] Slash commands (`/`) for field insertion (Notion-style)
- [ ] Smart inline add — hover between nodes reveals `+` insertion line
- [ ] Logic badges on fields: required (dot), conditional (?), calculated (=), validated (!), readonly (lock)
- [ ] Full document model (the form IS the editor)

---

### P6 — DRY / KISS refactoring audit (2026-04-22)

Full file-by-file review of `packages/formspec-studio/src/` (~29k lines, 175+ files). Found 50 issues across 4 tiers: ~2,500 lines of duplicated code, 6 god components (3,800+ lines), 10+ `any`-typed boundaries, and a dual-chat architecture with zero shared code. Organized into 4 phases below.

Items already tracked in P4 are cross-referenced, not duplicated.

#### 6.1 Shared primitives (highest leverage — eliminates the most duplication)

- [x] **`useEscapeKey(callback, active)`** — escape-key handler duplicated in 5 dialogs (`ImportDialog`, `ConfirmDialog`, `AppSettingsDialog`, `ProviderSetupV2`, `SettingsDialog`); also duplicated in `useEditorState.ts` and `useShellLayout.ts`.
- [x] **`<InlineCreateForm>`** — inline add/create pattern duplicated in 10 files: `DataSources.tsx`, `OptionSets.tsx`, `ScreenerQuestions.tsx`, `PhaseList.tsx`, `VariablesSection.tsx`, `ShapesSection.tsx`, `ColorPalette.tsx`, `AllTokens.tsx`, `ScreenSizes.tsx`, `MappingSelector.tsx`. All share `isAdding` state, autoFocus input, Enter/Escape handling, identical CSS. Added `accentColor` support.
- [x] **`<ExpandableCard>`** — card-with-collapsible-header duplicated in 5 files: `DataSources.tsx`, `OptionSets.tsx`, `QuestionCard.tsx`, `RouteCard.tsx`, `PhaseCard.tsx`. All share clickable header, rotating chevron, border state toggle, animate-in.
- [x] **`<Pillar>`** — workspace section pillar triplicated across `MappingTab.tsx:14-54`, `LogicTab.tsx:17-50`, `DataTab.tsx:12-45`. Identical structure, only `accentColor` default differs. Move to `workspaces/shared/`.
- [x] **`<SectionFilterBar>`** — tab strip triplicated across `MappingTab.tsx:104-125`, `LogicTab.tsx:76-96`, `DataTab.tsx:76-91`. Identical JSX + controlled/uncontrolled state.
- [x] **Consolidate icons** — inline SVGs copy-pasted in 10+ files: close/X (4 places), chevron (4), trash (2), plus (2), edit-pencil, warning, exclamation. Chat files define 20+ local icons. Move all to `components/icons/index.tsx`.
- [ ] **Unify `CollapsibleSection`** — `Section.tsx`, `CollapsibleSection.tsx`, `AccordionSection.tsx` implement the same core behavior. Merge into one component with controlled/uncontrolled modes + optional decoration slots. (Section uses text `▶▼` while others use SVG — unify on SVG.)
- [ ] **`useControllableState`** — "controlled if prop provided, uncontrolled otherwise" pattern reimplemented independently in `MappingTab.tsx`, `MappingConfig.tsx`, `PreviewTab.tsx`, `DataTab.tsx`.
- [x] **`exportProjectZip(project)`** — ZIP export logic duplicated verbatim in `Shell.tsx:331-361` and `ChatShellV2.tsx:182-209`. Move to `lib/`.
- [ ] **`<RenderableBindCard>`** — `BindCard`+`GuidedBindEditor` wrapper copy-pasted 7 times in `ItemRowCategoryPanel.tsx` (relevant/required/constraint/readonly), `BindsInlineSection.tsx`, `FieldConfigSection.tsx`. ~18 identical lines each.
- [x] **FEL quoting utilities** — `quoteFELValue`/`unquoteFELValue` logic duplicated in `ConditionBuilder.tsx:177-184` and `ConditionBuilderPreview.tsx:414`. Extract to shared utility.
- [x] **`<EmptyBlueprintState>`** — dashed-border empty state repeated in 6 blueprint files: `DataSourcesList`, `OptionSetsList`, `VariablesList`, `MappingsList`, `StructureTree`, `ComponentTree`.
- [x] **`<EmptyWorkspaceState>`** — large dashed-border empty state extracted from `DataSources.tsx`, `OptionSets.tsx`, etc.
- [x] **`useProjectSlice(selector)`** — `useSyncExternalStore` subscription boilerplate duplicated in `useComponent.ts` and `useProjectState.ts`. Consolidated into `useProjectSlice.ts`. Hooks like `useTheme`, `useScreener`, and `useDefinition` now only re-render when their specific state slice changes.
- [x] **`useFieldOptions()`** — `flatItems(definition.items).map(...)` field-options construction duplicated in `FELEditor.tsx:147-154` and `GuidedBindEditor.tsx:30-37`. Consolidated into a shared hook.
- [x] **`<OverflowButton>`** — inline toolbar overflow button triplicated in `InlineToolbar.tsx` lines 493-509, 555-571, 614-630 (identical 17-line blocks).
- [ ] **`useDirtyGuard` adoption** — hook exported from `DirtyGuardConfirm.tsx` but never used; `PropertyPopover.tsx` and `ThemeOverridePopover.tsx` each roll their own `Set<string>`-based dirty tracking.
- [x] **Replace `window.confirm()`** — used in 7 locations (`DataSources.tsx`, `OptionSets.tsx`, `QuestionCard.tsx`, `RouteCard.tsx`, `PhaseCard.tsx`, `ScreenerToggle.tsx`, `RuleEditor.tsx`) despite `<ConfirmDialog>` component existing.
- [x] **`BindEntry` interface + `bindTypes`** — duplicated verbatim between `logic/BindsSection.tsx:9-26` and `logic/FilterBar.tsx:4-20`. Extract to shared types file.

#### 6.2 Decompose god components

- [ ] **`LayoutLeafBlock`** — extract from `FieldBlock.tsx` (541 lines) and `DisplayBlock.tsx` (569 lines). ~400 lines of identical code: drag setup, resize handles, shell styling, identity editing, property popover, resize overlay, `STOP_SELECT`/`targetStopsSelect` helper. Both become thin wrappers.
- [ ] **Decompose `Shell.tsx`** (632 lines, 55+ imports) — extract `useExportZip`, `useBlueprintSectionResolution` (duplicated at lines 119-127 vs 241-248), workspace content routing. Target <150 lines.
- [ ] **Decompose `LayoutCanvas.tsx`** (819 lines) — extract `useLayoutCanvasContextMenu` (133 lines, 11 params), `useLayoutNodeOperations` (49 lines), `useLayoutAddOperations` (64 lines) into separate files.
- [ ] **Extract `useInlineIdentityEdit`** — identity editing state machine duplicated between `ItemRow.tsx` (649 lines) and `GroupNode.tsx` (592 lines): `commitIdentityField`, `cancelIdentityField`, `handleIdentityKeyDown`, draft state, sync-from-props effect (~80 identical lines each). Also create `SUMMARY_LABEL_MAP` to eliminate dual `summaryInputValue`/`updateSummaryValue` mapping in `ItemRow.tsx` (lines 351-450).
- [ ] **Decompose `FELEditor.tsx`** (498 lines) — 6 responsibilities (draft state, auto-resize, floating UI autocomplete, 3 autocomplete kinds, syntax highlighting, validation display) held by 13 hooks. Extract autocomplete logic, highlighting overlay, validation display.
- [ ] **Decompose `render-tree.tsx`** (604 lines) — `renderLayoutTree` has 5 branching levels; `collectLayoutFlatSelectionKeys` duplicates the tree walk. Extract per-node-type renderers. Consider visitor pattern.
- [ ] **Decompose `ItemListEditor.tsx`** (617 lines) — extract ~80-line inline wrap-in-group modal into its own component; selection state, context menu, and delete confirmation should be separate concerns.

#### 6.3 Bugs and correctness

- [x] **`useOptionalDefinition()` reads stale data** — `state/useDefinition.ts:10-13` reads `project.state.definition` directly without `useSyncExternalStore` subscription; consumers never re-render on definition changes.
- [x] **`manageCount` non-reactive** — `hooks/useEditorState.ts:21-28` accesses `project.definition` directly (not via `useProjectState`), no `useMemo`, shows stale counts.
- [x] **`ActiveGroupProvider` context not memoized** — `state/useActiveGroup.tsx:16` creates new object literal on every parent render, unnecessary re-renders in all consumers.
- [x] **`useMappingIds` new array every render** — `state/useMappingIds.ts:6` calls `Object.keys()` each render, breaking `React.memo` in downstream components.
- [x] **`ConditionBuilder` stale on prop change** — `ui/ConditionBuilder.tsx:204-383` does not reset `mode`/`group`/`advancedDraft` when `value` prop changes (e.g., undo/redo).
- [x] **`FELEditor` blur-to-save race** — `ui/FELEditor.tsx:381-390` uses 150ms `setTimeout` with stale closure; fires `onSave` with outdated value if component unmounts or draft changes within window.
- [x] **`ShapesSection.handleAdd` discards user ID** — `logic/ShapesSection.tsx:31-33` calls `project.addValidation('*', 'true', ...)` ignoring the user-entered shape ID.
- [x] **`MappingConfig.tsx` Enter double-fires setter** — `mapping/MappingConfig.tsx:167-169` calls `project.setMappingTargetSchema` then blurs, but `onBlur` already calls the setter.
- [x] **DnD context re-renders on every pointer move** — `LayoutCanvasDragFeedbackContext` updates on every pointer move during drag, cascading re-renders through every `LayoutContainer` and row drop guide. Split pointer coordinates (ref) from drop indicator (context).
- [x] **`RuleCard.tsx` `any` typing** — `mapping/RuleCard.tsx:29` types `rule` as `any`; proper interface exists partially in `RuleEditor.tsx` but is not shared.
- [x] **`SettingsDialog.tsx` duplicate functions** — `setProperty` and `setPresentation` (lines 169-175) are verbatim copies.
- [ ] **Remove dead `collisionPriority` prop** — computed in `render-tree.tsx`, threaded to `LayoutContainer`, `FieldBlock`, `DisplayBlock`; all receive and `void` it. Remove until wired into Pragmatic DnD.
- [ ] **Remove dead code** — `ItemListEditor.tsx:422` (`paletteScope` identical branches), `OptionsModal.tsx:291-298` (both branches identical), `MappingSelector.tsx:167-170` (dead ternary).

#### 6.4 Architecture and DX

- [ ] **Dual chat: shared abstractions** — `ChatPanel.tsx` (505 lines) and `ChatPanelV2.tsx` (422 lines) have zero shared code. Identical: auto-scroll, textarea resize, Enter/Shift+Enter, typing indicator, empty state, message bubbles. Divergent: ChatPanel has MCP + changeset review; ChatPanelV2 has none. Decision recorded in P2 (dual architecture intentional). Extract shared `useChatPanel` hook + message rendering to reduce duplication without unifying surfaces.
- [ ] **Provider config UI 3-way duplication** — `AppSettingsDialog.tsx`, `ProviderSetupV2.tsx`, `ChatShellV2.tsx` each implement identical provider select + API key + validation. `ChatShellV2` bypasses `provider-config-storage.ts` helpers. Extract `<ProviderConfigForm>`.
- [ ] **Dual CSS systems** — studio uses Tailwind with semantic tokens; chat-v2 defines 90+ CSS custom properties and 60+ `v2-*` classes. Dark mode in chat-v2 relies on `.dark` class managed by studio's `useColorScheme`. If chat-v2 is permanent, align on one system; if transitional, document the plan.
- [ ] **5-level relative imports** — `ChatShellV2.tsx:7` has `../../../../../registries/formspec-common.registry.json`. Add path alias or re-export.
- [ ] **Cross-workspace dependency** — `data/DataTab.tsx` imports from `../editor/DataSources` and `../editor/OptionSets`. Move shared components to `workspaces/shared/`.
- [ ] **DnD file naming inconsistency** — 7 files mix `pdnd`, `dnd`, `drag-chrome`, `Pragmatic` naming. `layout-pdnd-kind.ts` is 2 lines, already re-exported from `layout-pdnd.ts`. Consolidate kind file; group under `dnd/` subdirectory.
- [ ] **`layout-node-styles.ts` + `layout-canvas-drag-chrome.ts` overlap** — both export Tailwind class strings for layout canvas visual states. Merge into one file.
- [x] **Delete dead code** — `ComponentRenderer.tsx` (155 lines, superseded by `<formspec-render>` web component, no imports found); `LayoutPreviewPanel.tsx` (10 lines, self-documented as "Legacy"); `LayoutWorkspace.tsx` (3-line unnecessary re-export alias).
- [ ] **Add `ThemeTab.tsx`** — every workspace has a `*Tab.tsx` orchestrator except theme. Creates structural asymmetry.
- [ ] **`handleResend`/`handleEdit` near-duplicate** — `chat-v2/ChatPanelV2.tsx:109-135` differs only in content source (`msg.content` vs `newContent`). Merge into single function with content parameter.
- [ ] **`useWorkspaceRouter` unsafe casts** — `hooks/useWorkspaceRouter.ts:47` casts arbitrary event string to `MappingTabId` without validation; line 36 casts event as `CustomEvent` without checking shape.
- [x] **`<span onClick>` a11y** — `ConditionBuilderPreview.tsx:399-430` and `InlineExpression.tsx:113-122` use `<span onClick>` without `role="button"`, `tabIndex`, or keyboard handler. Replace with `<button>`.

---

## Completed (reference only — do not reopen)

<details>
<summary><strong>P0 — Correctness and fences</strong> (all done)</summary>

- [x] Add `@formspec-org/types` as a **direct** dependency in `packages/formspec-studio/package.json` → commit `cb921792`.
- [x] Move `nextId` in `packages/formspec-studio-core/src/proposal-manager.ts` from **module scope** to an instance field → commit `e474bbe9`.
- [x] **Document and enforce** the clone-before-`restoreState` contract — JSDoc on `restoreState` + dev-only `deepFreeze` guard + contract tests → commit `e58cac18`.
- [x] Add a **snapshot isolation** test for ProposalManager → commit `e474bbe9` (`instance isolation` describe block).
- [x] Replace `as any` tree access in `packages/formspec-studio-core/src/evaluation-helpers.ts` (previewForm) with typed `CompNode` walks → commit `a44b76a7`.
- [x] **bindKeyMap collision:** `reconcileComponentTree` (`@formspec-org/core`) stamps each item with `definitionItemPath` (absolute definition dotted path). Layout code in `@formspec-org/studio-core` / studio prefers that field when resolving paths; `buildBindKeyMap` remains a fallback for external trees that never ran reconciliation. Areas touched: `packages/formspec-core/src/tree-reconciler.ts`, `packages/formspec-studio-core/src/authoring-helpers.ts`, `packages/formspec-studio/src/workspaces/layout/render-tree.tsx`, `CompNode` in `layout-helpers.ts`.

</details>

<details>
<summary><strong>P1 — Owner decisions</strong> (all done)</summary>

- [x] **Behavior preview:** `BehaviorPreview` is mounted from **Preview** workspace as the **Behavior** mode (alongside Form / JSON); `PreviewMode` includes `'behavior'`.

</details>

<details>
<summary><strong>P2 — Consolidation and cleanup</strong> (all done)</summary>

**Component tree helpers:**

- [x] Introduce shared **`tree-utils.ts`** and consolidate **`findComponentNodeById`** (merged with prior `findNodeById` usage; see `packages/formspec-studio-core/src/tree-utils.ts`).
- [x] **`componentTreeHasBind` / `componentSubtreeContainsRef`:** No `componentTreeHasBind` symbol remains; subtree membership is **`treeContainsRef`** in `tree-utils.ts`.
- [x] **Parent walk:** **`findParentOfNodeRef`** / **`findParentRefOfNodeRef`** live in `tree-utils.ts`; no duplicate `_findComponentParentRef`.
- [x] **Test-local tree DFS copies:** Old `findNodeById` / `findNodeByBind` block in `project-methods.test.ts` is gone; helpers live in `tree-utils.ts`.

**Chat (dual product — keep both):**

- [x] Add a short **"Two chat surfaces"** section to `packages/formspec-studio/README.md` → commit `1108a85d`.
- [x] Replace **500ms `setInterval`** polling with subscribe/notify via `ProposalManager.subscribe` + `useSyncExternalStore` → commit `1108a85d`.
- [x] **Unify provider localStorage keys** under canonical `formspec:provider-config` with one-time legacy-key migration → commit `3d3ff501`.
- [x] Add a small **shared icons** module — `IconSparkle` / `IconArrowUp` extracted to `components/icons/` → commit `1108a85d`.

**Legacy / deprecated API:**

- [x] Remove **`formspecBaseCssHref`** from `formspec-base-css-url.ts` → commit `e474bbe9`.
- [x] Update `packages/formspec-studio/tests/setup.ts` to import only **non-deprecated** public exports → commit `e474bbe9`.

**Repo layout (thoughts / research):**

- [x] Move `packages/formspec-studio/research/` into `thoughts/archive/studio/research-2026-04-14/` with README banner.
- [x] Delete the empty **`packages/formspec-studio/research/`** directory.
- [x] Move `packages/formspec-studio/thoughts/editor-canvas-audit.md` → `thoughts/plans/2026-03-13-editor-canvas-audit.md`.
- [x] Move `packages/formspec-studio-core/research/adr/` → `thoughts/adr/0061-*`, `0062-*` (renumbered).

**P3 helper extraction (completed):**

- [x] **Extract pure helpers (batch 1 — sample / object):** `pruneObject`, `sampleValueForField`, `filterByRelevance` → `lib/sample-data.ts`; `editDistance`, `resolvePath` → `lib/object-utils.ts`.
- [x] **Extract pure helpers (batch 2 — FEL / tree):** `buildRepeatScopeRewriter`, `checkVariableSelfReference` → `lib/fel-rewriter.ts`; `refForCompNode`, `pageChildren`, `findKeyInItems` → `tree-utils.ts`; `componentTargetRef` → `lib/component-target-ref.ts`.
- [x] Add a **file size guardrail:** `npm run check:studio-source-sizes`.

**Explicit gaps (documented, not fixed):**

- [x] Document **`Project.renameVariable()`** as `NOT_IMPLEMENTED` — JSDoc + README.
- [x] **Triage `repro.test.ts`:** removed scratch file (only `console.log` / no assertions).

**Decisions confirmed:**

- [x] Confirm **dual chat architecture** intentional: `ChatPanel.tsx` (sidebar) **and** `chat-v2` MPA at `/studio/chat.html` — different surfaces, not a migration.
- [x] Delete dead **`pre-populate-combined.ts`** and its test.
- [x] Fix stale "stubbed" comment in **`proposal-manager.ts`**.
- [x] Decide **`packages/formspec-studio/research/`** → archive under `thoughts/archive/studio/`.
- [x] **Screener:** Treat as **shipped** (workspace, MCP, E2E, Rust evaluator).
- [x] `useSyncExternalStore` snapshot identity verified; regression test added in commit `137e9954`.

</details>

---

## Reference (not tasks)

### Lessons learned & ideas (from thoughts/studio/ history)

Distilled from 7 thought files spanning 2026-03-05 to 2026-03-30, cross-referenced with the current codebase.

#### Architectural lessons

1. **React beat Preact for the Studio.** PRD and visual spec specified Preact + Preact Signals. Implementation uses React 19 with `useSyncExternalStore`. Right call — React 19's ecosystem gives more leverage for a complex desktop-class app.

2. **Tree + inspector is still the model, not document-first.** The PRD's biggest vision has not been attempted. The current Studio is the "canvas/inspector model (Figma/Webflow)" the PRD said should exist "as a layer underneath." Works for power users but doesn't achieve "2 minutes to first form."

3. **Pragmatic DnD over dnd-kit.** Researched dnd-kit (captured in `thoughts/studio/vendor/dndkit.txt`), chose `@atlaskit/pragmatic-drag-and-drop`. Simpler API, lighter weight.

4. **The 3-tier cascade is the right model and now surfaced.** P5.4 extended it to 5 levels and added source-layer badges in the properties panel. The cascade is comprehensible to users.

5. **Packages-first is sacred and well-followed.** Studio imports from studio-core, engine, webcomponent, layout, chat, MCP. No spec logic reimplemented in the UI layer.

#### Ideas that survived from early thinking

- Progressive disclosure (5 patterns: smart defaults, collapsed sections, hover-to-reveal, mode switching, contextual surfacing)
- Three ways to do everything (direct manipulation, command palette, keyboard)
- Selection drives the inspector (context-sensitive properties panel)
- The complexity map (40/70/40/115/108 property layers across 5 layers)
- Widget constraints must generate semantic enforcement
- The screener as a ManageView pillar (not a separate tab)
- FEL as the universal escape hatch for visual builders
- The condition builder pattern (field/operator/value rows)

#### Ideas that were tried and abandoned

- **Dark-first design** — visual spec prescribed Bloomberg-style dark + amber. Actual Studio defaults to warm light (cream/brass/teal) with dark mode option. Amber survives as warm brass.
- **Preact** — specified in PRD and visual spec. Switched to React 19.
- **dnd-kit** — researched, abandoned for pragmatic-drag-and-drop.
- **Icon-only sidebar** — visual spec had ~48px icon sidebar expanding to ~180px. Actual sidebar is ~214px with full labels and badges.
- **JSON editor as first-class mode** — visual spec had Guided/JSON toggle in tree editor. Actual has JSON viewing in Preview only.
- **Separate Component/Theme/Mapping tabs** — V2 architecture plan killed these as sidebar tabs. Current Studio mostly follows.

#### Principles for future work

1. **The PRD's delivery phases are still the right roadmap.** Phase 1 (Google Forms Moment) is 80% of the value. Measure every feature against: "does this help a non-technical user build their first form in under 2 minutes?"

2. **Build the condition builder once, use it everywhere.** Screener routes, bind relevant/required, shape constraints, calculate templates — same core pattern, same components.

3. **The FEL toggle is non-negotiable.** Every visual builder must have an "Advanced" toggle to raw FEL. Complex expressions that don't fit the visual model degrade gracefully, not block the user.

4. **Don't fight manual edits.** "iOS Feel, Android Flexibility" — if a user makes an advanced edit the guided UI can't model, mark it "Custom" and show raw source. Never overwrite manual work.

5. **Test against "2 minutes to first form."** The PRD's success criterion. Current Studio doesn't achieve this for non-technical users (requires understanding tree model, properties panel, FEL). Document-first is the only path.

6. **The $ref assembler is a prerequisite for form composition.** Without FEL rewriting, the Studio can't support sub-form composition — a key differentiator for enterprise form systems.

#### Recurring themes

- **Non-technical users as primary audience** — every doc returns to "can a program officer who doesn't know JSON build this form?" Answer keeps being "not yet" for advanced features.
- **Progressive disclosure as the answer to complexity** — the ~373 spec properties problem. Five-pattern framework is the consistently proposed solution.
- **The spec as source of truth** — schemas validate, packages implement, Studio surfaces. Never the other way.
- **FEL as both safety net and barrier** — it's the escape hatch for every visual builder but the barrier to entry for non-technical users. Visual builders exist to make FEL invisible for the common case while preserving full power.

### Quick reference

| Label | What it is |
|--------|----------------|
| `integrated-studio-ai` | `src/components/ChatPanel.tsx` — sidebar assistant on `Project` |
| `standalone-conversational-entry` | `src/chat-v2/` + `main-chat.html` route `/studio/chat.html` |

**Suggested PR labels:** `correctness-hazard` (restoreState, useSyncExternalStore), `needs-owner-decision` (BehaviorPreview), `archive-reference` (moved research), `delete-now` (orphan runtime — pre-populate already removed).

### Verification (run after each significant PR)

- [ ] `npm run build` (repo root)
- [ ] `npm run check:deps`
- [ ] `packages/formspec-studio` unit tests (include screener if touched)
- [ ] `packages/formspec-studio-core` unit tests
- [ ] Playwright: chat / changeset specs if chat or ProposalManager behavior changed
- [ ] Manual smoke: Screener workspace; ChatPanel open + changeset review; standalone `/studio/chat.html` if keys or chat code changed
- [ ] No broken imports / stale re-exports; README matches final decisions
