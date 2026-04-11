# Formspec Studio — Test Coverage Gaps

Date: 2026-03-12
Source: `bug-test-mapping.md` cross-referenced against actual test files + `visual_bugs.md` repro steps.

All paths relative to `packages/formspec-studio/` unless noted.

### Ground rules

Every test written from this document **must be RED (failing) on first run**. These are tests for real bugs — if a test passes immediately, it is not testing the actual behavior. When a test comes up green:

1. **Do not ship it.** A green test for a known bug means the test is wrong.
2. **Reproduce in the browser first.** Use Playwright's `page.evaluate`, `boundingBox()`, or direct DOM inspection to confirm the bug is real and visible.
3. **Adjust the test to hit the real code path.** The most common reasons a bug-test passes are: mocked dependencies hiding the broken path, assertions on fixture data instead of rendered output, or selectors that match a wrapper instead of the actual control.
4. **Test real behaviors, not fixtures or testing harnesses.** Seed state via `dispatch`/`seedDefinition`, then assert against what the user sees in the DOM — rendered text, computed styles, bounding boxes, ARIA attributes, enabled/disabled state.

---

## Needs E2E (unit test exists, no E2E coverage)

### Cluster A: Inspector Panel — 7 gaps

Test file: `tests/e2e/playwright/inspector-safety.spec.ts`

- [x] **#22** KEY stale on switch
  - Repro: Select field A (e.g. Full Legal Name, key `name`), then select field B (e.g. SSN, key `ssn`)
  - Assert: KEY input updates to `ssn`, not stuck on `name`
  - Root cause: `ItemProperties.tsx` KEY input uses `defaultValue` (uncontrolled) — never refreshes on selection change

- [x] **#25** Rename breaks inspector
  - Repro: Select a field, edit the KEY input in Properties, commit with Tab
  - Assert: Inspector still shows the renamed item (not "Item not found")
  - Root cause: Inspector resolves by old path string; renamed path no longer exists

- [x] **#32** Behavior Rules never show
  - Repro: Select any field that has binds (e.g. Date of Birth, SSN, Household Size) and look for "Behavior Rules" section
  - Assert: "Behavior Rules" section renders with the field's bind expressions
  - Root cause: `arrayBindsFor` matches on full dot-paths but definition stores bare relative keys

- [x] **#12** "+ Add Rule" dead
  - Repro: Select a field with existing binds, scroll to Behavior Rules, click "+ Add Rule"
  - Assert: A rule composer opens or a new editable rule row is appended
  - Root cause: Button has no click handler — styled like a primary affordance but does nothing

- [x] **#52** No cardinality settings
  - Repro: Click the `Members` repeatable group header (shows `⟳ 0–12`)
  - Assert: Inspector shows min/max cardinality controls
  - Root cause: Inspector only renders Key and Type for groups — no repeat-specific properties

- [x] **#53** No choice options editor
  - Repro: Select "Marital Status" (a Choice field) or add a new Single Choice field
  - Assert: Inspector shows a "Choices" or "Options" section listing available choices
  - Root cause: Inspector renders only Identity section for choice fields — no options section

- [x] **#57** No label field
  - Repro: Select any field (e.g. "Full Legal Name")
  - Assert: Inspector shows a Label/Title input with the human-readable display name
  - Root cause: `ItemProperties.tsx` renders only Key, Type, DataType — no label property

### Cluster C: Command Palette — 1 gap

Test file: `tests/e2e/playwright/command-palette.spec.ts` (extended)

- [x] **#5** Missing rules/FEL results
  - Repro: Press `⌘K`, search for a bind, rule type, or FEL snippet visibly present in the Logic workspace
  - Assert: Rules/binds/shapes appear in the result list
  - Root cause: `CommandPalette.tsx` only builds result groups for flattened items and variables — header says "Search items, rules, FEL…" but rules are never indexed

### Cluster F: Preview JSON View — 2 gaps

Test file: `tests/e2e/playwright/preview-workspace.spec.ts` (extended)

- [x] **#39** No copy button
  - Repro: Preview workspace → Json tab → Definition sub-tab, try to copy the form definition JSON
  - Assert: A "Copy to clipboard" button renders next to the JSON block
  - Root cause: JSON rendered as plain `<pre>/<code>` with no copy affordance

