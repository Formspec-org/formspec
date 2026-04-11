# Layout Workspace Direct Manipulation Redesign

**Date:** 2026-04-02  
**Status:** Approved (spec); implementation tracked below  
**Tracker updated:** 2026-04-04  
**Scope:** `packages/formspec-studio/src/workspaces/layout/` (+ `formspec-studio-core` helpers, `Shell.tsx`, theme workspace re-parenting)

This document is organized as **what shipped**, **what is still open**, then **design decisions** and the **full reference** (original Sections 0–9).

---

## Delivered

### Canvas & structure

- **Real CSS per container type** in `LayoutContainer` — Grid (`repeat(N, 1fr)`), Stack (flex + direction/wrap/gap/align), Card, Panel, Collapsible/Accordion semantics.
- **`render-tree.tsx`** propagates parent layout context (container type, grid column count) to fields and display nodes.
- **Proportional grid items** — `grid-column` / `grid-row` span from `style`, wired through studio-core `setColumnSpan` / `setRowSpan`.
- **`LayoutCanvas`** orchestrates page structure, palette, step nav, context menu, DnD provider, Layout/Theme mode, preview vs structural canvas.

### Resize & direct manipulation

- **`useResizeHandle`** — shared pointer-driven resize with snapping.
- **Field (and display) grid resize** — right-edge column span, bottom-edge row span; column guide overlay on parent Grid during horizontal resize; tooltips; disambiguation from dnd-kit via separate handles + activation distance.
- **Full-width-span hides column handle** — avoids overlap with hypothetical grid column-count affordance (per spec disambiguation note).

### Inline editing (toolbar / popover)

- **`InlineToolbar`** — per-container controls (Grid/Stack/Card/Panel/Collapsible, etc.) and field controls including column span stepper where applicable.
- **`PropertyPopover`** — Tier 3 (style, a11y, cssClass, unwrap/remove) with overflow dot when Tier 3 content exists.
- **Visual condition** promoted to Tier 2 where implemented (`InlineExpression` / chip pattern per toolbar).

### DnD (partial relative to Section 5)

- **`LayoutDndProvider`** — tray → canvas, **insert-slot** targets with `moveComponentNodeToIndex`, **container-drop** → `moveComponentNodeToContainer`, fallback linear `reorderComponentNode` for non-spatial cases.
- **Thin insert slots** interleaved with children when drag is active (containers with `nodeId`).
- **Empty container** placeholder copy (“Drop items here”) when non-drag empty state.

### Right sidebar & shell

- **`LayoutPreviewPanel`** / **`FormspecPreviewHost`** in the Layout tab right sidebar (hidden in Theme mode and compact/chat layouts per existing shell rules).
- **`Theme` workspace tab removed** from `Header` and `WORKSPACES`; theme editing lives under Layout **Theme mode**.
- **Blueprint** switches to **`THEME_MODE_BLUEPRINT_SECTIONS`** when Layout + Theme mode (`BlueprintSidebarInner` + `LayoutModeProvider`).
- **Theme workspace components** (ColorPalette, TypographySpacing, etc.) registered in sidebar — re-parented from deleted standalone Theme tab.

### Theme mode

- **Layout / Theme toggle** (`LayoutThemeToggle` + `LayoutModeContext`).
- **Full-width preview** in Layout canvas when Theme mode; **`ThemeAuthoringOverlay`** + **`ThemeOverridePopover`** for per-item overrides; cascade via **`getPropertySources`** / **`getEditableThemeProperties`**.
- **Studio-core layout + theme helpers** exported from `formspec-studio-core` (`layout-helpers.ts`, `layout-ui-helpers.ts`): e.g. `setColumnSpan`, `setRowSpan`, `setPadding`, `setStyleProperty`, `removeStyleProperty`, theme override helpers, `resolveLayoutInsertTarget`, `getItemOverrides`, `addStyleOverride`, `validateTokenName`, `applyBreakpointPresets`, `summarizeSelectorRule`, `getTokensByGroup`, `getGroupedTokens`, `getSortedBreakpoints`, `getEditablePropertiesForNode`.

### Legacy removal

- **Old layout property sidebar pieces** absorbed into toolbar/popover/helpers (per inventory — `ComponentProperties` et al. removed from Layout flow).
- **`ThemeTab.tsx`** removed.

### Tests

- Studio-core tests for layout helpers; Vitest layout/workspace tests; Playwright layout E2E including insert-slot reorder and theme/layout flows (exact coverage evolves — see Section 9 checklist in reference).

---

## Outstanding

### Grid DnD (Section 5 — highest gap)

- **Required spatial drop indicator** — spec: while dragging over a Grid, **highlight the target cell** (outline or shaded region). Current: **no** cell-level preview; only small **`h-1` insert slots**, hard to interpret as “which column/row.”
- **Nearest-cell / layout-aware `insertIndex`** — spec: derive placement from **pointer position vs grid geometry**. Current: **linear** insert indices from interleaved slots in DOM order, not true “nearest cell” in 2D (especially painful with mixed spans).
- **`renderLayoutTree`** still does not pass **sibling `index`** into every draggable; fallback `reorderComponentNode` direction can be wrong if spatial drop misses.

### Resize handles (Section 2)

