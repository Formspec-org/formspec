# Clustered Parallel Multi-Agent Bug Fix Workflow

## Agent Instructions

**Each agent MUST update this file as work progresses:**
- When starting a bug: change `[ ]` to `[~]` (in progress)
- When a bug is fixed and verified: change `[~]` to `[x]` (done)
- If a test was already passing (not a real bug): change `[ ]` to `[-]` (skipped) and add a note

**Per-bug workflow:**
1. **Validate RED** — Run the test, confirm it fails. If it passes, fix the test first.
2. **Debug** — Read test expectations, trace through source to find root cause.
3. **Fix** — Minimum change, follow existing patterns.
4. **Verify GREEN** — Run specific test, then broader suite for regressions.
5. **E2E check** — If applicable, run the E2E test too.

**Test commands:**
```bash
# Unit test
cd packages/formspec-studio && npx vitest run tests/path/to/test.test.tsx --reporter=verbose 2>&1 | head -80

# E2E test
cd packages/formspec-studio && npx playwright test tests/e2e/playwright/file.spec.ts --grep "test name" --reporter=list 2>&1 | head -80

# Full unit suite (regression check)
cd packages/formspec-studio && npx vitest run --reporter=verbose

# Full E2E suite
cd packages/formspec-studio && npx playwright test
```

---

## Phase 1 — Independent Clusters (6 agents in parallel)

These clusters share NO source files and can run simultaneously.

### Agent 1: Cluster A — Inspector
**Source:** `ItemProperties.tsx`, `field-helpers.ts`
**Tests:** `item-properties.test.tsx`, `item-properties-switching.test.tsx`, `shell.test.tsx`, `inspector-safety.spec.ts`

- [x] BUG-022
- [x] BUG-025
- [x] BUG-032
- [x] BUG-012
- [x] BUG-052
- [x] BUG-053
- [x] BUG-057
- [x] BUG-040

### Agent 2: Cluster H — Data
**Source:** `DataTab.tsx`, `ResponseSchema.tsx`, `DataSources.tsx`, `OptionSets.tsx`
**Tests:** `response-schema.test.tsx`, `data-sources.test.tsx`, `option-sets.test.tsx`, `test-response.test.tsx`, `theme-tokens.test.ts`

- [x] BUG-002
- [x] BUG-003
- [x] BUG-033
- [x] BUG-034
- [x] BUG-035
- [x] BUG-036
- [x] BUG-048
- [x] BUG-054

### Agent 3: Cluster I — Logic
**Source:** `LogicTab.tsx`, `FilterBar.tsx`
**Tests:** `logic-tab.test.tsx`, `binds-section.test.tsx`, `shapes-section.test.tsx`, `bind-card.test.tsx`, `logic-authoring.spec.ts`

- [x] BUG-013
- [x] BUG-049
- [x] BUG-050
- [x] BUG-055
- [x] BUG-060

### Agent 4: Cluster K — Add Item
**Source:** `AddItemPalette.tsx`
**Tests:** `add-item-palette.test.tsx`, `editor-authoring.spec.ts`

- [x] BUG-004
- [x] BUG-026
- [x] BUG-063

### Agent 5: Cluster M — Mapping
**Source:** `MappingTab.tsx`
**Tests:** `mapping-tab.test.tsx`, `mapping-preview.test.tsx`, `mapping-workspace.spec.ts`

- [x] BUG-031
- [x] BUG-046
- [x] BUG-066

### Agent 6: Cluster P — Core Tree
**Source:** `packages/formspec-studio-core/src/project.ts`
**Tests:** `tree-sync.test.ts`

- [x] BUG-001

---

## Phase 2 — Editor Canvas Pipeline (sequential dependency)

### Step 2a — Agents 7+8 in parallel (after Phase 1 completes)

#### Agent 7: Cluster B — Context Menu
**Source:** `EditorContextMenu.tsx`, `EditorCanvas.tsx` (context menu handler)
**Tests:** `editor-context-menu.test.tsx`, `editor-authoring.spec.ts`

- [x] BUG-007 / BUG-042
- [x] BUG-043
- [x] BUG-009
- [x] BUG-061

#### Agent 8: Cluster Q — Canvas Interaction
**Source:** `EditorCanvas.tsx` (drag/tab-order rendering)
**Tests:** `editor-canvas.test.tsx`, `editor-authoring.spec.ts`

- [x] BUG-056
- [x] BUG-062

### Step 2b — Agent 9 (after 2a completes)

