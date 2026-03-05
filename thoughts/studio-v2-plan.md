# Plan: Formspec Studio v2 — Full Implementation

## Context

The previous form-builder (`feat/unified-component-tree-editor`) was a learning exercise that has been deleted. We're building Formspec Studio v2 from scratch based on `thoughts/PRD-v2.md`. This plan covers the **complete PRD** — all three phases.

The existing monorepo has three packages we'll consume:
- `formspec-engine` — reactive form state, FEL compiler, validation
- `formspec-layout` — theme cascade resolution (exists but minimal)
- `formspec-webcomponent` — `<formspec-render>` custom element for preview

**Stack:** Preact + Preact Signals, TypeScript (strict), Vite, Vanilla CSS.

---

## Step 0: Project Scaffolding

Create `form-builder/` as a new Vite + Preact + TypeScript app (workspace member).

- `form-builder/package.json` — deps: `preact`, `@preact/signals`, `formspec-engine`, `formspec-layout`, `formspec-webcomponent`, `ajv`
- `form-builder/vite.config.ts` — Preact JSX, dev server
- `form-builder/tsconfig.json` — strict, Preact JSX
- `form-builder/index.html` — entry point
- `form-builder/src/main.tsx` — mount root component
- `form-builder/src/styles/` — vanilla CSS

Add `"form-builder"` to root `package.json` workspaces. Add `start:studio` script (already exists in root package.json).

**Verify:** `npm run dev --workspace=form-builder` opens a blank Preact app.

---

## Step 1: State Layer — The Project Signal

A single Preact signal holding the unified project state. All UI reads from / writes to this.

### 1a: Project Model

```
form-builder/src/state/
  project.ts      — project signal, types, initialization
  mutations.ts    — focused mutation functions (addItem, deleteItem, renameItem, moveItem, etc.)
  derived.ts      — computed signals (diagnostics counts, field list for pickers, etc.)
  wiring.ts       — automatic artifact coordination (§7.4: bind path derivation, FEL path rewriting on rename/move)
```

The project signal contains:
- `definition` — the Formspec Definition JSON (matches `definition.schema.json`)
- `component` — the Component Document JSON (matches `component.schema.json`)
- `theme` — the Theme Document JSON (matches `theme.schema.json`)
- `selection` — currently selected item path (or null for form-level)
- `uiState` — inspector open sections, view mode, etc.

Key mutations (§7.4):
- **addItem(type, position)** → creates definition item + component node atomically. No bind.
- **deleteItem(path)** → removes item, component node, bind (if any), shape refs
- **renameItem(path, newKey)** → rewrites key in definition, component bind, all FEL $path references
- **moveItem(from, to)** → reorders in definition items + component tree, rewrites bind paths
- **setBind(path, property, value)** → creates bind on-demand, garbage-collects empty binds
- **setPresentation(path, block)** → writes to theme items or definition presentation

### 1b: FormEngine Integration

A live `FormEngine` instance rebuilt on definition changes. Runs headless for real-time diagnostics and preview data.

### 1c: Structural Validation

Ajv validation of all three documents against their schemas on every state change. Results feed the diagnostics signal.

**Verify:** Unit tests — create project, add items, rename, move, verify definition + component JSON are structurally valid.

---

## Step 2: Shell Layout

The main app layout with three zones:

```
┌─────────┬──────────────────────────┬──────────────┐
│ Structure│      Form Surface       │  Inspector   │
│  (tree)  │                          │   (right)    │
│          │                          │              │
│ optional │                          │  on-select   │
├─────────┴──────────────────────────┴──────────────┤
│                 Diagnostics Bar                    │
└───────────────────────────────────────────────────┘
```

- **Left panel** (Structure tree): collapsible, hidden by default for simple forms
- **Center** (Form Surface): the document-first editing area — always visible
- **Right panel** (Inspector): appears when an item is selected, hidden otherwise
- **Bottom bar** (Diagnostics): error/warning/info counts, expandable

Top toolbar: form title (editable), view toggles (structure, preview), breakpoint slider (Phase 2).

```
form-builder/src/components/
  Shell.tsx           — main layout
  Toolbar.tsx         — top bar
  DiagnosticsBar.tsx  — bottom bar
```

**Verify:** Layout renders, panels toggle, responsive.

---

## Step 3: Form Surface — Document-First Editing

This is the core of Phase 1 — the center panel that renders the form as an editable document.

### 3a: Item Renderer