- **Grid `columns` via container edge drag** — spec: drag Grid container right edge (1–12) **in addition to** toolbar stepper. Current: **stepper only** (no container-edge column-count handle).
- **Panel width** — spec: drag Panel edge with tooltip. Verify / implement if not present on `LayoutContainer` Panel path.
- **Stack gap drag** — spec stretch goal; likely **not** implemented.

### Sidebar preview & compact (Section 4)

- **Selection sync** — explicitly deferred in spec (v1+): click field in preview → highlight on canvas.
- **Compact “Preview” drawer/modal** — spec: when sidebar hidden, toolbar button opens on-demand preview; confirm fully wired everywhere compact Layout is used.

### Theme mode polish (Section 7)

- **Selection handoff** — spec: Layout→Theme opens popover for prior selection, scroll/highlight field; Theme→Layout restores prior canvas selection. Confirm behavior matches **full** spec wording.
- **Overlay + `data-bind` / `data-key`** on preview — depends on webcomponent attributes; verify all field wrappers expose what overlay expects.

### Spec / schema (Section 0)

- Four **PresentationBlock** additions (`density`/`size`, `labelPosition: floating`, `helpTextPosition`, `errorDisplay`) — **Theme spec work**, not Studio-only; theme popover “future controls” stay blocked until spec lands.

### Section 8 “done in core” vs UI residue

- Helpers are **exported**; individual theme UI components may still contain **display-only** logic per “stays in UI” table — no need to move unless MCP parity is required.

### Testing vs spec (Section 9)

- E2E item **“Drag-resize a Grid container to change column count”** — only valid once **container-edge column resize** exists (or test should be reinterpreted as stepper-only).

---

## Design decisions (unchanged intent)

- **Approach A (full canvas rewrite)** — structural canvas, not a flat list with fake boxes.
- **Proportional grid canvas** — the canvas uses real Grid/Flex.
- **Numeric spatial properties** — intended to be drag-resizable where specified (some still open above).
- **Mixed inline editing** — zero-click affordances, one-click toolbar, two-click popover.
- **Right sidebar = live preview** in Layout mode (not a property form).
- **Preview tab unchanged** — full deliberate preview remains separate.
- **Theme merged into Layout** — two-mode toggle; standalone Theme tab eliminated.
- **Per-item theme overrides** — popover from preview in Theme mode; studio-core owns cascade reads/writes.

---

# Reference: original specification (Sections 0–9)

The following sections are the **authoritative design text** from the 2026-04-02 approval. Use **Delivered** / **Outstanding** above for implementation status; paragraphs below are not retro-edited to match code.

## Section 0: Tier & Property Strategy

### Principle: Dependency Inversion — Studio-Core Owns All Business Logic

Both the Studio UI and the MCP server consume `formspec-studio-core`. Any business logic, convenience function, or optimization that one consumer needs, the other probably needs too. **Neither consumer should think about which document to edit, which tier owns a property, or how the cascade works.** They call intent-based helpers and render/return the results.

This means:

- Studio UI components call studio-core methods and render. They never import from `formspec-core` directly, never construct handler payloads, never do document routing.
- MCP tools call the same studio-core helpers with identical semantics, different presentation.
- Business logic found in studio UI during this rewrite gets refactored down into studio-core.
- New helpers are tested at the studio-core layer (Vitest), not through the UI (Playwright).

The studio UI should not know about cascade levels, schema tiers, or spec internals. **Studio-core helpers are the abstraction layer** — the studio asks "what can I do?", studio-core knows how to do it.

### Principle: Prefer Tier 3 (Components), Fall Back to Lower Tiers

Components (Tier 3) afford the most complexity and are the natural home for layout authoring. Use component properties directly when they exist. When a capability isn't on the component schema, use the `style` property (open-ended `StyleMap` on `ComponentBase`) as the vehicle — this requires zero schema changes and works today. When a capability belongs to presentation/theming (label position, density, etc.), use Tier 2 Theme mechanisms via studio-core helpers. The studio UI never needs to know which tier owns what.

### Property Routing Table

Every direct-manipulation property routes through a studio-core helper. The helper decides the target tier and property.

| Studio Action | Component Prop (Tier 3) | Style Fallback | Theme (Tier 2) | Definition (Tier 1) |
|---|---|---|---|---|
| Grid column span | — | `style.gridColumn: "span N"` | — | `presentation.layout.colSpan` (1-12) also exists but is Tier 1 grid-flow only |
| Grid row span | — | `style.gridRow: "span N"` | — | — (no Tier 1 equivalent) |
| Grid columns | `columns` (direct prop) | — | — | — |
| Grid gap | `gap` (direct prop) | — | — | — |
| Grid rowGap | `rowGap` (direct prop) | — | — | — |
| Stack direction | `direction` (direct prop) | — | — | — |
| Stack wrap | `wrap` (direct prop) | — | — | — |
| Stack gap | `gap` (direct prop) | — | — | — |
| Stack align | `align` (direct prop) | — | — | — |
| Card elevation | `elevation` (direct prop) | — | — | — |
| Card padding | — | `style.padding` | — | — |
| Panel width | `width` (direct prop) | — | — | — |
| Panel position | `position` (direct prop, `"left"` \| `"right"` only) | — | — | — |
| Collapsible title | `title` (direct prop) | — | — | — |
| Collapsible defaultOpen | `defaultOpen` (direct prop) | — | — | — |
| Container/field padding | — | `style.padding` | — | — |
| Label position | — | — | PresentationBlock `labelPosition` | `formPresentation.labelPosition` (form-wide) |
| Per-item density | — | — | *Requires spec change* | `styleHints.size` exists per-item but not in PresentationBlock |