#### Agent 9: Cluster J — Page/Wizard
**Source:** `PageTabs.tsx`, `EditorCanvas.tsx`, `StructureTree.tsx`
**Tests:** `page-tabs.test.tsx`, `structure-tree.test.tsx`, `editor-authoring.spec.ts`

- [x] BUG-010
- [x] BUG-011
- [x] BUG-044
- [x] BUG-073
- [x] BUG-074
- [x] BUG-075

### Step 2c — Agent 10 (after 2b completes)

#### Agent 10: Cluster L — Blueprint
**Source:** `Blueprint.tsx`, `StructureTree.tsx`, `Variables.tsx`, `Settings.tsx`
**Tests:** `blueprint.test.tsx`, `structure-tree.test.tsx`, `variables.test.tsx`, `settings.test.tsx`

- [x] BUG-014
- [x] BUG-027
- [x] BUG-028
- [x] BUG-030
- [x] BUG-037
- [x] BUG-045
- [x] BUG-047

---

## Phase 3 — Shell & Header Groups

### Pair 3a — Agents 11+12 in parallel

#### Agent 11: Cluster D+G — Import + Keyboard
**Source:** `ImportDialog.tsx`, `Shell.tsx`, `keyboard.ts`
**Tests:** `import-dialog.test.tsx`, `shell.test.tsx`, `keyboard.test.ts`

- [x] BUG-018
- [x] BUG-020
- [x] BUG-021
- [x] BUG-064
- [x] BUG-065
- [x] BUG-015
- [x] BUG-016

#### Agent 12: Cluster C+N+O — Palette + Chrome + Features
**Source:** `CommandPalette.tsx`, `Header.tsx`, `StatusBar.tsx`, `Footer.tsx`
**Tests:** `command-palette.test.tsx`, `header.test.tsx`, `status-bar.test.tsx`, `footer.test.tsx`

- [x] BUG-005
- [x] BUG-006
- [x] BUG-017
- [x] BUG-019
- [x] BUG-001 (Chrome)
- [x] BUG-008
- [x] BUG-051
- [x] BUG-058
- [x] BUG-059
- [x] BUG-067
- [x] BUG-024
- [x] BUG-029
- [x] BUG-072

### Pair 3b — Agent 13 (after Phase 1 Agent 6 completes)

#### Agent 13: Cluster E+F — Preview
**Source:** `PreviewTab.tsx`, webcomponent integration
**Tests:** `preview-tab.test.tsx`, `preview-integration.spec.ts`

- [x] BUG-023
- [x] BUG-038
- [x] BUG-041
- [x] BUG-068
- [x] BUG-069
- [x] BUG-070
- [x] BUG-039
- [x] BUG-071

---

## Final Verification

- [x] Full unit suite passes: `cd packages/formspec-studio && npx vitest run`
  - **268/268 pass** — Fixed missing `registerTarget`/`itemPath` props in `field-block.test.tsx` (4 tests) and `theme-tokens.test.tsx` (1 test), plus ambiguous `/page/i` selector in `page-layouts.test.tsx` (1 test)
- [x] Full E2E suite passes: `cd packages/formspec-studio && npx playwright test`
  - **141/141 pass** — All fixed, see breakdown below
- [x] All worktrees merged back to `studiofixes`
  - `studiofixes2` branch had no package diffs vs `studiofixes` — all work already in working tree
- [x] Final full-suite run on merged branch — **268 unit + 141 E2E = ALL GREEN**

### E2E Fixes Summary

All 141 E2E tests pass. Fixes applied across sessions:

- `preview-field-types.spec.ts` — `<option>` inside closed `<select>` isn't "visible" per Playwright; changed assertions from `toBeVisible()` to `toBeAttached()`
- `theme-workspace.spec.ts` BUG-029 — added `+ Add` buttons to populated state of all 6 theme sub-tabs; reverted ThemeTab from `sr-only` to conditional rendering; fixed unit test to use `act()`
- `wizard-mode.spec.ts` (2 tests) — **Root cause**: webcomponent took `planComponentTree` path (auto-built Stack tree existed) instead of `planDefinitionFallback` where wizard wrapping logic lives. Fix: `normalizeComponentDoc` strips auto-built tree when `pageMode === 'wizard'` or `'tabs'`, forcing fallback path
- `interaction-patterns.spec.ts` (3 tests) — **Root cause**: `ItemProperties` unconditionally auto-focused Key input on selection change, stealing focus from clicked field card. Fix: added `selectAndFocusInspector` / `shouldFocusInspector` flag so auto-focus only fires after add-item, not on navigation clicks
- `shell-responsive.spec.ts` (1 test) — **Root cause**: Header's `shrink-0` right actions group forced 1258px min width. Fix: added `isCompact` prop to Header (hides non-critical buttons at tablet width), added `overflow-x-hidden` to shell root
- `undo-redo.spec.ts` (1 test) — **Root cause**: `seedDefinition` pushed a snapshot onto undo stack, so after one undo the stack wasn't empty. Fix: added `Project.resetHistory()` method, called from test helpers after seeding

