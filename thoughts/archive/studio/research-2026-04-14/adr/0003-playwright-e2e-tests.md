# ADR 0003: Playwright E2E Tests for formspec-studio

> Status: implemented (with remaining work)
> Date: 2026-03-11
> Implemented: 2026-03-11

## Implementation Status

### What Was Implemented

**59 Playwright E2E tests across 14 spec files**, all passing. The implementation also wired 5 UI features that were prerequisites (components existed but weren't connected to the Shell):

| Spec File | Tests | Status |
|-----------|-------|--------|
| `smoke.spec.ts` | 1 | ✅ Complete |
| `workspace-navigation.spec.ts` | 6 | ✅ Complete |
| `editor-authoring.spec.ts` | 6 | ✅ Complete |
| `blueprint-selection-sync.spec.ts` | 4 | ✅ Complete |
| `undo-redo.spec.ts` | 5 | ✅ Complete |
| `command-palette.spec.ts` | 3 | ✅ Complete |
| `import-definition.spec.ts` | 3 | ✅ Complete |
| `logic-authoring.spec.ts` | 3 | ✅ Complete |
| `data-workspace.spec.ts` | 3 | ✅ Complete |
| `theme-workspace.spec.ts` | 6 | ✅ Complete (Tokens, Defaults, Selectors + empty states) |
| `mapping-workspace.spec.ts` | 4 | ✅ Complete |
| `preview-workspace.spec.ts` | 4 | ✅ Complete (viewport switching, form rendering) |
| `cross-workspace-authoring.spec.ts` | 3 | ✅ Complete |
| `interaction-patterns.spec.ts` | 8 | ✅ Complete (context menu, keyboard delete, autofocus) |

**UI features wired during implementation:**

- `ItemProperties` → Shell (replacing simple PropertiesPanel with full rename/delete/duplicate)
- `AddItemPicker` → EditorCanvas (Add button with type/dataType picker flow)
- `CommandPalette` → Shell (Cmd+K opens, Escape closes, click selects item)
- `ImportDialog` → Shell + Header (Import button, JSON parse, `project.import` dispatch)
- `EditorContextMenu` → EditorCanvas (right-click context menu with duplicate/delete)

**Other fixes applied during implementation:**

- Keyboard handler: `Meta+Shift+Z` case sensitivity fix (key is `'Z'` not `'z'` when Shift held)
- Keyboard handler: added `event.preventDefault()` for undo/redo/search to prevent browser defaults
- Keyboard handler: wired Delete/Backspace to delete selected item
- StructureTree: rendered in sidebar when Structure section is active
- EditorCanvas: click-on-background deselect behavior
- `playwright.config.ts`: ESM `__dirname` polyfill via `fileURLToPath`, `localhost` instead of `127.0.0.1` (Vite binding)
- `helpers.ts`: uses `project.import` command (not `project.replaceDefinition` from the original ADR)

### What Remains — Unimplemented

#### 1. Drag and Drop (not started — requires component work)

The entire drag-and-drop section is unimplemented. No drag handles exist in the UI, the `data-testid="drag-{key}"` convention was never added, and no reorder/reparent logic is wired through the UI.

**Remaining work:**

- Add drag handle elements to `FieldBlock`, `GroupBlock`, `DisplayBlock` with `data-testid="drag-{key}"`
- Wire drag-and-drop behavior (HTML5 drag API or a library like `@dnd-kit`)
- Dispatch `definition.reorderItem` / `definition.moveItem` on drop
- Write 3 specs: reorder fields, move field into group, drag handle visibility

**Why skipped:** Drag-and-drop requires significant component work beyond test-writing. The ADR already notes these are "the most fragile (coordinate-dependent)" tests.

#### 2. Wizard Navigation in Preview (not started — requires component wiring)

The `WizardNav` component exists but is not rendered in `PreviewTab`. The preview always shows all items flat — no page-based navigation.

**Remaining work:**

- Wire `WizardNav` into `PreviewTab` when `presentation.pageMode === 'wizard'` and pages are defined
- Implement page-based item filtering (show only items on the current page)
- Write specs: step indicators, Next/Back/Submit buttons, page transitions

**Why skipped:** PreviewTab doesn't read `presentation.pageMode` or page definitions yet.

#### 3. Theme Workspace — Item Overrides, Page Layouts, Breakpoints Sub-tabs

Only Tokens, Defaults, and Selectors sub-tabs have dedicated E2E scenarios. The remaining 3 sub-tabs (Item Overrides, Page Layouts, Breakpoints) are tested only via workspace-navigation (tab renders) but have no data-seeded content verification.

**Remaining work:**

- Seed theme with `itemOverrides`, `pages`, and `breakpoints` data
- Write scenarios verifying per-item override entries, 12-column grid visualization, breakpoint name+minWidth pairs

**Why deferred:** Low risk — these sub-tabs are read-only displays covered by vitest component tests. Add E2E specs when they gain editing UI.

#### 4. Keyboard Shortcut Tab Navigation (Cmd+1 through Cmd+6)

The ADR proposed Cmd+1 through Cmd+6 for workspace switching. The `keyboard.ts` handler only supports undo/redo/delete/escape/search — no tab shortcuts exist.

**Remaining work:**

- Add Cmd+1 through Cmd+6 handling to `keyboard.ts` with a `switchTab` callback
- Wire the callback in Shell.tsx
- Add test scenarios to `workspace-navigation.spec.ts`

#### 5. Context Menu — Move Up, Move Down, Wrap in Group Actions

The context menu renders all 5 options but only Duplicate and Delete dispatch commands. Move Up, Move Down, and Wrap in Group are visual-only.

**Remaining work:**

- Wire `moveUp` → `definition.reorderItem` (index - 1)
- Wire `moveDown` → `definition.reorderItem` (index + 1)
- Wire `wrapInGroup` → create group + move item into it
- Add E2E assertions for these actions

#### 6. Focus Management (partially implemented)

The ADR listed 3 focus scenarios. Only keyboard autofocus (Cmd+K focuses search input) was tested.

**Remaining work:**

- Tab order through Properties panel inputs (key → data type → action buttons)
- Focus returns to trigger element after dialog close (AddItemPicker → Add button)
- Focus trap in Import Dialog (Tab cycles within dialog, doesn't escape to Shell)

#### 7. CI Integration

No CI configuration was added. The ADR specifies: `npx playwright install --with-deps && npm run test:e2e`.

**Remaining work:**

- Add Playwright install + run to the CI pipeline (GitHub Actions or equivalent)
- Ensure `forbidOnly` and `retries` work correctly in CI environment

### Updated Spec Coverage Matrix

| Phase | What | Spec(s) | Coverage |
|-------|------|---------|----------|
| 0 — Scaffolding | App boots | `smoke` | ✅ Full |
| 1 — React hooks | State subscription | All specs (implicit) | ✅ Wiring-level |
| 2 — Shell Chrome | Header, tabs, status, blueprint, properties | `smoke`, `workspace-navigation` | ✅ Full |
| 3 — Shared Primitives | Pill, BindCard, Section | All specs (implicit) | ✅ Visual |
| 4 — Editor | Canvas, blocks, properties, context menu, add picker | `editor-authoring`, `interaction-patterns` | ✅ Full (minus drag-drop) |
| 5 — Logic | Variables, binds, shapes, filter | `logic-authoring` | ✅ Full |
| 6 — Data | Schema, instances, option sets | `data-workspace` | ✅ Full |
| 7 — Theme | Tokens, defaults, selectors | `theme-workspace` | ⚠️ Partial (overrides, pages, breakpoints not data-tested) |
| 8 — Mapping | Rules, adapter, preview | `mapping-workspace` | ✅ Full |
| 9 — Preview | Viewport, renderer | `preview-workspace` | ⚠️ Partial (wizard not wired) |
| 10a — Structure Tree | Tree selection sync | `blueprint-selection-sync` | ✅ Full |
| 10b — Component Tree | Node display | `smoke` (sidebar visible) | Minimal |
| 10c — Screener | Fields, routes | (not yet covered) | Gap |
| 10d — Migrations | Entries, field maps | (not yet covered) | Gap |
| 10e — FEL Reference | Categories, functions | (not yet covered) | Gap |
| 10f — Settings | Metadata, presentation | (not yet covered) | Gap |
| 10g — Sidebar panels | Variables, data sources, option sets, mappings, theme | `blueprint-selection-sync` (sidebar visible) | Minimal |
| 11 — Command Palette | Search, navigate | `command-palette` | ✅ Full |
| 11 — Import Dialog | Import, validate | `import-definition` | ✅ Full |
| 11 — Keyboard | Shortcuts | `undo-redo`, `interaction-patterns` | ⚠️ Partial (no tab shortcuts, no focus management) |
| 12 — Cross-workspace | Wiring across tabs | `cross-workspace-authoring` | ✅ Full |
| — — Drag and Drop | Reorder, reparent | (not implemented) | ❌ Gap |
| — — CI | Pipeline integration | (not implemented) | ❌ Gap |

## Context

The files in `tests/e2e/` (editor-workflow, logic-workflow, data-workflow, undo-redo, import-export) are **integration tests**, not end-to-end tests. They use Vitest + React Testing Library + happy-dom to render components in a synthetic DOM and assert on state changes via `project.dispatch()`. They never:

- Open a real browser
- Click actual buttons the user would click
- Navigate between workspace tabs
- Exercise the Shell → Header → workspace routing
- Test keyboard shortcuts in a real event loop
- Validate CSS-driven visibility (Tailwind classes, `display: none`, overflow)
- Test focus management, scroll behavior, or drag-and-drop

True E2E tests exercise the deployed application through the same surface a user touches. For formspec-studio, that means Playwright against the Vite dev server.

## Decision

Add a Playwright test suite under `tests/e2e/playwright/` that tests full authoring workflows through the browser. These tests start the Vite dev server, navigate to the app, and interact exclusively through clicks, keyboard input, and DOM assertions.

### Playwright Configuration

Create `playwright.config.ts` at the package root (not the monorepo root — the existing root config tests the webcomponent harness on port 8080, not the studio):

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e/playwright',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
    cwd: __dirname,
  },
});
```

Add to `package.json`:

```json
"test:e2e": "playwright test --config playwright.config.ts"
```

### What Needs to Be True First

The current Shell renders workspace content as a placeholder `<div>{activeTab}</div>`. The App.tsx renders `<h1>The Stack</h1>` without any providers. Before Playwright tests can exercise real workflows, the app must be wired end-to-end:

1. **`App.tsx`** must create a `Project`, wrap in `ProjectProvider` + `SelectionProvider`, and render `Shell`.
2. **`Shell.tsx`** must route `activeTab` to actual workspace components (`EditorCanvas`, `LogicTab`, `DataTab`, `ThemeTab`, `MappingTab`, `PreviewTab`).
3. **Blueprint sidebar** must render the actual section components.
4. **Properties panel** must render `ItemProperties` when an item is selected.

This wiring is a prerequisite — without it, Playwright sees placeholder text, not interactive components.

### Test Plan

Eleven spec files covering every workspace, cross-workspace flows, and interaction patterns:

---

#### 1. `smoke.spec.ts` — App Bootstrap

Validates the app loads and the shell chrome is present.

```
- navigates to /
- sees "The Stack" or app title in the header
- sees 6 workspace tabs (Editor, Logic, Data, Theme, Mapping, Preview)
- default tab is Editor
- StatusBar is visible at the bottom
- Blueprint sidebar is visible on the left
```

---

#### 2. `workspace-navigation.spec.ts` — Tab Switching

Validates tab switching and that each workspace renders its characteristic UI.

```
- click Logic tab → LogicTab renders (look for "Variables" or "Binds" section heading)
- click Data tab → DataTab renders (look for "Response Schema" or "Data Sources")
- click Theme tab → ThemeTab renders (look for "Tokens" section)
- click Mapping tab → MappingTab renders (look for "Rules" or "Config")
- click Preview tab → PreviewTab renders (look for viewport switcher)
- click Editor tab → back to EditorCanvas
- keyboard shortcut navigation (if wired): Cmd+1 through Cmd+6
```

---

#### 3. `editor-authoring.spec.ts` — Editor Workspace

Full field authoring cycle through the Editor workspace.

```
Scenario: Add a field via AddItemPicker
- click the "Add" button (or "+" in the canvas)
- select "Field" from the picker
- select "String" as data type
- verify a new field block appears in the canvas
- verify StatusBar updates field count from "0 fields" to "1 field"