- [x] **#71** Component/Theme sub-tabs show stubs
  - Repro: Preview workspace → Json view → click Component sub-tab, then Theme sub-tab
  - Assert: Each sub-tab shows real document content, not just `{ "targetDefinition": { "url": "..." } }`
  - Root cause: Only the Definition sub-tab renders real content; Component/Theme/Mapping show stub objects

### Cluster H: Data Workspace — 8 gaps

Test file: `tests/e2e/playwright/data-workspace.spec.ts` (extended)

- [x] **#2** Dark borders in light shell
  - Repro: Switch to Data workspace → visit Response Schema, Data Sources, or Option Sets
  - Assert: Borders use light-theme tokens (`border-border`, `bg-subtle`), not `border-neutral-700/800`
  - Root cause: Data workspace uses `border-neutral-700`, `border-neutral-800`, `bg-neutral-800` — leftover dark-theme classes

- [x] **#3** `text-foreground` undefined
  - Repro: Hover inactive tabs in Data workspace; add a Display item and inspect its label styling
  - Assert: Text elements using `text-foreground` have a defined CSS token resolving to a visible color
  - Root cause: `src/index.css` does not define a `foreground` color token — elements fall back to unintended defaults

- [x] **#33** Repeatable shows "object"
  - Repro: Data workspace → Response Schema → find the `members` row
  - Assert: Type column shows "array" (not "object") for repeatable groups
  - Root cause: `ResponseSchema.tsx` doesn't distinguish `repeatable: true` groups from regular groups

- [x] **#34** Labels look clickable but aren't
  - Repro: Data workspace → Response Schema → click any Label column value (e.g. "Full Legal Name")
  - Assert: Click navigates to that field in the Editor or triggers a selection change
  - Root cause: Label values render with blue link-style text but have no click handler

- [x] **#35** DataSources empty stub
  - Repro: Data workspace → Data Sources tab (with no data sources defined)
  - Assert: An "Add Data Source" button or creation affordance is present in the empty state
  - Root cause: Tab shows only "No data sources defined." with no creation affordance

- [x] **#36** Test Response placeholder
  - Repro: Data workspace → Test Response tab
  - Assert: Tab shows meaningful authoring content (e.g. "Run Test" button), not a dev stub string
  - Root cause: Tab body reads verbatim: "Test Response — future implementation."

- [x] **#48** OptionSets read-only
  - Repro: Data workspace → Option Sets → click an option set card (e.g. `incSrc`)
  - Assert: Card is a clickable button that opens an edit view or selects in inspector
  - Root cause: Cards have no click handler — shows options as read-only text

- [x] **#54** Chip contrast
  - Repro: Data workspace → Option Sets → look at option chips ("Employment", "Self-Employment", etc.)
  - Assert: Chip text has accessible contrast (WCAG 4.5:1 minimum)
  - Root cause: `bg-neutral-800` + `slate-900` text = dark-on-dark, ~1:1 contrast ratio

### Cluster I: Logic Workspace — 3 gaps

Test file: `tests/e2e/playwright/logic-authoring.spec.ts` (extended)

- [x] **#50** Shapes inconsistent detail
  - Repro: Logic workspace → Shapes section → observe `inc-lim`, `ast-req`, `hh-match`
  - Assert: All shapes show severity, key, AND FEL expression (not just the first one)
  - Root cause: Only `inc-lim` renders its FEL expression; `ast-req` and `hh-match` show severity/key only

- [x] **#55** FEL ref function click
  - Repro: Logic workspace → click "?" (FEL Reference) button → expand AGGREGATE → click "sum"
  - Assert: Clicking copies the function signature to clipboard or shows detail panel
  - Root cause: Click dismisses the FEL Reference panel with no visible effect or clipboard action

- [x] **#60** FEL read-only
  - Repro: Logic workspace → double-click any variable expression (e.g. `sum($members[*].mInc)`)
  - Assert: An inline expression editor opens
  - Root cause: No click or double-click handler — entire Logic workspace is read-only display

### Cluster J: Page/Wizard Mode — 6 gaps

Test file: `tests/e2e/playwright/wizard-mode.spec.ts` (extended)

- [x] **#10** Inactive tabs hide labels
  - Repro: Switch form into wizard/tabs page mode with several top-level group pages
  - Assert: Every page tab shows its label text, not just numbered circles
  - Root cause: `PageTabs.tsx` only renders the label on the active tab; inactive tabs collapse to numbers

- [x] **#11** Page mode hides root items
  - Repro: Create root-level items, then add a top-level group and enable wizard page mode
  - Assert: Root-level items that aren't top-level groups remain visible in the editor canvas
  - Root cause: Canvas renders only the active top-level group; orphan root items drop out of the view

