# Editor / Layout Workspace Split

**Date:** 2026-03-27
**Status:** Draft
**Scope:** `packages/formspec-studio/` only — no external package changes

## Problem

The Studio Editor tab mixes Tier 1 (Definition) and Tier 3 (Component) concerns. It renders items by walking the component tree, shows layout containers (Card, Grid, Page) as LayoutBlocks, includes page navigation tabs for wizard/tabs mode, and supports wrap-in-Card/Grid operations. This creates bugs (Page nodes appearing as layout blocks on the Editor canvas) and confuses two distinct authoring intents: shaping the data structure vs arranging the visual layout.

The Layout tab (currently `PagesTab`) already manages page structure — mode selection, page cards, grid region editing, field assignment — but lacks the visual canvas and drag-and-drop that the Editor provides.

## Design Principles

The split follows the Formspec specification's three-tier architecture (Core S2.3):

- **Editor tab = Tier 1 Definition** — Structure Layer (what data is collected) + Behavior Layer (how data behaves). Answers: "what items exist, what types are they, how do they validate?"
- **Layout tab = Tier 2 Theme + Tier 3 Component** — Presentation Layer (how data is displayed). Answers: "where do items go, what do they look like, how is the form paginated?"

The spec mandates this separation as an "architectural invariant" (Core S2.3, line 627). Definition item array order is data-structural. Component tree children order is visual. Binding is by key, not position (Component S4.1). These are independent by design.

## The New Editor Tab — Definition Tree Editor

### Purpose

Pure Tier 1 data-structure editor. Shows what data the form collects and how it behaves. Derives its view entirely from `definition.items` — never reads the component tree.

### What It Shows

A tree view of `definition.items`:

- **Fields** — compact rows showing key, label, dataType badge
- **Groups** — collapsible tree nodes with indented children
- **Display items** — rows showing key, label, widgetHint badge (advisory)
- **Bind indicators** — small pills/icons for required, calculated, conditional, readonly, constrained
- No pages, no layout containers, no component tree structure

### Interactions

- Click item → select, open definition properties panel
- `+ Add Item` → palette (fields, groups, display — no layout category)
- Drag-to-reorder within tree → reorders `definition.items` array (data structure order)
- Right-click → delete, duplicate, move up/down, wrap in group
- Multi-select with Cmd+click, Shift+click (same patterns as current Editor)

**Editor always shows the full item tree** regardless of `formPresentation.pageMode`. Even in wizard or tabs mode, the Editor displays all items across all groups — there is no page-filtered view. This is a deliberate UX change: the current Editor shows one page at a time in wizard mode, but since pages are a Layout concern, the Editor presents the complete data structure.

### Properties Panel (Right Sidebar)

Definition and behavior properties only:

| Section | Properties |
|---------|-----------|
| Identity | key, label, description, hint, type, dataType |
| Field config | initialValue, prePopulate, semanticType, currency, precision, prefix, suffix |
| Options | options (inline), optionSet, choicesFrom |
| Group config | repeatable, minRepeat, maxRepeat |
| Display content | label (body text), advisory `presentation.widgetHint` (read-only annotation showing current hint) |
| Binds | required, calculate, relevant, readonly, constraint, constraintMessage, default, whitespace, excludedValue |
| Advisory hints | `presentation.layout.page` (shown as annotation — "assigned to page X") |

Properties NOT shown (moved to Layout): widget override, style, CSS classes, grid span/start, responsive breakpoints, appearance/label-position overrides, component `when`.

### What Gets Deleted from Editor

- `render-tree-nodes.tsx` — component tree rendering
- `LayoutBlock.tsx` — layout container blocks
- `GroupTabs.tsx` — page navigation tabs
- `FieldBlock.tsx`, `GroupBlock.tsx`, `DisplayBlock.tsx` — visual card blocks (replaced with compact tree rows)
- `dnd/` directory — component-tree-order DnD (replaced with definition-order DnD)
- `DragHandle.tsx` — extracted to `components/ui/` first (shared with Layout)
- `canvas-operations.ts`, `block-utils.ts` — canvas utilities
- `flattenStructural` and page-aware filtering — no longer needed
- `properties/AppearanceSection.tsx` — moves to Layout
- `properties/LayoutProperties.tsx` — moves to Layout
- `properties/WidgetHintSection.tsx` — split: the advisory `widgetHint` annotation stays in Editor (read-only in `ContentSection`); the actual widget override selector moves to Layout as `WidgetSection.tsx` (queries component tree, sets component type)

## The New Layout Tab — Visual Form Builder

### Purpose

