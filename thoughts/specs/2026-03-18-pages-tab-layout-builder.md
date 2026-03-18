# Pages Tab Layout Builder — Design Spec

**Date:** 2026-03-18
**Status:** Draft
**Scope:** formspec-studio PagesTab, formspec-studio-core (palette query), formspec-core (no changes)
**Prerequisite:** Pages Behavioral API (Phases 0–3 complete)

---

## 1. Problem

Studio's Pages tab currently shows one full-width block per page — each
block is a top-level group at span 12. The tab is technically correct but
visually uninteresting and functionally limited. Users cannot arrange
individual fields on the page grid, compare layouts across breakpoints,
or understand what each page contains without expanding every card.

The theme spec (SS6.3) envisions fine-grained page layout: regions
referencing individual fields, groups, or display items arranged on a
12-column grid with responsive breakpoints. The current UI delivers
a coarse group-per-page organizer instead of a layout builder.

### User feedback (persona testing)

Three user personas were consulted:

- **Forms designer (Maria):** Wants focused per-page editing with
  maximum grid space. Needs the field palette from day one, prominent
  page descriptions, and responsive as a viewport-level toggle.
- **Developer integrator (James):** Warns against shipping a flat
  palette that allows placing items the reconciler cannot resolve.
  Flags reconciler nested-field indexing as the real blocker.
- **Non-technical admin (Denise):** Needs to see all pages at a glance
  for completeness checking. Wants plain-English width labels, hidden
  responsive controls by default, and strong undo/confirmation safety.

Key tension: Denise needs an overview of all pages; Maria and James need
focused editing space. The design resolves this with two modes.

---

## 2. Two-Mode Architecture

The Pages tab operates in two modes that the user flows between.

### 2.1 Overview Mode (default)

A vertical list of page cards — an evolution of the current PagesTab.

Each card shows:
- Page number badge, editable title, item count
- Mini 12-column grid preview (colored blocks showing layout proportions)
- Expand/collapse for quick detail inspection
- Description field (always visible when set; "+ Add description" when absent)

Page-level controls:
- Mode selector at the top (Single / Wizard / Tabs)
- Drag handle on each card for page reordering
- Add Page button
- Unassigned items section at the bottom

**Entry to Focus Mode:** Clicking a page card's grid preview, or a
dedicated "Edit Layout" button visible on hover/expand, enters Focus
Mode for that page.

### 2.2 Focus Mode (drill-in)

A full-width layout editor for a single page.

**Top bar:**
- Back arrow (returns to Overview Mode; also Escape key)
- Page title (editable inline)
- Page navigation: prev/next arrows or dropdown to jump between pages

**Breakpoint bar:**
- Horizontal toggle below the top bar
- Shows "Base" plus named breakpoints from `structure.breakpointNames`
- Active breakpoint highlighted; clicking switches the grid context
- Visible but non-demanding — Base is always the default

**Grid canvas (main area):**
- 12-column grid with subtle column guide lines
- Items render as labeled blocks on the grid
- Direct manipulation: drag to resize, reorder, and place
- See Section 3 for full interaction spec

**Field palette (collapsible right panel):**
- Unplaced items grouped by definition parent
- Already-placed items greyed out
- Drag from palette to grid, or quick-add button
- See Section 4 for full spec

---

## 3. Grid Canvas

### 3.1 Item Blocks

Each item on the grid renders as a block showing:
- Field label (truncated if needed)
- Type indicator (icon or subtle text: text, date, choice, group, display)
- Width badge (e.g., "6/12")
- Status coloring: valid = accent, broken = amber
- Groups show a child-count indicator (e.g., "5 fields")

### 3.2 Interactions

| Action | Mechanism |
|--------|-----------|
| Resize | Drag right edge of block. Snaps to column boundaries (1–12). Column guides highlight during drag. |
| Reorder | Drag block vertically. Items reflow. Drop indicator shows landing position. |
| Place | Drag from palette onto grid. Drop indicator shows where item will land. |
| Remove | Hover shows ×. Click × or select + Delete/Backspace. Item returns to palette. |
| Select | Click block. Selection toolbar appears (see 3.3). |

### 3.3 Selection Toolbar

Appears above or below the selected block:
- **Width presets:** Full (12) · Half (6) · Third (4) · Quarter (3)
- **Custom width:** Number input (1–12)
- **Offset input:** Number input for grid start column (advanced, collapsed by default)

The presets use plain-English labels. The number input is always available
for power users.

### 3.4 Row Wrapping