Scenario: Select a field → Properties panel populates
- click on the field block in the canvas
- Properties panel shows the field's key in an input
- Properties panel shows the data type

Scenario: Rename a field via Properties
- click on the field block
- clear the key input, type "firstName"
- blur the input
- verify the canvas block now shows "firstName"

Scenario: Duplicate a field
- click on the field block
- click "Duplicate" in Properties
- verify two blocks now exist in the canvas
- verify StatusBar shows "2 fields"

Scenario: Delete a field
- click on a field block
- click "Delete" in Properties
- verify the block is removed from the canvas

Scenario: Add a group with children
- add a Group via the picker
- add a Field inside the group (click group first, then add)
- verify nested indentation in the canvas
```

---

#### 4. `logic-authoring.spec.ts` — Logic Workspace

Logic workspace interactions.

```
Prerequisite: seed the project with 2-3 fields + binds + shapes + variables

Scenario: View binds
- click Logic tab
- verify fields with binds appear in the Binds section
- verify bind type pills (required, relevant, calculate, constraint, readonly)

Scenario: View shapes
- verify shape card appears with severity badge and constraint expression

Scenario: View variables
- verify @variableName appears with its expression

Scenario: Filter bar
- verify filter bar shows counts (e.g., "3 binds", "1 shape", "2 variables")
```

---

#### 5. `data-workspace.spec.ts` — Data Workspace

Data workspace read/browse flows.

```
Prerequisite: seed with fields, instances, option sets

