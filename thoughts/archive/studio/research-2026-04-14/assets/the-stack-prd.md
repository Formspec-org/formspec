# The Stack — Product Requirements Document

**Version:** 2.0  
**Status:** Draft  
**Date:** March 11, 2026  
**Classification:** Internal / Confidential  
**Mutation Layer:** formspec-studio-core v0.1 (Studio Command Catalog)

---

## 1. Executive Summary

The Stack is a desktop-first visual authoring environment for the Formspec v1.0 specification. It provides program analysts, field researchers, and technical reviewers with a unified workspace for building, configuring, testing, and publishing structured data collection instruments — without writing JSON or code.

All mutations flow through the Studio Command Catalog (`formspec-studio-core`), a typed command dispatch system that guarantees structural validity, cascading reference updates, and undo/redo capability. The Stack is the visual surface for this command system; every user interaction that modifies state maps to one or more dispatched commands. This document specifies the UX behaviors that drive those dispatches, not the command payloads themselves.

The platform manages four artifact types per project: **Definition** (structure and behavior), **Theme** (presentation cascade), **Component** (Tier 3 layout tree), and **Mapping** (data transformation rules). The initial release covers six workspaces: Editor, Logic, Data, Theme, Mapping, and Preview — plus a persistent Blueprint sidebar and Properties panel.

---

## 2. Problem Statement

The people who understand regulatory requirements are not the people who can express them as machine-readable specifications. This gap produces three failure modes: ambiguous Word documents that engineers misinterpret, legacy form builders that cannot express conditional logic, and hand-authored JSON with structural errors that surface only at runtime.

The Stack resolves this by giving domain experts a visual surface whose every interaction produces valid, standards-compliant Formspec output. The command dispatch layer enforces invariants (unique keys, valid bind paths, acyclic variable graphs, compatible data types) that would otherwise require manual review. The analyst works in a visual vocabulary of blocks, rules, and connections; the system maintains the JSON contract.

---

## 3. Target Users

**Program Analysts** are the primary audience. They understand that Section 8 eligibility depends on household size relative to Area Median Income, that self-employment income requires tax documentation, and that eviction details should appear only when the applicant discloses a prior eviction. They do not know what a JSON schema is, but they need to encode this knowledge into a form that downstream systems can process. They need to author, iterate, test, and publish — all without filing engineering tickets.

**Field Researchers** administer forms and report structural problems. They need to inspect a form's logic, understand why a field is hidden or required under specific conditions, and propose corrections in the same tool the analyst uses. They are readers and annotators more than authors.

**Technical Reviewers** validate output before deployment. They need raw access to JSON, FEL expressions, component trees, migration paths, and mapping rules. They use The Stack as a verification tool, checking that the visual configuration produces the expected machine-readable artifacts.

---

## 4. Design Philosophy

### 4.1 Swiss Brutalist Utility

High contrast, rigorous alignment, visible structure, monospaced data accents. Every pixel serves an informational purpose. The aesthetic communicates precision and trustworthiness — essential qualities for a tool that produces legal and regulatory instruments. No decorative elements, soft shadows, or rounded bubbles.

### 4.2 Specification Transparency

The Stack shows both layers: a natural-language summary for analysts ("Visible when: Eviction = Yes") and the underlying FEL expression (`$evHist = true`). This teaches the specification incrementally and ensures technical reviewers can verify output without switching tools.

### 4.3 Command-Driven Mutations

Every state change dispatches through `Project.dispatch()`. The UI never mutates state directly. This guarantees undo/redo capability, cascading reference integrity (renaming a field updates all binds, shapes, variables, component references, and mapping rules that reference it), and structural validation at the command boundary. The UX consequence is that users can experiment freely — every action is reversible, and the system will never produce an invalid document.

---

## 5. Project Model

A project contains four mutable artifacts, each managed by a dedicated command area.

**Definition Document** is the source of truth for structure and behavior. It contains the form's identity, item tree, behavioral binds, validation shapes, computed variables, secondary instances, option sets, screener routing, migration descriptors, and presentation hints. Managed by commands in the `definition-items`, `definition-binds`, `definition-metadata`, `definition-pages`, `definition-shapes`, `definition-variables`, `definition-optionsets`, `definition-instances`, `definition-screener`, and `definition-migrations` areas.