Items flow left-to-right, wrapping to new rows when cumulative span
exceeds 12 — matching CSS Grid behavior. Each visual row in the canvas
is separated by a subtle divider. Row wrapping is automatic and
non-configurable; it mirrors what the rendered form will produce.

Example: Three items at span 6 render as two rows — [6, 6] and [6].

### 3.5 Breakpoint Context

When a non-base breakpoint is active in the breakpoint bar:
- Block widths/offsets reflect that breakpoint's overrides
- Unset overrides show the inherited base value in muted style
- A "hidden" toggle appears per block (hide item at this breakpoint)
- Resize/reorder operations write to the active breakpoint's overrides,
  not the base values

The grid canvas does NOT attempt to visually resize to simulate viewport
width. It always renders at full available width with the column count
and values reflecting the active breakpoint.

---

## 4. Field Palette

### 4.1 Structure

A collapsible right panel in Focus Mode. Contains all definition items
that can be placed on pages.

Items are organized by definition parent group (collapsible sections):
- Section header: group label + placed/total count
- Each item: label + type icon
- Already-placed items: greyed out with checkmark, non-draggable
- Unplaced items: draggable, with a "+" quick-add button

Quick-add places the item at the end of the grid at span 12.

### 4.2 Scope Constraint

The palette shows only items the reconciler can resolve. Currently,
the reconciler indexes top-level nodes only (`tree-reconciler.ts`
lines 212–216). Until reconciler Phase 4 (nested field extraction)
ships, the palette is restricted to:

- Top-level groups
- Top-level fields
- Top-level display items

Nested fields within groups are NOT shown in the palette and cannot
be placed individually. When the reconciler is updated to support
nested key resolution, the palette expands to show nested items
with an "extract from group" affordance.

This constraint prevents the UI from allowing actions the engine
cannot handle.

### 4.3 Residual Groups

When individual fields are extracted from a group (post-Phase 4),
the group remains on the page containing its non-extracted children.
The palette shows extracted fields as independently placed; the
group's palette entry shows its reduced child count.

---

## 5. Breakpoint Switcher

### 5.1 Layout

A horizontal bar below the page title in Focus Mode. Contains:
- "Base" toggle (always present, always first)
- Named breakpoint toggles from `structure.breakpointNames`
  (typically `sm`, `md`, `lg`)

Active breakpoint is visually highlighted. Only one active at a time.

### 5.2 Behavior

Switching breakpoints changes:
- Which width/offset values the grid canvas displays
- Which values resize/reorder operations write to
- Whether "hidden" toggles are shown per item

It does NOT change:
- The physical width of the grid canvas
- Which items are on the page (hiding is per-breakpoint, not removal)
- The palette contents

### 5.3 Override Indicators

When viewing a non-base breakpoint:
- Items with explicit overrides show their override values normally
- Items without overrides show the inherited base value in muted/italic
  style, indicating "this is inherited, not explicitly set"
- Editing an inherited value promotes it to an explicit override

---

## 6. Data Flow

### 6.1 Read Path

```
project.state (theme + definition)
  → resolvePageView(state)
  → PageStructureView { pages, unassigned, breakpointNames, diagnostics }
  → usePageStructure() hook (memoized)
  → Overview Mode: page cards with mini grid previews
  → Focus Mode: grid canvas + palette + breakpoint bar
```

No new query functions are needed. `resolvePageView` already provides
all data the layout builder requires.

### 6.2 Write Path

All mutations go through existing behavioral project methods:

| User action | Method |
|-------------|--------|
| Resize item | `project.setItemWidth(pageId, itemKey, width)` |
| Set offset | `project.setItemOffset(pageId, itemKey, offset)` |
| Reorder item | `project.reorderItemOnPage(pageId, itemKey, direction)` |
| Place item | `project.placeOnPage(itemKey, pageId, { span })` |
| Remove item | `project.removeItemFromPage(pageId, itemKey)` |
| Set responsive | `project.setItemResponsive(pageId, itemKey, breakpoint, overrides)` |
| Add page | `project.addPage(title)` |
| Delete page | `project.removePage(pageId)` |
| Reorder page | `project.reorderPage(pageId, direction)` or `project.movePageToIndex(pageId, index)` |
| Update title | `project.updatePage(pageId, { title })` |
| Update desc | `project.updatePage(pageId, { description })` |
| Set mode | `project.setFlow(mode)` |

No new project methods are needed. The behavioral API (Phases 1–2)
already covers every mutation the layout builder requires.

### 6.3 Palette Query

The palette needs to know which items are placed and which are not.
`PageStructureView.unassigned` already provides unplaced items.
For placed-but-greyed-out display, the palette walks `pages[].items[]`
to collect placed keys. This is a UI-local derivation, not a new query.