Scenario: Response schema table
- click Data tab
- verify field names appear as rows in the schema table
- verify data types are shown for each field
- verify groups show nested children with indentation

Scenario: Data sources
- navigate to Data Sources sub-tab
- verify instance cards render with names
- verify source URL is visible when present
- verify empty state message when no instances

Scenario: Option sets
- navigate to Option Sets sub-tab
- verify option set names are listed
- verify option values/labels appear on expand
- verify "used by" count reflects fields referencing the set
```

---

#### 6. `theme-workspace.spec.ts` — Theme Workspace

Theme workspace view and edit flows.

```
Prerequisite: seed with theme tokens, defaults, selectors, item overrides, pages

Scenario: Token editor
- click Theme tab
- verify token key-value pairs render (e.g., "primaryColor" → "#3b82f6")
- verify empty state when no tokens

Scenario: Defaults editor
- navigate to Defaults sub-tab
- verify current defaults display (labelPosition, density, pageMode)

Scenario: Selector list
- navigate to Selectors sub-tab
- verify selector cards show match criteria (type + dataType)
- verify selector cards show applied properties (widget, etc.)

Scenario: Item overrides
- navigate to Item Overrides sub-tab
- verify per-item override entries are listed by item name
- verify override properties are visible

Scenario: Page layouts
- navigate to Page Layouts sub-tab
- verify 12-column grid visualization renders for each page
- verify region span indicators are visible
- verify empty state when no pages