Tier 2+3 visual builder. Shows how the form looks and is organized. Built from scratch — not migrated from the current Editor canvas. Absorbs all functionality from the current `PagesTab`.

### What It Shows

The component tree rendered as a visual canvas:

- **Page nodes** — first-class visible sections with titles, rendered as large section blocks
- **Layout containers** — Card, Grid, Panel, Columns as dashed-border wrappers with children
- **Field blocks** — bound items showing label and widget type
- **Display blocks** — display items showing label and component type (Heading, Text, Divider)
- **Page navigation** — wizard step bar or tab strip depending on `pageMode`
- **Mode selector** — single / wizard / tabs (absorbed from current PagesTab)
- **Unassigned items tray** — definition items not yet placed in the component tree

### Unassigned Items Tray

The tray shows definition items that exist but are not bound in the component tree. Per Component S4.5, required unbound items MUST be rendered at runtime; non-required MAY be omitted. The tray distinguishes between these:

- **Required unassigned** — highlighted, since the rendered form will auto-append them as fallback inputs
- **Non-required unassigned** — dimmed, since they may not appear in the rendered form

Dragging an item from the tray into the canvas creates a component node with `bind` set to the item's key.

### Interactions

- Drag-and-drop reorder within component tree (visual order, not data order)
- Drag from unassigned tray onto pages/containers
- Right-click → wrap in Card/Grid/Panel/Stack/Collapsible, unwrap, move to page, delete from tree
- Add Page button, page reordering, page deletion
- Grid region editing (span/start within pages)

### Properties Panel (Right Sidebar)

Presentation properties only:

| Section | Properties |
|---------|-----------|
| Widget | component type selector (actual override, not advisory hint) |
| Appearance | style overrides, CSS classes, labelPosition override |
| Layout | grid span, start, responsive breakpoint overrides |
| Container | direction, gap, columns (for Grid/Stack/Columns containers) |
| Conditional | component `when` expression (visual-only — does NOT clear data) |
| Accessibility | component-level a11y overrides |

Properties NOT shown (stay in Editor): key, label, dataType, options, binds, repeat config.

### Cross-Tier Write: pageMode

The Layout tab's mode selector writes `definition.formPresentation.pageMode` to the Definition document. This is a cross-tier write — a presentation control modifying a Tier 1 property. This is architecturally defensible because `pageMode` is explicitly advisory (Core S4.1.1) and exists solely to control pagination behavior. The Layout tab also writes `formPresentation.showProgress`, `allowSkip`, `defaultTab`, `tabPosition` — all mode-dependent behavioral settings that are only meaningful when `pageMode` is non-`single`.

### Component `when` vs Bind `relevant`

The Layout tab exposes component `when` expressions. The Editor tab exposes bind `relevant` expressions. Per Component S8.2, these have fundamentally different data-model semantics:

- **`when` (Layout)** — visual only. Hidden component's bound data is preserved in the instance.
- **`relevant` (Editor)** — affects data model. Non-relevant items MAY be removed from the instance per `nonRelevantBehavior`.

The Layout properties panel should clearly label `when` as "Visual Condition (data preserved)" to prevent confusion with `relevant`.

## Selection Behavior Across Tabs

Each tab maintains independent selection state. Switching tabs does not clear or transfer selection.

- **Editor selection** — definition item paths (e.g., `"contacts.email"`)
- **Layout selection** — definition paths for bound items OR layout node IDs (e.g., `"__node:abc123"`)

These are separate selection scopes within `SelectionProvider`. When Editor is active, only Editor's selection drives the properties panel. When Layout is active, only Layout's selection drives its properties panel. Selecting an item in Editor does not highlight it in Layout, and vice versa.

The Blueprint sidebar sections (Structure tree, Component Tree) interact with the selection of the currently active tab. The **Component Tree** sidebar section is hidden when the Editor tab is active, since the Editor has no concept of component tree nodes.

## Context Menu Actions Split

| Action | Editor | Layout |
|--------|--------|--------|
| Delete | Yes | Yes |
| Duplicate | Yes | Yes |
| Move Up / Move Down | Yes (definition order) | Yes (component tree order) |
| Wrap in Group | Yes (creates group item) | No |
| Wrap in Card/Stack/Grid/Panel/Collapsible | No | Yes |
| Unwrap | No | Yes |
| Move to Page | No | Yes |
| Add Item | Yes | Yes (also places in tree) |

## Atomic Add-from-Layout

When adding an item from the Layout tab's palette, the operation dispatches as a single undo step using `project.core.dispatch([...commands])` (batch array dispatch, same mechanism as `project.addPage`). The batch contains:

1. `definition.addItem` — creates the item in the definition
2. `pages.assignItem` — places the new item's component node in the target page/container