**Key insight:** `style` is an open-ended `StyleMap` (`additionalProperties: { string | number }`) on BOTH `ComponentBase` (Tier 3) and `PresentationBlock` (Tier 2). Properties like `gridColumn`, `gridRow`, `padding`, `margin` are valid `style` entries today with zero schema changes. The caveat: `style` is "renderer-interpreted, not CSS" — non-web renderers may not understand CSS grid properties. If non-web portability matters later, promote `gridColumnSpan`/`gridRowSpan` to first-class `ComponentBase` properties.

### Required Spec Changes (4 total)

These are the only capabilities that cannot be expressed by any existing spec mechanism:

1. **`density` / `size` on PresentationBlock** — Tier 1 has per-item `styleHints.size` (`"compact"` / `"default"` / `"large"`), but PresentationBlock doesn't have it, so theme selectors can't target density. Add to PresentationBlock to enable theme cascade for per-item density.
2. **`labelPosition: "floating"` enum extension** — Current enum is `"top"` / `"start"` / `"hidden"`. Add `"floating"` for floating-label input patterns.
3. **`helpTextPosition` on PresentationBlock** — No existing mechanism controls where help text renders relative to the input. New property needed.
4. **`errorDisplay` on PresentationBlock** — No existing mechanism controls per-item error display mode. New property needed.

These are all Theme spec (Tier 2) PresentationBlock additions. No Component spec (Tier 3) changes are required — `style` covers the layout properties.

### What the Studio Does NOT Need to Know

- Cascade level numbers (-2 through 3)
- Which tier owns a property
- Schema structure or validation rules
- How `style` vs direct props differ

Studio-core exposes intent-based helpers: `setColumnSpan(ref, 2)`, `setPadding(ref, '16px')`, `getPropertySources(itemKey, 'labelPosition')`. When the spec evolves (e.g., promoting `gridColumnSpan` to `ComponentBase`), studio-core changes its implementation — the studio UI doesn't change.

## Section 1: Canvas Architecture

Replace the current flat-list canvas with a structural canvas that mirrors real CSS layout.

The new `LayoutCanvas` renders the component tree using actual CSS Grid and Flexbox matching each container's semantics:

- **Grid** container: CSS `display: grid` with `grid-template-columns: repeat(N, 1fr)` where N is the node's `columns` prop.
- **Stack** container: CSS `display: flex` with `flex-direction` matching the node's `direction` prop, `flex-wrap` matching `wrap`.
- **Card**: A bordered card wrapper with padding via `style.padding` and elevation via `elevation` prop.
- **Panel**: Positioned sidebar with `width` prop (direct) and `position` prop (`"left"` | `"right"`).
- **Collapsible/Accordion**: Collapsible section with open/closed state. Note: Accordion is Layout/Progressive (Component spec S6.3), not Container/Core like Collapsible (S5.17) — different nesting rules per S3.4.