Scenario: Breakpoint editor
- navigate to Breakpoints sub-tab
- verify breakpoint name + minWidth pairs render
```

---

#### 7. `mapping-workspace.spec.ts` — Mapping Workspace

Mapping workspace view and edit flows.

```
Prerequisite: seed with mapping rules and adapter config

Scenario: Mapping config
- click Mapping tab
- verify direction indicator (outbound/inbound/bidirectional) is visible
- verify definition ref is shown

Scenario: Rule editor
- navigate to Rules sub-tab
- verify rule cards render with source → target
- verify transform type badges (preserve, coerce, expression)
- verify inner rules render with indentation for nested mappings

Scenario: Adapter config
- navigate to Adapter sub-tab
- verify adapter format is shown (JSON/XML/CSV)
- verify adapter options are listed

Scenario: Mapping preview
- navigate to Preview sub-tab
- verify split-pane layout shows Input and Output panels
- verify direction indicator matches mapping config
```

---

#### 8. `preview-workspace.spec.ts` — Preview Workspace

Form preview and wizard flows.

```
Prerequisite: seed with 3+ fields across 2 groups, one bind (required)

Scenario: Form preview renders
- click Preview tab
- verify form fields render as input elements
- verify group labels appear as section headings
- verify display items render as read-only text

Scenario: Viewport switcher
- click "Tablet" viewport option
- verify preview container width changes
- click "Mobile" viewport option
- verify preview container narrows further
- click "Desktop" to restore