Each definition item renders as an editable block on the form surface. The surface walks `definition.items` recursively:

```
form-builder/src/components/surface/
  FormSurface.tsx      — scrollable item list, handles selection
  ItemBlock.tsx        — single item: renders by type (field/group/display)
  FieldBlock.tsx       — field item: label, input preview, logic badges
  GroupBlock.tsx       — group item: section header, children, collapse, repeat
  DisplayBlock.tsx     — display item: heading, instructions, divider
  AddBetween.tsx       — hover-to-reveal + button between items
  DragHandle.tsx       — hover-to-reveal drag handle
```

Each block has:
- **Click** → selects the item, opens inspector
- **Inline label editing** → click label to edit in-place, blur saves
- **Inline description editing** → same pattern
- **Logic badges** — small icons (● ? = ! 🔒) when bind properties are set
- **Hover affordances** — drag handle, delete button, add-between button

### 3b: Inline Option Editing

For choice/multiChoice fields, clicking the options area on the surface opens an inline editor:
- Type to add option, Enter for next
- Drag to reorder
- X to delete

### 3c: Selection State

Clicking an item sets `selection` in the project signal. The inspector reacts. Clicking empty space deselects (shows form-level inspector). Selection is visually indicated with a highlight border.

**Verify:** Render a test definition, click items, see selection highlight, edit labels inline.

---

## Step 4: Slash Commands

The field insertion system — type `/` to open a filterable picker.

```
form-builder/src/components/surface/
  SlashCommandMenu.tsx  — floating menu, search, keyboard nav
  field-templates.ts    — maps user-facing names to item+component creation params
```

The menu appears:
- When clicking the "+ Add field" placeholder on empty forms
- When clicking the add-between button
- When typing "/" in the form surface (keyboard trigger)

Each template entry defines:
- User-facing name and category (Common / Structure / Display / Advanced)
- `dataType`, default `key` prefix, default label
- Component type to create

On select: calls `addItem()` mutation, field appears at position, label focused for immediate typing.

**Verify:** Open menu, search filters, arrow+enter inserts, label is focused.

---

## Step 5: Inspector Panel

The right panel that adapts to the current selection.

```
form-builder/src/components/inspector/
  Inspector.tsx            — router: dispatches to correct panel based on selection
  FieldInspector.tsx       — field properties (basics, logic, validation, appearance, advanced)
  GroupInspector.tsx        — group properties (title, collapse, repeat settings)
  DisplayInspector.tsx     — display properties (content, style)
  FormInspector.tsx        — form-level settings (metadata, formPresentation, variables, shapes)

  sections/
    BasicsSection.tsx      — label, hint, key, required toggle, placeholder
    LogicSection.tsx        — show when, required when, calculate, readonly when
    ValidationSection.tsx  — constraint + message
    AppearanceSection.tsx  — widget override, cssClass
    AdvancedSection.tsx    — bind fine-tuning (default, nonRelevantBehavior, whitespace, etc.)
    RepeatSection.tsx      — min/max instances, display mode
```

Each section is a collapsible group. When collapsed, shows a summary pill if content exists (e.g., "▸ LOGIC — ? Show when").

### Inspector Controls

Standard control components used across sections:

```
form-builder/src/components/controls/
  Toggle.tsx             — on/off switch
  TextInput.tsx          — label + text input
  NumberInput.tsx        — label + number input
  Dropdown.tsx           — label + select
  Collapsible.tsx        — expandable section with summary
  FELEditor.tsx          — expression editor with $path autocomplete, live validation
```

**Verify:** Select field, inspector shows correct sections, edit properties, definition JSON updates.

---

## Step 6: Visual Logic Builders

The visual condition builders for show-when, required-when, calculate, and constraint — with toggle to raw FEL.

```
form-builder/src/components/logic/
  ConditionBuilder.tsx   — visual: [field] [operator] [value], AND/OR rows
  FormulaBuilder.tsx     — visual: [function] of [field] in [group], templates
  ConstraintBuilder.tsx  — visual: "This value [must be] [at least 0]"
  ExpressionToggle.tsx   — visual ↔ FEL toggle wrapper
```

### ConditionBuilder (for relevant, required, readonly)

Visual mode: rows of `[field dropdown] [operator dropdown] [value input]` with AND/OR connectors.
- Field dropdown lists all fields by label, grouped by section
- Operators adapt to field type (text: equals/contains/starts with/is empty; number: =/>/</between; boolean: is true/is false)
- Generates FEL: `$budgetType = 'detailed' and $amount > 0`

