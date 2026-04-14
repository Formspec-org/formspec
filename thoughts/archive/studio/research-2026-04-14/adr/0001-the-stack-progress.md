# The Stack — Progress Tracker

> Side-card for [0001-the-stack-tdd-implementation-plan.md](./0001-the-stack-tdd-implementation-plan.md)
> Updated: 2026-03-11

---

## Phase 0: Scaffolding & Design Tokens ✅

- [x] `package.json` — React 19, Vite, Tailwind 4, Vitest, RTL, studio-core dep
- [x] `vite.config.ts` — React plugin, monorepo aliases
- [x] `tsconfig.json` — strict, JSX react-jsx, workspace paths
- [x] `vitest.config.ts` — happy-dom, same aliases
- [x] `src/index.css` — Tailwind v4 @theme tokens (colors, fonts, radii)
- [x] `src/main.tsx` — React root mount
- [x] `src/index.css` — Tailwind directives + Google Fonts
- [x] `index.html` — Vite entry
- [x] `tests/smoke.test.tsx` — app mounts without crashing
- [x] `npm install` succeeds
- [x] `npm run build` compiles clean
- [x] `npm test` smoke passes

---

## Phase 1: React–Project Integration Layer ✅

### Tests (RED first)
- [x] `tests/state/project-context.test.tsx` — Provider renders, useProject returns instance (2 tests)
- [x] `tests/state/project-state.test.tsx` — re-renders on dispatch, updated definition (3 tests)
- [x] `tests/state/dispatch.test.tsx` — stable function, addItem updates state (2 tests)
- [x] `tests/state/selection.test.tsx` — select/deselect, persists across re-renders (4 tests)

### Implementation (GREEN)
- [x] `src/state/ProjectContext.tsx` — React Context + Provider + DispatchContext
- [x] `src/state/useProject.ts` — context consumer hook
- [x] `src/state/useProjectState.ts` — useSyncExternalStore subscription
- [x] `src/state/useDispatch.ts` — stable dispatch wrapper via context
- [x] `src/state/useSelection.tsx` — selection state management
- [x] `src/state/useDefinition.ts` — derived definition hook
- [x] `src/state/useComponent.ts` — derived component hook
- [x] `src/state/useTheme.ts` — derived theme hook
- [x] `src/state/useMapping.ts` — derived mapping hook

### Verify
- [x] All state tests green (12 tests)
- [x] Build compiles clean

---

## Phase 2: Shell Chrome ✅

### Tests (RED first)
- [x] `tests/components/shell.test.tsx` — title, 6 tabs, tab switching, default Editor (4 tests)
- [x] `tests/components/header.test.tsx` — version, undo/redo disabled states, dispatch (4 tests)
- [x] `tests/components/status-bar.test.tsx` — version, status badge, presentation mode, counts, updates (7 tests)
- [x] `tests/components/blueprint.test.tsx` — 11 section list, count badges, section switching (3 tests)
- [x] `tests/components/properties-panel.test.tsx` — empty state, inspector on selection (2 tests)

### Implementation (GREEN)
- [x] `src/components/Shell.tsx` — root layout frame with workspace routing
- [x] `src/components/Header.tsx` — logo, nav tabs, undo/redo
- [x] `src/components/StatusBar.tsx` — version, status, counts
- [x] `src/components/Blueprint.tsx` — 11 collapsible sidebar sections
- [x] `src/components/PropertiesPanel.tsx` — empty state + selected item routing

### Verify
- [x] All shell tests green (20 tests)
- [x] Build compiles clean

---

## Phase 3: Shared Primitives ✅

### Tests (RED first)
- [x] `tests/components/ui/pill.test.tsx` — text, color, small variant (4 tests)
- [x] `tests/components/ui/bind-card.test.tsx` — bind type rendering, humanized + raw FEL (4 tests)
- [x] `tests/components/ui/shape-card.test.tsx` — severity badge, constraint (4 tests)
- [x] `tests/components/ui/section.test.tsx` — collapsible, state memory, title (4 tests)
- [x] `tests/lib/humanize.test.ts` — FEL → human-readable mappings (8 tests)
- [x] `tests/lib/field-helpers.test.ts` — flatItems, bindsFor, shapesFor, data type lookup (12 tests)

### Implementation (GREEN)
- [x] `src/components/ui/Pill.tsx`
- [x] `src/components/ui/BindCard.tsx`
- [x] `src/components/ui/ShapeCard.tsx`
- [x] `src/components/ui/PropertyRow.tsx`
- [x] `src/components/ui/Section.tsx`
- [x] `src/components/ui/FieldIcon.tsx`
- [x] `src/lib/humanize.ts`
- [x] `src/lib/field-helpers.ts`

### Verify
- [x] All primitive tests green (36 tests)
- [x] Build compiles clean

---

## Phase 4: Editor Workspace ✅