- [x] **#44** Tabs can't be renamed
  - Repro: Double-click the "Applicant Information" page tab (or right-click for Rename)
  - Assert: An inline text editor opens on the tab label
  - Root cause: Double-click navigates to the page (same as single click); no inline edit or context menu

- [x] **#73** First field blocked in empty paged def
  - Repro: Set `pageMode: "wizard"` with no groups defined, then try to add the first field
  - Assert: The first root field is accepted (guard doesn't block before any pages exist)
  - Root cause: Paged-mode guard rejects non-group root items even when no pages exist yet

- [x] **#74** Added page selects wrong key
  - Repro: With an existing `page1`, add a new page (which auto-generates key `page1` → collision renamed to `page1_1`)
  - Assert: `activePageKey` follows the inserted key (`page1_1`), not the original `page1`
  - Root cause: Selection tracks the generated key before collision rename adjusts it

- [x] **#75** Active-page normalization
  - Repro: Load a paged editor without StructureTree mounted (e.g. fresh render)
  - Assert: First page tab is auto-selected (`aria-selected="true"`)
  - Root cause: Active-page normalization only runs inside StructureTree's effect — if StructureTree isn't mounted, no page gets selected

### Cluster K: Add Item Flow — 1 gap

Test file: `tests/e2e/playwright/editor-authoring.spec.ts` (extended)

- [x] **#4** Not mobile-safe
  - Repro: Click "+ Add Item", resize viewport to a narrow width
  - Assert: Palette switches to single-column layout with readable cards and safe margins
  - Root cause: Modal always uses two-column grid + fixed `pt-20` top offset — no responsive breakpoint

### Cluster L: Blueprint Sidebar — 6 gaps

Test file: `tests/e2e/playwright/blueprint-sidebar.spec.ts` (new)

- [x] **#14** Component tree count=0
  - Repro: Open Blueprint sidebar → Component Tree row (with a component document present)
  - Assert: Count badge shows a non-zero value
  - Root cause: Count function is hardcoded to `0` in `Blueprint.tsx`

- [x] **#27** Settings read-only
  - Repro: Blueprint sidebar → Settings → click on TITLE value ("Section 8 HCV — Inta...")
  - Assert: An editable input field appears for the title
  - Root cause: All settings rows are static `<span>` displays with no edit handlers

- [x] **#28** Title truncated no tooltip
  - Repro: Blueprint sidebar → Settings → look at TITLE row
  - Assert: The element has a `title` attribute with the full untruncated string
  - Root cause: Row values use `truncate` CSS without a `title` attribute

- [x] **#30** Variables inert
  - Repro: Blueprint sidebar → Variables → click a variable row (e.g. `@totalHHInc`)
  - Assert: Click navigates to Logic workspace or opens an editing surface
  - Root cause: Variable rows render with blue link-style text but have no `onClick` handler

- [x] **#37** Screener badge inert
  - Repro: Blueprint sidebar → Screener → click the "Disabled" badge
  - Assert: Click toggles screener to enabled or opens a creation/configuration flow
  - Root cause: Badge is a static `<div>` with no click handler

- [x] **#47** Collapse arrow frozen
  - Repro: Blueprint sidebar → click any section's `▶` button to collapse/expand
  - Assert: Arrow rotates to `▼` when expanded, back to `▶` when collapsed
  - Root cause: Arrow stays `▶` regardless of section state — no visual state feedback

### Cluster N: Shell Chrome — 2 gaps

Test files: `tests/e2e/playwright/header-actions.spec.ts` (new), `tests/e2e/playwright/shell-responsive.spec.ts` (new)

- [x] **#58** Logo does nothing
  - Repro: Click "The Stack" logo/title in the top-left corner of the header
  - Assert: Navigates to dashboard/home or shows a top-level menu
  - Root cause: Element is not interactive — no click handler

- [x] **#67** Footer URL not a link
  - Repro: Look at bottom status bar → `https://agency.gov/forms/s8-intake` → try to click it
  - Assert: URL renders as `<a>` with `href`, not a `<div>`
  - Root cause: URL renders as `<div>` with `cursor: auto` — not a hyperlink

### Cluster O: Missing Features — 1 gap

Test file: `tests/e2e/playwright/theme-workspace.spec.ts` (new)

- [x] **#29** Theme tabs all empty stubs
  - Repro: Theme workspace → visit every sub-tab: Tokens, Defaults, Selectors, Item Overrides, Page Layouts, Breakpoints
  - Assert: Each tab provides an add affordance (e.g. "+ Add Token"), not just "No [X] defined"
  - Root cause: All sub-tab components render empty-state message with no create action

**Subtotal: 37 E2E tests written (all RED)**

---

## Needs Unit (E2E test exists, no unit coverage)

### Cluster B: Context Menu — 2 gaps

Test file: `tests/workspaces/editor/context-menu.test.tsx` (extended)

- [x] **#9** Menu off-screen
  - Repro: Right-click an item near the right or bottom edge of the editor canvas
  - Assert: Context menu bounding box stays within the viewport
  - Root cause: `EditorCanvas.tsx` sets `left/top` from raw `clientX/Y` with no viewport clamping

- [x] **#61** Menu on empty canvas
  - Repro: Right-click on the empty canvas area below all field cards (no field under cursor)
  - Assert: No field context menu appears (or a canvas-level menu with "Add Item" appears instead)
  - Root cause: `onContextMenu` handler doesn't guard against events without a field target

### Cluster D: Import Dialog — 2 gaps

Test file: `tests/components/import-dialog.test.tsx` (extended)

- [x] **#18** Import clears undo
  - Repro: Make edits → open Import → paste valid JSON → click Load → check undo
  - Assert: Undo is still available (import itself is undoable, or a warning was shown)
  - Root cause: `project.import` handler clears undo history immediately with no warning

- [x] **#21** Escape doesn't close import
  - Repro: Click Import → press Escape
  - Assert: Dialog closes (matching command palette Escape behavior)
  - Root cause: Import dialog has no local `Escape` handler; shell only handles palette Escape

### Cluster G: Keyboard + Workspace — 1 gap

Test file: `tests/components/shell.test.tsx` (extended)

- [x] **#16** Sub-tabs reset on leave
  - Repro: Data workspace → switch to "Option Sets" → navigate to Logic → return to Data
  - Assert: "Option Sets" sub-tab is still active (not reset to default)
  - Root cause: Each workspace keeps local `useState` defaults and gets unmounted on tab switch

### Cluster K: Add Item Flow — 2 gaps

Test file: `tests/workspaces/editor/editor-canvas.test.tsx` (extended)

- [x] **#26** Not auto-selected
  - Repro: Select a field on page 1, navigate to page 6, click "+ Add Item" and confirm a field type
  - Assert: New field becomes the active selection; inspector shows its properties
  - Root cause: `AddItemPalette.onConfirm` dispatches `definition.addItem` but not `selection.select`

- [x] **#63** Auto-generated key, no rename prompt
  - Repro: Click "+ Add Item" → select "Single Choice"
  - Assert: New field is auto-selected with KEY input focused for immediate rename
  - Root cause: Field is added with auto-generated key (`select11`) but inspector is not focused on it

### Cluster M: Mapping Workspace — 1 gap

Test file: `tests/workspaces/mapping/mapping-preview.test.tsx` (extended)

- [x] **#31** Escape doesn't close picker
  - Repro: Mapping workspace → Config → click `unset` direction value → picker opens → press Escape
  - Assert: Picker closes (consistent with command palette Escape behavior)
  - Root cause: Item picker modal has no `keydown` Escape handler

### Cluster N: Shell Chrome — 2 gaps (lower priority)

Test file: `tests/components/shell.test.tsx` (extended)

- [x] **#1** Shell breaks at tablet width
  - Repro: Resize window to tablet width or desktop split view
  - Assert: Shell adapts — no horizontal overflow, main workspace remains usable
  - Root cause: Two non-shrinking sidebars (230px + 270px) + fixed header — no responsive fallback

- [x] **#8** Tiny text (9-10px)
  - Repro: Inspect blueprint headers, count badges, status bar, page metadata rows on a laptop display
  - Assert: Navigational/diagnostic text is at minimum 11px (not 9-10px)
  - Root cause: Large parts of UI use `text-[9px]` through `text-[10.5px]` in low-contrast muted colors

**Subtotal: 10 unit tests written (all RED)**

---

## Totals

| Layer | Count | Status |
|-------|-------|--------|
| Needs E2E | 37 | all tests written (RED) |
| Needs Unit | 10 | all tests written (RED) |
| **Total gaps** | **47** | **all covered** |
| Already OK (both layers) | 28 | |
| **Grand total bugs** | **75 + BUG-001** | |