**Theme Document** controls the presentation cascade: design tokens, form-wide defaults, selector-based overrides, per-item overrides, page layouts with grid regions, breakpoints, and external stylesheets. Managed by commands in the `theme` area.

**Component Document** defines the Tier 3 parallel presentation tree: target definition binding, responsive breakpoints, design tokens, custom component templates, and a single-root tree of 33+ built-in component types. Managed by commands in the `component-tree` and `component-properties` areas.

**Mapping Document** describes data transformation rules for import/export: source-to-target field mapping with transform expressions, output adapters, nested inner rules for group/array transforms, and preview execution. Managed by commands in the `mapping` area.

Project-level operations — import, subform composition, registry management, and publishing — are managed by the `project` area.

---

## 6. Global Chrome

### 6.1 Header Bar

Fixed height. Contains the application mark with the current Formspec version and definition status badge, six primary navigation tabs (Editor, Logic, Data, Theme, Mapping, Preview), a global search field with keyboard shortcut indicator, and action buttons (Preview, Publish, user avatar).

**Publish** opens a dialog requesting a semver version string and optional release summary. On confirmation, dispatches `project.publish`, which freezes the current state as an immutable snapshot, transitions the definition status from draft to active, and generates a changelog. The Publish button is disabled when the definition status is already active or retired.

**Undo/Redo** buttons (or ⌘Z / ⌘⇧Z) reverse or replay the most recent command dispatch. The `project.import` command clears undo history as a side effect; all other commands are fully reversible.

### 6.2 Blueprint Sidebar

Fixed width, left-docked, persistent across all tabs. Contains navigable sections, each corresponding to a command area or read-only reference. The section list includes: Structure, Component Tree, Theme, Screener, Variables, Data Sources, Option Sets, Mappings, Migrations, FEL Reference, and Settings.

Each section displays its entity count as a badge. Clicking a section replaces the sidebar content with that section's navigable tree or list. Selection within the sidebar updates the Properties panel.

### 6.3 Properties Panel

Fixed width, right-docked. Context-sensitive inspector driven by the current selection. The panel's content adapts to the selected entity type: definition item, component node, theme selector, mapping rule, screener field, variable, instance, option set, or FEL function.

The panel organizes content into collapsible labeled sections. For a definition field, these sections are: Identity, Field Config, Labels, Presentation, Behavior Rules, Validation Shapes, Options, Extensions, and Repeat Config. Each section is independently collapsible, defaulting to expanded on first selection and remembering collapse state thereafter.

All editable properties in the Properties panel dispatch commands on change. Text fields dispatch on blur or Enter. Toggles and dropdowns dispatch immediately. The panel never holds unsaved local state.

### 6.4 Status Bar

Fixed height. Displays Formspec version, definition status with lifecycle indicator, active presentation mode, default currency, density setting, and aggregate counts across all artifact types.

---

## 7. Editor Tab

### 7.1 Purpose

The primary structural authoring workspace. Analysts add, configure, reorder, and nest form items here. Every structural change dispatches commands in the `definition-items` area, with automatic component tree rebuilds as a side effect.

### 7.2 Page Navigation

The editor respects the definition's `formPresentation.pageMode`. In wizard mode, a page tab strip shows all pages as labeled tabs. Clicking a tab filters the canvas to that page's items. Pages can be added (`definition.addPage`), deleted (`definition.deletePage`), and reordered (`definition.reorderPage`) via context menu on the tab strip. Deleting a page moves its items to the preceding page. In single-page mode, the tab strip is hidden and all items render in document order.

### 7.3 Block Rendering

Three block types render on the canvas.

**Group Blocks** render as section headers with heavy bottom borders, uppercase monospaced labels, and inline metadata pills (repeat config, layout flow, style emphasis, alternative labels). Groups can be collapsed to hide their children. Clicking a group header selects it in the Properties panel and toggles collapse.