### 4a — Page Navigation
- [x] Tests: page labels, tab switching, active highlight (5 tests)
- [x] `src/workspaces/editor/PageTabs.tsx`

### 4b — Block Rendering
- [x] `tests/workspaces/editor/editor-canvas.test.tsx` — block types, groups, selection, pills (5 tests)
- [x] `tests/workspaces/editor/field-block.test.tsx` — Required pill, Calc pill, icon, nesting (4 tests)
- [x] `src/workspaces/editor/EditorCanvas.tsx`
- [x] `src/workspaces/editor/GroupBlock.tsx`
- [x] `src/workspaces/editor/FieldBlock.tsx`
- [x] `src/workspaces/editor/DisplayBlock.tsx`

### 4c — Properties Panel (Editor Context)
- [x] Tests: rename dispatches, details display, duplicate, delete (5 tests)
- [x] `src/workspaces/editor/ItemProperties.tsx`

### 4d — Drag and Drop
- [x] Drag handle + drop indicator (stub implementation)

### 4e — Context Menu & Inline Creation
- [x] Tests: context menu items, wrap in group (2 tests)
- [x] Tests: add item picker, type selection (5 tests)
- [x] `src/workspaces/editor/EditorContextMenu.tsx`
- [x] `src/workspaces/editor/AddItemPicker.tsx`

### Verify
- [x] All editor tests green (26 tests)
- [x] Build compiles clean

---

## Phase 5: Logic Workspace ✅

### Tests (RED first)
- [x] `tests/workspaces/logic/logic-tab.test.tsx` — filter counts, variables, shapes, binds (4 tests)
- [x] `tests/workspaces/logic/binds-section.test.tsx` — field entries, type pills, expressions (3 tests)
- [x] `tests/workspaces/logic/shapes-section.test.tsx` — severity colors, constraint expressions (3 tests)

### Implementation (GREEN)
- [x] `src/workspaces/logic/LogicTab.tsx`
- [x] `src/workspaces/logic/FilterBar.tsx`
- [x] `src/workspaces/logic/VariablesSection.tsx`
- [x] `src/workspaces/logic/BindsSection.tsx`
- [x] `src/workspaces/logic/ShapesSection.tsx`

### Verify
- [x] All logic tests green (10 tests)
- [x] Build compiles clean

---

## Phase 6: Data Workspace ✅

### Tests (RED first)
- [x] `tests/workspaces/data/response-schema.test.tsx` — table columns, nesting, group types (3 tests)
- [x] `tests/workspaces/data/data-sources.test.tsx` — instance cards, source URL, empty state (3 tests)
- [x] `tests/workspaces/data/option-sets.test.tsx` — option cards, values, used-by count (3 tests)

### Implementation (GREEN)
- [x] `src/workspaces/data/DataTab.tsx`
- [x] `src/workspaces/data/ResponseSchema.tsx`
- [x] `src/workspaces/data/DataSources.tsx`
- [x] `src/workspaces/data/OptionSets.tsx`
- [x] `src/workspaces/data/TestResponse.tsx` (placeholder)

### Verify
- [x] All data tests green (9 tests)
- [x] Build compiles clean

---

## Phase 7: Theme Workspace ✅

### Tests (RED first)
- [x] `tests/workspaces/theme/token-editor.test.tsx` — key-value pairs, all tokens, empty state (3 tests)
- [x] `tests/workspaces/theme/defaults-editor.test.tsx` — current defaults, page mode (2 tests)
- [x] `tests/workspaces/theme/selector-list.test.tsx` — selector cards, match criteria (2 tests)
- [x] `tests/workspaces/theme/item-overrides.test.tsx` — override entries, properties (2 tests)
- [x] `tests/workspaces/theme/page-layouts.test.tsx` — 12-col grid, empty state (2 tests)

### Implementation (GREEN)
- [x] `src/workspaces/theme/ThemeTab.tsx`
- [x] `src/workspaces/theme/TokenEditor.tsx`
- [x] `src/workspaces/theme/DefaultsEditor.tsx`
- [x] `src/workspaces/theme/SelectorList.tsx`
- [x] `src/workspaces/theme/ItemOverrides.tsx`
- [x] `src/workspaces/theme/PageLayouts.tsx`
- [x] `src/workspaces/theme/BreakpointEditor.tsx`

### Verify
- [x] All theme tests green (11 tests)
- [x] Build compiles clean

---

## Phase 8: Mapping Workspace ✅

### Tests (RED first)
- [x] `tests/workspaces/mapping/rule-editor.test.tsx` — rule cards, transform types, source/target (4 tests)
- [x] `tests/workspaces/mapping/mapping-preview.test.tsx` — direction, input/output panels (2 tests)

