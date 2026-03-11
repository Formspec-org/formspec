# The Stack — TDD Implementation Plan

## Context

The Stack is a desktop-first visual authoring environment for Formspec v1.0, greenfield replacing the existing `form-builder/` (Preact). It provides 6 workspaces (Editor, Logic, Data, Theme, Mapping, Preview) with a persistent Blueprint sidebar and Properties panel. All mutations flow through `formspec-studio-core`'s `Project.dispatch()` — the UI is a visual surface for the 122-command catalog.

**Decisions:** React, Tailwind CSS, fresh build in `packages/formspec-studio/`, full PRD scope, TDD mandatory.

---

## Phase 0: Scaffolding & Design Tokens

**Goal:** Package setup, build tooling, Tailwind config with the PRD's design system tokens. No components yet — just the skeleton that everything builds on.

**Files to create:**

- `packages/formspec-studio/package.json` — React 19, Vite, Tailwind 4, Vitest, React Testing Library, formspec-studio-core dep
- `packages/formspec-studio/vite.config.ts` — React plugin, monorepo aliases (formspec-studio-core, formspec-engine)
- `packages/formspec-studio/tsconfig.json` — strict, JSX react-jsx, paths for workspace packages
- `packages/formspec-studio/vitest.config.ts` — happy-dom environment, same aliases
- `packages/formspec-studio/tailwind.config.ts` — PRD design tokens as custom theme:
  - Colors: ink, bg, surface, border, accent, logic, error, muted, subtle, green, amber
  - Fonts: `ui` (Space Grotesk), `mono` (JetBrains Mono)
  - Border radius: `sm` (3px), `DEFAULT` (4px)
- `packages/formspec-studio/src/main.tsx` — React root mount
- `packages/formspec-studio/src/index.css` — Tailwind directives + Google Fonts import
- `packages/formspec-studio/index.html` — Vite entry

**Tests:** Smoke test that the app mounts without crashing.

- `tests/smoke.test.tsx` — render root component, assert it doesn't throw

**Study:** `form-builder/vite.config.ts`, `form-builder/package.json` for monorepo alias patterns.

---

## Phase 1: React–Project Integration Layer

**Goal:** Custom hooks that wrap `formspec-studio-core`'s `Project` class in React idioms. This is the foundation every component depends on.

**Files to create:**

- `src/state/ProjectContext.tsx` — React Context providing a `Project` instance
- `src/state/useProject.ts` — hook returning the project from context
- `src/state/useProjectState.ts` — hook that subscribes to `project.onChange()`, returns current `ProjectState` via `useSyncExternalStore`
- `src/state/useDispatch.ts` — hook returning a stable `dispatch` function
- `src/state/useSelection.ts` — hook managing the global selection state (selected item key, selected entity type)
- `src/state/useDefinition.ts` — derived hook for `state.definition`
- `src/state/useComponent.ts` — derived hook for `state.component`
- `src/state/useTheme.ts` — derived hook for `state.theme`
- `src/state/useMapping.ts` — derived hook for `state.mapping`

**Tests (write FIRST):**

- `tests/state/project-context.test.tsx` — ProjectProvider renders children, useProject returns Project instance
- `tests/state/project-state.test.tsx` — useProjectState re-renders on dispatch, returns updated definition after addItem
- `tests/state/dispatch.test.tsx` — useDispatch returns stable function, dispatching addItem updates state
- `tests/state/selection.test.tsx` — useSelection tracks selected key, updates on select/deselect, persists across re-renders, persists across workspace tab switches (PRD §20.1)

**Key patterns:**

- `useSyncExternalStore` for subscribing to Project changes (no useEffect + useState)
- Selection state is pure React state (not in Project) — managed via context
- Selection persists across workspace tab switches (PRD §20.1)
- All hooks are testable in isolation with a ProjectProvider wrapper