Scenario: Wizard navigation (when pageMode = wizard)
- seed a definition with presentation.pageMode = "wizard" and 2+ pages
- verify step indicators are visible
- verify "Next" button advances to next page
- verify "Back" button returns to previous page
- verify "Submit" button appears on the final page
- verify step indicator highlights the current step
```

---

#### 9. `undo-redo.spec.ts` — History

Undo/redo through the Header buttons and keyboard.

```
Scenario: Undo button
- add a field via the Editor
- verify field exists
- click "Undo" button in Header
- verify field is gone
- verify "Undo" button is now disabled (no more history)

Scenario: Redo button
- (continuing from above)
- click "Redo" button
- verify field reappears

Scenario: Keyboard shortcuts
- add a field
- press Cmd+Z
- verify field is gone
- press Cmd+Shift+Z
- verify field reappears

Scenario: Multiple undo
- add field A, add field B, add field C
- Cmd+Z → C gone
- Cmd+Z → B gone
- Cmd+Z → A gone
- Cmd+Shift+Z → A back
```

---

#### 10. `command-palette.spec.ts` — Search & Navigate

Command palette search and navigation.

```
Scenario: Open and close
- press Cmd+K
- verify search input is visible and focused
- press Escape
- verify palette is closed

Scenario: Search fields
- seed project with fields: firstName, lastName, age
- press Cmd+K
- type "first"
- verify "firstName" appears in results
- verify "lastName" and "age" are filtered out (or deprioritized)

Scenario: Select result
- press Cmd+K
- type a field name
- click the result
- verify palette closes
- verify the item is selected in the Editor
```

---

#### 11. `import-definition.spec.ts` — Import & Verify Across Workspaces

Import a JSON definition and verify it renders correctly in every workspace.

```
Scenario: Import via dialog
- open Import dialog (button in Header or Cmd+I)
- select "Definition" artifact type
- paste a complete definition JSON into the textarea:
  {
    "$formspec": "1.0",
    "url": "urn:formspec:e2e-test",
    "version": "1.0.0",
    "title": "E2E Test Form",
    "items": [
      { "key": "name", "type": "field", "dataType": "string", "label": "Full Name" },
      { "key": "age", "type": "field", "dataType": "integer", "label": "Age" },
      { "key": "notes", "type": "display", "label": "Please review carefully" }
    ],
    "binds": { "name": { "required": "true" } },
    "shapes": [{ "name": "ageValid", "severity": "error", "constraint": "$age >= 0" }]
  }
- click Import/Confirm
- verify Editor shows 3 blocks (name, age, notes)
- click Logic tab → verify 1 bind and 1 shape
- click Data tab → verify 2 fields in response schema
- StatusBar shows "2 fields", "1 bind", "1 shape"
```

---

### Cross-Workspace Flows

These scenarios span multiple workspace tabs and panels. They validate wiring that no single-workspace test or integration test can reach. They can live in their own spec files or as scenarios within the workspace specs above — the key is that they exist.

---

#### `cross-workspace-authoring.spec.ts`

End-to-end authoring cycle that touches every workspace.

```
Scenario: Editor → Logic round-trip
- in Editor, add a field "income" (dataType: money)
- switch to Logic tab
- seed a required bind on "income" via __testProject__
- switch back to Editor
- verify the "income" block now shows a "Required" pill

Scenario: Editor → Data → Preview round-trip
- in Editor, add 3 fields: firstName (string), lastName (string), dob (date)
- switch to Data tab
- verify all 3 fields appear in the response schema
- switch to Preview tab
- verify 3 form inputs render

Scenario: Full authoring cycle
- create 3 fields and 1 group in Editor
- add required binds in Logic (via seed or future UI)
- add a shape in Logic
- switch to Data, verify response schema matches
- switch to Theme, seed some tokens, verify they render
- switch to Mapping, seed a rule, verify the card renders
- switch to Preview, verify the form renders with all fields
- undo the last action, verify the change reverts
- redo, verify it restores
```

---

#### `blueprint-selection-sync.spec.ts`

Selection propagation across the Blueprint sidebar, Editor canvas, and Properties panel.

```
Prerequisite: seed with 4-5 fields and a group