---

## 7. Component Architecture

### 7.1 New Components

| Component | Purpose |
|-----------|---------|
| `PagesFocusView` | Focus Mode container: top bar + breakpoint bar + grid canvas + palette |
| `GridCanvas` | 12-column grid with item blocks, drag/resize/reorder |
| `GridItemBlock` | Single item on the grid canvas |
| `SelectionToolbar` | Width presets + custom input, shown for selected item |
| `FieldPalette` | Collapsible right panel with grouped unplaced items |
| `BreakpointBar` | Horizontal breakpoint switcher |

### 7.2 Modified Components

| Component | Change |
|-----------|--------|
| `PagesTab` | Add mode state (overview/focus). Render `PagesFocusView` when in focus mode. Add "Edit Layout" entry point to PageCard. |
| `PageCard` | Add click handler on grid preview to enter focus mode. Make description always visible when set. |

### 7.3 State Management

- `focusedPageId: string | null` — which page is in focus mode (null = overview)
- `activeBreakpoint: string` — which breakpoint is active in focus mode ("base" default)
- `selectedItemKey: string | null` — which item is selected on the grid canvas
- `isPaletteOpen: boolean` — palette panel visibility

All state is local to PagesTab. No new context providers needed.

---

## 8. Interaction Details

### 8.1 Entering Focus Mode

- Click grid preview in a PageCard → focus on that page
- Click "Edit Layout" button (visible on card hover/expand) → focus
- Keyboard: select a card, press Enter → focus

### 8.2 Exiting Focus Mode

- Click back arrow in top bar
- Press Escape
- Both return to Overview Mode, scrolled to the previously-focused card

### 8.3 Page Navigation in Focus Mode

- Prev/Next arrows step through pages in order
- Dropdown allows jumping to any page
- Navigating preserves focus mode (no return to overview)

### 8.4 Drag-to-Resize Details

- Drag starts on right edge of a block (cursor changes to `col-resize`)
- During drag: column guides highlight, showing snap targets
- Minimum span: 1. Maximum span: 12.
- Snap threshold: nearest column boundary
- On drop: `project.setItemWidth()` is called with the new span
- If active breakpoint is not "base": `project.setItemResponsive()` is called instead

### 8.5 Drag-to-Reorder Details

- Drag starts on the block body (not the right edge)
- During drag: other items shift to show the drop position
- Uses existing `@dnd-kit/react` already in the project
- On drop: `project.reorderItemOnPage()` is called
- Reorder is position-based (within the page's item list order)

### 8.6 Drag-from-Palette Details

- Drag starts on an unplaced item in the palette
- Grid canvas shows drop indicators between existing items
- On drop: `project.placeOnPage(itemKey, pageId, { span: 12 })` is called,
  then `project.reorderItemOnPage()` to position it at the drop index

---

## 9. Scope Boundaries

### In Scope

- Two-mode architecture (Overview + Focus)
- Grid canvas with drag-to-resize, reorder, place, remove
- Field palette (top-level items only)
- Breakpoint switcher
- Width presets (Full/Half/Third/Quarter + custom)
- Page description as first-class field
- Existing behavioral API methods (no new ones needed)

### Out of Scope (Future Work)

- **Nested field extraction** — Depends on reconciler Phase 4.
  When it ships, the palette expands to show nested fields, and
  residual group behavior activates.
- **Conditional pages / page branching** — Requires new spec work
  for page-level relevance expressions.
- **Page-level validation gating** — Wizard forward-navigation
  validation is a component-tier concern, not a theme-tier one.
- **Live rendered preview** — Showing actual rendered fields instead
  of abstract blocks. Separate feature.
- **Page templates** — Pre-built page patterns for common use cases.
- **Sidebar/pages source reconciliation** — Aligning the sidebar's
  page-derived section list with the Pages tab. Related but separate.

---

## 10. Success Criteria

After implementation:

1. User can see all pages at a glance in Overview Mode with item counts
   and mini grid previews.
2. User can click into any page to enter Focus Mode with a full-width
   grid canvas.
3. User can drag the right edge of a field block to resize its column
   span, with visual column guides.
4. User can drag fields from the palette onto the grid to place them.
5. User can remove fields from the grid (they return to the palette).
6. User can switch breakpoints and see/edit per-breakpoint overrides.
7. User can use named width presets (Full/Half/Third/Quarter) instead
   of remembering column numbers.
8. Escape returns to Overview Mode.
9. No new formspec-core or formspec-studio-core methods are needed —
   all mutations use the existing behavioral API.
10. The palette does not show items the reconciler cannot resolve.