**Field Blocks** render as cards with a colored data-type icon badge, the field label at primary weight, contextual pills (max three visible, with overflow indicator), a metadata line (type, key, semantic type, prefix/suffix), and an optional hint line. Below the main content, a bind summary strip shows active visibility, calculation, and validation status. Nested fields (children of a field item) indent with dashed guide lines.

**Display Blocks** render with a left accent border, a "Display" label, widget hint and emphasis pills, and the display content text.

### 7.4 Drag and Drop

All blocks have drag handles that appear on hover (not permanently visible). Dragging a block shows a 3px blue drop indicator at valid insertion points. Dropping dispatches `definition.moveItem` with the source path, target parent path, and target index. The component tree rebuilds automatically.

Within the Blueprint Structure tree, items are also draggable with the same interaction model. Tree-level drags dispatch `definition.reorderItem` for sibling moves or `definition.moveItem` for cross-parent moves.

### 7.5 Context Menu

Right-clicking a block opens a context menu with: Edit (selects in Properties), Duplicate (`definition.duplicateItem`), Delete (`definition.deleteItem`), Move Up / Move Down (`definition.reorderItem`), Add Child (for groups), and Wrap in Group (creates a new group containing the selected item). For fields with inline options, the menu includes "Promote to Option Set" (`definition.promoteToOptionSet`).

### 7.6 Inline Creation

The "Add Item" button at the bottom of the canvas opens a type picker (Field, Group, Display). Selecting a type dispatches `definition.addItem` with the chosen type. For fields, a secondary picker offers data type selection (string, integer, boolean, date, choice, money, attachment, etc.), which sets the `dataType` property on the dispatched command. The new item appears at the end of the current page and is immediately selected in the Properties panel for configuration.

Groups can also be added with a "Wrap in Group" action that dispatches `definition.addItem` with type "group" and then `definition.moveItem` to relocate selected items into the new group.

### 7.7 Properties Panel Behaviors (Editor Context)

When a definition item is selected, the Properties panel dispatches the following commands based on user input:

Renaming the key field dispatches `definition.renameItem`, which cascades to all binds, shapes, variables, and component references. Changing the data type dispatches `definition.setFieldDataType`. Editing bind properties (required, relevant, calculate, constraint, readonly) dispatches `definition.setBind`. Modifying presentation hints dispatches `definition.setItemProperty` with dotted paths. Toggling the repeatable flag dispatches `definition.setItemProperty` and triggers a component tree rebuild. Setting options dispatches `definition.setFieldOptions`. Extensions dispatch `definition.setItemExtension`.

The Duplicate button dispatches `definition.duplicateItem`. The Delete button dispatches `definition.deleteItem` with a confirmation dialog when the item has children or is referenced by binds/shapes.

---

## 8. Logic Tab

### 8.1 Purpose

A dedicated workspace for viewing and editing all behavioral declarations: binds, shapes, and variables. While the Editor tab shows logic inline on blocks, the Logic tab provides a filterable, sortable, dependency-aware view of the entire behavioral layer.

### 8.2 Filter Bar

Horizontal toggle buttons filter the bind list by type (all, required, relevant, calculate, constraint, readonly). Each button displays its count. Filtering is client-side and instantaneous.

### 8.3 Variables Section

Displays all computed variables as cards showing the `@name`, FEL expression, scope, and extracted field dependencies. Adding a variable dispatches `definition.addVariable`. Editing a variable's expression or scope dispatches `definition.setVariable`. Deleting dispatches `definition.deleteVariable`. Variables that form circular dependencies are flagged with an error indicator; the dispatch layer rejects circular graphs.

### 8.4 Binds Section

Each bind renders as a collapsible card. The collapsed state shows the target field label, path, active bind type pills, and a single-line expression preview. The expanded state shows each bind property as a colored BindCard (required=blue, relevant=violet, calculate=green, constraint=amber, readonly=grey) with both humanized and raw FEL. Bind overrides (whitespace, excludedValue, nonRelevantBehavior, disabledDisplay, default) render in a dedicated overrides section. A dependency graph section shows which fields and variables the bind reads from, resolved to human-readable labels.

Clicking "Add Bind" opens a field picker, then dispatches `definition.setBind` with an empty properties object for the selected path. Editing any bind property dispatches `definition.setBind` with the updated properties. Inline FEL editing uses a text field that dispatches on blur or Enter; future iterations will add autocomplete and syntax validation.