### FormulaBuilder (for calculate)

Template buttons: Sum, Count, Average, Custom
- Sum: `sum($group[*].field)` — pick group and field
- Count: `count($group[*])` — pick group
- Custom: opens FEL editor

### ConstraintBuilder (for field constraint)

Visual: "This value [must be ▼] [at least 0]"
- Operators: at least, at most, between, one of, matching pattern, not empty, before date, after date
- Generates FEL using bare `$`: `$ > 0`, `matches($, '^[0-9]{2}-[0-9]{7}$')`
- Error message text input below

### Expression Toggle

Wraps any builder. Toggle to FEL: shows raw expression editor. Toggle back: parses FEL if it matches a supported visual pattern, otherwise shows "too complex for visual builder."

**Verify:** Build a condition visually, toggle to FEL, see correct expression. Edit FEL, toggle back, visual reconstructs (for simple cases).

---

## Step 7: Brand Panel

Form-level style settings, accessible when nothing is selected or from the toolbar.

```
form-builder/src/components/brand/
  BrandPanel.tsx        — colors, fonts, layout
  TokenEditor.tsx       — design token key-value editor (collapsed by default)
  ColorPicker.tsx       — color swatch + hex input
```

**Brand section:**
- Primary/Secondary/Error colors → write to theme tokens (`color.primary`, etc.)
- Font family → theme token (`typography.body.family`)

**Layout section:**
- Page mode → `definition.formPresentation.pageMode` (single/wizard/tabs)
- Labels → `definition.formPresentation.labelPosition` (top/start/hidden)
- Density → `definition.formPresentation.density` (compact/comfortable/spacious)
- Currency → `definition.formPresentation.defaultCurrency`

**Design Tokens (collapsed):**
- Full token vocabulary editor for power users

**Verify:** Change primary color, see token in theme JSON. Change page mode, see definition update.

---

## Step 8: Logic Badges

Small visual indicators on the form surface showing what logic a field has.

Badges render on `FieldBlock.tsx`:
- `●` — required (bind has `required`)
- `?` — conditional visibility (bind has `relevant`)
- `=` — calculated (bind has `calculate`)
- `!` — has constraint (bind has `constraint`)
- `🔒` — readonly (bind has `readonly`)

Clicking a badge opens the corresponding inspector section.

**Verify:** Add a required toggle, badge appears. Add show-when, badge appears. Click badge, inspector opens to that section.

---

## Step 9: Command Palette

`Cmd+K` opens a fuzzy-search overlay.

```
form-builder/src/components/
  CommandPalette.tsx    — modal overlay with search input, result list, keyboard nav
  commands.ts          — command registry (actions, navigation, settings)
```

Commands:
- **Navigation:** Go to field (by label/key), Go to page
- **Actions:** Add field, Toggle preview, Toggle structure, Form rules, Form settings
- **Advanced:** Open JSON editor, Validate, Export

Fuzzy search across field labels, keys, page titles, and command names.

**Verify:** Cmd+K opens palette, type to filter, Enter executes, Escape closes.

---

## Step 10: Preview

Live preview of the form using `<formspec-render>` in an isolated iframe.

```
form-builder/src/components/preview/
  PreviewPane.tsx       — iframe wrapper, artifact injection
  PreviewToggle.tsx     — split-pane or full-screen toggle
```

On every state change, serialize definition + component + theme → post to iframe. The iframe loads formspec-webcomponent and renders the form. Full interactivity: fill fields, trigger validation, navigate wizard pages.

**Verify:** Edit definition in the studio, preview updates in real-time. Fill out fields in preview, validation works.

---

## Step 11: Structure Tree

Collapsible left panel showing the item hierarchy.

```
form-builder/src/components/tree/
  StructurePanel.tsx    — tree view with collapse/expand
  TreeNode.tsx          — single node: icon, label, badges, indent
```

- Icons by type (field type icon, group icon, display icon)
- Logic badges inline
- Click to select (scrolls form surface, opens inspector)
- Drag to reorder (calls moveItem mutation)

