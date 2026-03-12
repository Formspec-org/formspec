# Formspec Studio — Bug → Test File Mapping

Date: 2026-03-12
Source: `thoughts/formspec-studio/visual_bugs.md` (72 bugs) + 3 code-review bugs (#73–#75)

All paths relative to `packages/formspec-studio/`.

---

## Cluster A: Inspector Panel

`ItemProperties.tsx`, `field-helpers.ts`

| Bug | Summary | Existing Unit Test | Existing E2E Test | Gap |
|-----|---------|-------------------|-------------------|-----|
| #22 | KEY stale on switch | `tests/workspaces/editor/item-properties-switching.test.tsx` — multi-field selection harness | `tests/e2e/playwright/editor-authoring.spec.ts` — tests rename, not switch-then-read | **DONE 2026-03-12:** select field A → select field B → assert KEY input updates |
| #25 | Rename breaks inspector | `tests/workspaces/editor/item-properties-switching.test.tsx` — post-rename inspector repro | `tests/e2e/playwright/editor-authoring.spec.ts:51` — tests rename, doesn't verify inspector survives | **DONE 2026-03-12:** rename → assert inspector still shows renamed item |
| #32 | Behavior Rules never show | `tests/workspaces/editor/item-properties.test.tsx` — behavior-rules section repro | — | **DONE 2026-03-12:** seed binds matching field path → assert "Behavior Rules" section renders |
| #12 | "+ Add Rule" dead | `tests/workspaces/editor/item-properties.test.tsx` — click should dispatch a bind action | — | **DONE 2026-03-12:** `+ Add Rule` now has a failing dispatch repro |
| #52 | No cardinality settings | `tests/workspaces/editor/item-properties.test.tsx` — repeatable-group cardinality repro | — | **DONE 2026-03-12:** select repeatable group → assert min/max controls |
| #53 | No choice options editor | `tests/workspaces/editor/item-properties.test.tsx` — choice-options editor repro | — | **DONE 2026-03-12:** select choice field → assert options section renders |
| #57 | No label field | `tests/workspaces/editor/item-properties.test.tsx` — label input repro | — | **DONE 2026-03-12:** select field with label → assert label input present |
| #40 | Inspector in non-Editor tabs | `tests/components/shell.test.tsx` — shell-level delete suppression repro | `tests/e2e/playwright/inspector-safety.spec.ts` — inspector actions remain visible in Data workspace | **DONE 2026-03-12:** select in Editor → switch workspace → assert Delete/Duplicate hidden or disabled |

### Actions

- **DONE 2026-03-12:** `tests/workspaces/editor/item-properties-switching.test.tsx` — added a failing multi-field selection harness for #22 and #25
- **NEW FILE (E2E):** `tests/e2e/playwright/inspector-safety.spec.ts` — #40 (inspector buttons hidden in non-Editor workspaces)
- **DONE 2026-03-12:** `item-properties.test.tsx` — added failing expectations for bind rendering (#32), cardinality (#52), choice options (#53), and label editing (#57)
- **DONE 2026-03-12:** `item-properties.test.tsx` — added a failing `+ Add Rule` dispatch repro for #12

---

## Cluster B: Context Menu

`EditorContextMenu.tsx`, `EditorCanvas.tsx`

| Bug | Summary | Existing Unit Test | Existing E2E Test | Gap |
|-----|---------|-------------------|-------------------|-----|
| #7/#42 | Wrap in Group no-op | `tests/workspaces/editor/context-menu.test.tsx` — wrap-in-group behavior repro | `tests/e2e/playwright/interaction-patterns.spec.ts` — wrap-in-group repro | **DONE 2026-03-12:** fire `wrapInGroup` → assert DOM change |
| #43 | Move Down no-op | `tests/workspaces/editor/context-menu.test.tsx` — move-down behavior repro | `tests/e2e/playwright/interaction-patterns.spec.ts` — move-down repro | **DONE 2026-03-12:** move item down → assert order changes |
| #9 | Menu off-screen | — | `tests/e2e/playwright/interaction-patterns.spec.ts` — viewport-edge context menu repro | **DONE 2026-03-12:** right-click near edge → assert menu within viewport |
| #61 | Menu on empty canvas | — | `tests/e2e/playwright/interaction-patterns.spec.ts` — empty-canvas context menu suppression | **DONE 2026-03-12:** right-click empty area → assert no field context menu |

### Actions

- **DONE 2026-03-12:** `context-menu.test.tsx` — replaced shallow action-dispatch checks with failing `EditorCanvas` behavior tests for wrap and move-down (#7/#42, #43)
- **DONE 2026-03-12:** `interaction-patterns.spec.ts` — added failing E2E cases for wrap-in-group (#7/#42), move-down (#43), and empty-canvas context menu suppression (#61)

---

## Cluster C: Command Palette

`CommandPalette.tsx`, `Header.tsx`

| Bug | Summary | Existing Unit Test | Existing E2E Test | Gap |
|-----|---------|-------------------|-------------------|-----|
| #5 | Missing rules/FEL results | `tests/components/command-palette.test.tsx` — rules/FEL search repro | — | **DONE 2026-03-12:** seed binds/shapes → search → assert rules appear |
| #6 | Variable click does nothing | `tests/components/command-palette.test.tsx` — variable-row action repro | `tests/e2e/playwright/command-palette.spec.ts` — item/keyboard coverage | **DONE 2026-03-12:** click variable row → assert navigation/action |
| #17 | No keyboard nav | `tests/components/command-palette.test.tsx` — keyboard-nav repro | `tests/e2e/playwright/command-palette.spec.ts` — arrow/enter repro | **DONE 2026-03-12:** type → ArrowDown → Enter → assert selection |
| #19 | Stale search on reopen | `tests/components/command-palette.test.tsx` — reopen-reset repro | `tests/e2e/playwright/command-palette.spec.ts` — stale-state reopen repro | **DONE 2026-03-12:** type → close → reopen → assert input empty |

### Actions

- **DONE 2026-03-12:** `command-palette.test.tsx` — added failing expectations for rules search (#5), variable click (#6), keyboard navigation (#17), and reopen-state reset (#19)
- **DONE 2026-03-12:** `command-palette.spec.ts` — added failing E2E coverage for keyboard nav (#17) and stale-state reopen (#19)

---

## Cluster D: Import Dialog

`ImportDialog.tsx`, `Shell.tsx`

| Bug | Summary | Existing Unit Test | Existing E2E Test | Gap |
|-----|---------|-------------------|-------------------|-----|
| #18 | Clears undo | — | `tests/e2e/playwright/import-definition.spec.ts` — undo-after-import repro | **DONE 2026-03-12:** make edits → import → assert undo still available |
| #20 | Stale state on reopen | `tests/components/import-dialog.test.tsx` — reopen-reset repro | `import-definition.spec.ts` — stale-state reopen repro | **DONE 2026-03-12:** open → type → cancel → reopen → assert textarea empty |
| #21 | Escape doesn't close | — | `tests/e2e/playwright/import-definition.spec.ts` — Escape dismiss repro | **DONE 2026-03-12:** open import → Escape → assert closed |
| #64 | Missing ARIA | `import-dialog.test.tsx` — modal dialog a11y assertions | — | **DONE 2026-03-12:** assert `role="dialog"` and `aria-modal` on container |
| #65 | Load enabled with bad JSON | `import-dialog.test.tsx` — invalid-JSON disablement repro | — | **DONE 2026-03-12:** paste invalid JSON → assert Load button disabled |

### Actions

- **DONE 2026-03-12:** `import-dialog.test.tsx` — added failing expectations for reopen reset (#20), dialog ARIA (#64), and invalid-JSON disablement (#65)
- **DONE 2026-03-12:** `import-definition.spec.ts` — added failing E2E coverage for Escape dismiss (#21) and stale-state reopen reset (#20)
- **DONE 2026-03-12:** `import-definition.spec.ts` — covers import-dialog Escape dismissal for #21; no additional `interaction-patterns.spec.ts` repro needed

---

## Cluster E: Preview Rendering

`PreviewTab.tsx`, `formspec-webcomponent`

| Bug | Summary | Existing Unit Test | Existing E2E Test | Gap |
|-----|---------|-------------------|-------------------|-----|
| #23 | String/Int/Date/Choice missing | `tests/workspaces/preview/component-renderer.test.tsx` — concrete field-widget repro | `tests/e2e/playwright/preview-field-types.spec.ts` — concrete preview-control repro | **DONE 2026-03-12:** seed integer/date/choice → assert render in preview |
| #38 | Wizard flat not paged | `tests/workspaces/preview/wizard-nav.test.tsx` — WizardNav component works in isolation | `tests/e2e/playwright/wizard-mode.spec.ts` — wizard paging repro | **DONE 2026-03-12:** seed wizard → assert one page visible + Next |
| #41 | Desktop=Tablet viewport | `preview-tab.test.tsx` — no viewport width test | `preview-workspace.spec.ts:89` — computed-width comparison repro | **DONE 2026-03-12:** assert computed width differs between Desktop and Tablet (both render 748px) |
| #68 | No Submit button | `tests/workspaces/preview/wizard-nav.test.tsx:23` — component-level submit repro | `tests/e2e/playwright/wizard-mode.spec.ts` — final-page submit repro | **DONE 2026-03-12:** last wizard page → assert Submit button |
| #69 | Calculated fields don't update | `tests/workspaces/preview/preview-tab.test.tsx` — calculated-field update repro | `tests/e2e/playwright/preview-workspace.spec.ts` — calculated update repro | **DONE 2026-03-12:** seed calculate bind → type in source → assert target updates |
| #70 | No Remove on repeat | `tests/workspaces/preview/component-renderer.test.tsx` — repeat remove-control repro | `tests/e2e/playwright/preview-workspace.spec.ts` — repeat-removal repro | **DONE 2026-03-12:** seed repeatable → add instance → assert Remove button |

### Actions

- **DONE 2026-03-12:** `tests/e2e/playwright/preview-field-types.spec.ts` — tightened the field-type coverage to assert concrete preview controls for #23 after the first pass stayed green
- **DONE 2026-03-12:** `tests/e2e/playwright/wizard-mode.spec.ts` — added failing E2E coverage for wizard navigation (#38) and final-page submit (#68)
- **DONE 2026-03-12:** `tests/workspaces/preview/component-renderer.test.tsx` — added failing expectations for concrete field widgets (#23) and repeat remove controls (#70)
- **DONE 2026-03-12:** `tests/workspaces/preview/preview-tab.test.tsx` — added a failing calculated-field update expectation for #69
- **DONE 2026-03-12:** `tests/e2e/playwright/preview-workspace.spec.ts` — added failing E2E coverage for viewport-width parity (#41), calculated updates (#69), and repeat removal (#70)

---

## Cluster F: Preview JSON View

`PreviewTab.tsx`

| Bug | Summary | Existing Test | Gap |
|-----|---------|--------------|-----|
| #39 | No copy button | `tests/workspaces/preview/json-view.test.tsx` — copy-affordance repro | **DONE 2026-03-12:** assert copy-to-clipboard button renders |
| #71 | Component/Theme sub-tabs show stubs | `tests/workspaces/preview/json-view.test.tsx` — non-stub sub-tab repro | **DONE 2026-03-12:** switch sub-tabs → assert real content |

### Actions

- **DONE 2026-03-12:** `tests/workspaces/preview/json-view.test.tsx` — added failing expectations for copy affordance (#39) and non-stub Component/Theme docs (#71); refined the test flow after the first red run

---

## Cluster G: Global Keyboard + Workspace Switching

`Shell.tsx`, `keyboard.ts`

| Bug | Summary | Existing Unit Test | Existing E2E Test | Gap |
|-----|---------|-------------------|-------------------|-----|
| #15 | Delete from wrong workspace | `tests/lib/keyboard.test.ts` — non-Editor suppression repro | `tests/e2e/playwright/workspace-state-persistence.spec.ts` — cross-workspace delete repro | **DONE 2026-03-12:** select in Editor → switch to Data → Delete → assert item not deleted |
| #16 | Sub-tabs reset on leave | — | `tests/e2e/playwright/workspace-state-persistence.spec.ts` — sub-tab persistence repro | **DONE 2026-03-12:** Data→Option Sets → Logic → Data → assert Option Sets active |
| #40 | Inspector buttons in non-Editor (see Cluster A) | | | |

### Actions

- **DONE 2026-03-12:** `tests/e2e/playwright/workspace-state-persistence.spec.ts` — added failing E2E coverage for cross-workspace delete (#15) and sub-tab persistence (#16); refined the sub-tab selector after the first red run
- **DONE 2026-03-12:** `keyboard.test.ts` — added a failing expectation that delete is suppressed outside the Editor workspace (#15); refined it to target a focused child inside a non-Editor workspace container
- **DONE 2026-03-12:** `tests/e2e/playwright/inspector-safety.spec.ts` — added failing E2E coverage for non-Editor inspector actions remaining visible (#40)

---

## Cluster H: Data Workspace

`DataTab.tsx`, `ResponseSchema.tsx`, `DataSources.tsx`, `OptionSets.tsx`

| Bug | Summary | Existing Unit Test | Existing E2E Test | Gap |
|-----|---------|-------------------|-------------------|-----|
| #2 | Dark borders in light shell | `tests/styles/theme-tokens.test.tsx` — Data workspace light-token repro | — | **DONE 2026-03-12:** Data workspace should avoid `neutral-*` border utilities in the light shell |
| #3 | `text-foreground` undefined | `tests/styles/theme-tokens.test.tsx` — foreground-token repro | — | **DONE 2026-03-12:** `text-foreground` usage should be backed by a defined CSS token |
| #33 | Repeatable→"object" | `tests/workspaces/data/response-schema.test.tsx:40` — asserts `array` for repeatable groups | `data-workspace.spec.ts` — no repeatable test | **DONE 2026-03-12:** seed repeatable group → assert type="array" |
| #34 | Labels look clickable but aren't | `tests/workspaces/data/response-schema.test.tsx` — label-navigation affordance repro | — | **DONE 2026-03-12:** click label → assert navigation affordance to Editor |
| #35 | DataSources empty stub | `tests/workspaces/data/data-sources.test.tsx` — empty-state creation affordance repro | `data-workspace.spec.ts:46` — tests instances render | **DONE 2026-03-12:** empty state → assert creation affordance |
| #36 | Test Response placeholder | `tests/workspaces/data/test-response.test.tsx` — non-placeholder content repro | — | **DONE 2026-03-12:** assert meaningful content, not dev stub |
| #48 | OptionSets read-only | `tests/workspaces/data/option-sets.test.tsx` — edit-affordance repro | `data-workspace.spec.ts:55` — render only | **DONE 2026-03-12:** click card → assert edit affordance |
| #54 | Chip contrast | `tests/workspaces/data/option-sets.test.tsx` — chip styling/accessibility repro | — | **DONE 2026-03-12:** option chips should remain legible against their background |

### Actions

- **DONE 2026-03-12:** `response-schema.test.tsx:40` — changed the test expectation from `object` to `array` for repeatable groups (#33)
- **DONE 2026-03-12:** `tests/workspaces/data/test-response.test.tsx` — added a failing expectation for non-placeholder Test Response content (#36)
- **DONE 2026-03-12:** `response-schema.test.tsx` — added failing expectations for repeatable type (#33) and interactive label navigation affordance (#34)
- **DONE 2026-03-12:** `option-sets.test.tsx` — added failing expectations for card edit affordance (#48) and accessible chip styling (#54)
- **DONE 2026-03-12:** `data-sources.test.tsx` — added a failing empty-state creation affordance expectation (#35)
- **DONE 2026-03-12:** `tests/styles/theme-tokens.test.tsx` — added failing token/class regressions for dark Data workspace borders (#2) and undefined `text-foreground` usage (#3)
- **DONE 2026-03-12:** `tests/styles/theme-tokens.test.ts` — added failing source-level token regressions for Data dark-theme borders/chips (#2) and missing `foreground` theme token (#3)

---

## Cluster I: Logic Workspace

`LogicTab.tsx`, `FilterBar.tsx`

| Bug | Summary | Existing Unit Test | Existing E2E Test | Gap |
|-----|---------|-------------------|-------------------|-----|
| #13 | Filter chips don't filter | `tests/workspaces/logic/logic-tab.test.tsx:41` — click-to-filter repro | `tests/e2e/playwright/logic-authoring.spec.ts` — filter-click repro | **DONE 2026-03-12:** click "required" chip → assert only required binds visible |
| #49 | Bind rows don't select | `tests/workspaces/logic/binds-section.test.tsx` — clickable-bind-row repro | `tests/e2e/playwright/logic-authoring.spec.ts` — bind-row selection repro | **DONE 2026-03-12:** click bind row → assert related field selection |
| #50 | Shapes inconsistent detail | `tests/workspaces/logic/shapes-section.test.tsx:22` — strengthened multi-shape detail repro | — | **DONE 2026-03-12:** seed 3+ shapes with constraints → assert all show constraint text |
| #55 | FEL ref function click | `tests/components/ui/bind-card.test.tsx` — signature-copy repro | — | **DONE 2026-03-12:** click `sum` in the bind-card FEL reference → expect clipboard copy |
| #60 | FEL read-only | `tests/workspaces/logic/logic-tab.test.tsx` — variable expression double-click repro | — | **DONE 2026-03-12:** double-click expression → expect editor input |

### Actions

- **DONE 2026-03-12:** `logic-tab.test.tsx` — added failing expectations for filter-click (#13) and bind-row selection (#49)
- **DONE 2026-03-12:** `binds-section.test.tsx` — added a failing expectation that bind rows render as clickable controls (#49)
- **DONE 2026-03-12:** `shapes-section.test.tsx` — added failing full-detail assertions across 3+ shapes (#50)
- **DONE 2026-03-12:** `bind-card.test.tsx` — added a failing FEL reference function-click repro for #55
- **DONE 2026-03-12:** `logic-tab.test.tsx` — added a failing double-click expression-editor repro for #60
- **DONE 2026-03-12:** `logic-authoring.spec.ts` — added failing E2E coverage for filter click (#13) and bind-row selection (#49)
- **DONE 2026-03-12:** `bind-card.test.tsx` — added a failing FEL reference function-click repro for #55
- **DONE 2026-03-12:** `logic-tab.test.tsx` — added a failing double-click expression-editor repro for #60

---

## Cluster J: Page/Wizard Mode

`PageTabs.tsx`, `EditorCanvas.tsx`, `StructureTree.tsx`

| Bug | Summary | Existing Unit Test | Existing E2E Test | Gap |
|-----|---------|-------------------|-------------------|-----|
| #10 | Inactive tabs hide labels | `tests/workspaces/editor/page-tabs.test.tsx:39` — visible label assertions via `getByText` | `tests/e2e/playwright/wizard-mode.spec.ts` — paged-mode workflow repro | **DONE 2026-03-12:** assert visible label text on all tabs, not just `title` attr |
| #11 | Page mode hides root items | `tests/workspaces/editor/editor-canvas.test.tsx` — orphan root item should still render in wizard mode | `tests/e2e/playwright/wizard-mode.spec.ts` — paged-mode workflow repro | **DONE 2026-03-12:** root-level items stay visible after page mode is enabled |
| #44 | Tabs can't be renamed | `tests/workspaces/editor/page-tabs.test.tsx` — double-click should open inline rename | `tests/e2e/playwright/wizard-mode.spec.ts` — tab rename workflow repro | **DONE 2026-03-12:** double-click page tab should expose inline editor |
| #73 | First field blocked in empty paged definition | `packages/formspec-studio-core/tests/definition-items.test.ts` — empty paged definition add-item repro | — | **DONE 2026-03-12:** pageMode with no groups should still allow the first root field |
| #74 | Added page selects wrong key after collision rename | `tests/components/blueprint/structure-tree.test.tsx` — collision-safe key repro | — | **DONE 2026-03-12:** add page with existing `page1` → assert `activePageKey` follows inserted key (`page1_1`) |
| #75 | Active-page normalization only runs when StructureTree is mounted | `tests/workspaces/editor/editor-canvas.test.tsx` — first page should auto-select without StructureTree | — | **DONE 2026-03-12:** paged Editor render without StructureTree → first tab should still be selected |

### Actions

- **DONE 2026-03-12:** `page-tabs.test.tsx:39` — changed the test from `getByTitle` to visible label assertions (#10)
- **DONE 2026-03-12:** `page-tabs.test.tsx` — added a failing double-click rename expectation (#44)
- **DONE 2026-03-12:** `editor-canvas.test.tsx` — added a failing orphan-root-item visibility repro for #11
- **DONE 2026-03-12:** `editor-canvas.test.tsx` — added a failing first-tab normalization repro for #75 when `EditorCanvas` renders without `StructureTree`
- **NEW FILE (E2E):** `tests/e2e/playwright/wizard-mode.spec.ts` — #10, #11, #44 (also covers Cluster E #38, #68)
- **DONE 2026-03-12:** `packages/formspec-studio-core/tests/definition-items.test.ts` — added a failing empty-paged-definition add-item repro for #73
- **DONE 2026-03-12:** `structure-tree.test.tsx` — added a failing collision-key page-selection repro for #74; refined it after the first run to keep a single stronger red case

---

## Cluster K: Add Item Flow

`AddItemPalette.tsx`

| Bug | Summary | Existing Unit Test | Existing E2E Test | Gap |
|-----|---------|-------------------|-------------------|-----|
| #4 | Not mobile-safe | `tests/components/add-item-palette.test.tsx` — narrow-screen layout repro | — | **DONE 2026-03-12:** viewport resize → assert single-column layout |
| #26 | Not auto-selected | — | `tests/e2e/playwright/editor-authoring.spec.ts` — auto-select after add repro | **DONE 2026-03-12:** add item → assert inspector shows new item |
| #63 | Auto-generated key | — | `tests/e2e/playwright/editor-authoring.spec.ts` — immediate rename-focus repro | **DONE 2026-03-12:** add item → assert inspector focused on key input |

### Actions

- **DONE 2026-03-12:** `tests/components/add-item-palette.test.tsx` — added a failing narrow-screen single-column expectation (#4); refined the card selector after the first red run
- **DONE 2026-03-12:** `editor-authoring.spec.ts` — added failing E2E coverage for auto-select after add (#26) and immediate rename focus after add (#63)

---

## Cluster L: Blueprint Sidebar

`Blueprint.tsx`, `StructureTree.tsx`, `Variables.tsx`, `Settings.tsx`

| Bug | Summary | Existing Unit Test | Existing E2E Test | Gap |
|-----|---------|-------------------|-------------------|-----|
| #14 | Component tree count=0 | `tests/components/blueprint.test.tsx:35` — non-zero count-badge repro | — | **DONE 2026-03-12:** seed component doc → assert count badge > 0 |
| #27 | Settings read-only | `tests/components/blueprint/settings-section.test.tsx` — editable-title repro | — | **DONE 2026-03-12:** click title → assert editable |
| #28 | Title truncated no tooltip | `tests/components/blueprint/settings-section.test.tsx:52` — long-title tooltip repro | — | **DONE 2026-03-12:** seed long title → assert `title` attribute |
| #30 | Variables inert | `tests/components/blueprint/sidebar-panels.test.tsx` — variable-action repro | — | **DONE 2026-03-12:** click variable → assert navigation/action affordance |
| #37 | Screener badge inert | `tests/components/blueprint/screener-section.test.tsx` — disabled-badge interaction repro | — | **DONE 2026-03-12:** click `Disabled` → assert toggle/creation affordance |
| #45 | Structure click no scroll | `tests/components/blueprint/structure-tree.test.tsx:57` — local scroll-sync repro | `tests/e2e/playwright/blueprint-selection-sync.spec.ts` — blueprint/editor sync repro | **DONE 2026-03-12:** click tree item on different page → assert canvas navigates/syncs |
| #47 | Collapse arrow frozen | `tests/components/blueprint.test.tsx` — collapse-arrow glyph repro | — | **DONE 2026-03-12:** click section → assert arrow rotates (▶ → ▼) |

### Actions

- **DONE 2026-03-12:** `blueprint.test.tsx` — added failing coverage for seeded component-tree counts (#14) and collapse-arrow state (#47)
- **DONE 2026-03-12:** `settings-section.test.tsx` — added failing expectations for editable title switching (#27) and full-title tooltips (#28)
- **DONE 2026-03-12:** `sidebar-panels.test.tsx` — added a failing expectation that variables render as clickable controls (#30)
- **DONE 2026-03-12:** `screener-section.test.tsx` — added a failing expectation that the disabled screener badge is an interactive setup control (#37)
- **DONE 2026-03-12:** `structure-tree.test.tsx` — added a failing expectation that structure clicks scroll the matching canvas block into view (#45)
- **DONE 2026-03-12:** `blueprint-selection-sync.spec.ts` — added failing E2E coverage for cross-page tree navigation plus scroll sync (#45); refined the page-tab selector after the first red run
- **DONE 2026-03-12:** `blueprint.test.tsx` — added failing expectations for component-tree counts (#14) and collapse-arrow state changes (#47)

---

## Cluster M: Mapping Workspace

`MappingTab.tsx`

| Bug | Summary | Existing Unit Test | Existing E2E Test | Gap |
|-----|---------|-------------------|-------------------|-----|
| #31 | Escape doesn't close picker | — | `tests/e2e/playwright/mapping-workspace.spec.ts` — picker Escape repro | **DONE 2026-03-12:** click direction → Escape → assert closed |
| #46 | Direction badge inert | `tests/workspaces/mapping/mapping-preview.test.tsx:17` — direction-control action repro | `tests/e2e/playwright/mapping-workspace.spec.ts` — direction-picker repro | **DONE 2026-03-12:** click direction → assert dropdown/action |
| #66 | Config section can't collapse | `tests/workspaces/mapping/mapping-tab.test.tsx` — workspace-level collapse persistence repro | `tests/e2e/playwright/mapping-workspace.spec.ts` — collapse persistence coverage | **DONE 2026-03-12:** tests written (unit + E2E); implementation fix still needed |

### Actions

- **DONE 2026-03-12:** `mapping-workspace.spec.ts` — added failing E2E coverage for picker Escape (#31), direction click (#46), and config-collapse persistence (#66)
- **DONE 2026-03-12:** `mapping-tab.test.tsx` — added a failing workspace-level collapse persistence repro for #66 after the isolated config section passed

---

## Cluster N: Shell Chrome

`Header.tsx`, `StatusBar.tsx`, `Footer.tsx`, `Section.tsx`

| Bug | Summary | Existing Unit Test | Existing E2E Test | Gap |
|-----|---------|-------------------|-------------------|-----|
| #1 | Shell breaks at tablet width | `tests/components/shell.test.tsx` — no responsive test | `tests/e2e/playwright/shell-responsive.spec.ts` — tablet overflow repro | **DONE 2026-03-12:** resize to 768px → assert no horizontal overflow |
| #8 | Tiny text (9–10px) | — | `tests/e2e/playwright/shell-responsive.spec.ts` — minimum-font-size repro | **DONE 2026-03-12:** assert minimum font size ≥ 11px for navigational text |
| #51 | Header metadata inert | `tests/components/header.test.tsx` — metadata click-action repro | `tests/e2e/playwright/header-actions.spec.ts` — header action repro | **DONE 2026-03-12:** click metadata → assert Settings/navigation affordance |
| #58 | Logo does nothing | `tests/components/shell.test.tsx` — home-action repro | `smoke.spec.ts` — same | **DONE 2026-03-12:** click logo → assert home/top-level action |
| #59 | Avatar does nothing | `tests/components/header.test.tsx` — avatar affordance repro | `tests/e2e/playwright/header-actions.spec.ts` — avatar action repro | **DONE 2026-03-12:** click avatar → assert menu affordance |
| #67 | Footer URL not a link | `tests/components/status-bar.test.tsx` — link rendering repro | — | **DONE 2026-03-12:** assert URL renders as `<a>` with `href` |

### Actions

- **DONE 2026-03-12:** `tests/e2e/playwright/shell-responsive.spec.ts` — added failing E2E coverage for tablet overflow (#1) and undersized chrome text (#8)
- **DONE 2026-03-12:** `shell.test.tsx` — added failing expectations for the clickable home logo (#58) and non-Editor delete suppression at the Shell level (#15)
- **DONE 2026-03-12:** `header.test.tsx` — added failing expectations for Export (#24), New Form (#72), clickable metadata (#51), and avatar menu affordance (#59)
- **DONE 2026-03-12:** `status-bar.test.tsx` — added a failing expectation that the footer URL renders as a real link (#67)

---

## Cluster O: Missing Top-Level Features

| Bug | Summary | Proposed Test Location | Type |
|-----|---------|----------------------|------|
| #24 | No Export | `tests/components/header.test.tsx` → assert Export button; `tests/e2e/playwright/import-definition.spec.ts` → rename to `import-export.spec.ts`, add export E2E | Unit + E2E |
| #29 | Theme tabs all empty stubs | `tests/workspaces/theme/theme-tab.test.tsx` — empty-state add-affordance repro | Unit |
| #72 | No "New Form" | `tests/components/header.test.tsx` or `shell.test.tsx` → assert "New" button renders | Unit + E2E |

- **DONE 2026-03-12:** `tests/workspaces/theme/theme-tab.test.tsx` — added failing empty-state add-affordance expectations across Theme sub-tabs (#29)
- **DONE 2026-03-12:** `tests/e2e/playwright/header-actions.spec.ts` — added failing E2E coverage for Export (#24), New Form (#72), clickable metadata (#51), and avatar affordance (#59)
- **DONE 2026-03-12:** `tests/workspaces/mapping/mapping-tab.test.tsx` — tightened #66 to a workspace-level collapse persistence repro after the isolated config-section check came up green

---

## Cluster P: Studio Core — Component Tree Rebuilds

`packages/formspec-studio-core/src/project.ts` — `_rebuildComponentTree()`

| Bug | Summary | Existing Unit Test | Existing E2E Test | Gap |
|-----|---------|-------------------|-------------------|-----|
| BUG-001 | Display node component overrides lost during tree rebuilds | `packages/formspec-studio-core/tests/tree-sync.test.ts` — rebuild override-preservation repro | — | **DONE 2026-03-12:** trigger rebuild after distinct display overrides → assert both retained |

**Root Cause:** Display items lack a `bind` property, so `_rebuildComponentTree()` has to rely on a separate identity key. The current Studio-core tests now probe a likely collision path where display-node identity is only the local `item.key`, which can conflate same-key display items under different groups during rebuilds.

**Proposed Fix:** Use `item.key` as a `nodeId` for display node matching — build an `existingDisplayById` map parallel to `existingBound`, keyed by `nodeId` instead of `bind`.

**Severity:** P2 — latent data loss; currently low impact (studio only creates `Text` display nodes), but blocks custom display component editing.

### Actions

- **DONE 2026-03-12:** `packages/formspec-studio-core/tests/tree-sync.test.ts` — extended display-node rebuild coverage with a same-key nested-display repro for BUG-001
- **DONE 2026-03-12:** `tests/e2e/playwright/editor-authoring.spec.ts` — added failing E2E for display override survival through tree rebuild (same-key collision path)

---

## Cluster Q: Editor Canvas Interaction

`EditorCanvas.tsx`

| Bug | Summary | Existing Unit Test | Existing E2E Test | Gap |
|-----|---------|-------------------|-------------------|-----|
| #56 | No drag-to-reorder for field cards | `tests/workspaces/editor/editor-canvas.test.tsx` — draggable-card repro | `tests/e2e/playwright/interaction-patterns.spec.ts` — drag-affordance repro | **DONE 2026-03-12:** assert drag handles/drag affordance render on field cards |
| #62 | Tab key moves focus to inspector instead of canvas fields | `tests/workspaces/editor/editor-canvas.test.tsx` — canvas tab-order repro | `tests/e2e/playwright/interaction-patterns.spec.ts` — field-card Tab-order repro | **DONE 2026-03-12:** focus field card → Tab → assert next field card focused |

### Actions

- **DONE 2026-03-12:** `tests/workspaces/editor/editor-canvas.test.tsx` — added failing expectations for hidden root items in wizard mode (#11), missing drag handles (#56), and broken Tab order between field cards (#62)
- **DONE 2026-03-12:** `tests/e2e/playwright/editor-authoring.spec.ts` — added failing E2E coverage for later-page add-item selection sync (#26) and immediate rename focus after adding Single Choice (#63)
- **DONE 2026-03-12:** `tests/e2e/playwright/interaction-patterns.spec.ts` — now also verifies missing drag affordances (#56) and broken Tab focus order between field cards (#62)

---

## Tests That Codify Bugs (need fixing, not just adding)

All previously-codified bugs have been corrected:

| File | Line | Bug | Status |
|------|------|-----|--------|
| `tests/workspaces/data/response-schema.test.tsx` | :40 | #33 | **FIXED 2026-03-12:** Now asserts `array` for repeatable groups |
| `tests/workspaces/editor/page-tabs.test.tsx` | :39 | #10 | **FIXED 2026-03-12:** Now uses `getByText` for visible label assertions |

---

## New Files Summary

| Proposed File | Bugs Covered | Type |
|---------------|-------------|------|
| `tests/workspaces/editor/item-properties-switching.test.tsx` | #22, #25, #32, #57 | Unit | DONE 2026-03-12 (covers #22, #25) |
| `tests/e2e/playwright/inspector-safety.spec.ts` | #40, #15 | E2E | DONE 2026-03-12 (#40) |
| `tests/e2e/playwright/workspace-state-persistence.spec.ts` | #15, #16 | E2E | DONE 2026-03-12 |
| `tests/e2e/playwright/preview-field-types.spec.ts` | #23 | E2E | DONE 2026-03-12 |
| `tests/workspaces/preview/component-renderer.test.tsx` | #23, #70 | Unit | DONE 2026-03-12 |
| `tests/workspaces/preview/preview-tab.test.tsx` | #23, #41, #69 | Unit | DONE 2026-03-12 (#69) |
| `tests/e2e/playwright/wizard-mode.spec.ts` | #10, #11, #38, #44, #68 | E2E | DONE 2026-03-12 (#38, #68) |
| `tests/workspaces/preview/json-view.test.tsx` | #39, #71 | Unit | DONE 2026-03-12 |
| `tests/workspaces/theme/theme-tab.test.tsx` | #29 | Unit | DONE 2026-03-12 |
| `tests/workspaces/data/test-response.test.tsx` | #36 | Unit | DONE 2026-03-12 |
| `tests/styles/theme-tokens.test.tsx` | #2, #3 | Unit | DONE 2026-03-12 |
| `tests/components/add-item-palette.test.tsx` | #4, #26, #63 | Unit | DONE 2026-03-12 (#4) |
| `tests/components/blueprint.test.tsx` | #14, #47 | Unit | DONE 2026-03-12 |
| `tests/components/blueprint/settings-section.test.tsx` | #27, #28 | Unit | DONE 2026-03-12 |
| `tests/components/blueprint/sidebar-panels.test.tsx` | #30 | Unit | DONE 2026-03-12 |
| `tests/components/blueprint/screener-section.test.tsx` | #37 | Unit | DONE 2026-03-12 |
| `tests/components/blueprint/structure-tree.test.tsx` | #45 | Unit | DONE 2026-03-12 |
| `tests/e2e/playwright/shell-responsive.spec.ts` | #1, #8 | E2E | DONE 2026-03-12 |
| `packages/formspec-studio-core/tests/tree-sync.test.ts` | BUG-001 | Unit | DONE 2026-03-12 |
| `packages/formspec-studio-core/tests/definition-items.test.ts` | #73 | Unit | DONE 2026-03-12 |

## Existing Files Needing Extension

| File | Add Tests For Bugs |
|------|--------------------|
| `tests/workspaces/editor/item-properties.test.tsx` | #12, #32, #52, #53, #57 | DONE 2026-03-12 (#12, #32, #52, #53, #57) |
| `tests/workspaces/editor/context-menu.test.tsx` | #7/#42, #43 | DONE 2026-03-12 |
| `tests/components/command-palette.test.tsx` | #5, #6, #17, #19 | DONE 2026-03-12 |
| `tests/components/import-dialog.test.tsx` | #20, #21, #64, #65 | DONE 2026-03-12 (#20, #64, #65) |
| `tests/workspaces/data/response-schema.test.tsx` | #33 (fix), #34 | DONE 2026-03-12 |
| `tests/styles/theme-tokens.test.ts` | #2, #3 | DONE 2026-03-12 |
| `tests/workspaces/data/option-sets.test.tsx` | #48, #54 | DONE 2026-03-12 |
| `tests/workspaces/data/data-sources.test.tsx` | #35 | DONE 2026-03-12 |
| `tests/workspaces/logic/logic-tab.test.tsx` | #13, #49, #60 | DONE 2026-03-12 |
| `tests/components/ui/bind-card.test.tsx` | #55 | DONE 2026-03-12 |
| `tests/workspaces/logic/binds-section.test.tsx` | #49 | DONE 2026-03-12 |
| `tests/workspaces/logic/shapes-section.test.tsx` | #50 | DONE 2026-03-12 |
| `tests/workspaces/theme/theme-tab.test.tsx` | #29 | DONE 2026-03-12 |
| `tests/workspaces/editor/page-tabs.test.tsx` | #10 (fix), #44 | DONE 2026-03-12 |
| `tests/workspaces/editor/editor-canvas.test.tsx` | #11, #56, #62, #75 | DONE 2026-03-12 |
| `tests/components/blueprint.test.tsx` | #14, #47 | DONE 2026-03-12 |
| `tests/components/blueprint/settings-section.test.tsx` | #27, #28 | DONE 2026-03-12 |
| `tests/components/blueprint/structure-tree.test.tsx` | #45, #74 | DONE 2026-03-12 |
| `tests/components/blueprint/sidebar-panels.test.tsx` | #30 | DONE 2026-03-12 |
| `tests/components/blueprint/screener-section.test.tsx` | #37 | DONE 2026-03-12 |
| `tests/workspaces/preview/preview-tab.test.tsx` | #23, #41, #69 | DONE 2026-03-12 (#69) |
| `tests/workspaces/preview/component-renderer.test.tsx` | #23, #70 | DONE 2026-03-12 |
| `tests/components/shell.test.tsx` | #15, #58 | DONE 2026-03-12 |
| `tests/components/header.test.tsx` | #24, #51, #59, #72 | DONE 2026-03-12 |
| `tests/components/status-bar.test.tsx` | #67 | DONE 2026-03-12 |
| `tests/lib/keyboard.test.ts` | #15 | DONE 2026-03-12 |
| `tests/e2e/playwright/editor-authoring.spec.ts` | #26, #63 | DONE 2026-03-12 |
| `tests/e2e/playwright/interaction-patterns.spec.ts` | #7/#42, #43, #56, #61, #62, #21 | DONE 2026-03-12 (#7/#42, #43, #56, #61, #62) |
| `tests/e2e/playwright/command-palette.spec.ts` | #17, #19 | DONE 2026-03-12 |
| `tests/e2e/playwright/import-definition.spec.ts` | #18, #20 | DONE 2026-03-12 (#20, #21) |
| `tests/e2e/playwright/preview-workspace.spec.ts` | #38, #41, #68, #69, #70 | DONE 2026-03-12 (#41, #69, #70) |
| `tests/e2e/playwright/logic-authoring.spec.ts` | #13, #49 | DONE 2026-03-12 |
| `tests/e2e/playwright/blueprint-selection-sync.spec.ts` | #45 | DONE 2026-03-12 |
| `tests/e2e/playwright/header-actions.spec.ts` | #24, #51, #59, #72 | DONE 2026-03-12 |
| `tests/e2e/playwright/inspector-safety.spec.ts` | #40, #15 | DONE 2026-03-12 (#40) |
| `tests/e2e/playwright/mapping-workspace.spec.ts` | #31, #46, #66 | DONE 2026-03-12 |
| `tests/workspaces/mapping/mapping-tab.test.tsx` | #66 | DONE 2026-03-12 |
| `tests/workspaces/mapping/rule-editor.test.tsx` | #66 | superseded by `tests/workspaces/mapping/mapping-tab.test.tsx` for the actual workspace-level collapse bug |
| `tests/workspaces/mapping/mapping-preview.test.tsx` | #46 | DONE 2026-03-12 |