### 8.5 Shapes Section

Each shape renders as a card with severity-colored border, code, target (resolved to field label, with `#` shown as "form-level"), constraint expression, composition operators, and metadata. Adding a shape dispatches `definition.addShape`. Editing a property dispatches `definition.setShapeProperty`. Configuring composition (AND/OR/XOR/NOT) dispatches `definition.setShapeComposition`. Renaming dispatches `definition.renameShape`. Deleting dispatches `definition.deleteShape`.

---

## 9. Data Tab

Four sub-tabs, each serving a distinct data management function.

### 9.1 Response Schema

A table-format view derived from the item tree showing every field's key, JSON type, label, and behavioral flags (required, calculated, conditional). Groups show nesting through indentation. Repeatable groups display as `array<object>`. A callout explains the definition's `nonRelevantBehavior` and its effect on the response shape. This view is read-only — structural changes are made in the Editor tab.

### 9.2 Data Sources

Inspector cards for each secondary instance. Displays `@instance('name')` reference syntax, description, source URL template, static/readonly flags, schema, and fallback data. A "Referenced By" section scans all FEL expressions to show which binds and variables consume each instance.

Adding an instance dispatches `definition.addInstance`. Editing a property dispatches `definition.setInstance`. Renaming dispatches `definition.renameInstance`, which cascades to all `@instance()` references in FEL. Deleting dispatches `definition.deleteInstance`.

### 9.3 Option Sets

Cards for each named option set showing inline options (as a table with add/remove/reorder) or external source configuration (URL, valueField, labelField). A "Used By" section shows which fields reference each set.

Creating or updating dispatches `definition.setOptionSet`. Deleting dispatches `definition.deleteOptionSet`. The "Promote to Option Set" action (available from the Editor context menu) dispatches `definition.promoteToOptionSet`, which extracts inline options from a field and replaces them with a named reference.

### 9.4 Test Response

A split-pane interactive environment. The left column lists every field with type-appropriate input controls. Calculated fields show a "ƒx auto" indicator. The right column renders live response JSON with syntax highlighting. Relevance is evaluated against the current mock values — toggling a boolean that governs a `relevant` bind causes dependent fields to appear or disappear from the response per the definition's `nonRelevantBehavior`.

This view does not dispatch commands. It is a stateless preview computed from the current definition and user-entered mock values. A "Copy JSON" button copies the rendered response to the clipboard.

---

## 10. Theme Tab

### 10.1 Purpose

A dedicated workspace for the presentation cascade. The theme controls how fields and groups appear without altering behavioral semantics. Three cascade levels apply in order: form-wide defaults, selector-based overrides, and per-item overrides. Higher levels win.

### 10.2 Token Editor

A key-value grid for design tokens (colors, spacing, radii, fonts). Adding or editing a token dispatches `theme.setToken`. Replacing all tokens dispatches `theme.setTokens`. Tokens use dot-delimited paths (e.g., `color.primary`, `spacing.md`). Token values can reference other tokens via `$token.path` syntax. A color picker appears for values that match hex/rgb patterns.

### 10.3 Defaults Editor

Form-wide presentation defaults: label position (top/start/hidden), density (compact/comfortable/spacious), page mode (single/wizard/tabs), default currency. Each change dispatches `theme.setDefaults`. Setting page mode dispatches `definition.setFormPresentation` with a component tree rebuild side effect.

### 10.4 Selectors

An ordered list of selector rules, each with match criteria (item type, data type) and applied properties (widgetHint, layout, styleHints). Selectors are evaluated in declaration order; the first match applies. Adding dispatches `theme.addSelector`. Editing dispatches `theme.setSelector`. Reordering dispatches `theme.reorderSelector`. Deleting dispatches `theme.deleteSelector`.

The selector list renders as draggable cards. Each card shows its match criteria as pills and its applied properties as a compact property grid. A "Test" button highlights which items in the definition currently match each selector.

### 10.5 Per-Item Overrides