---

## Changes Made This Session

### Source changes:

- `packages/formspec-webcomponent/src/components/interactive.ts:233` — Wizard last-step button: "Finish" → "Submit"
- `packages/formspec-layout/src/planner.ts:323-343` — Wizard/Tabs wrapping of top-level groups when `formPresentation.pageMode` is set (from prior session)
- `packages/formspec-studio/src/workspaces/preview/preview-documents.ts` — `presentation` → `formPresentation` normalization; `normalizeComponentDoc` strips auto-built tree in wizard/tabs mode to force fallback planner path
- `packages/formspec-studio/src/workspaces/preview/FormspecPreviewHost.tsx` — Passes normalized definition to `normalizeComponentDoc`
- `packages/formspec-studio/src/state/useSelection.tsx` — Added `selectAndFocusInspector`, `shouldFocusInspector`, `consumeFocusInspector` to separate navigation selection from inspector auto-focus
- `packages/formspec-studio/src/workspaces/editor/ItemProperties.tsx` — Auto-focus Key input only when `shouldFocusInspector` flag is set (not on every selection change)
- `packages/formspec-studio/src/workspaces/editor/EditorCanvas.tsx` — `handleAddItem` uses `selectAndFocusInspector` instead of `select`
- `packages/formspec-studio/src/components/Header.tsx` — Added `isCompact` prop; hides non-critical buttons and shrinks search at tablet width
- `packages/formspec-studio/src/components/Shell.tsx` — Passes `isCompact={isTabletLayout}` to Header; added `overflow-x-hidden` to shell root
- `packages/formspec-studio-core/src/project.ts` — Added `resetHistory()` method to clear undo/redo stacks
- `packages/formspec-studio/src/workspaces/theme/ThemeTab.tsx` — Reverted from `sr-only` all-panels to conditional rendering (only active tab)
- `packages/formspec-studio/src/workspaces/theme/TokenEditor.tsx` — Added `+ Add Token` button in both empty and populated states
- `packages/formspec-studio/src/workspaces/theme/DefaultsEditor.tsx` — Added `+ Add Default` button in both empty and populated states
- `packages/formspec-studio/src/workspaces/theme/SelectorList.tsx` — Added `+ Add Selector` button in both empty and populated states
- `packages/formspec-studio/src/workspaces/theme/ItemOverrides.tsx` — Added `+ Add Item Override` button in populated state
- `packages/formspec-studio/src/workspaces/theme/PageLayouts.tsx` — Added `+ Add Page Layout` button in populated state
- `packages/formspec-studio/src/workspaces/theme/BreakpointEditor.tsx` — Added `+ Add Breakpoint` button in populated state
- `packages/formspec-studio/vite.config.ts` — Added formspec-layout alias + optimizeDeps exclude

### Test changes:

- `packages/formspec-studio/tests/workspaces/theme/theme-tab.test.tsx` — Wrapped `.click()` calls in `act()` for React 19 compatibility
- `packages/formspec-studio/tests/e2e/playwright/preview-field-types.spec.ts` — Changed `toBeVisible()` → `toBeAttached()` for `<option>` elements
- `packages/formspec-studio/tests/workspaces/editor/field-block.test.tsx` — Added missing `registerTarget`/`itemPath` props
- `packages/formspec-studio/tests/styles/theme-tokens.test.tsx` — Added missing `registerTarget`/`itemPath` props to DisplayBlock render
- `packages/formspec-studio/tests/workspaces/theme/page-layouts.test.tsx` — Narrowed `/page/i` selector to `/page 1/i`
- `packages/formspec-studio/tests/e2e/playwright/helpers.ts` — `seedDefinition`/`seedProject` call `project.resetHistory()` after import

---

## Key References

- Bug descriptions + root causes: `thoughts/formspec-studio/coverage-gaps.md`
- Bug-to-test mapping: `thoughts/formspec-studio/bug-test-mapping.md`
- Source files: `packages/formspec-studio/src/`
- Core source: `packages/formspec-studio-core/src/`
- Unit tests: `packages/formspec-studio/tests/`
- E2E tests: `packages/formspec-studio/tests/e2e/playwright/`