Scenario: Structure Tree → Editor → Properties
- click a field name in the Blueprint Structure Tree
- verify the field block highlights in the Editor canvas
- verify Properties panel populates with that field's key, dataType, binds

Scenario: Editor canvas → Structure Tree highlight
- click a field block in the Editor canvas
- verify the corresponding item in the Structure Tree is highlighted/selected

Scenario: Selection persists across tab switches
- select a field in the Editor
- switch to Logic tab
- switch back to Editor
- verify the same field is still selected
- verify Properties panel still shows that field

Scenario: Deselect
- click an empty area of the Editor canvas (not on any block)
- verify Properties panel shows "Select an item to inspect"
- verify no Structure Tree item is highlighted
```

---

### Interaction Patterns

These test browser-native interactions that happy-dom cannot simulate. They can be woven into the specs above or grouped into a dedicated `interaction-patterns.spec.ts`.

---

#### Context Menu

```
Scenario: Right-click opens context menu
- right-click on a field block in the Editor canvas
- verify menu appears near the click position (not off-screen)
- verify menu contains: Duplicate, Delete, Move Up, Move Down, Wrap in Group

Scenario: Context menu action → effect
- right-click on a field block
- click "Duplicate"
- verify a second copy of the field appears
- verify the context menu is dismissed

Scenario: Context menu dismissal
- right-click on a field block → menu appears
- click anywhere outside the menu
- verify menu is dismissed
- press Escape → verify menu is dismissed
```

---

#### Drag and Drop

```
Scenario: Reorder fields via drag
- seed 3 fields: A, B, C (in that order)
- drag field C's handle above field A
- verify order is now C, A, B
- verify the definition items array reflects the new order

Scenario: Move field into group via drag
- seed 2 fields and 1 empty group
- drag a field onto the group block
- verify the field is now a child of the group (indented)

Scenario: Drag handle visibility
- hover over a field block
- verify a drag handle (grip icon) becomes visible
- move mouse away
- verify drag handle disappears (or dims)
```

---

#### Keyboard Shortcuts

```
Scenario: Delete via keyboard
- select a field block by clicking it
- press Delete (or Backspace)
- verify the field is removed from the canvas
- verify selection clears (Properties shows empty state)

Scenario: Escape closes overlays
- open Command Palette (Cmd+K) → press Escape → palette closes
- open Import Dialog → press Escape → dialog closes
- open a context menu (right-click) → press Escape → menu closes

Scenario: Cmd+K autofocuses search
- press Cmd+K
- immediately start typing (no click needed)
- verify characters appear in the search input
- verify results filter as you type
```

---

#### Focus Management

```
Scenario: Tab order through Properties panel
- select a field in the Editor
- Properties panel populates
- press Tab
- verify focus moves through Properties panel inputs in logical order
  (key input → data type → bind fields → action buttons)

Scenario: Focus returns after dialog close
- click "Add" button to open AddItemPicker
- press Escape to close
- verify focus returns to the "Add" button (or the last focused element)

Scenario: Focus trap in modal dialogs
- open Import Dialog
- press Tab repeatedly
- verify focus cycles within the dialog (does not escape to Shell behind it)
- press Escape to close
```

---

### Test Helpers

Create `tests/e2e/playwright/helpers.ts` with reusable utilities:

```ts
import { Page } from '@playwright/test';

/** Wait for the app to be fully loaded (Shell visible). */
export async function waitForApp(page: Page) {
  await page.goto('/');
  await page.waitForSelector('[data-testid="shell"]', { timeout: 10000 });
}

/** Switch to a workspace tab by clicking its label. */
export async function switchTab(page: Page, tabName: string) {
  await page.click(`[data-testid="tab-${tabName}"]`);
  await page.waitForSelector(`[data-testid="workspace-${tabName}"]`);
}

/** Dispatch a command by evaluating in the page context.
 *  Requires the Project to be exposed on window for test access. */