When an item is selected (via the Editor or Blueprint), the Theme tab shows its effective presentation — the resolved cascade from defaults through selectors to any per-item overrides. Each property shows its source level (default/selector/override) with a visual indicator. Editing a property at the override level dispatches `theme.setItemOverride`. Clearing an override dispatches `theme.deleteItemOverride` and falls back to the selector or default value. Widget-specific configuration dispatches `theme.setItemWidgetConfig`. Accessibility overrides dispatch `theme.setItemAccessibility`. Style overrides dispatch `theme.setItemStyle`.

### 10.6 Page Layouts

A visual grid editor for page-level layouts. Each page can contain named grid regions with column spans. Adding a page dispatches `theme.addPage`. Adding a region dispatches `theme.addRegion`. Regions can be reordered, resized (by adjusting span and start), renamed, and deleted. The grid is visualized as a 12-column overlay.

### 10.7 Breakpoints

Named viewport breakpoints (e.g., sm: 576px, md: 768px, lg: 1024px). Adding or editing dispatches `theme.setBreakpoint`. These breakpoints are shared with the Component Document and govern responsive prop overrides on component nodes.

---

## 11. Mapping Tab

### 11.1 Purpose

Configures how form response data maps to external systems. A mapping document defines source-to-target field transformations, output format adapters, and nested rules for repeatable groups.

### 11.2 Document Configuration

Top-level properties: direction (forward/reverse), definition reference, target schema. Each dispatches `mapping.setProperty` or `mapping.setTargetSchema`.

### 11.3 Rule Editor

An ordered list of mapping rules, each specifying a source path, target path, and transform type (preserve, expression, drop). Adding dispatches `mapping.addRule`. Editing dispatches `mapping.setRule`. Reordering dispatches `mapping.reorderRule`. Deleting dispatches `mapping.deleteRule`.

Rules render as draggable cards with source and target paths connected by an arrow, a transform type badge, and an optional FEL expression for computed transforms. For repeatable groups, rules can contain nested inner rules (`mapping.addInnerRule`, `mapping.setInnerRule`, `mapping.deleteInnerRule`, `mapping.reorderInnerRule`).

An "Auto-Generate" button dispatches `mapping.autoGenerateRules`, which creates rules for all fields in the definition (optionally scoped to a subtree). The analyst can then edit individual rules to customize the mapping.

### 11.4 Output Adapter

Configures the serialization format (JSON, XML, CSV) and format-specific options. Dispatches `mapping.setAdapter`.

### 11.5 Preview

A split-pane view showing sample input data on the left and transformed output on the right. The analyst enters or pastes sample data, clicks "Run," and sees the mapping result. Dispatches `mapping.preview`, which executes rules without mutating state and returns the transformed output, diagnostics, and matched rules. Direction can be toggled between forward and reverse.

---

## 12. Preview Tab

### 12.1 Purpose

A respondent-facing form preview that renders the Component Document's tree recursively. This is how the form will appear to the person filling it out.

### 12.2 Viewport Switcher

Toggle between desktop (full width), tablet (768px), and mobile (375px) viewports. The preview frame animates its width transition. Breakpoints defined in the component document govern which responsive overrides apply at each viewport size.

### 12.3 Component Rendering

The Component Document's tree is walked recursively. Each of the 33 built-in component types renders an appropriate visual representation. Layout components (Wizard, Page, Card, Grid, Stack, Columns, Tabs, Accordion, Collapsible, ConditionalGroup, Spacer) produce structural containers. Input components (TextInput, NumberInput, DatePicker, Select, CheckboxGroup, Toggle, FileUpload, MoneyInput, RadioGroup, Slider, Rating, Signature) produce widget-specific placeholders with labels, hints, and required indicators pulled from the definition. Display components (Heading, Text, Divider, Alert, Badge, ProgressBar, Summary, ValidationSummary, DataTable, SubmitButton) render with type-appropriate treatments.

### 12.4 Wizard Navigation

In wizard mode, the preview shows step indicators, back/continue buttons, and a submit button on the final step. Step navigation is functional — clicking Continue advances to the next Page child of the Wizard. Non-relevant pages (governed by bind `relevant` expressions) are skipped.

### 12.5 Live Editing (Future)