Hidden by default for simple forms. Toggled via toolbar button or `Cmd+\`.

**Verify:** Tree reflects item structure, click navigates, drag reorders.

---

## Step 12: Diagnostics

Bottom bar showing validation status.

- Counts: `2 errors · 1 warning · 0 info`
- Expandable panel with clickable results (navigate to source field)
- Two layers: structural (Ajv) + logical (FormEngine)

**Verify:** Create invalid state (e.g., bad FEL expression), diagnostics show error, click navigates.

---

---

# Phase 2: The Power User Toolkit

## Step 13: Full FEL Expression Editor

Enhanced `FELEditor.tsx` with:
- `$path` autocomplete (type `$` → dropdown of all field paths by label/key)
- Function signature tooltips on hover
- Live validation (parse FEL, show errors inline)
- Syntax highlighting (paths, functions, operators, literals)

## Step 14: Form Rules (Shapes) Builder

Guided shape builder accessible from form-level inspector or toolbar "Form Rules" button.

```
form-builder/src/components/shapes/
  ShapeList.tsx          — list of all shapes with severity icons, + Add
  ShapeEditor.tsx        — full shape editor (name, target, severity, condition, composition, message)
  CompositionBuilder.tsx — combine rules: ALL/ANY/EXACTLY ONE/NOT
```

Key mappings (PRD §3.4):
- Name → auto-generates `shape.id` (slugified)
- Applies to: Entire form → `target: "#"`
- Applies to: Specific field → `target: "fieldPath"`
- Applies to: Each instance of → `target: "group[*].field"`
- Condition → `shape.constraint` (FEL with `$fieldName` paths, NOT bare `$`)
- Composition → `shape.and`/`or`/`xone`/`not` arrays of shape IDs or inline FEL
- Message → `shape.message` with `{{expression}}` interpolation
- Advanced → `timing`, `code`, `context`, `activeWhen`

## Step 15: Responsive Breakpoint Slider

Toolbar breakpoint bar with draggable width slider.

```
form-builder/src/components/responsive/
  BreakpointBar.tsx     — slider + named breakpoint snaps
  ResponsiveOverrides.tsx — per-component responsive property editor
```

- Slider resizes form preview in real-time
- At a specific breakpoint, per-field overrides: span, start, hidden
- Writes to component `responsive` blocks and theme `breakpoints`

## Step 16: Widget Override Selector

In Appearance section of inspector: dropdown to change widget type for a field (e.g., choice → Radio instead of Dropdown). Updates component node type. Shows available widgets based on field dataType.

## Step 17: Theme Selector Rules

"Style Rules" section in brand panel. Plain-language rules: "All date fields use compact style."

```
form-builder/src/components/brand/
  SelectorRuleEditor.tsx — match criteria (type/dataType) + apply (PresentationBlock)
```

Generates theme `selectors[]` with `match` conditions and `apply` blocks.

## Step 18: Design Token Editor

Full token vocabulary editor (expanded from Step 7's collapsed section).
- Key-value grid: token name → value
- Category grouping (color.*, spacing.*, typography.*, border.*, elevation.*)
- Token preview (color swatches, spacing visualizer)
- References shown: where each token is used

## Step 19: Variables Panel

"Form Settings → Variables" — named FEL expressions available to any field's logic.

```
form-builder/src/components/variables/
  VariablesPanel.tsx    — list of variables with name, expression, used-by
  VariableEditor.tsx    — name + FEL expression editor
```

Variables write to `definition.variables[]`. Shows dependency graph: which fields reference each variable.

## Step 20: Data Table Configuration

For repeating groups, option to switch display mode to Data Table (tabular view).
- Column configuration: which child fields are columns
- Sort, filter options
- Writes to component node type + config

---

# Phase 3: The Integration Platform

## Step 21: Mapping Rule Editor

Table-based bidirectional mapping rule editor.

```
form-builder/src/components/mapping/
  MappingEditor.tsx      — main editor: direction, format, rules table
  MappingRuleRow.tsx     — single rule: source, target, transform, reversible
  MappingRuleDetail.tsx  — expanded rule: expression, coerce, valueMap, condition
  RoundTripTest.tsx      — upload sample JSON, run forward+reverse, diff
```

- Direction: forward/reverse/both
- Format: JSON/XML/CSV
- Rules table: rows with source path, target path, transform type, reversible indicator
- Transform types: preserve, drop, expression, coerce, valueMap, flatten, nest, constant, concat, split
- Round-trip test: verify bidirectional fidelity

Writes to a Mapping Document (matches `mapping.schema.json`).

## Step 22: Extension Registry Browser

"Form Settings → Extensions" — load and browse registry documents.

```
form-builder/src/components/extensions/
  ExtensionBrowser.tsx   — list loaded registries and their entries
  RegistryLoader.tsx     — paste URL or select file to load registry