Undoing reverts both operations. This requires no new handler — the existing batch dispatch API already supports this pattern.

## Shell & Routing Changes

### Tab Bar

No tab additions or removals. Same seven tabs: Editor, Logic, Data, Layout, Theme, Mapping, Preview.

Update the `TABS` help text in `Header.tsx`:

- **Editor**: "Definition tree — items, types, and data binds" (was: "Visual form builder canvas for adding and arranging items")
- **Layout**: "Visual form builder — pages, layout containers, and widget selection" (was: "Multi-page form structure — wizard, tabs, and page grid layouts")

### WORKSPACES Map

```typescript
const WORKSPACES: Record<string, React.FC> = {
  Editor: DefinitionTreeEditor,  // NEW — replaces EditorCanvas
  Logic: LogicTab,
  Data: DataTab,
  Layout: LayoutCanvas,           // NEW — replaces PagesTab
  Theme: ThemeTab,
  Mapping: MappingTab,
  Preview: PreviewTab,
};
```

### Shared State

| Hook | Editor | Layout | Notes |
|------|--------|--------|-------|
| `useDefinition` | Yes | Yes | Shared — both read definition |
| `useComponent` | No | Yes | Layout only — Editor never reads component tree |
| `useSelection` | Yes | Yes | Shared provider, but independent per-tab selection scopes (see Selection Behavior) |
| `useActiveGroup` | No | Yes | Layout only — page navigation is a Layout concern |
| `useProject` | Yes | Yes | Shared — both dispatch commands |
| `useCanvasTargets` | Yes | Yes | Per-tab target registries — targets rebuild on tab switch to avoid cross-tab DOM conflicts |
| `useTheme` | No | Yes | Layout only — theme cascade resolution |
| `usePageStructure` | No | Yes | Layout only — from current PagesTab |

### Properties Panel in Shell

The right sidebar currently renders `ItemProperties` for all workspaces. In the new design:

- When **Editor** is active → render `DefinitionProperties` (Tier 1 props)
- When **Layout** is active → render `ComponentProperties` (Tier 2/3 props)
- When other tabs are active → keep current behavior (or hide panel)

The Shell routes based on `activeTab`, not item selection.

### Item Addition from Both Tabs

Items can be created from either tab:

- **Editor** `+ Add Item` → creates a definition item. Appears as unassigned in Layout until placed.
- **Layout** add-from-palette → creates a definition item AND places it in the component tree in one operation (dispatches `definition.addItem` + `pages.assignItem` atomically, same as `project.addPage` does today).

## File Structure

```
workspaces/
  editor/                          # REWRITTEN — definition tree editor
    DefinitionTreeEditor.tsx        # Main — tree view of definition.items
    ItemRow.tsx                     # Compact tree row for field/group/display
    GroupNode.tsx                   # Collapsible group with children
    AddItemPalette.tsx              # Reuse existing, minus layout category
    EditorContextMenu.tsx           # Simplified — no wrap/unwrap, no layout actions
    dnd/                            # Definition-order DnD (reorders items array)
    properties/
      DefinitionProperties.tsx      # Properties panel root
      FieldConfigSection.tsx        # Stays — strip any presentation props
      OptionsSection.tsx            # Stays as-is
      GroupConfigSection.tsx         # Stays as-is
      ContentSection.tsx            # Stays — strip widget override
      BindsInlineSection.tsx        # Extracted from SelectedItemProperties — inline bind editing for selected item
      MultiSelectSummary.tsx        # Stays — batch delete/duplicate
      shared.tsx                    # Stays — PropInput, AddPlaceholder

  layout/                           # NEW — replaces pages/
    LayoutCanvas.tsx                # Main — component tree visual builder
    CanvasBlock.tsx                 # Renders any component tree node
    PageSection.tsx                 # Page node as a titled section
    LayoutContainer.tsx             # Card/Grid/Panel/Columns wrapper
    FieldBlock.tsx                  # Bound field as a visual card
    DisplayBlock.tsx                # Display item visual block
    UnassignedTray.tsx              # Items not placed in component tree
    ModeSelector.tsx                # Single/wizard/tabs (from PagesTab)
    PageNav.tsx                     # Wizard step bar or tab bar
    dnd/                            # Component-tree-order DnD
    properties/
      ComponentProperties.tsx       # Properties panel root
      WidgetSection.tsx             # Component type selector
      AppearanceSection.tsx         # Style, CSS classes (migrated from editor)
      LayoutSection.tsx             # Grid span, responsive
      ContainerSection.tsx          # Direction, gap, columns
```

### Deleted Entirely