A planned enhancement where clicking a field in the Preview selects it in the Properties panel, enabling inline property editing without switching to the Editor tab. Component-level changes (changing a TextInput to a RadioGroup) would dispatch `component.setFieldWidget`.

---

## 13. Component Tree Workspace

### 13.1 Blueprint Section

The Component Tree section in the Blueprint sidebar shows a flattened, indented view of every node in the Tier 3 tree. Nodes are color-coded by category: blue for layout, green for input, amber for display, violet for container. Each node shows its component type, bind key (for bound nodes), title (for layout nodes), and a conditional indicator when `when` is present.

### 13.2 Node Operations

Selecting a node updates the Properties panel with all of its props, responsive overrides, style, and accessibility properties. The following operations are available:

Adding a child node dispatches `component.addNode` with the selected node as parent. Deleting dispatches `component.deleteNode`. Moving dispatches `component.moveNode`. Reordering dispatches `component.reorderNode`. Duplicating dispatches `component.duplicateNode`. Wrapping a node in a container dispatches `component.wrapNode` (e.g., wrapping a TextInput in a Card). Unwrapping removes a container and promotes its children via `component.unwrapNode`.

Changing a node's component type dispatches `component.setNodeType`. Setting properties dispatches `component.setNodeProperty`. Style changes dispatch `component.setNodeStyle`. Accessibility changes dispatch `component.setNodeAccessibility`. Responsive overrides dispatch `component.setResponsiveOverride` with the breakpoint name and patch object. Array-valued props (like DataTable columns or Summary items) are modified via `component.spliceArrayProp`.

### 13.3 Custom Components

The registry of custom component templates is managed through `component.registerCustom`, `component.updateCustom`, `component.deleteCustom`, and `component.renameCustom`. Custom components define parameter lists and a template subtree that is instantiated with `{param}` interpolation. The Blueprint shows registered custom components with their parameter lists.

### 13.4 Document Properties

Component-level breakpoints dispatch `component.setBreakpoint`. Tier 3 tokens dispatch `component.setToken`. Top-level document properties dispatch `component.setDocumentProperty`. Wizard-mode configuration dispatches `component.setWizardProperty`.

---

## 14. Screener Workspace

### 14.1 Blueprint Section

The Screener section shows screening fields and routing rules. Screener items are not part of the form's response data; they exist solely for pre-qualification routing.

### 14.2 Operations

Enabling or disabling the screener dispatches `definition.setScreener`. Adding a screening field dispatches `definition.addScreenerItem`. Deleting dispatches `definition.deleteScreenerItem`. Setting bind properties on screener fields dispatches `definition.setScreenerBind`.

Routes are ordered rules evaluated top-to-bottom; first match wins. Adding dispatches `definition.addRoute`. Editing a route's condition, target, or label dispatches `definition.setRouteProperty`. Reordering dispatches `definition.reorderRoute`. Deleting dispatches `definition.deleteRoute`. A route with condition `true` serves as the default fallback and should be placed last.

---

## 15. Migrations Workspace

### 15.1 Blueprint Section

The Migrations section shows version-to-version field mapping descriptors. Each migration entry describes how to transform responses from a prior definition version into the current version's structure.

### 15.2 Operations

Adding a migration dispatches `definition.addMigration` with a source version. Setting properties dispatches `definition.setMigrationProperty`. Deleting dispatches `definition.deleteMigration`.

Within a migration, field mapping rules are managed via `definition.addFieldMapRule`, `definition.setFieldMapRule`, and `definition.deleteFieldMapRule`. Each rule specifies a source path, target path, and transform type (preserve, drop, or expression). Expression transforms include a FEL expression for value computation. Default values for fields that exist only in the new version are managed via `definition.setMigrationDefaults`.

---

## 16. FEL Reference

### 16.1 Blueprint Section

A browsable catalog of all 48 built-in FEL functions organized into nine collapsible categories: Aggregate, String, Numeric, Date, Logical, Type, Money, MIP, and Repeat. Each function entry shows the function name, typed signature, and a one-line description.

### 16.2 Properties Panel

Selecting a function displays its full detail: name, signature, description, category, and a contextual usage example. This reference is read-only; it does not dispatch commands.