**Study:** `form-builder/src/state/project.ts` and `form-builder/src/state/derived.ts` for signal patterns (we'll translate to React hooks).

---

## Phase 2: Shell Chrome

**Goal:** The persistent layout frame — header, sidebar, content area, properties panel, status bar. Tab navigation between workspaces. No workspace content yet — just the chrome and navigation.

**Components to build:**

- `src/components/Shell.tsx` — root layout: header + [sidebar | main | properties] + footer
- `src/components/Header.tsx` — logo, 6 nav tabs, search placeholder, Preview/Publish buttons, undo/redo
- `src/components/StatusBar.tsx` — formspec version, status badge, counts
- `src/components/Blueprint.tsx` — left sidebar with collapsible sections, entity counts
- `src/components/PropertiesPanel.tsx` — right panel, empty state ("Select an item to inspect")

**Tests (write FIRST):**

- `tests/components/shell.test.tsx`:
  - Renders header with app title "The Stack"
  - Shows 6 workspace tabs (Editor, Logic, Data, Theme, Mapping, Preview)
  - Clicking a tab switches active workspace
  - Default tab is Editor
- `tests/components/header.test.tsx`:
  - Displays formspec version and definition status
  - Undo button disabled when canUndo is false
  - Redo button disabled when canRedo is false
  - Undo dispatches project.undo(), redo dispatches project.redo()
- `tests/components/status-bar.test.tsx`:
  - Shows formspec version and definition status lifecycle badge
  - Shows active presentation mode, default currency, density setting (PRD §6.4)
  - Shows field count, bind count, shape count
  - Updates when definition changes
- `tests/components/blueprint.test.tsx`:
  - Renders section list (Structure, Component Tree, Screener, Variables, etc.)
  - Shows entity count badges
  - Clicking a section switches sidebar content
- `tests/components/properties-panel.test.tsx`:
  - Shows empty state when nothing selected
  - Renders item inspector when a field is selected

**Commands dispatched:** `project.undo()`, `project.redo()`, `project.publish` (from Publish button)

**Study:** `form-builder/src/components/Shell.tsx`, `form-builder/src/components/Toolbar.tsx`

---

## Phase 3: Shared Primitives

**Goal:** Reusable UI atoms used across all workspaces. These map directly to the PRD's design system.

**Components:**

- `src/components/ui/Pill.tsx` — colored metadata badge (10% bg, 20% border)
- `src/components/ui/BindCard.tsx` — colored bind type card (required=blue, relevant=violet, etc.)
- `src/components/ui/ShapeCard.tsx` — severity-colored validation shape card
- `src/components/ui/PropertyRow.tsx` — label/value row for Properties panel
- `src/components/ui/Section.tsx` — collapsible section with title
- `src/components/ui/FieldIcon.tsx` — data-type colored icon (Aa, #, $, etc.)

**Tests (write FIRST):**

- `tests/components/ui/pill.test.tsx` — renders text, applies color, small variant
- `tests/components/ui/bind-card.test.tsx` — renders per bind type, shows humanized + raw FEL
- `tests/components/ui/shape-card.test.tsx` — renders severity badge, constraint, composition
- `tests/components/ui/section.test.tsx` — collapsible, remembers state, shows title

**Utilities:**

- `src/lib/humanize.ts` — FEL expression humanizer (translates `$evHist = true` → "Eviction = Yes")
- `src/lib/field-helpers.ts` — data type metadata (icon, label, color), item flattening, bind/shape lookups

**Tests:**

- `tests/lib/humanize.test.ts` — known FEL → human-readable mappings
- `tests/lib/field-helpers.test.ts` — flatItems, bindsFor, shapesFor, data type lookup

**Study:** `research/assets/the-stack-desktop-split/00-preamble.tsx` for exact Pill, BindCard, ShapeCard, Row, Sec implementations.

---

## Phase 4: Editor Workspace

**Goal:** The primary authoring surface — page navigation, block rendering, drag-drop, context menu, inline creation.

### 4a: Page Navigation

- `src/workspaces/editor/PageTabs.tsx` — wizard page tabs with numbered indicators

**Tests:**

- Renders page labels from definition
- Clicking a tab filters to that page's items
- Active page highlighted
- Add/delete page via context menu dispatches `definition.addPage` / `definition.deletePage`

### 4b: Block Rendering

- `src/workspaces/editor/EditorCanvas.tsx` — scrollable block list for current page
- `src/workspaces/editor/GroupBlock.tsx` — section header with metadata pills
- `src/workspaces/editor/FieldBlock.tsx` — card with icon, label, pills, bind summary strip
- `src/workspaces/editor/DisplayBlock.tsx` — accent-bordered display item

**Tests:**

- `tests/workspaces/editor/editor-canvas.test.tsx`:
  - Renders correct block type for each item type
  - Groups show children indented
  - Clicking a block selects it (updates selection state)
  - Fields show data type icon, key, label, bind pills
  - Display blocks show accent border and content
- `tests/workspaces/editor/field-block.test.tsx`:
  - Shows Required pill when bind has required
  - Shows "ƒx Calc" pill when bind has calculate
  - Shows bind summary strip (visibility, calculation, validation icons)
  - Nested fields indent with dashed guide lines

### 4c: Properties Panel — Editor Context

- `src/workspaces/editor/ItemProperties.tsx` — full inspector for selected item
  - Identity section (key, type, dataType)
  - Field Config section (currency, precision, prefix/suffix)
  - Labels section
  - Presentation section (widgetHint, layout)
  - Behavior Rules section (BindCards for each bind)
  - Validation Shapes section (ShapeCards)
  - Options section
  - Extensions section
  - Repeat Config section

**Tests:**

- Renaming key dispatches `definition.renameItem`
- Changing dataType dispatches `definition.setFieldDataType`
- Editing bind expression dispatches `definition.setBind` on blur
- Toggle required dispatches `definition.setBind` with required property
- Duplicate button dispatches `definition.duplicateItem`
- Delete button shows confirmation when item has children, dispatches `definition.deleteItem`

### 4d: Drag and Drop

- Drag handles visible on hover
- Drop indicator line at valid targets
- Drop dispatches `definition.moveItem` or `definition.reorderItem`

**Tests:**

- Drag handle appears on hover
- Drop dispatches moveItem with correct source/target paths

### 4e: Context Menu & Inline Creation

- `src/workspaces/editor/EditorContextMenu.tsx`
- `src/workspaces/editor/AddItemPicker.tsx` — type picker → data type picker

**Tests:**

- Context menu shows Duplicate, Delete, Move Up/Down, Wrap in Group
- "Promote to Option Set" shown for fields with inline options
- Add Item dispatches `definition.addItem` with chosen type and dataType

**Commands dispatched:** `definition.addItem`, `definition.deleteItem`, `definition.renameItem`, `definition.moveItem`, `definition.reorderItem`, `definition.duplicateItem`, `definition.setBind`, `definition.setFieldDataType`, `definition.setItemProperty`, `definition.setFieldOptions`, `definition.setItemExtension`, `definition.addPage`, `definition.deletePage`, `definition.reorderPage`, `definition.promoteToOptionSet`

**Study:** `form-builder/src/components/surface/`, `form-builder/src/components/inspector/`, `form-builder/src/components/tree/`

---

## Phase 5: Logic Workspace

**Goal:** Dedicated behavioral editing — binds, shapes, variables with filtering and dependency awareness.

**Components:**

- `src/workspaces/logic/LogicTab.tsx` — filter bar + variables + binds + shapes
- `src/workspaces/logic/FilterBar.tsx` — toggle buttons for bind types with counts
- `src/workspaces/logic/VariablesSection.tsx` — variable cards with @name, expression, dependencies
- `src/workspaces/logic/BindsSection.tsx` — collapsible bind cards per field
- `src/workspaces/logic/ShapesSection.tsx` — severity-colored shape cards

**Tests (write FIRST):**

- `tests/workspaces/logic/logic-tab.test.tsx`:
  - Filter bar shows correct counts per bind type
  - Clicking "required" filter shows only fields with required binds
  - Variables section renders all computed variables
  - Adding a variable dispatches `definition.addVariable`
  - Editing variable expression dispatches `definition.setVariable`
  - Deleting variable dispatches `definition.deleteVariable`
- `tests/workspaces/logic/binds-section.test.tsx`:
  - Each bind field renders as collapsible card
  - Collapsed: field label, path, active bind type pills
  - Expanded: colored BindCards for each property + overrides section
  - Editing bind property dispatches `definition.setBind`
  - "Add Bind" opens field picker, dispatches `definition.setBind`
- `tests/workspaces/logic/shapes-section.test.tsx`:
  - Renders shapes with severity-colored borders
  - Adding shape dispatches `definition.addShape`
  - Editing property dispatches `definition.setShapeProperty`
  - Composition (AND/OR/XOR/NOT) dispatches `definition.setShapeComposition`

**Commands dispatched:** `definition.addVariable`, `definition.setVariable`, `definition.deleteVariable`, `definition.setBind`, `definition.addShape`, `definition.setShapeProperty`, `definition.setShapeComposition`, `definition.renameShape`, `definition.deleteShape`

**Study:** `form-builder/src/components/logic/`, `form-builder/src/components/shapes/`, `form-builder/src/components/variables/`

---

## Phase 6: Data Workspace

**Goal:** Four sub-tabs for data management — schema view, instances, option sets, test response.

**Components:**

- `src/workspaces/data/DataTab.tsx` — sub-tab container
- `src/workspaces/data/ResponseSchema.tsx` — read-only table from item tree
- `src/workspaces/data/DataSources.tsx` — instance inspector cards
- `src/workspaces/data/OptionSets.tsx` — named option set cards
- `src/workspaces/data/TestResponse.tsx` — split-pane mock input + live JSON

**Tests (write FIRST):**

- `tests/workspaces/data/response-schema.test.tsx`:
  - Renders table with key, type, label columns
  - Groups show nesting indentation
  - Repeatable groups show `array<object>` type
- `tests/workspaces/data/data-sources.test.tsx`:
  - Renders instance cards with name, source, schema
  - Adding dispatches `definition.addInstance`
  - Editing dispatches `definition.setInstance`
  - Renaming dispatches `definition.renameInstance` (cascades to FEL)
- `tests/workspaces/data/option-sets.test.tsx`:
  - Renders option set cards with inline options table
  - "Used By" shows referencing fields
  - Creating/updating dispatches `definition.setOptionSet`
- `tests/workspaces/data/test-response.test.tsx`:
  - Renders fields with type-appropriate inputs
  - Calculated fields show "ƒx auto" indicator
  - Right panel shows live JSON
  - Toggling a boolean governing `relevant` shows/hides dependent fields

**Commands dispatched:** `definition.addInstance`, `definition.setInstance`, `definition.renameInstance`, `definition.deleteInstance`, `definition.setOptionSet`, `definition.deleteOptionSet`

**Study:** `form-builder/src/components/instances/`, `form-builder/src/components/optionsets/`

---

## Phase 7: Theme Workspace

**Goal:** Full presentation cascade editor — tokens, defaults, selectors, overrides, page layouts, breakpoints.

**Components:**

- `src/workspaces/theme/ThemeTab.tsx` — sub-tab container
- `src/workspaces/theme/TokenEditor.tsx` — key-value grid with color picker
- `src/workspaces/theme/DefaultsEditor.tsx` — label position, density, page mode
- `src/workspaces/theme/SelectorList.tsx` — draggable selector rules
- `src/workspaces/theme/ItemOverrides.tsx` — resolved cascade + override editing
- `src/workspaces/theme/PageLayouts.tsx` — 12-column grid editor
- `src/workspaces/theme/BreakpointEditor.tsx` — named viewport widths

**Tests (write FIRST):**

- `tests/workspaces/theme/token-editor.test.tsx`:
  - Renders token key-value pairs
  - Adding token dispatches `theme.setToken`
  - Color picker appears for hex values
- `tests/workspaces/theme/defaults-editor.test.tsx`:
  - Shows current defaults (label position, density, etc.)
  - Changing page mode dispatches `theme.setDefaults`
- `tests/workspaces/theme/selector-list.test.tsx`:
  - Renders selectors as draggable cards with match criteria pills
  - Adding dispatches `theme.addSelector`
  - Reordering dispatches `theme.reorderSelector`
- `tests/workspaces/theme/item-overrides.test.tsx`:
  - Shows effective cascade (default → selector → override) with source indicators
  - Editing override dispatches `theme.setItemOverride`
  - Clearing override dispatches `theme.deleteItemOverride`
- `tests/workspaces/theme/page-layouts.test.tsx`:
  - Renders 12-column grid
  - Adding region dispatches `theme.addRegion`
  - Resizing region dispatches `theme.setRegionProperty`

**Commands dispatched:** `theme.setToken`, `theme.setTokens`, `theme.setDefaults`, `theme.addSelector`, `theme.setSelector`, `theme.deleteSelector`, `theme.reorderSelector`, `theme.setItemOverride`, `theme.deleteItemOverride`, `theme.setItemWidgetConfig`, `theme.setItemAccessibility`, `theme.setItemStyle`, `theme.addPage`, `theme.addRegion`, `theme.setRegionProperty`, `theme.setBreakpoint`

---

## Phase 8: Mapping Workspace

**Goal:** Data transformation rule editor with preview.

**Components:**

- `src/workspaces/mapping/MappingTab.tsx` — config + rules + adapter + preview
- `src/workspaces/mapping/MappingConfig.tsx` — direction, definition ref, target schema
- `src/workspaces/mapping/RuleEditor.tsx` — ordered list of mapping rules
- `src/workspaces/mapping/RuleCard.tsx` — source → target with transform badge
- `src/workspaces/mapping/InnerRules.tsx` — nested rules for repeatable groups
- `src/workspaces/mapping/AdapterConfig.tsx` — JSON/XML/CSV options
- `src/workspaces/mapping/MappingPreview.tsx` — split-pane input → output

**Tests (write FIRST):**

- `tests/workspaces/mapping/rule-editor.test.tsx`:
  - Renders rules as draggable cards
  - Adding dispatches `mapping.addRule`
  - Editing dispatches `mapping.setRule`
  - Reordering dispatches `mapping.reorderRule`
  - Auto-Generate dispatches `mapping.autoGenerateRules`
- `tests/workspaces/mapping/mapping-preview.test.tsx`:
  - Run button dispatches `mapping.preview`
  - Shows transformed output and diagnostics
  - Direction toggle between forward/reverse

**Commands dispatched:** `mapping.setProperty`, `mapping.setTargetSchema`, `mapping.addRule`, `mapping.setRule`, `mapping.deleteRule`, `mapping.reorderRule`, `mapping.addInnerRule`, `mapping.setInnerRule`, `mapping.deleteInnerRule`, `mapping.setAdapter`, `mapping.autoGenerateRules`, `mapping.preview`

---

## Phase 9: Preview Workspace

**Goal:** Respondent-facing form preview rendering the Component Document tree.

**Components:**

- `src/workspaces/preview/PreviewTab.tsx` — viewport switcher + preview frame
- `src/workspaces/preview/ViewportSwitcher.tsx` — desktop/tablet/mobile toggle
- `src/workspaces/preview/ComponentRenderer.tsx` — recursive tree walker
- `src/workspaces/preview/WizardNav.tsx` — step indicators, back/continue/submit

**Tests (write FIRST):**

- `tests/workspaces/preview/preview-tab.test.tsx`:
  - Viewport switcher changes frame width (full/768px/375px)
  - Renders component tree recursively
- `tests/workspaces/preview/component-renderer.test.tsx`:
  - Layout components render as structural containers
  - Input components render with labels, hints, required indicators
  - Display components render with type-appropriate treatments
- `tests/workspaces/preview/wizard-nav.test.tsx`:
  - Shows step indicators matching page count
  - Continue advances to next page
  - Back returns to previous page
  - Submit button on final step

**Study:** `packages/formspec-webcomponent/src/components/` for component rendering patterns, `form-builder/src/components/preview/`

---

## Phase 10: Blueprint Sidebar Sections

**Goal:** Complete all Blueprint sidebar sections. The PRD (§6.2) specifies 11 navigable sections: Structure, Component Tree, Theme, Screener, Variables, Data Sources, Option Sets, Mappings, Migrations, FEL Reference, and Settings. Each section is a compact navigable list/tree within the sidebar — distinct from the full workspace views.

### 10a: Structure Tree
- `src/components/blueprint/StructureTree.tsx` — navigable item tree (full version of Phase 2 stub)

**Tests:**
- `tests/components/blueprint/structure-tree.test.tsx`:
  - Renders items as indented tree with type icons
  - Selecting a node updates Properties panel
  - Drag-and-drop dispatches `definition.reorderItem` (sibling) or `definition.moveItem` (cross-parent)
  - Collapse/expand state persists

### 10b: Component Tree (26 commands — PRD §13)

**Components:**
- `src/components/blueprint/ComponentTree.tsx` — color-coded node tree with full CRUD
- `src/components/blueprint/ComponentNodeProperties.tsx` — Properties panel for selected component node
- `src/components/blueprint/CustomComponentManager.tsx` — register/edit/delete custom component templates

**Tests (write FIRST):**
- `tests/components/blueprint/component-tree.test.tsx`:
  - Renders nodes color-coded by category (blue=layout, green=input, amber=display, violet=container)
  - Each node shows component type, bind key, title, conditional indicator when `when` present
  - Selecting a node updates Properties panel
  - Drag-and-drop dispatches `component.moveNode` or `component.reorderNode`
  - Context menu: Add Child (`component.addNode`), Delete (`component.deleteNode`), Duplicate (`component.duplicateNode`), Wrap (`component.wrapNode`), Unwrap (`component.unwrapNode`)
- `tests/components/blueprint/component-node-properties.test.tsx`:
  - Changing component type dispatches `component.setNodeType`
  - Setting a property dispatches `component.setNodeProperty`
  - Setting a style property dispatches `component.setNodeStyle`
  - Setting an accessibility property dispatches `component.setNodeAccessibility`
  - Adding a responsive override dispatches `component.setResponsiveOverride` with breakpoint name
  - Splicing an array prop (e.g., DataTable columns) dispatches `component.spliceArrayProp`
  - Setting field widget dispatches `component.setFieldWidget`
  - Group-specific: `component.setGroupRepeatable`, `component.setGroupDisplayMode`, `component.setGroupDataTable`
- `tests/components/blueprint/custom-component-manager.test.tsx`:
  - Lists registered custom components with parameter lists
  - Register dispatches `component.registerCustom`
  - Update dispatches `component.updateCustom`
  - Delete dispatches `component.deleteCustom`
  - Rename dispatches `component.renameCustom`

**Component document properties (tested in component-tree or dedicated):**
- `component.setBreakpoint` — named viewport breakpoints
- `component.setToken` — Tier 3 design token overrides
- `component.setDocumentProperty` — top-level document properties
- `component.setWizardProperty` — wizard-mode configuration

**Commands dispatched (26 total):**
- Tree: `component.addNode`, `component.deleteNode`, `component.moveNode`, `component.reorderNode`, `component.duplicateNode`, `component.wrapNode`, `component.unwrapNode`
- Properties: `component.setNodeProperty`, `component.setNodeType`, `component.setNodeStyle`, `component.setNodeAccessibility`, `component.spliceArrayProp`, `component.setFieldWidget`, `component.setResponsiveOverride`
- Groups: `component.setGroupRepeatable`, `component.setGroupDisplayMode`, `component.setGroupDataTable`
- Custom: `component.registerCustom`, `component.updateCustom`, `component.deleteCustom`, `component.renameCustom`
- Document: `component.setWizardProperty`, `component.setToken`, `component.setBreakpoint`, `component.setDocumentProperty`

### 10c: Screener Section (8 commands — PRD §14)

**Components:**
- `src/components/blueprint/ScreenerSection.tsx` — screening fields + routing rules

**Tests (write FIRST):**
- `tests/components/blueprint/screener-section.test.tsx`:
  - Enable/disable toggle dispatches `definition.setScreener`
  - Adding a screening field dispatches `definition.addScreenerItem`
  - Deleting a screening field dispatches `definition.deleteScreenerItem`
  - Setting bind on screener field dispatches `definition.setScreenerBind`
  - Route list renders ordered rules with FEL conditions
  - Adding a route dispatches `definition.addRoute`
  - Editing a route property dispatches `definition.setRouteProperty`
  - Reordering a route dispatches `definition.reorderRoute`
  - Deleting a route dispatches `definition.deleteRoute`
  - Route with condition `true` shown as default fallback

**Commands dispatched (8):** `definition.setScreener`, `definition.addScreenerItem`, `definition.deleteScreenerItem`, `definition.setScreenerBind`, `definition.addRoute`, `definition.setRouteProperty`, `definition.reorderRoute`, `definition.deleteRoute`

### 10d: Migrations Section (7 commands — PRD §15)

**Components:**
- `src/components/blueprint/MigrationsSection.tsx` — version migration descriptors with field map rules

**Tests (write FIRST):**
- `tests/components/blueprint/migrations-section.test.tsx`:
  - Renders migration entries with source version and description
  - Adding dispatches `definition.addMigration`
  - Editing a migration property dispatches `definition.setMigrationProperty`
  - Deleting dispatches `definition.deleteMigration`
  - Field map rules: renders source→target with transform type
  - Adding a field map rule dispatches `definition.addFieldMapRule`
  - Editing a field map rule property dispatches `definition.setFieldMapRule`
  - Deleting a field map rule dispatches `definition.deleteFieldMapRule`
  - Setting migration defaults dispatches `definition.setMigrationDefaults`

**Commands dispatched (7):** `definition.addMigration`, `definition.deleteMigration`, `definition.setMigrationProperty`, `definition.addFieldMapRule`, `definition.setFieldMapRule`, `definition.deleteFieldMapRule`, `definition.setMigrationDefaults`

### 10e: FEL Reference (PRD §16)

**Components:**
- `src/components/blueprint/FELReference.tsx` — browsable function catalog (9 categories, 48 functions)

**Tests:**
- `tests/components/blueprint/fel-reference.test.tsx`:
  - Shows 9 collapsible categories (Aggregate, String, Numeric, Date, Logical, Type, Money, MIP, Repeat)
  - Each function shows name, typed signature, one-line description
  - Selecting a function shows full detail in Properties panel (name, signature, description, category, usage example)
  - Search/filter narrows visible functions

### 10f: Settings Section (PRD §17)

**Components:**
- `src/components/blueprint/SettingsSection.tsx` — 6 subsections for all document-level config

**Tests (write FIRST):**
- `tests/components/blueprint/settings-section.test.tsx`:
  - **Definition Metadata** (§17.2): identity fields ($formspec, url, version, status, name, date, description), editing dispatches `definition.setDefinitionProperty`
  - **Presentation Defaults** (§17.3): pageMode, labelPosition, density, defaultCurrency — dispatches `definition.setFormPresentation` (triggers component tree rebuild when pageMode changes)
  - **Behavioral Defaults** (§17.4): nonRelevantBehavior (remove/empty/keep) — dispatches `definition.setDefinitionProperty`
  - **Lineage** (§17.5): derivedFrom (parent URL + version) — dispatches `definition.setDefinitionProperty`
  - **Extensions** (§17.6): definition-level x-prefixed key-value editor with JSON input — dispatches `definition.setDefinitionProperty`
  - **Group References** (§17.7): group `$ref` for subform composition — setting ref dispatches `definition.setGroupRef`, import dispatches `project.importSubform`
  - **Extension Registries** (§17.8): load dispatches `project.loadRegistry`, remove dispatches `project.removeRegistry`

**Commands dispatched:** `definition.setDefinitionProperty`, `definition.setFormPresentation`, `definition.setFormTitle`, `definition.setGroupRef`, `project.loadRegistry`, `project.removeRegistry`, `project.importSubform`

### 10g: Remaining Blueprint Sidebar Panels (PRD §6.2)

The PRD specifies 11 sidebar sections. Phases 5–8 build full workspace views, but the Blueprint sidebar needs compact navigable panels for sections that link into those workspaces.

**Components:**
- `src/components/blueprint/ThemeOverview.tsx` — compact token/selector/defaults summary
- `src/components/blueprint/VariablesList.tsx` — navigable @name list with expression previews
- `src/components/blueprint/DataSourcesList.tsx` — instance names with `@instance('name')` syntax
- `src/components/blueprint/OptionSetsList.tsx` — named option set list with "used by" counts
- `src/components/blueprint/MappingsList.tsx` — mapping rule summary with source→target paths

**Tests:**
- `tests/components/blueprint/sidebar-panels.test.tsx`:
  - Each panel renders entity list with count badge matching Blueprint header
  - Selecting an entity in sidebar updates Properties panel
  - Theme overview shows token count, selector count, defaults summary
  - Variables list shows @name and expression preview for each variable
  - Data Sources list shows instance names with reference syntax
  - Option Sets list shows set names with "used by" field count
  - Mappings list shows rule count and direction indicator

---

## Phase 11: Global Search, Keyboard Shortcuts & Import

**Goal:** ⌘K command palette, keyboard shortcuts, and project import dialog (PRD §18.1).

**Components:**

- `src/components/CommandPalette.tsx` — search dialog triggered by ⌘K
- `src/components/ImportDialog.tsx` — multi-artifact import with validation (PRD §18.1)
- `src/lib/keyboard.ts` — shortcut registry and handler

**Tests:**

- `tests/components/command-palette.test.tsx`:
  - ⌘K opens command palette
  - Typing filters items, fields, variables, FEL functions
  - Selecting a result navigates to it and selects it
  - Escape closes the palette
- `tests/components/import-dialog.test.tsx`:
  - Accepts JSON files for definition, component, theme, and/or mapping documents
  - Validates documents before dispatch; shows diagnostic messages on rejection
  - On confirmation, dispatches `project.import` (clears undo history)
- `tests/lib/keyboard.test.ts`:
  - ⌘Z / ⌘⇧Z trigger undo/redo
  - Delete key on selected item dispatches delete with confirmation
  - Escape closes any open dialog/palette

**Study:** `form-builder/src/components/CommandPalette.tsx`

---

## Phase 12: E2E Integration

**Goal:** Playwright tests covering full authoring workflows.

**Tests:**

- `tests/e2e/editor-workflow.spec.ts` — add field, configure binds, reorder, duplicate, delete
- `tests/e2e/logic-workflow.spec.ts` — add variable, create bind, add shape
- `tests/e2e/data-workflow.spec.ts` — add instance, create option set, test response
- `tests/e2e/undo-redo.spec.ts` — dispatch, undo, verify rollback, redo, verify restore
- `tests/e2e/import-export.spec.ts` — import a definition, verify it renders, export and compare

---

## Directory Structure

```
packages/formspec-studio/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── tailwind.config.ts
├── src/
│   ├── main.tsx
│   ├── index.css
│   ├── state/                    # Phase 1
│   │   ├── ProjectContext.tsx
│   │   ├── useProject.ts
│   │   ├── useProjectState.ts
│   │   ├── useDispatch.ts
│   │   ├── useSelection.ts
│   │   ├── useDefinition.ts
│   │   ├── useComponent.ts
│   │   ├── useTheme.ts
│   │   └── useMapping.ts
│   ├── components/               # Phases 2–3, 11
│   │   ├── Shell.tsx
│   │   ├── Header.tsx
│   │   ├── StatusBar.tsx
│   │   ├── Blueprint.tsx
│   │   ├── PropertiesPanel.tsx
│   │   ├── CommandPalette.tsx
│   │   ├── ImportDialog.tsx
│   │   ├── ui/
│   │   │   ├── Pill.tsx
│   │   │   ├── BindCard.tsx
│   │   │   ├── ShapeCard.tsx
│   │   │   ├── PropertyRow.tsx
│   │   │   ├── Section.tsx
│   │   │   └── FieldIcon.tsx
│   │   └── blueprint/            # Phase 10
│   │       ├── StructureTree.tsx
│   │       ├── ComponentTree.tsx
│   │       ├── ComponentNodeProperties.tsx
│   │       ├── CustomComponentManager.tsx
│   │       ├── ScreenerSection.tsx
│   │       ├── MigrationsSection.tsx
│   │       ├── FELReference.tsx
│   │       ├── SettingsSection.tsx
│   │       ├── ThemeOverview.tsx
│   │       ├── VariablesList.tsx
│   │       ├── DataSourcesList.tsx
│   │       ├── OptionSetsList.tsx
│   │       └── MappingsList.tsx
│   ├── workspaces/               # Phases 4–9
│   │   ├── editor/
│   │   │   ├── EditorCanvas.tsx
│   │   │   ├── PageTabs.tsx
│   │   │   ├── GroupBlock.tsx
│   │   │   ├── FieldBlock.tsx
│   │   │   ├── DisplayBlock.tsx
│   │   │   ├── ItemProperties.tsx
│   │   │   ├── EditorContextMenu.tsx
│   │   │   └── AddItemPicker.tsx
│   │   ├── logic/
│   │   │   ├── LogicTab.tsx
│   │   │   ├── FilterBar.tsx
│   │   │   ├── VariablesSection.tsx
│   │   │   ├── BindsSection.tsx
│   │   │   └── ShapesSection.tsx
│   │   ├── data/
│   │   │   ├── DataTab.tsx
│   │   │   ├── ResponseSchema.tsx
│   │   │   ├── DataSources.tsx
│   │   │   ├── OptionSets.tsx
│   │   │   └── TestResponse.tsx
│   │   ├── theme/
│   │   │   ├── ThemeTab.tsx
│   │   │   ├── TokenEditor.tsx
│   │   │   ├── DefaultsEditor.tsx
│   │   │   ├── SelectorList.tsx
│   │   │   ├── ItemOverrides.tsx
│   │   │   ├── PageLayouts.tsx
│   │   │   └── BreakpointEditor.tsx
│   │   ├── mapping/
│   │   │   ├── MappingTab.tsx
│   │   │   ├── MappingConfig.tsx
│   │   │   ├── RuleEditor.tsx
│   │   │   ├── RuleCard.tsx
│   │   │   ├── InnerRules.tsx
│   │   │   ├── AdapterConfig.tsx
│   │   │   └── MappingPreview.tsx
│   │   └── preview/
│   │       ├── PreviewTab.tsx
│   │       ├── ViewportSwitcher.tsx
│   │       ├── ComponentRenderer.tsx
│   │       └── WizardNav.tsx
│   └── lib/                      # Phase 3, 11
│       ├── humanize.ts
│       ├── field-helpers.ts
│       └── keyboard.ts
├── tests/
│   ├── smoke.test.tsx
│   ├── state/
│   ├── components/
│   │   ├── ui/
│   │   └── blueprint/
│   ├── workspaces/
│   │   ├── editor/
│   │   ├── logic/
│   │   ├── data/
│   │   ├── theme/
│   │   ├── mapping/
│   │   └── preview/
│   ├── lib/
│   └── e2e/
└── public/
```

---

## Verification

After each phase:

1. `npm test` — all Vitest tests green, zero warnings
2. `npm run build` — TypeScript compiles clean
3. `npm run dev` — visual sanity check in browser

After all phases:

1. Full Playwright E2E suite passes
2. Import the Section 8 HCV definition (from prototype) and verify all workspaces render correctly
3. Perform a full authoring cycle: create form → add fields → configure binds → add shapes → set theme → create mapping → preview → publish

---

## Key Reference Files

| What | Path |
|------|------|
| Studio-core Project class | `packages/formspec-studio-core/src/project.ts` |
| Studio-core types | `packages/formspec-studio-core/src/types.ts` |
| Command catalog schema | `schemas/studio-commands.schema.json` |
| Studio-core API reference | `packages/formspec-studio-core/API.llm.md` |
| PRD | `packages/formspec-studio/research/assets/the-stack-prd.md` |
| Visual prototype | `packages/formspec-studio/research/assets/the-stack-desktop-split/` |
| Mockup screenshots | `packages/formspec-studio/research/assets/Screenshot*.png` |
| Existing form-builder | `form-builder/src/` |
| Existing form-builder state | `form-builder/src/state/` |