- `workspaces/editor/FieldBlock.tsx`
- `workspaces/editor/GroupBlock.tsx`
- `workspaces/editor/DisplayBlock.tsx`
- `workspaces/editor/LayoutBlock.tsx`
- `workspaces/editor/render-tree-nodes.tsx`
- `workspaces/editor/GroupTabs.tsx`
- `workspaces/editor/DragHandle.tsx` (extracted to `components/ui/`)
- `workspaces/editor/canvas-operations.ts`
- `workspaces/editor/block-utils.ts`
- `workspaces/editor/dnd/` (old component-tree DnD)
- `workspaces/editor/properties/AppearanceSection.tsx` (moves to layout)
- `workspaces/editor/properties/LayoutProperties.tsx` (moves to layout)
- `workspaces/editor/properties/WidgetHintSection.tsx` (moves to layout)
- `workspaces/pages/` (entire directory)

### Extracted to `components/ui/`

- `DragHandle.tsx` — shared between Editor (definition reorder) and Layout (component tree reorder)
- `block-utils.ts` — `blockRef` and `blockIndent` utilities relocated here (used by Layout canvas blocks)

## Concerns Not Affected by This Split

These Tier 1 behavioral constructs already live in dedicated tabs and are not part of the Editor/Layout split:

- **Variables** — Logic tab (`VariablesSection`)
- **Shapes** — Logic tab (`ShapesSection`)
- **Instances / Data Sources** — Data tab (`DataSources`)
- **Option Sets** — Data tab (`OptionSets`)
- **Screener** — Blueprint sidebar (`ScreenerSection`)
- **Mappings** — Mapping tab
- **Migrations** — not yet implemented; separate concern

## Testing Strategy

### Preserve Test IDs

The new Editor tree rows MUST emit the same `data-testid` patterns as the current blocks:

- `data-testid="field-{key}"` on field rows
- `data-testid="group-{key}"` on group nodes
- `data-testid="display-{key}"` on display rows
- `data-testid="add-item"` on the Add Item button

This minimizes E2E test breakage. Layout-specific test IDs (`layout-{nodeId}`, wrap/unwrap actions) move to Layout tab tests.

### Unit Tests

- `DefinitionTreeEditor` — renders items tree from definition, add/delete/reorder changes definition array order, no component tree awareness
- `LayoutCanvas` — renders component tree, Page nodes visible as sections, DnD reorders component tree children, unassigned tray shows unbound items
- `DefinitionProperties` — shows only Tier 1 properties for selected item
- `ComponentProperties` — shows only Tier 2/3 properties for selected component node

### Integration Tests

- Adding item in Editor → appears as unassigned in Layout
- Placing unassigned item on a page in Layout → does not change definition order
- Reordering in Editor → changes `definition.items` order, does not affect component tree
- Reordering in Layout → changes component tree order, does not affect definition items
- Properties split: selecting item in Editor shows definition props; selecting in Layout shows component props

### E2E Tests

- Full authoring workflow: create form in Editor → switch to Layout → arrange on pages → Preview renders correctly
- Existing E2E tests updated: layout-specific tests (`layout-components.spec.ts`, wrap/unwrap) navigate to Layout tab instead of Editor
- Wizard/tabs mode tests navigate to Layout tab for page management

### Test Files Affected

**Editor unit tests (rewrite):** 13 files in `tests/workspaces/editor/`
**Pages unit tests (rewrite):** 7 files in `tests/workspaces/pages/`
**Integration tests (update):** `editor-workflow`, `import-export`, `undo-redo`
**E2E tests (update selectively):** ~14 files — primarily `editor-authoring`, `layout-components`, `interaction-patterns`, `wizard-mode`, `pages-workspace`, `pages-behavioral`, `pages-focus-mode`

## Migration

No data migration required. The definition and component documents are unchanged — only the UI surface that edits each part is relocated. Existing projects load identically.

## Spec References

- Core S2.3 — Three-layer separation of concerns (architectural invariant)
- Core S4.1.1 — `formPresentation` (advisory, does not participate in processing model)
- Core S4.2.5 — `presentation` hints (advisory, MUST NOT affect data semantics)
- Core S4.3 — Binds (behavioral layer)
- Component S3.3 — Children array ordering (renderers MUST preserve)
- Component S4.1 — Slot binding by key (not position)
- Component S4.5 — Unbound required items (MUST render as fallback)
- Component S8.2 — `when` vs `relevant` (visual-only vs data-affecting)
- Component S11.3 — Cross-tier cascade precedence
- Theme S5.1 — Cascade levels (Tier 1 < Tier 2 < Tier 3)
- Theme S6.3 — Unassigned items rendering policy