export async function dispatch(page: Page, command: { type: string; payload: unknown }) {
  await page.evaluate((cmd) => {
    (window as any).__testProject__.dispatch(cmd);
  }, command);
}

/** Seed the project with a definition before the test starts. */
export async function seedDefinition(page: Page, definition: unknown) {
  await page.evaluate((def) => {
    (window as any).__testProject__.dispatch({
      type: 'project.replaceDefinition',
      payload: def,
    });
  }, definition);
}

/** Seed a complete project state (definition + theme + mapping + component). */
export async function seedProject(page: Page, state: Record<string, unknown>) {
  await page.evaluate((s) => {
    const project = (window as any).__testProject__;
    if (s.definition) project.dispatch({ type: 'project.replaceDefinition', payload: s.definition });
    if (s.theme) project.dispatch({ type: 'project.replaceTheme', payload: s.theme });
    if (s.mapping) project.dispatch({ type: 'project.replaceMapping', payload: s.mapping });
    if (s.component) project.dispatch({ type: 'project.replaceComponent', payload: s.component });
  }, state);
}

/** Click a field block in the editor canvas. */
export async function selectField(page: Page, key: string) {
  await page.click(`[data-testid="field-${key}"]`);
}

/** Click a group block in the editor canvas. */
export async function selectGroup(page: Page, key: string) {
  await page.click(`[data-testid="group-${key}"]`);
}