### Implementation (GREEN)
- [x] `src/workspaces/mapping/MappingTab.tsx`
- [x] `src/workspaces/mapping/MappingConfig.tsx`
- [x] `src/workspaces/mapping/RuleEditor.tsx`
- [x] `src/workspaces/mapping/RuleCard.tsx`
- [x] `src/workspaces/mapping/InnerRules.tsx`
- [x] `src/workspaces/mapping/AdapterConfig.tsx`
- [x] `src/workspaces/mapping/MappingPreview.tsx`

### Verify
- [x] All mapping tests green (6 tests)
- [x] Build compiles clean

---

## Phase 9: Preview Workspace ✅

### Tests (RED first)
- [x] `tests/workspaces/preview/preview-tab.test.tsx` — viewport switcher, form fields, display items (3 tests)
- [x] `tests/workspaces/preview/component-renderer.test.tsx` — inputs, groups, display rendering (3 tests)
- [x] `tests/workspaces/preview/wizard-nav.test.tsx` — step indicators, nav, submit (5 tests)

### Implementation (GREEN)
- [x] `src/workspaces/preview/PreviewTab.tsx`
- [x] `src/workspaces/preview/ViewportSwitcher.tsx`
- [x] `src/workspaces/preview/ComponentRenderer.tsx`
- [x] `src/workspaces/preview/WizardNav.tsx`

### Verify
- [x] All preview tests green (11 tests)
- [x] Build compiles clean

---

## Phase 10: Blueprint Sidebar Sections ✅

### 10a — Structure Tree
- [x] `tests/components/blueprint/structure-tree.test.tsx` — indented tree, icons, selection (4 tests)
- [x] `src/components/blueprint/StructureTree.tsx`

### 10b — Component Tree
- [x] `tests/components/blueprint/component-tree.test.tsx` — nodes, bind keys, types, empty state (4 tests)
- [x] `src/components/blueprint/ComponentTree.tsx`

### 10c — Screener Section
- [x] `tests/components/blueprint/screener-section.test.tsx` — enabled/disabled, fields, routes, default (5 tests)
- [x] `src/components/blueprint/ScreenerSection.tsx`

### 10d — Migrations Section
- [x] `tests/components/blueprint/migrations-section.test.tsx` — entries, description, field map, empty (4 tests)
- [x] `src/components/blueprint/MigrationsSection.tsx`

### 10e — FEL Reference
- [x] `tests/components/blueprint/fel-reference.test.tsx` — categories, function names, signatures (3 tests)
- [x] `src/components/blueprint/FELReference.tsx`

### 10f — Settings Section
- [x] `tests/components/blueprint/settings-section.test.tsx` — metadata, status, presentation, title (4 tests)
- [x] `src/components/blueprint/SettingsSection.tsx`

### 10g — Remaining Sidebar Panels
- [x] `tests/components/blueprint/sidebar-panels.test.tsx` — all 5 panels (5 tests)
- [x] `src/components/blueprint/ThemeOverview.tsx`
- [x] `src/components/blueprint/VariablesList.tsx`
- [x] `src/components/blueprint/DataSourcesList.tsx`
- [x] `src/components/blueprint/OptionSetsList.tsx`
- [x] `src/components/blueprint/MappingsList.tsx`

### Verify
- [x] All blueprint tests green (29 tests)
- [x] Build compiles clean

---

## Phase 11: Global Search, Keyboard Shortcuts & Import ✅

### Tests (RED first)
- [x] `tests/components/command-palette.test.tsx` — open/closed, search filtering, items display (4 tests)
- [x] `tests/components/import-dialog.test.tsx` — open/closed, artifact types (3 tests)
- [x] `tests/lib/keyboard.test.ts` — ⌘Z undo, ⌘⇧Z redo, Escape, ⌘K search, Delete (5 tests)

### Implementation (GREEN)
- [x] `src/components/CommandPalette.tsx`
- [x] `src/components/ImportDialog.tsx`
- [x] `src/lib/keyboard.ts`

### Verify
- [x] All keyboard/search/import tests green (12 tests)
- [x] Build compiles clean

---

## Phase 12: E2E Integration ✅

- [x] `tests/e2e/editor-workflow.test.tsx` — add field, multiple fields, nested groups (3 tests)
- [x] `tests/e2e/logic-workflow.test.tsx` — variables, binds, shapes (3 tests)
- [x] `tests/e2e/data-workflow.test.tsx` — response schema, nested schema (2 tests)
- [x] `tests/e2e/undo-redo.test.tsx` — dispatch/undo, dispatch/undo/redo, multiple undos (3 tests)
- [x] `tests/e2e/import-export.test.tsx` — import definition renders, export matches (2 tests)

---

## Final Verification ✅

- [x] **53 test files, 195 tests — all passing**
- [x] **Build compiles clean** (zero errors, zero warnings)
- [x] Full app wired up: App → ProjectProvider → SelectionProvider → Shell → Workspaces
- [x] All 6 workspaces render with real components
- [x] Blueprint sidebar with all 11 sections
- [x] Properties panel with selection-driven display