```

- Fetch registry, display entries by category
- Custom data types → added to field picker
- Custom functions → added to FEL autocomplete
- Custom constraints → available in validation system
- Show status badges (stable/deprecated/retired)

## Step 23: Version Management

"Form Settings → Version" — diff viewer, impact indicator, publish with changelog.

```
form-builder/src/components/versioning/
  VersionPanel.tsx       — current version, last published, changes since
  ChangeList.tsx         — list of changes with impact classification
  PublishDialog.tsx      — publish flow: version bump, changelog generation
```

- Auto-computed diff from edit history
- Impact classification: breaking/compatible/cosmetic → major/minor/patch
- Publish: bumps version, generates Changelog document (matches `changelog.schema.json`)
- Export bundle: all artifacts as ZIP

## Step 24: Sub-Form Composition ($ref)

"Insert → Sub-form" — import groups from other definitions.

```
form-builder/src/components/subform/
  SubFormImport.tsx     — URL/file input to import definition fragment
  LinkedBadge.tsx       — visual indicator for imported groups
```

- Resolves `$ref` references
- Uses the engine's `assembleDefinitionSync` for FEL path rewriting
- Imported fragment shows as collapsible section with "linked" badge

## Step 25: JSON Editor Escape Hatch

`Cmd+Shift+J` — split view of raw Definition/Component/Theme JSON.

```
form-builder/src/components/json/
  JsonEditorPane.tsx    — tabbed JSON editors with live sync
  JsonDiffView.tsx      — show changes between visual edits
```

- Edits in JSON propagate to visual editor (parse + validate)
- Edits in visual editor propagate to JSON view
- Syntax highlighting, schema validation inline

## Step 26: Import/Export

- Export form bundle (all artifacts as JSON files or ZIP)
- Import from JSON files
- Template system: save/load form templates

---

## Verification Strategy

1. **Unit tests** (Vitest): State mutations, FEL round-tripping (visual ↔ expression), bind lifecycle, path rewriting
2. **Integration tests** (Vitest + happy-dom): Inspector renders correct sections, slash menu filters, command palette search
3. **E2E tests** (Playwright): Full workflow — open studio, add fields via slash command, set required, add show-when condition, preview form, verify behavior

Key E2E scenario:
1. Open studio
2. Type title "Grant Application"
3. `/` → Short Answer → type "Organization Name"
4. `/` → Dropdown → type "Organization Type" → add options
5. `/` → Short Answer → type "Sub-type"
6. Select Sub-type → Logic → Show when → Org Type equals "University"
7. Select Org Name → Required toggle ON
8. Toggle preview → fill out form → verify conditional field appears/disappears

---

## Build Order Summary

### Phase 1: The Google Forms Moment
| Step | What | Depends On |
|------|-------|-----------|
| 0 | Scaffolding | — |
| 1 | State layer | 0 |
| 2 | Shell layout | 0 |
| 3 | Form surface (item blocks, inline editing, selection) | 1, 2 |
| 4 | Slash commands | 1, 3 |
| 5 | Inspector panel | 1, 2, 3 |
| 6 | Visual logic builders | 5 |
| 7 | Brand panel | 1, 5 |
| 8 | Logic badges | 3, 5 |
| 9 | Command palette | 1, 2 |
| 10 | Preview | 1, 2 |
| 11 | Structure tree | 1, 2, 3 |
| 12 | Diagnostics | 1, 2 |

### Phase 2: Power User Toolkit
| Step | What | Depends On |
|------|-------|-----------|
| 13 | Full FEL editor (autocomplete, validation, highlighting) | 6 |
| 14 | Form rules / shapes builder | 5, 13 |
| 15 | Responsive breakpoint slider | 2, 10 |
| 16 | Widget override selector | 5 |
| 17 | Theme selector rules | 7 |
| 18 | Design token editor | 7 |
| 19 | Variables panel | 1, 13 |
| 20 | Data table for repeating groups | 3, 5 |

### Phase 3: Integration Platform
| Step | What | Depends On |
|------|-------|-----------|
| 21 | Mapping rule editor | 1, 13 |
| 22 | Extension registry browser | 1, 4, 13 |
| 23 | Version management + changelog | 1 |
| 24 | Sub-form composition ($ref) | 1, 3 |
| 25 | JSON editor escape hatch | 1, 2 |
| 26 | Import/export | 1 |