### 16.3 Expression Builder (Future)

A planned enhancement that provides autocomplete suggestions, field reference insertion (`$fieldKey`), variable reference insertion (`@varName`), function insertion with parameter hints, and real-time syntax validation. The builder would appear as an inline editor wherever FEL expressions are authored (bind properties, shape constraints, variable expressions, migration transforms, mapping rules). Autocomplete would be context-aware — showing only fields in scope for repeat contexts, only valid operators for the current type, and only functions compatible with the expected return type.

---

## 17. Settings Workspace

### 17.1 Blueprint Section

The Settings section displays and edits all document-level metadata and configuration. Content is organized into subsections.

### 17.2 Definition Metadata

Identity fields ($formspec, url, version, versionAlgorithm, status, name, date) and description. Editing dispatches `definition.setDefinitionProperty`.

### 17.3 Presentation Defaults

Form-wide presentation hints (pageMode, labelPosition, density, defaultCurrency). Editing dispatches `definition.setFormPresentation`, which triggers a component tree rebuild when pageMode changes.

### 17.4 Behavioral Defaults

The `nonRelevantBehavior` setting (remove, empty, keep). Dispatches `definition.setDefinitionProperty`.

### 17.5 Lineage

The `derivedFrom` reference (parent definition URL and version). Dispatches `definition.setDefinitionProperty`.

### 17.6 Extensions

Definition-level extensions (x-prefixed). Editing dispatches `definition.setDefinitionProperty`. The UI renders extensions as a key-value editor with JSON value input.

### 17.7 Group References (Subforms)

Groups can reference external definitions via `$ref` for modular composition. Setting a group's ref dispatches `definition.setGroupRef` with the reference URL and optional key prefix. Importing a subform into a target group dispatches `project.importSubform`.

### 17.8 Extension Registries

The project can load external extension registries that provide additional validation rules, custom components, or domain-specific metadata. Loading dispatches `project.loadRegistry`. Removing dispatches `project.removeRegistry`.

---

## 18. Project Operations

### 18.1 Import

Replacing one or more project artifacts dispatches `project.import` with the new document(s). This clears undo history as a side effect. The UI presents an import dialog accepting JSON files for definition, component, theme, and/or mapping documents. Validation runs before dispatch; invalid documents are rejected with diagnostic messages.

### 18.2 Publish

Publishing a version dispatches `project.publish` with a semver version string and optional summary. This transitions the definition status to active, freezes the content, and generates a changelog. Published definitions cannot be modified — any subsequent changes require a new version.

### 18.3 Subform Composition

Importing items from an external definition dispatches `project.importSubform`. The analyst selects a target group, provides the external definition, and optionally specifies a key prefix to avoid collisions. Imported items, binds, and variables are merged into the current definition.

---

## 19. Design System

### 19.1 Typography

**Primary UI:** Space Grotesk (400/500/600/700) for headings, labels, body text, navigation, and buttons. **Data/Logic:** JetBrains Mono (400/500/600) for item keys, FEL expressions, bind paths, variable names, option values, JSON output, and all monospaced metadata. The minimum font size across the application is 11px. Primary field labels render at 15px. Properties panel headers at 15px. Blueprint nav items at 13px. Metadata and secondary labels at 12px. Pills at 11–12px.

### 19.2 Color Palette

Ink `#0F172A`, Background `#F8FAFC`, Surface `#FFFFFF`, Border `#E2E8F0`, Accent `#2563EB`, Logic `#7C3AED`, Error `#DC2626`, Muted `#64748B`, Subtle `#F1F5F9`, Green `#059669`, Amber `#D97706`. All colors achieve WCAG AA contrast compliance against the `#F8FAFC` background. The muted text color achieves a 5.2:1 contrast ratio.

### 19.3 Structural Rules

All elements use 1px solid `#E2E8F0` borders. Corner radius is 3–4px. No soft shadows. Bind type indicators use 3px colored left-borders. Drop indicators render as 2–3px accent-colored lines during drag. Drag handles appear on hover only. Selected items show a 2px left-border and 8% opacity tinted background.

### 19.4 Pill System