/** Open the command palette and search. */
export async function openPaletteAndSearch(page: Page, query: string) {
  await page.keyboard.press('Meta+k');
  await page.waitForSelector('[data-testid="command-palette"]');
  await page.fill('[data-testid="command-palette"] input', query);
}
```

**Important:** For `dispatch()` and `seedDefinition()` to work, `App.tsx` or `main.tsx` must expose the project instance on `window` in dev mode:

```ts
// In main.tsx or App.tsx, after creating the project:
if (import.meta.env.DEV) {
  (window as any).__testProject__ = project;
}
```

This is a common pattern — Cypress, Playwright, and other E2E frameworks use it. The `import.meta.env.DEV` guard ensures it's stripped from production builds.

### Data-testid Conventions

Components should emit `data-testid` attributes for stable Playwright selectors. Proposed conventions:

| Element | `data-testid` |
|---------|--------------|
| Shell root | `shell` |
| Header | `header` |
| Workspace tab button | `tab-{name}` (e.g., `tab-Editor`) |
| Workspace content area | `workspace-{name}` |
| StatusBar | `status-bar` |
| Blueprint sidebar | `blueprint` |
| Blueprint section | `blueprint-{section}` (e.g., `blueprint-structure`) |
| Structure tree item | `tree-item-{key}` |
| Properties panel | `properties` |
| Field block | `field-{key}` |
| Group block | `group-{key}` |
| Display block | `display-{key}` |
| Block drag handle | `drag-{key}` |
| Add item button | `add-item` |
| Undo button | `undo-btn` |
| Redo button | `redo-btn` |
| Command palette overlay | `command-palette` |
| Import dialog | `import-dialog` |
| Context menu | `context-menu` |
| Context menu item | `ctx-{action}` (e.g., `ctx-duplicate`) |

### What NOT to Test in E2E

- FEL parsing correctness (covered by engine unit tests)
- Command handler logic (covered by studio-core tests)
- Hook subscription mechanics (covered by Vitest integration tests)
- CSS token values (covered by visual regression if needed later)
- Exact pixel positions or animation timing

E2E tests validate that the pieces are wired together and that a user can accomplish real workflows. They should not duplicate what unit and integration tests already cover.

## Spec Coverage Matrix

Cross-reference of implemented phases against E2E spec coverage:

| Phase | What | Spec(s) | Coverage |
|-------|------|---------|----------|
| 0 — Scaffolding | App boots | `smoke` | Full |
| 1 — React hooks | State subscription | All specs (implicit) | Wiring-level |
| 2 — Shell Chrome | Header, tabs, status, blueprint, properties | `smoke`, `workspace-navigation` | Full |
| 3 — Shared Primitives | Pill, BindCard, Section | All specs (implicit) | Visual |
| 4 — Editor | Canvas, blocks, properties, context menu, add picker | `editor-authoring`, `interaction-patterns` | Full |
| 5 — Logic | Variables, binds, shapes, filter | `logic-authoring` | Full |
| 6 — Data | Schema, instances, option sets | `data-workspace` | Full |
| 7 — Theme | Tokens, defaults, selectors, overrides, pages, breakpoints | `theme-workspace` | Full |
| 8 — Mapping | Rules, adapter, preview | `mapping-workspace` | Full |
| 9 — Preview | Viewport, renderer, wizard | `preview-workspace` | Full |
| 10a — Structure Tree | Tree selection sync | `blueprint-selection-sync` | Full |
| 10b — Component Tree | Node display | `smoke` (sidebar visible) | Minimal |
| 10c — Screener | Fields, routes | (not yet covered) | Gap |
| 10d — Migrations | Entries, field maps | (not yet covered) | Gap |
| 10e — FEL Reference | Categories, functions | (not yet covered) | Gap |
| 10f — Settings | Metadata, presentation | (not yet covered) | Gap |
| 10g — Sidebar panels | Variables, data sources, option sets, mappings, theme | `blueprint-selection-sync` (sidebar visible) | Minimal |
| 11 — Command Palette | Search, navigate | `command-palette` | Full |
| 11 — Import Dialog | Import, validate | `import-definition` | Full |
| 11 — Keyboard | Shortcuts | `undo-redo`, `interaction-patterns` | Full |
| 12 — Cross-workspace | Wiring across tabs | `cross-workspace-authoring` | Full |

**Acknowledged gaps:** Screener (10c), Migrations (10d), FEL Reference (10e), and Settings (10f) don't have dedicated E2E specs. These are read-heavy sidebar panels with no cross-workspace flows — the integration tests in `tests/components/blueprint/` cover their rendering. E2E specs can be added when these panels gain interactive editing (CRUD dispatches through the UI rather than just display).

## Implementation Order

1. **Wire up App.tsx** — create Project, add providers, render Shell with real workspace routing
2. **Add data-testid attributes** to Shell, Header, workspace components, Blueprint sections
3. **Expose `__testProject__` in dev mode** for test seeding
4. **Rename `tests/e2e/` → `tests/integration/`** to resolve naming confusion
5. **Add `playwright.config.ts`** and `test:e2e` script
6. **Write specs in this order:**
   - `smoke.spec.ts` — validates the entire wiring works
   - `workspace-navigation.spec.ts` — validates tab routing
   - `editor-authoring.spec.ts` — first interactive workflow
   - `blueprint-selection-sync.spec.ts` — cross-panel wiring
   - `undo-redo.spec.ts` — history through real UI
   - `command-palette.spec.ts` — keyboard-driven overlay
   - `import-definition.spec.ts` — import + cross-workspace verification
   - `logic-authoring.spec.ts`, `data-workspace.spec.ts`, `theme-workspace.spec.ts`, `mapping-workspace.spec.ts`, `preview-workspace.spec.ts` — remaining workspaces
   - `cross-workspace-authoring.spec.ts` — full authoring cycle
   - `interaction-patterns.spec.ts` — context menu, drag-drop, keyboard, focus
7. **Run in CI** with `npx playwright install --with-deps && npm run test:e2e`

## Consequences

- Adds `@playwright/test` as a devDependency
- Requires the app to be fully wired (App → providers → Shell → workspaces) before tests can pass
- Tests run slower than Vitest (~2-5s per spec vs ~50ms) but catch wiring bugs that integration tests miss
- The `__testProject__` escape hatch is dev-only and enables seeding without building a full import UI first
- Drag-and-drop tests are the most fragile (coordinate-dependent) — keep assertions on order, not position

## Relationship to Existing Tests

| Layer | Tool | Location | What it covers |
|-------|------|----------|----------------|
| Unit | Vitest | `tests/lib/`, `tests/state/` | Pure functions, hooks in isolation |
| Integration | Vitest + RTL | `tests/components/`, `tests/workspaces/`, `tests/integration/` | Component trees in happy-dom |
| **E2E** | **Playwright** | **`tests/e2e/playwright/`** | **Full browser workflows** |

The integration tests currently in `tests/e2e/` should be renamed to `tests/integration/` to avoid confusion. They are valuable tests — they just aren't E2E.