Field blocks inside a Grid render with `grid-column: span N` driven by `style.gridColumn` on the component node (routed through studio-core's `setColumnSpan` helper). A field spanning 2 of 3 columns visually occupies 2/3 width. Fields inside a Stack flow according to the stack's direction.

The canvas is no longer a flat `flex-col gap-1.5` list. Each `LayoutContainer` component applies the real CSS layout its component type dictates. The canvas IS the layout.

The existing `render-tree.tsx` recursive renderer stays as the pattern but gets rewritten — each container type gets its own CSS treatment rather than the current uniform dashed-border box.

## Section 2: Direct Manipulation — Resize Handles

Every numeric spatial property gets a drag handle.

Resize interactions use pointer events (no library needed):

- **Grid column span**: Drag the right edge of a field/container block. Snap points at each column boundary. Visual guides show the grid columns as the user drags. A field in a 3-column grid can drag from span-1 to span-2 to span-3. Writes `style.gridColumn: "span N"` on the component node via `setColumnSpan` helper.
- **Grid row span**: Drag the bottom edge. Same snap behavior. Writes `style.gridRow: "span N"` via `setRowSpan` helper.
- **Grid columns count**: Drag the right edge of a Grid container itself to add/remove columns (or a dedicated handle in the container header). Snaps to integers 1-12. Writes the `columns` prop directly (it's a first-class Grid property). Note: the 1-12 range is a studio UX decision — the Component spec does not define a maximum.
- **Panel width**: Drag the Panel's edge. Shows percentage as a tooltip while dragging. Writes the `width` prop directly (first-class Panel property).
- **Stack gap**: Drag the space between items in a Stack to adjust gap visually. (Stretch goal — gap is less intuitive to drag.) Writes the `gap` prop directly.

### Implementation

A shared `useResizeHandle` hook that takes `{ axis, min, max, snap, onResize }`. The hook attaches `pointerdown/pointermove/pointerup` handlers, calculates delta, applies snapping, and calls back with the new value. Each block type wires it up with its specific constraints.

### Visual Feedback During Drag

- Ghost overlay showing the target size.
- Column guides (light dashed lines) appear on the parent Grid during column-span drags.
- Numeric tooltip near the cursor showing the current value.

### Disambiguation with Drag Reorder

Resize handles live on the edges (right edge, bottom edge). Drag-to-reorder initiates from the body interior. The existing `PointerActivationConstraints.Distance({ value: 5 })` prevents accidental drags. Resize handles use their own pointer event listeners (not dnd-kit) so there's no conflict — they're separate DOM elements that stop propagation.

**Minimum hit target**: Resize handles must be at least 8px wide/tall (touch: 24px with invisible extended hit area). On fields shorter than 48px, the bottom-edge resize handle should be hidden to avoid consuming a disproportionate fraction of the touch target — row span can still be set via the Tier 2 toolbar.

**Container edge vs. child edge overlap**: When a field spans the full Grid width, its right-edge resize handle would overlap with the Grid container's column-count resize handle. Resolution: the field's right-edge resize handle is hidden when the field already spans all columns (there's nowhere to resize to). The Grid container's column-count handle lives on the container's outer border, outside the content area — never overlapping with child resize handles.

**Competing affordances for Grid column count**: Both the drag handle (right edge of Grid container) and the toolbar stepper (+/-) change the same `columns` property. This is intentional — drag for spatial manipulation, stepper for precise numeric control. The drag handle must be visually distinct from the container border (e.g., a visible grab indicator or different color on hover) to avoid confusion with a passive border.

## Section 3: Inline Editing — Toolbar & Popover Strategy

Properties surface based on frequency of use and interaction cost. Three tiers:

### Tier 1 — Always Visible (zero clicks)

When a container or field is selected, its most-used properties show directly on the element:

- **Grid**: column count badge, gap indicator
- **Stack**: direction arrow icon, wrap icon
- **Card**: elevation indicator
- **Field block**: column span badge, widget type label
- **All containers**: a small component-type label (already exists)

These are read-only indicators — they tell you the current state at a glance.

### Tier 2 — Inline Toolbar (one click to select, then immediate access)

Selecting a container reveals a compact toolbar row at the top of the container (inside the border, replacing the current bare label badge):

- **Grid**: columns stepper (+/-), gap dropdown, padding dropdown (writes `style.padding`)
- **Stack**: direction toggle (row/column), wrap toggle, gap dropdown, align dropdown
- **Card**: elevation dropdown, padding dropdown (writes `style.padding`)
- **Panel**: position dropdown (left/right — spec only allows these two values), width input
- **Collapsible/Accordion**: title inline text input, default-open toggle
- **Field block**: widget type dropdown (if multiple compatible), column span stepper, visual condition chip (shows `when` expression if set, click to edit — see note below)
- **All**: a "..." overflow button for Tier 3

The toolbar uses icon buttons and compact dropdowns — similar in density to a rich text editor toolbar. One row, no scrolling.

**Visual Condition in Tier 2, not Tier 3**: The component `when` expression controls conditional rendering and is fundamental for authors building conditional forms. Demoting it to the overflow popover (Tier 3) would be a discoverability regression from the current sidebar where it's always visible. Instead, show a compact expression chip in the Tier 2 toolbar: if `when` is set, display a truncated `"if: ..."` tag that opens the FEL editor on click; if unset, show a dim `"+ condition"` affordance. This applies to both containers and field blocks.

**Important: `when` vs `relevant` distinction.** The `when` property (Component spec §8) controls component rendering only — data is preserved. The Definition bind's `relevant` property controls whether the field is active and may clear data per `nonRelevantBehavior`. The FEL editor opened from the Tier 2 chip should include a persistent callout: "This controls rendering visibility only. To exclude data from the response or clear values when conditions change, configure `relevant` in the Editor workspace."

### Tier 3 — Popover (two clicks: select + "...")

The overflow button opens a floating popover anchored to the element containing:

- Accessibility (ARIA label, role)
- Style overrides (`style` properties — open-ended key-value map)
- CSS class (`cssClass`)
- Actions (Unwrap, Remove from Tree)

The "..." button should show a dot indicator when any Tier 3 property is configured, so users know there's something set in the overflow without checking manually.

This is essentially the current `ComponentProperties` content minus Visual Condition (promoted to Tier 2) and Appearance/theme (moved to Theme mode), rendered as a popover instead of a sidebar panel.

**Commit model for inline inputs**: All text inputs in the toolbar and popover use blur-to-commit (value is saved when focus leaves the input). The popover should not dismiss on click-away while any input within it has uncommitted changes (dirty guard). Pressing Escape dismisses without committing if no inputs are dirty, or prompts "Discard changes?" if any are.

## Section 4: Right Sidebar — Live Preview

Replace `ComponentProperties` in the right sidebar with a live `<formspec-render>` preview.

The Shell already has the right sidebar wired up for the Layout tab (Shell.tsx lines 489-524). Swap the content:

- **Old**: `<ComponentProperties />` — a property editor
- **New**: `<LayoutPreviewPanel />` — wraps `FormspecPreviewHost` with minimal chrome

The preview panel:

- Mounts `<formspec-render>` using the same `FormspecPreviewHost` pattern from the Preview tab.
- No viewport switcher, no mode switcher — just the rendered form at the sidebar's width.
- Updates reactively as the user edits (debounced 300ms, same as the existing preview).
- A small label at the top: "Live Preview" with a subtle border-bottom.

**Selection sync** (future enhancement, not in v1): clicking a field in the preview could highlight it in the canvas. For now, they're independent.

**Compact/tablet layout**: On small screens, the sidebar preview hides (same as how the editor hides FormHealthPanel on compact). The compact properties modal for the Layout tab gets removed since properties are now inline. To compensate for the lost feedback loop, add a "Preview" button in the canvas toolbar that opens the live preview in a bottom drawer or modal — the structural canvas is harder to use without rendered feedback, so an on-demand alternative must exist.

## Section 5: DnD Changes

Existing dnd-kit infrastructure stays, with two adjustments.

### Reorder Becomes Spatial

Currently reorder is linear (up/down). With real CSS layout, dropping a field in a Grid should place it at the grid cell nearest the drop point, not just "above" or "below." The `handleTreeReorder` function gets a richer target: instead of just `direction: 'up' | 'down'`, it receives `{ targetContainer, insertIndex }` computed from the drop position relative to the container's grid/flex layout.

**Spatial drop indicator (required)**: During a drag over a Grid container, the target cell must be visually highlighted — a colored cell outline or shaded region showing where the item will land. Without this, spatial reorder is worse than linear because the user has no feedback about insert position. The drop indicator design drives the data model: you need to know what insert positions are possible before computing `insertIndex`.

**Empty container drop target**: Empty Grid containers should render a visible placeholder (dashed cell outline with "drop items here" label) rather than a bare empty box. This makes the first drop experience explicit.

### Drop-Into-Container

Dragging a field onto a container (not next to a sibling inside it) should place it as the last child of that container. The existing `useDroppable` on `LayoutContainer` already has this wiring — it just needs the handler to call `project.moveToContainer(sourceRef, targetContainerId)` or equivalent.

### Tray-to-Canvas

Stays unchanged — drag an unassigned item from the tray onto the canvas to bind it.

## Section 6: Component Inventory

### Rewritten (new implementations replacing old)

| File | Lines | Reason |
|------|-------|--------|
| `LayoutCanvas.tsx` | 394 | Largest component — contains page sections, add-item palette, mode selector, step nav, context menu, DnD wiring. Full rewrite for structural CSS layout. Effort is higher than the other rewrite targets. |
| `FieldBlock.tsx` | 54 | Proportional sizing, resize handles, inline toolbar, Tier 1 indicators |
| `LayoutContainer.tsx` | 76 | Per-container-type CSS layout (Grid/Stack/Card/Panel/Collapsible/Accordion), inline toolbar, overflow popover. Note: Accordion is Layout/Progressive (S6.3), Collapsible is Container/Core (S5.17) — different nesting rules. |
| `render-tree.tsx` | 175 | Recursive renderer passes layout context (parent container type, grid columns) to children |
| `LayoutDndProvider.tsx` | 111 | Spatial reorder logic, drop-into-container, spatial drop indicators |

### Kept As-Is

| File | Reason |
|------|--------|
| `LayoutPageSection.tsx` | Page sections are structural wrappers |
| `LayoutStepNav.tsx` | Page navigation |
| `LayoutContextMenu.tsx` | Right-click menu |
| `ModeSelector.tsx` | Flow mode selector |
| `UnassignedTray.tsx` | Tray stays |
| `DisplayBlock.tsx` | Updated: adds resize handles for span, but retains current structure and selection behavior |
| `useLayoutPageStructure.ts` | Unchanged |

### New Components (Studio)

| File | Purpose |
|------|---------|
| `LayoutPreviewPanel.tsx` | Right sidebar live preview wrapper (Layout mode) and full-width preview with authoring overlay (Theme mode) |
| `useResizeHandle.ts` | Shared hook for drag-to-resize with snapping |
| `InlineToolbar.tsx` | Compact property toolbar rendered inside containers/fields. Includes visual condition chip (Tier 2). |
| `PropertyPopover.tsx` | Overflow popover for Tier 3 layout properties with dirty guard on dismiss |
| `ThemeOverridePopover.tsx` | Per-item theme cascade popover with provenance display and override controls |
| `LayoutThemeToggle.tsx` | Mode toggle between Layout and Theme modes with selection handoff |

### New Studio-Core Helpers

These helpers abstract tier/property routing so the studio UI never touches schemas directly.

| Helper | Purpose | Writes To |
|--------|---------|-----------|
| `setColumnSpan(ref, n)` | Set grid column span on a component node | `style.gridColumn: "span N"` on component node |
| `setRowSpan(ref, n)` | Set grid row span | `style.gridRow: "span N"` on component node |
| `setPadding(ref, value)` | Set padding on a container | `style.padding` on component node |
| `getPropertySources(itemKey, prop)` | Resolve cascade provenance for a theme property | Read-only — walks all 6 cascade levels, returns `{ source, value }[]` |
| `getEditableThemeProperties(itemKey)` | List which PresentationBlock properties are available for override | Read-only — returns property descriptors based on current schema |
| `setThemeOverride(itemKey, prop, value)` | Set a per-item theme override | `theme.items.{key}.{prop}` via existing `theme.setItemOverride` |
| `clearThemeOverride(itemKey, prop)` | Remove a per-item theme override | Deletes from `theme.items.{key}` |

### Deleted

| File | Lines | Absorbed By |
|------|-------|-------------|
| `properties/ComponentProperties.tsx` | 288 | Inline toolbar + popover |
| `properties/ContainerSection.tsx` | 201 | `InlineToolbar` per-container-type rendering |
| `properties/LayoutSection.tsx` | 32 | Resize handles + field toolbar |
| `properties/WidgetSection.tsx` | 50 | Field toolbar dropdown |
| `properties/AppearanceSection.tsx` | 233 | `ThemeOverridePopover` (Theme mode, cascade-aware) + `PropertyPopover` (Layout mode Tier 3, style/a11y/cssClass) |

Total: 804 lines absorbed into inline toolbars, popovers, and studio-core helpers.

### Relocated (not rewritten)

These components stay in `workspaces/theme/` (no file move needed) but get registered in `SIDEBAR_COMPONENTS` and rendered in the Blueprint sidebar when the Layout workspace is in Theme mode. `ThemeTab.tsx` is the only file deleted from that directory.

| File | Sidebar Section Name |
|------|---------------------|
| `ColorPalette.tsx` | "Colors" |
| `TypographySpacing.tsx` | "Typography" |
| `DefaultFieldStyle.tsx` | "Field Defaults" |
| `FieldTypeRules.tsx` | "Field Rules" |
| `ScreenSizes.tsx` | "Breakpoints" |
| `AllTokens.tsx` | "All Tokens" |

### Deleted (Theme tab)

| File | Reason |
|------|--------|
| `workspaces/theme/ThemeTab.tsx` | Eliminated — functionality absorbed into Layout workspace Theme mode |

### Shell.tsx Changes

- Swap `<ComponentProperties />` for `<LayoutPreviewPanel />` in the Layout tab's right sidebar slot (lines 489-524, Layout mode only).
- Hide right sidebar in Theme mode.
- Remove the compact properties modal for the Layout tab (line 603). Add compact "Preview" button that opens a bottom drawer/modal instead.
- Remove `Theme` from the `WORKSPACES` map (line 45) and Header tab bar (`Header.tsx` line 10). Consider renaming the Layout tab to "Design" to signal that both structural and visual concerns live there.
- Update `BLUEPRINT_SECTIONS_BY_TAB` (lines 61-67) for Layout to include theme sidebar sections when in Theme mode, and remove the standalone `Theme` entry.

## Section 7: Theme Mode — Visual Styling Workspace

The layout workspace gets a mode toggle (like the editor's Build/Manage/Screener). Two modes:

- **Layout mode** (Sections 1-6): Direct manipulation canvas with structural editing, resize handles, inline toolbars, live preview in the right sidebar.
- **Theme mode**: The live `<formspec-render>` preview takes over the full main area. No structural blocks, no resize handles — just the rendered form. You edit how it looks, not how it's structured.

### Main Area — Full-Width Live Preview

The `<formspec-render>` webcomponent renders in the main canvas area at full width. This is the same preview the right sidebar shows in Layout mode, but now it's the primary surface. Updates reactively as you change tokens, rules, or per-item overrides.

**Authoring mode interaction contract**: In Theme mode, the preview must NOT behave as a live interactive form — clicking an input should open the theme override popover, not focus the input. Implementation: render a transparent `pointer-events: all` overlay div above the `<formspec-render>` element that intercepts all pointer events. The overlay's click handler walks up the DOM from the event coordinates (using `document.elementFromPoint` with the overlay temporarily hidden) to find the nearest `data-bind` or `data-key` attribute on field wrapper elements. This requires the webcomponent renderer to set these attributes on field wrappers — if not already present, add `data-bind="{itemKey}"` to every field wrapper element in `<formspec-render>`. The overlay approach requires no webcomponent API changes beyond the data attributes.

### Form-Wide Settings — Blueprint Sidebar

The Blueprint sidebar already switches content per tab via `BLUEPRINT_SECTIONS_BY_TAB`. In Theme mode, the sidebar shows the form-wide theme editors:

- Color Palette (token editors with color pickers)
- Typography & Spacing (token inputs)
- Default Field Style (label position, default widget, CSS class)
- Field Type Rules (selector rule list with match/apply)
- Screen Sizes (breakpoint editor)
- All Tokens (full token reference)

These are the existing components from `workspaces/theme/` — they move into sidebar sections rather than being a standalone workspace tab. No full rewrite needed, just re-parenting. However, per Section 8, business logic in these components (token filtering/grouping, naming validation, breakpoint sorting, preset values, rule summarization) must be refactored into studio-core helpers before re-parenting, so both Studio and MCP share the same logic.

### Per-Item Theme Overrides — Popover on Preview

Clicking a field in the live preview (intercepted by the authoring overlay — see above) opens a floating popover anchored to that field showing:

- **Theme cascade provenance** — where each property value comes from, resolved by a `getPropertySources(itemKey, property)` studio-core helper. The helper walks all cascade levels and returns a flat list:
  - **Definition hint** (Tier 1 `presentation` — Level 0): inline per-item hints from the Definition. Shown as read-only provenance; editing requires switching to the Editor workspace.
  - **Theme Default** (Tier 2 `defaults` — Level 1): form-wide theme baseline.
  - **Selector Rule(s)** (Tier 2 `selectors[]` — Level 2): type/dataType-based rules. Multiple may match — all shown.
  - **Item Override** (Tier 2 `items.{key}` — Level 3): per-item override. This is what the popover edits.
  - Levels -2 (renderer defaults) and -1 (`formPresentation`) are collapsed into a "Baseline" row if they contribute a value.
  - **Merge rule**: cascade is shallow per-property (Theme spec §5.5). Nested objects (`widgetConfig`, `style`) are replaced as a whole, NOT deep-merged. Exception: `cssClass` uses union semantics.
- **Override controls** — scoped to properties that exist today in PresentationBlock:
  - `labelPosition` (`"top"` / `"start"` / `"hidden"` — and `"floating"` once the spec change lands)
  - `widget` (widget type selection)
  - `widgetConfig` (widget-specific tuning, open object)
  - `style` (open-ended key-value pairs for freeform overrides)
  - `cssClass` (CSS class string)
  - `accessibility` (ARIA properties)
  - `fallback` (fallback widget)
- **Future override controls** (pending spec changes from Section 0):
  - `density` / `size` — once added to PresentationBlock
  - `helpTextPosition` — once added to PresentationBlock
  - `errorDisplay` — once added to PresentationBlock
- Clear Override button

The studio UI doesn't construct cascade logic — it calls `getPropertySources` and renders the result. When the spec adds new PresentationBlock properties, studio-core's `getEditableThemeProperties(itemKey)` returns them and the UI renders controls automatically.

**Commit model**: Same as Layout mode popovers — blur-to-commit for inputs, dirty guard on click-away dismiss. The popover should not dismiss while an input has uncommitted changes.

### Right Sidebar in Theme Mode

Hidden. No right sidebar in Theme mode — the preview IS the main area and per-item editing is via popover. The sidebar collapse button stays available but defaults to collapsed.

### Mode Toggle

Add a new toggle similar to `BuildManageToggle` in the editor workspace. Two modes:

- **Layout** — structural editing (default)
- **Theme** — visual styling

This toggle sits in the sticky header area of the layout workspace, next to the existing toolbar buttons.

**Selection handoff on mode switch**: Switching from Layout → Theme preserves the canvas selection as context. If a field was selected in the canvas, Theme mode opens with that field's override popover pre-opened (the preview scrolls to and highlights the corresponding rendered field). If no selection existed, Theme mode opens with no popover — the user clicks to select. Switching from Theme → Layout restores the canvas selection state that was active when the user left Layout mode. The two modes maintain independent selection state but use the switch moment to transfer context.

### Theme Tab Elimination

The standalone `ThemeTab.tsx` and its entry in the `WORKSPACES` map in `Shell.tsx` get removed. The Header tab bar drops from Editor/Layout/Theme/Mapping/Preview to Editor/Layout/Mapping/Preview. All theme functionality lives in the Layout workspace's Theme mode.

`BLUEPRINT_SECTIONS_BY_TAB` for Layout gets updated to include the theme sidebar sections when in Theme mode.

## Section 8: Business Logic Refactoring — Studio → Studio-Core

As part of this rewrite, business logic currently embedded in studio UI components must be refactored down into `formspec-studio-core` so both the Studio UI and MCP server share identical semantics. This is not optional cleanup — it's a prerequisite for the new helpers (Section 6) to work correctly.

### Filter: Would an MCP Server Need This?

Not all business logic in UI components belongs in studio-core. The test: **would an MCP server need this to modify a form?** If the answer is "no, this is display/presentation logic," it stays in the UI.

### Refactor to Studio-Core (MCP needs these)

| Current Location | Business Logic | Target Studio-Core Helper |
|---|---|---|
| `LayoutCanvas.tsx:171-182` | Active page ID resolution, parent node selection for add-node | `resolveLayoutInsertTarget(project, pageId?)` — MCP's `addItemToLayout` needs this |
| `LayoutCanvas.tsx:201-230` | Item type routing and presentation mapping for add-item | `addItemToLayoutAtPage(project, itemType, pageId?)` — MCP adds items to pages |
| `AppearanceSection.tsx:70` | `(project.state.theme as any)?.items?.[itemKey] ?? {}` — direct state access | `getItemOverrides(project, itemKey)` — MCP reads overrides before modifying |
| `AppearanceSection.tsx:77-89` | Style addition with key/value validation | `addStyleOverride(project, itemKey, key, value)` — MCP sets styles, needs same validation |
| `ColorPalette.tsx:22` | Token naming validation (`/[^a-zA-Z0-9_-]/g`) | `validateTokenName(name)` — MCP creates tokens, needs same naming rules |
| `ScreenSizes.tsx:31-35` | `applyPresets()` — hardcoded standard breakpoints | `applyBreakpointPresets(project)` — MCP could offer "set standard breakpoints" |
| `FieldTypeRules.tsx:11-17` | `ruleSummary()` — selector rule formatting | `summarizeSelectorRule(rule)` — MCP tool responses need human-readable rule summaries |

### Also Refactor to Studio-Core (borderline but helps MCP work more seamlessly)

| Current Location | Business Logic | Target Studio-Core Helper | Why Include |
|---|---|---|---|
| `ColorPalette.tsx:14-15` | Token filtering by `color.` prefix, name extraction | `getTokensByGroup(project, 'color')` | MCP tool listing "color tokens" benefits from consistent grouping rather than reimplementing prefix logic |
| `AllTokens.tsx:23-28` | Token grouping by dot-prefix | `getGroupedTokens(project)` returning `Map<string, Token[]>` | MCP could expose "list tokens by category" — same grouping logic |
| `ScreenSizes.tsx:14-15` | Breakpoint sorting by numeric width | `getSortedBreakpoints(project)` | MCP returning breakpoints in size order makes responses more usable |
| `ComponentProperties.tsx:128-134` | Tier-aware property visibility (hiding sections for Heading/Divider) | `getEditablePropertiesForNode(project, nodeRef)` | MCP could use this to tell the AI which properties are valid to set on a given node, avoiding invalid tool calls |

### Stays in UI (purely visual/interaction concerns)

| Current Location | Business Logic | Why UI-Only |
|---|---|---|
| `LayoutCanvas.tsx:41-68` | `synthesizePagedLayoutTree()` — page mode detection, tree for canvas rendering | Builds a UI-renderable tree structure for the visual canvas. MCP doesn't render a canvas. |
| `LayoutCanvas.tsx:126-145` | `materializePagedLayout()` — synthetic page materialization for canvas | Same — canvas rendering concern. |
| `ComponentProperties.tsx:42-47` | `isLayoutId()` / `nodeIdFromLayoutId()` — selection type detection | "Selection" is a UI concept. MCP knows its targets by key. |
| `AllTokens.tsx:6-8` | `isHexColor()` validation | UI swatch color display. |

**Rule of thumb:** If the logic is about *what data to write* or *how to validate input*, it belongs in studio-core. If it's about *what to show the user* or *how to organize things on screen*, it stays in the UI.

## Section 9: Testing Strategy

### Studio-Core Helper Tests (Vitest — `packages/formspec-studio-core/tests/`)

These are the most important tests. Business logic lives here, both consumers (Studio + MCP) depend on it.

- `setColumnSpan` / `setRowSpan` — writes correct `style.gridColumn` / `style.gridRow` values, clamps to valid range, handles existing style properties without clobbering.
- `setPadding` — writes `style.padding`, preserves other style keys.
- `getPropertySources` — resolves all cascade levels correctly, handles missing levels, returns sources in precedence order.
- `getEditableThemeProperties` — returns correct property descriptors for different item types.
- `resolveLayoutInsertTarget` — correct parent node for different page modes.
- `getItemOverrides` — returns current overrides for an item, clean API.
- `addStyleOverride` — validates key/value, preserves existing style keys.
- `validateTokenName` — rejects invalid characters, handles edge cases.
- `applyBreakpointPresets` — sets standard breakpoints correctly.
- `summarizeSelectorRule` — human-readable summaries for different match combinations.
- `getTokensByGroup` / `getGroupedTokens` — correct prefix filtering, consistent grouping.
- `getSortedBreakpoints` — numeric sort order.
- `getEditablePropertiesForNode` — correct property sets for different component types.

### UI Unit Tests (Vitest + jsdom)

- `useResizeHandle` — snap math, min/max clamping, axis constraint.
- Inline toolbar rendering per container type — correct controls surface for Grid vs Stack vs Card etc.
- Popover content — Tier 3 properties render and commit correctly.
- Dirty guard — popover blocks dismiss when inputs have uncommitted changes.

### Integration Tests (Vitest + jsdom)

- Canvas renders Grid containers with actual CSS grid and correct `grid-template-columns`.
- Canvas renders Stack containers with correct flex-direction.
- Field blocks inside a Grid get `grid-column: span N` matching their `style.gridColumn`.
- Selection of a container shows the inline toolbar with the right controls for that type.
- Overflow button opens popover with Tier 3 properties.
- Property changes via toolbar/popover propagate to the project state via studio-core helpers (not direct handler calls).

### E2E Tests (Playwright)

- Drag-resize a field's right edge in a Grid, verify column span updates.
- Drag-resize a Grid container to change column count.
- Drag-reorder a field within a Grid (spatial placement).
- Drag a tray item into a specific container.
- Change container direction via toolbar, verify canvas re-lays out.
- Verify right sidebar shows live preview and updates when layout changes.
- Toggle to Theme mode, verify full-width preview renders.
- Click a field in Theme mode preview, verify override popover appears with cascade info.
- Change a color token in the sidebar, verify the preview updates.
- Add a selector rule, verify it applies to matching fields in the preview.
- Existing layout E2E tests updated to work with new component structure.
- Verify Theme tab is no longer in the header tab bar.

### What We Don't Test

- Exact pixel positions of resize snapping (fragile, renderer-dependent).
- Preview rendering fidelity (that's the webcomponent's responsibility).
