# Studio review — task list

**Scope:** `packages/formspec-studio/`, `packages/formspec-studio-core/`
**Goal:** Remove dead code, document real gaps, cut correctness and dependency risk, ship PRD-aligned features.
**Last validated:** 2026-04-22 (full refactoring audit of 175+ files / ~29k lines in `packages/formspec-studio/`; P6 added).

Use this file as a **backlog**: each `- [ ]` is one shippable task unless noted as a multi-step epic.

---

## Active work (open tasks, priority order)

---

### P3 — `project.ts` modularization (epic — completed)

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

#### 6.1 Shared primitives (highest leverage — completed)

- [x] **`useEscapeKey(callback, active)`** — escape-key handler duplicated in 5 dialogs.
- [x] **`<InlineCreateForm>`** — inline add/create pattern duplicated in 10 files.
- [x] **`<ExpandableCard>`** — card-with-collapsible-header duplicated in 5 files.
- [x] **`<Pillar>`** — workspace section pillar triplicated.
- [x] **`<SectionFilterBar>`** — tab strip triplicated.
- [x] **Consolidate icons** — inline SVGs copy-pasted in 10+ files. Move all to `components/icons/index.tsx`.
- [x] **Consolidate `Section` arrows** — Replaced text `▶▼` with shared `IconChevronDown` in `Section.tsx`.
- [x] **Unify `CollapsibleSection`** — Consolidated `Section`, `CollapsibleSection`, and `AccordionSection` into a single pattern.
- [x] **`useControllableState`** — "controlled if prop provided, uncontrolled otherwise" pattern. Consolidated into `useControllableState.ts`.
- [x] **`exportProjectZip(project)`** — ZIP export logic. Move to `lib/`.
- [ ] **`<RenderableBindCard>`** — `BindCard`+`GuidedBindEditor` wrapper copy-pasted 7 times in `ItemRowCategoryPanel.tsx`.
- [x] **FEL quoting utilities** — `quoteFELValue`/`unquoteFELValue` logic. Extract to shared utility.
- [x] **`<EmptyBlueprintState>`** — dashed-border empty state repeated in 6 blueprint files.
- [x] **`<EmptyWorkspaceState>`** — large dashed-border empty state extracted.
- [x] **`useProjectSlice(selector)`** — `useSyncExternalStore` subscription boilerplate.
- [x] **`useFieldOptions()`** — field-options construction. Consolidated into a shared hook.
- [x] **`<OverflowButton>`** — inline toolbar overflow button triplicated in `InlineToolbar.tsx`.
- [x] **Adopt `useDirtyGuard`** — Integrated into popovers.
- [x] **Replace `window.confirm()`** — used in 7 locations despite `<ConfirmDialog>` existing.
- [x] **`BindEntry` interface + `bindTypes`** — duplicated verbatim. Extract to shared types file.

#### 6.2 Decompose god components (epic — completed)

- [x] **`LayoutLeafBlock`** — Extracted from `FieldBlock.tsx` and `DisplayBlock.tsx`, eliminating ~400 lines of identical code.
- [x] **Decompose `Shell.tsx`** — Extracted `BlueprintSidebar`, `WorkspaceContent`, `ShellDialogs`, `useBlueprintSectionResolution`, and `ShellConstants`. Down to ~350 lines.
- [x] **Decompose `LayoutCanvas.tsx`** — Extracted `LayoutCanvasHeader`, `useLayoutPageMaterializer`, and `layout-tree-utils`. Down to ~430 lines.
- [x] **Extract `useInlineIdentityEdit`** — identity editing state machine. Provided keyboard handlers and shared logic for `ItemRow`, `GroupNode`, and `ItemRowContent`.
- [x] **Decompose `FELEditor.tsx`** — Extracted `useFELAutocomplete`, `FELHighlightOverlay`, and `FELAutocompleteMenu`. Down to ~250 lines.
- [x] **Decompose `render-tree.tsx`** — Extracted helpers and cleaned up the main recursive loop.
- [x] **Decompose `ItemListEditor.tsx`** — Extracted `WrapInGroupDialog`.

#### 6.3 Bugs and correctness (completed)

- [x] **`useOptionalDefinition()` reads stale data** — Fixed via `useSyncExternalStore`.
- [x] **`manageCount` non-reactive** — Fixed via `useProjectState`.
- [x] **`ActiveGroupProvider` context not memoized** — Fixed.
- [x] **`useMappingIds` new array every render** — Fixed.
- [x] **`ConditionBuilder` stale on prop change** — Fixed.
- [x] **`FELEditor` blur-to-save race** — Fixed.
- [x] **`ShapesSection.handleAdd` discards user ID** — Fixed.
- [x] **`MappingConfig.tsx` Enter double-fires setter** — Fixed.
- [x] **DnD context re-renders on every pointer move** — Fixed.
- [x] **`RuleCard.tsx` `any` typing** — Fixed.
- [x] **`SettingsDialog.tsx` duplicate functions** — Fixed.
- [x] **Remove dead `collisionPriority` prop** — Removed.
- [x] **Dead code cleanup** — Verified and removed identical branches and stale ternaries.

#### 6.4 Architecture and DX

- [ ] **Dual chat: shared abstractions** — (SKIPPED per user request)
- [ ] **Provider config UI 3-way duplication** — (SKIPPED per user request)
- [ ] **Dual CSS systems** — studio uses Tailwind with semantic tokens; chat-v2 defines 90+ CSS custom properties.
- [x] **5-level relative imports** — Fixed by re-exporting from `studio-core`.
- [x] **Cross-workspace dependency** — Moved `DataSources` and `OptionSets` to `workspaces/shared/`.
- [x] **DnD file naming inconsistency** — Consolidated all layout DnD files into `workspaces/layout/dnd/` with unified naming (Pdnd).
- [x] **`layout-node-styles.ts` + `layout-canvas-drag-chrome.ts` overlap** — Merged into `layout-dnd-styles.ts`.
- [x] **Delete dead code** — `ComponentRenderer.tsx`, `LayoutPreviewPanel.tsx`, `LayoutWorkspace.tsx`.
- [x] **Add `ThemeTab.tsx`** — Introduced top-level Theme workspace and tab orchestrator.
- [ ] **`handleResend`/`handleEdit` near-duplicate** — (SKIPPED per user request)
- [x] **`useWorkspaceRouter` unsafe casts** — Fixed via validation.
- [x] **`<span onClick>` a11y** — Replaced with `<button>`.

---

## Completed (reference only — do not reopen)

<details>
<summary><strong>P0 — Correctness and fences</strong> (all done)</summary>
...
</details>

---

## Reference (not tasks)
...