Contextual metadata pills appear on blocks and in the Properties panel. Each pill has a category color, a 10% opacity background fill, and a 20% opacity border. Maximum three pills visible on a block; overflow shows a "+N" indicator that expands on hover. Small pills (11px) for inline metadata. Standard pills (12px) for standalone badges.

---

## 20. Interaction Patterns

### 20.1 Selection Model

A single global selection state drives the Properties panel. Selectable entities: definition items, component nodes, theme selectors, mapping rules, screener fields, variables, instances, option sets, and FEL functions. Selection persists across tab switches — selecting a field in the Editor and switching to the Logic tab maintains the selection if the field has binds.

### 20.2 Command Dispatch

All mutations route through `Project.dispatch()`. The UI layer constructs command payloads from user input and dispatches them. The dispatch layer validates, executes, records for undo, and emits change events that trigger UI updates. Commands that modify the definition's item tree trigger `rebuildComponentTree` as a side effect. The `project.import` command triggers `clearHistory`.

### 20.3 Undo / Redo

Every dispatched command (except `project.import`) is recorded in a linear history. ⌘Z undoes the most recent command. ⌘⇧Z redoes. The undo stack has no practical depth limit. Undo/redo state is reflected in the header bar with button enable/disable states.

### 20.4 Cascading Updates

Renaming an item key (`definition.renameItem`) cascades to all bind paths, shape targets, variable expressions, component bind references, and mapping source/target paths via FEL rewriting. Deleting an item (`definition.deleteItem`) cascades to remove orphaned binds and component references. Renaming an instance (`definition.renameInstance`) rewrites `@instance()` references. Renaming a shape (`definition.renameShape`) updates composition references. These cascades are handled by the dispatch layer, not the UI.

### 20.5 Drag and Drop

Three surfaces support drag-to-reorder: Editor blocks, Blueprint Structure tree nodes, and Blueprint Component Tree nodes. Drag handles appear on hover. During drag, the source fades to 40% opacity. A blue indicator line appears at valid drop targets. Drop dispatches the appropriate move or reorder command. Invalid drops (e.g., moving a field outside a group in a way that violates tree constraints) are rejected by the command layer with no visual effect.

### 20.6 Keyboard Shortcuts

⌘K opens global search. ⌘Z / ⌘⇧Z for undo/redo. ⌘S dispatches save (when connected to a persistence layer). Delete/Backspace on a selected item dispatches delete with confirmation. Arrow keys navigate the Blueprint tree. Enter expands/collapses tree nodes. Tab cycles between Editor canvas, Blueprint, and Properties panel.

---

## 21. Known Gaps and Future Work

### 21.1 Expression Builder

The highest-priority missing feature. Non-technical analysts need guided FEL authoring with autocomplete, field reference insertion, function parameter hints, type checking, and real-time syntax validation. Currently, FEL expressions are authored as raw text.

### 21.2 Theme Editor

The Theme tab is specified but not yet implemented in the visual prototype. The command layer is complete; the UI surface needs to be built.

### 21.3 Mapping Editor

The Mapping tab is specified but not yet implemented. The command layer supports the full mapping document lifecycle; the UI surface needs to be built.

### 21.4 Collaboration

No multi-user editing, commenting, change tracking, or approval workflows. The definition status lifecycle (draft → active → retired) is displayed but not enforced through the UI.

### 21.5 Mobile Adaptation

The current implementation is desktop-only. The original product vision described a mobile-first interface with the Blueprint as a full-screen overlay, the Editor as a vertical block list, and the Properties panel as a bottom sheet. This requires a distinct layout strategy.

### 21.6 Persistence

The current prototype is entirely in-memory. Integration with a persistence layer (file system, API, or database) requires connecting the dispatch system's change events to a save mechanism. The `project.import` and `project.publish` commands provide the serialization boundaries.

### 21.7 Validation Diagnostics

The command layer validates structural constraints, but the UI does not yet surface validation diagnostics (orphaned bind paths, missing required fields in published definitions, circular variable dependencies) as a persistent indicator. A planned "Diagnostics" panel would aggregate all warnings and errors across all artifacts.

---

*End of document.*
