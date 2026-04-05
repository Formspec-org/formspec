# Layout Workspace Direct Manipulation — Design Audit

**Date:** 2026-04-04
**Status:** Findings
**Scope:** `packages/formspec-studio/src/workspaces/layout/`
**Audits:** `thoughts/specs/2026-04-02-layout-workspace-direct-manipulation.md`

## Summary

Combined four-pass audit of the Layout Workspace Direct Manipulation Redesign spec and its current implementation:

1. **Visual design audit** (V-01 through V-11) — formspec-visual-designer agent. Spec read + full implementation code review of LayoutCanvas, LayoutContainer, FieldBlock, InlineToolbar, PropertyPopover, ThemeAuthoringOverlay, ThemeOverridePopover, LayoutThemeToggle, useResizeHandle, DisplayBlock, InlineExpression, Shell.tsx sidebar wiring, and render-tree.tsx.
2. **Service design audit** (SD-01 through SD-14) — formspec-service-designer agent. Interaction model, user journeys, data correctness, cross-workspace seams, MCP parity. Implementation review of the same files plus studio-core helpers (layout-helpers.ts, layout-ui-helpers.ts, layout-context-operations.ts), MCP tools (component.ts, theme.ts, style.ts), and LayoutDndProvider.
3. **Scout audit** (SC-01 through SC-10) — formspec-scout agent. Spec vs implementation gaps, missing features, dead code, wiring gaps, test coverage, cross-cutting concerns.
4. **Code quality audit** (CQ-01 through CQ-16) — code-scout agent. Naming, module boundaries, type safety, duplication, dependency direction, component design.

51 unique findings total. See the implementation status snapshot below and the unified priority list at the end.

## Implementation Status Since Audit

The current tree has already landed most of the layout/theme authoring path that this audit called out. The implementation touches `packages/formspec-studio/src/workspaces/layout/InlineToolbar.tsx`, `LayoutCanvas.tsx`, `PropertyPopover.tsx`, `ThemeAuthoringOverlay.tsx`, `LayoutPreviewPanel.tsx`, `LayoutModeContext.tsx`, `FieldBlock.tsx`, `DisplayBlock.tsx`, `packages/formspec-studio-core/src/layout-helpers.ts`, `packages/formspec-studio/src/components/ui/FELEditor.tsx`, and the MCP tools in `packages/formspec-mcp/src/tools/`.

### Resolved

- Visual design: `V-01`, `V-02`, `V-03`, `V-04`, `V-07`, `V-08`, `V-09`, `V-10`, `V-11`.
- Service design: `SD-01`, `SD-02`, `SD-03`, `SD-04`, `SD-05`, `SD-06`, `SD-07`, `SD-08`, `SD-09`, `SD-10`, `SD-12`, `SD-13`, `SD-14`.
- Scout: `SC-01`, `SC-02`, `SC-03`, `SC-04`, `SC-05`, `SC-06`, `SC-07`, `SC-08`, `SC-09`.
- Code quality: `CQ-01`, `CQ-02`, `CQ-03`, `CQ-04`, `CQ-05`, `CQ-06`, `CQ-07`, `CQ-08`, `CQ-09`, `CQ-10`, `CQ-11`, `CQ-12`, `CQ-13`, `CQ-14`, `CQ-15`, `CQ-16`.

No items from the prioritized backlog remain open.

---

## Finding V-01: Inline Toolbar Overflows on Narrow Containers

**Severity: High**

### What the spec says

Section 3 specifies "one row, no scrolling" for the inline toolbar. This is asserted but not enforced.

### What the implementation does

`InlineToolbar.tsx` renders all per-type controls in a single `flex items-center gap-1 flex-1 min-w-0` row. The controls for Grid are: `[−][2][+]` stepper, gap `<select>`, padding `<select>`, condition chip, and `[...]`. For Stack: two direction icon buttons, wrap button, two selects, condition chip, and `[...]`. This is seven interactive elements at 24px height each, all competing for the header row of a container whose width is determined by the canvas layout.

### The failure case

A Grid container spanning one column of a 3-column parent Grid will be roughly 200-250px wide on a 980px canvas (`max-w-[980px]` per `LayoutCanvas`). The Grid toolbar alone — stepper (50px) + gap select (60px) + padding select (60px) + condition chip (variable, but at minimum ~80px for placeholder text "Always visible") + overflow button (24px) + gaps — totals approximately 290px minimum. This overflows at 200-250px. The `flex-1 min-w-0` on the toolbar wrapper clips without warning and the user loses controls silently — no truncation indicator, no scroll, no wrapping.

The condition chip is the primary offender. At 11px font in a `font-mono` chip, "Always visible" renders at ~80px. When a condition is set (e.g., `item.status == "active"`), the chip expands further. The chip sits between the per-type controls and the `[...]` button with no priority system.

### The visual domino chain

Container narrow due to grid nesting → inline toolbar `flex-1 min-w-0` clips → critical controls (stepper, gap) disappear from view → `[...]` overflow button may itself be clipped → user has no visible editing path. First domino: the spec's "one row, no scrolling" directive was adopted without a minimum-width analysis for the narrowest realistic containers.

### Recommendation

**Component restructure.** The toolbar needs a priority cascade:

1. Establish a minimum toolbar width threshold (~180px) below which the toolbar collapses entirely and selection opens the `[...]` popover directly (auto-open on click rather than requiring a second click). The container shows only the type badge and `[→]` popover indicator.
2. When toolbar width is 180-300px: show only the most critical 1-2 controls + condition chip as icon-only (no text placeholder) + `[...]`.
3. Width >300px: current full-width behavior.

The condition chip must respect `min-w-0 flex-shrink` and truncate its content, not grow unbounded. Currently the `InlineExpression` chip renders with `inline-flex` but has no explicit max-width or truncation — the containing `<span data-testid="toolbar-condition-chip">` also has neither. Fix: cap the chip at `max-w-[120px]` with `overflow-hidden` and a tooltip showing the full expression on hover.

The `[...]` overflow button must be the last element and must always be visible. Currently it has no `shrink-0` — it can be clipped. Fix: add `ml-auto shrink-0` to ensure it's always pinned right regardless of content width.

---

## Finding V-02: Resize Handle Hit Target Below Usable Threshold

**Severity: High**

### What the spec says

Section 2: "Resize handles must be at least 8px wide/tall (touch: 24px with invisible extended hit area)."

### What the implementation does

`FieldBlock.tsx` renders the right-edge resize handle as:
```
className="absolute inset-y-0 right-0 w-2 cursor-col-resize hover:bg-accent/30 rounded-r"
```
`w-2` = 8px. This is the visual area **and** the hit area — there is no invisible extended touch zone. `DisplayBlock.tsx` has identical treatment.

### The visual problem

8px is the minimum WCAG pointer input target recommendation for desktop, and it's inadequate for a drag interaction. WCAG 2.5.5 recommends 44x44px for pointer targets (Level AAA) and 24x24px minimum (Level AA). A drag target needs to be larger than a click target because the user must both acquire and hold it. At 8px, the user's cursor must be positioned within an 8-pixel strip at the exact right edge of an element. On a 980px wide canvas at 100% zoom, the visual affordance is barely perceptible — users won't know it's draggable unless they happen to hover precisely.

The spec acknowledges the touch target issue but the implementation doesn't have a touch target at all. The `onPointerMove` handler is on the handle element itself, not on the document, which means if the user's cursor leaves the 8px strip during the drag, the move event stops firing. The pointer capture (`setPointerCapture`) in `useResizeHandle` addresses this correctly — captured pointer events fire on the element even when the cursor leaves — but the initial acquisition target remains 8px.

The hover feedback (`hover:bg-accent/30`) only appears on the 8px strip itself, giving no preview that the edge is draggable. The spec says "visually distinct from the container border" — `border-muted` and `hover:bg-accent/30` on an 8px strip do not achieve this at a glance.

### Recommendation

**CSS fix + implementation gap.**

The touch/pointer zone must be expanded without changing the visible width. Standard pattern: use a pseudo-element or an absolutely positioned invisible overlay:

```css
/* 8px visible, 24px touch zone */
.resize-handle::after {
  content: '';
  position: absolute;
  inset-y: 0;
  right: -8px;
  width: 24px;
}
```

In Tailwind terms: add a child `<span>` that is `absolute inset-y-0 -right-2 w-6 cursor-col-resize` (invisible, z-higher than the border) and move the pointer handlers there. The visual handle stays at `w-2`.

Additionally, introduce an always-visible drag indicator at the right edge when the parent container is selected — not just on hover. A 2px line in `accent/50` with a small grabber dot (3px circle) at center communicates draggability without requiring hover discovery. This is standard in tools like Figma and Linear's table resize.

For the `onPointerMove` handler: it is correctly attached to the handle element (and pointer capture makes this work), but test with touch devices — `Touch` events are not the same as `Pointer` events on some older WebKit versions. Verify `touch-action: none` is set on handle elements to prevent scroll conflict on mobile.

---

## Finding V-03: Theme Mode Has No Visual Authoring Signal

**Severity: High**

### What the spec says

Section 7: "In Theme mode, the preview must NOT behave as a live interactive form — clicking an input should open the theme override popover, not focus the input." The overlay intercepts pointer events. The spec does not specify what visible signal communicates the authoring-not-interactive distinction.

### What the implementation does

`ThemeAuthoringOverlay.tsx` renders a `position: absolute; inset: 0; z-index: 10; pointer-events: all; background: transparent; cursor: crosshair` div. The only visual signal is the `cursor: crosshair`. The form below renders normally — fields look like interactive inputs.

### The visual failure

Users who open Theme mode for the first time see what appears to be a fully interactive form. They will try to type into a text field. The cursor changes to crosshair on hover, but crosshair is also used for drawing tools and selection tools in many contexts — it does not universally communicate "click to select for theme editing." A user who doesn't understand the metaphor will be confused why their keyboard input isn't working.

The `ThemeOverridePopover` appears anchored at `position.x + 12, position.y + 12` from the click event, as a `fixed z-50 w-80` panel. This is a floating panel that appears to emerge from the click location. This is fine spatially but lacks visual connection to the selected field — the user clicked a field and a panel appeared near their cursor, but there's no visual affordance connecting the popover to the field (no selection ring on the field itself, no arrow/caret, no highlight).

The `ThemeAuthoringOverlay` receives `selectedItemKey` as a prop but does nothing with it. The currently selected field is not highlighted in the preview — you can't tell which field is "active" after selecting.

### The visual domino chain

Transparent overlay with crosshair only → user doesn't know they're in authoring mode → no indication of which field is selected after clicking → popover appears near cursor but no visual connects it to the field → user loses track of what they're editing when scrolling or when popover is open.

### Recommendation

**Component restructure** for the overlay plus **design addition** for mode communication.

**Mode communication (required before ship):**
A persistent banner or header badge indicating "Theme Editing Mode" with a brief hint. Suggest a thin colored bar at the top of the preview area (2px `bg-accent`) or a pill badge `"Theme Mode — Click a field to override"` in the canvas toolbar area, visible while in Theme mode. This is not heavy-handed — it's the same pattern as Storybook's "Docs/Canvas" toggle, Webflow's "Design/Symbol" mode, etc.

**Selected field highlight (required):**
The overlay knows `selectedItemKey` and it already sets `data-selected-key`. The overlay should apply a visual highlight ring to the selected field in the underlying `<formspec-render>` preview. This requires rendering an absolutely-positioned highlight ring at the field's bounding rect. Implementation: when `selectedItemKey` changes, call `document.querySelector('[data-bind="' + selectedItemKey + '"]')` (with the overlay temporarily hidden), read `.getBoundingClientRect()`, and render a `position: fixed; border: 2px solid accent; border-radius: 4px; pointer-events: none` overlay at those coordinates. This ring makes it immediately clear which field the open popover is governing.

**Crosshair augmentation:**
The crosshair cursor is acceptable but should only appear on elements that are selectable (those with `data-bind`). On non-field areas (form header, submit button, empty space), use `default` cursor. This signals that only certain areas are "clickable for editing." Currently the entire overlay area gets crosshair regardless.

---

## Finding V-04: ThemeOverridePopover Viewport Overflow

**Severity: Medium**

### What the implementation does

`ThemeOverridePopover` is `fixed z-50 w-80` positioned at `{ left: position.x, top: position.y }` where position comes from `handleThemeFieldSelect` as `{ x: clientX + 12, y: clientY + 12 }`.

### The failure cases

The popover is 320px wide (`w-80`). If a user clicks a field in the right half of the preview area (x > viewport_width - 332px), the popover extends beyond the viewport right edge. At a 1280px viewport, clicking anything with x > 948px causes right-edge overflow. Similarly, clicking a field near the bottom causes bottom overflow — the popover has no maximum height constraint and can exceed the viewport on forms with many theme properties.

The popover has `overflow-y-auto` on its content area, which handles internal scrolling, but the `flex flex-col` wrapper itself has no `max-height`. On a form with 8 theme properties (all the editable PresentationBlock props listed in Section 7), each `OverrideRow` renders at approximately 60px tall, producing a 480px+ popover body. On a 768px viewport, this may extend below the fold.

### Recommendation

**CSS fix.**

Apply standard popover viewport clamping:

```css
style={{
  left: Math.min(position.x, window.innerWidth - 340),
  top: Math.min(position.y, window.innerHeight - 400),
  maxHeight: 'min(480px, calc(100vh - 32px))',
}}
```

These values should be computed reactively if the user resizes the window while the popover is open. A `useEffect` with a `ResizeObserver` on the popover container handles this.

Additionally, consider flipping the popover to open upward when the click y-position is in the bottom half of the viewport, and leftward when in the right half. This is the standard "smart placement" pattern (Floating UI's `flip` middleware). Given the popover is already a `fixed` element, this is a straightforward state-driven position calculation.

---

## Finding V-05: `when` vs `relevant` Callout Has Insufficient Visual Weight

**Severity: Medium**

### What the spec says

Section 3: The FEL editor opened from the Tier 2 chip must include "a persistent callout: 'This controls rendering visibility only. To exclude data from the response or clear values when conditions change, configure `relevant` in the Editor workspace.'"

### What the implementation does

`InlineExpression.tsx` accepts `expressionType?: 'when' | 'calculate' | 'default'` and passes it to `FELEditor`. The `InlineToolbar` passes `expressionType="when"`. Whether `FELEditor` actually renders this callout is not visible in the files audited, but the `expressionType` pipe is wired.

### The visual concern

Assuming `FELEditor` renders the callout, the callout lives inside the FEL editor UI, which is a secondary surface (the inline edit mode of `InlineExpression`). The callout addresses a behavioral difference that has data-correctness implications — authors who don't see it may build forms where fields are conditionally hidden but their data still submits. This is a spec-level distinction (`when` vs `relevant`) that has real consequences for form responses.

A callout buried inside an expression editor that only appears when actively editing the expression is insufficient for discoverability. Authors who set `when` by copying a pattern from another field may never open the FEL editor themselves — they may paste a value programmatically or via MCP. The distinction needs to surface at the chip display level, not only in the editing UI.

### Recommendation

**Design addition.**

When a `when` condition is set (chip shows expression), append a small warning indicator adjacent to the chip — a `⚠` icon at 10px in `text-warning/70` with tooltip text "This hides the component only. Use `relevant` in the Editor to control data." This is one icon, visually quiet, but present whenever the condition is active. It's not an error state — it's an educational nudge.

Additionally, the placeholder text "Always visible" is accurate but doesn't communicate that setting a condition here only controls rendering. Consider "Always shown (rendering only)" as the placeholder — it primes the author that this is a rendering concern before they start typing.

---

## Finding V-06: Ghost Overlay, Column Guides, and Numeric Tooltip Not Implemented

**Severity: Medium**

### What the spec says

Section 2: "Ghost overlay showing the target size. Column guides (light dashed lines) appear on the parent Grid during column-span drags. Numeric tooltip near the cursor showing the current value."

### What the implementation does

`useResizeHandle` calls `onResize(snapped)` on every `pointermove`, which triggers `handleResizeColSpan` → `setColumnSpan` → updates `style.gridColumn` → React re-renders. The field's CSS grid column span changes in real time. There is no ghost overlay, no column guides, and no numeric tooltip.

### The visual impact

Without the ghost overlay and column guides, the user is directly manipulating the final state during drag. This is actually fine for immediate feedback, but it means there's no visual disambiguation between "what it will be" and "what it is." The real-time approach is defensible but creates a problem: every intermediate snap value triggers a state write, producing undo history entries for each step of the drag. If the user drags from span-1 to span-3, they get two intermediate undo steps (span-1→2, 2→3) in addition to the final value. This clutters the undo stack.

The numeric tooltip is also missing. During drag, the user can see the field visually resizing, but there's no numeric confirmation of the exact span value. In a 4-column grid, "the field looks about half width" is ambiguous — is it span-2 or span-3?

The column guides (dashed lines showing the grid column boundaries) are absent. Without them, the user is performing proportional drag without reference points. The snap behavior works, but the user has no visual explanation for why the field seems to "jump" to specific widths.

### Recommendation

**Implementation gap** that should have been caught by the spec before approval. These are specified behaviors, not stretch goals.

**Column guides** can be rendered by the parent `LayoutContainer` when `isDragActive` is true for a resize (not for a reorder drag). For resize, add a separate `isResizing` prop or context, and when true, render `columns` number of absolutely-positioned `1px border-dashed border-accent/30` vertical dividers at `(100 / columns * n)%` from the left.

**Numeric tooltip** is straightforward: inside `useResizeHandle`'s `onPointerMove`, derive and expose the current snap value. The handle element can render a `position: fixed; pointer-events: none` tooltip div tracking `clientX + 12, clientY - 24` with the current span value.

**Undo stack pollution**: debounce or batch the `setColumnSpan` write — call it on `pointerup` only, not on every `pointermove`. The visual re-render can happen immediately (local state in the hook), but the actual write to the project state (which creates undo history) should be deferred to drag-end. This requires splitting the hook's `onResize` callback into `onDrag` (visual-only) and `onCommit` (state write).

---

## Finding V-07: PropertyPopover Renders Inline, Not Floating

**Severity: Medium**

### What the implementation does

In `FieldBlock.tsx`, the `PropertyPopover` is called with:
```tsx
anchorRef={{ current: null }}
```

The `PropertyPopover` accepts `anchorRef: React.RefObject<HTMLElement | null>` but the `FieldBlock` passes a literal `{ current: null }` object — an always-null ref. The popover cannot position itself relative to the overflow button.

In `LayoutContainer.tsx`, `overflowRef` is a proper `useRef<HTMLButtonElement>(null)` passed to the overflow button and then to `PropertyPopover`. The overflow button ref is wired correctly for containers but the button itself never actually gets the ref assigned — looking at the container JSX, `overflowRef` is declared but the `InlineToolbar`'s overflow button (which is an internal button in `InlineToolbar.tsx`) never receives it. The ref is passed to `PropertyPopover` as `anchorRef={overflowRef}` but it stays `null`.

### The visual consequence

The `PropertyPopover` in its current form renders as a `relative z-50 w-72 rounded border` div — it uses `relative` positioning, meaning it appears inline in the DOM flow, not floating. Looking at `LayoutContainer.tsx`, the popover renders directly inside the container's JSX, not in a portal. This means the popover **is not floating** — it pushes down the container content. For a 250px-tall container, a 300px+ popover will double the container height and push other elements down. This is not a floating popover — it's an inline expanding panel.

Similarly in `FieldBlock.tsx`, the popover renders inside the field block, which will expand the field block height dramatically.

### Recommendation

**Component restructure.** The `PropertyPopover` must render in a portal (via `createPortal(content, document.body)`) and use `fixed` positioning relative to the trigger button's `getBoundingClientRect()`. The current `relative` + inline approach is not a popover — it is an accordion.

The `anchorRef` in `FieldBlock` must be wired to the actual `[...]` overflow button rendered inside `InlineToolbar`. Either:
a. `InlineToolbar` accepts and forwards an `overflowButtonRef` prop to its overflow button, or
b. `FieldBlock` uses a callback ref pattern, or
c. The popover position is computed from the field block's own bounding rect (simpler: anchor to the field's top-right corner).

---

## Finding V-08: Card Elevation Toolbar Is Visually Verbose

**Severity: Low**

### What the implementation does

`CardControls` in `InlineToolbar.tsx` renders four `ToolbarIconBtn` components labeled "0", "1", "2", "3" as a segmented selection for elevation. Each button is `h-6 min-w-[24px]` — total 4 x 32px minimum = 128px for this one control.

### The visual concern

Four numbered icon buttons for elevation levels don't communicate what elevation visually means — the labels "0/1/2/3" are abstract without showing the shadow intensity. In the already-constrained toolbar, this 128px block is the heaviest single control and is displayed before the padding select and condition chip. On a medium-width container (300-400px), this leaves roughly 100-170px for everything else including the condition chip.

The elevation control is not frequently used — most authors set elevation once and forget it. Per the spec's own tier framework, infrequently-used properties belong in Tier 3 (popover), not Tier 2 (toolbar). The spec lists elevation as Tier 2 ("Card: elevation indicator"), but in practice, elevation is a one-time setup property, not a property authors adjust during layout sessions.

### Recommendation

**Design revision.**

Move elevation to the Tier 3 popover for Cards and replace it in Tier 2 with a single elevation indicator that shows the current value and is clickable to increment (or a compact `0↑3` stepper). This frees ~80px in the toolbar for the condition chip.

If elevation must stay in Tier 2, replace the 4-button segmented control with a compact stepper (`−[1]+`) — same pattern as the column stepper, 50px total — which saves 78px.

---

## Finding V-09: Toolbar Header Crowding From Two Segmented Controls + Action Buttons

**Severity: Low-Medium**

### What the implementation does

`LayoutCanvas.tsx` renders the sticky header with:
- `ModeSelector` (flow mode: single/wizard/tabs — a segmented control)
- `LayoutThemeToggle` (Layout/Theme — another segmented control)
- `+ Item` button
- `+ Page` button (conditional)
- Seven `+ {ComponentName}` buttons (Card, Stack, Grid, Panel, Accordion, Collapsible, ConditionalGroup)

This is two segmented controls + up to ten action buttons in one flex-wrapped row. On a 980px canvas with the left blueprint sidebar visible (typically 240-280px wide), the canvas area is 700-740px. The two segmented controls take ~180-200px. The remaining ~500px must accommodate 9-10 buttons at ~70-80px each — this wraps at least once, potentially twice.

### The visual consequence

The toolbar wraps into 2-3 rows, making the sticky header significantly taller. Sticky headers grow downward, consuming canvas scroll real estate. With a 2-row wrap, the sticky zone is ~90-100px. On a 768px viewport, this leaves only ~670px of visible canvas, and the UnassignedTray at the bottom is partially obscured on first load.

The Layout/Theme toggle and the flow mode selector (ModeSelector) are visually undifferentiated — both are segmented pill controls with similar styling. Two segmented controls side-by-side without visual separation creates a "controls soup" where their hierarchy is unclear.

### Recommendation

**Design revision.**

The seven `+ Container` buttons are the main offenders. Move them into an `+ Add Container` dropdown or split button — one button that opens a compact popover with the seven container types as a grid of icon buttons (similar to a "shape picker" in Figma). This collapses 7 buttons into 1, freeing ~420px.

The `+ Item` button and container add button are related — consider a single `+ Add` button with a dropdown that shows both field types and container types in one palette. The spec already has `AddItemPalette` for field types — extend it to include containers.

The `LayoutThemeToggle` and `ModeSelector` should be visually separated — a `|` divider or `mx-2` gap between them signals they control different orthogonal concerns (flow mode vs. editing mode). Currently they are `gap-3` apart with no visual hierarchy signal.

---

## Finding V-10: Theme Mode Click Misses Produce No Feedback

**Severity: Low**

### What the implementation does

`LayoutContainer.tsx` renders an empty container as a dashed placeholder with "Drop items here" — correct for Layout mode. In Theme mode, clicking on an empty area of the preview (no `data-bind`) produces no feedback. The `ThemeAuthoringOverlay` comment says "no-op" for areas without `data-bind`. But authors may click on container-level elements (Card borders, Stack padding areas) expecting to configure them. Currently these clicks are silently swallowed.

### Recommendation

**UX gap.** Add a visual "miss" feedback for clicks on non-selectable areas in Theme mode — a brief flash or a status message: "Click a field to edit its theme properties." This can be a transient `aria-live="polite"` notification that clears after 2 seconds. Container-level theme overrides are a spec extension for a future version; the current behavior of "containers not selectable" is correct per the implementation comment, but authors need feedback that the click was received and understood.

---

## Finding V-11: LayoutMode State Resets Silently on Tab Switch

**Severity: Low**

### What the implementation does

`Shell.tsx`:
```tsx
const layoutModeCtx = useOptionalLayoutMode();
const isThemeMode = layoutModeCtx?.layoutMode === 'theme';
if (compactLayout || showChatPanel || isThemeMode) return null;
```

The right panel hides when Theme mode is active. This is correct behavior per the spec. However, the `LayoutModeContext` is initialized with `layoutMode = 'layout'` and `LayoutCanvas.tsx` maintains local state (`localLayoutMode`) that syncs to the context via `layoutModeCtx?.setLayoutMode(mode)`.

The fragility: if the context is not mounted (e.g., `useOptionalLayoutMode` returns `undefined` because the provider isn't in the tree), `isThemeMode` is `false` and the sidebar correctly shows. But the shell also renders `<LayoutModeProvider>` at the workspace level — if the provider unmounts and remounts (e.g., during a tab switch away and back), the mode resets to `layout`. This is likely correct behavior, but it means the mode is **not preserved** when the user switches away from the Layout tab and returns. The spec doesn't address this explicitly, but users who switch to Mapping and back will lose their Theme mode state.

### Recommendation

**Design clarification needed.** Decide whether the Layout/Theme mode toggle should persist across tab switches. If yes, hoist the mode state to the Shell level. If no, document that switching tabs resets to Layout mode — and add a visual indicator (the toggle returns to "Layout") so the user isn't surprised. Currently the reset is silent.

---

---

# Part 2: Service Design Findings

---

## Finding SD-01: Undo Stack Polluted on Every Drag Step — Phantom Entries Corrupt Undo History

**Severity: Critical — Data Loss Risk**

### The interaction

A user drags the right edge of a field in a 4-column Grid from span-1 to span-3. This is a single intentional edit.

### What happens

`useResizeHandle.ts` calls `onResize(snapped)` on every `pointermove` (line 71). In `LayoutCanvas.tsx`, `handleResizeColSpan` calls `setColumnSpan(project, ref, newSpan)` (line 218-222). `setColumnSpan` calls `project.setNodeStyleProperty(ref, 'gridColumn', ...)` which writes to project state. Every project state write creates an undo history entry.

The complete drag from span-1 to span-3 creates two intermediate undo entries: span-1→2 and span-2→3. The user presses Cmd+Z once expecting to undo "the resize." They land on span-2. They press again and land on span-1. Two undos for one interaction.

On a form with a 4-column Grid and six fields, a casual layout session (adjust each field's span once) may produce 20-40 phantom undo entries, making undo an unreliable recovery mechanism.

### What should happen

`useResizeHandle` needs two callbacks: `onDrag(value)` for visual feedback only (local component state, no project write), and `onCommit(value)` called on `pointerup` only. The `FieldBlock` updates its own CSS grid column during drag using local state from `onDrag`, then commits the single final value via `onCommit`. This is a well-established pattern (Figma's resize, VS Code's split pane).

The fix is a single API change to `UseResizeHandleOptions`: replace `onResize` with `onDrag` + `onCommit`. The FieldBlock passes a `gridColumnStyle` override from local drag state during drag, falling back to `nodeStyle.gridColumn` when not dragging. One undo step for one drag.

**Note:** V-06 also identifies undo pollution from the visual design perspective. This finding focuses on the data loss and recovery implications.

---

## Finding SD-02: Mode Switch Silently Discards Unsaved Popover Edits

**Severity: Critical — Data Loss Risk**

### The interaction

A user is in Layout mode editing a component's accessibility properties via the `PropertyPopover`. They've typed a new ARIA label but haven't blurred (or pressed Enter) — the `draft` local state in `PopoverInput` differs from the committed value. They then click the Layout/Theme toggle.

### What happens

`handleModeChange` in `LayoutCanvas.tsx` (line 285-294) calls `setLocalLayoutMode(mode)` and `layoutModeCtx?.setLayoutMode(mode)` immediately, with no check for open popovers or dirty inputs. The Layout canvas re-renders in Theme mode. `PropertyPopover` — which renders inside `FieldBlock` or `LayoutContainer` — is unmounted. The `draft` value is discarded. The user's ARIA label is gone with no warning.

The same scenario applies to `ThemeOverridePopover` when switching from Theme back to Layout: an open override form with unsaved input is destroyed.

The popovers have a `DirtyGuardConfirm` component with the correct behavior on X-close. But that guard only fires when the user clicks the close button inside the popover — it has no hook into the external mode toggle trigger.

### What should happen

`handleModeChange` must check if any popover is currently open with dirty state before switching modes. Option: `handleModeChange` calls `setPopoverOpen(false)` for all open popovers before changing mode, and if `dirtyInputs.size > 0` in any open popover, shows the "Discard changes?" prompt. The dirty state needs to be lifted or observed from outside the popover components.

---

## Finding SD-03: `when` Callout Is an Interaction Dead End — No Navigation to Editor

**Severity: High — Discoverability / Data Correctness**

### The interaction

A user wants to hide a field based on a condition AND exclude its value from the form response. They click the condition chip in the Layout workspace, read the callout ("This controls rendering visibility only. To exclude data from the response or clear values when conditions change, configure `relevant` in the Editor workspace."), and understand they need to go to the Editor.

### What happens

There is no navigation mechanism in the callout. The user must: remember the field key, switch to the Editor tab, scroll through the field list to find the field (possibly deep in a group hierarchy), open its properties panel, navigate to the Binds section, find and configure the `relevant` bind. On a form with 30+ fields in nested groups, this takes 30-60 seconds with potential for losing context.

A user who is confused by the difference will often skip this entirely, resulting in forms where conditionally hidden fields still submit data — a silent correctness defect in produced responses.

### What should happen

The callout's text should include a link/button: "Configure in Editor →". Clicking it navigates to the Editor tab (via the existing `formspec:navigate-workspace` custom event in Shell.tsx, line 347), selects the same field, and opens the Binds section. The shell event system already supports this. The implementation cost is low: the callout needs access to `itemKey` and the ability to dispatch the navigate event.

**Note:** V-05 covers the visual weight of the callout at the chip level. This finding focuses on the interaction dead end — even if the callout were perfectly visible, the user has no way to act on it without manual navigation.

---

## Finding SD-04: Theme Override Inputs Accept Invalid Enum Values — Authors Write Invalid Data

**Severity: High — Data Correctness**

### The interaction

A user opens the ThemeOverridePopover for a field, sees the `labelPosition` property, and types `"left"` as an override. This is not a valid enum value (`"top"` | `"start"` | `"hidden"` per Theme spec §4). The input commits on blur. No validation error appears. The theme document now contains `items.{key}.labelPosition = "left"` which the renderer ignores (or falls back to default), but the user believes it's set.

### What happens

`getEditableThemeProperties` in `layout-helpers.ts` returns a fixed list: `['labelPosition', 'widget', 'widgetConfig', 'style', 'cssClass', 'accessibility', 'fallback']` (line 118-126). These are passed to `OverrideRow` in `ThemeOverridePopover.tsx`, which renders a generic text input for every property regardless of type. `onCommit` calls `setThemeOverride(project, key, prop, value)` with the raw string.

There is no type-aware widget, no enum validation, no error on invalid value. `getEditableThemeProperties` ignores its `_project` and `_itemKey` parameters entirely — it returns the same list for all item types. A `Heading` node (which has no label position) gets the full property set.

### What should happen

`getEditableThemeProperties` should return type-specific property sets based on the item's actual component type. Properties with known string enums (`labelPosition`, `widget`, `fallback`) must render as `<select>` with the valid options, not `<input type="text">`. The studio-core function signature should evolve to return `{ prop: string; type: 'enum' | 'string' | 'object'; options?: string[] }[]` so both Studio UI and MCP can render/validate correctly.

---

## Finding SD-05: Selection Handoff Opens Popover at (0,0)

**Severity: High — Interaction Model**

### The interaction

A user selects the `email` field in Layout mode. They toggle to Theme mode to adjust its label position. The spec says: "Theme mode opens with that field's override popover pre-opened (the preview scrolls to and highlights the corresponding rendered field)."

### What happens

`handleModeChange` in `LayoutCanvas.tsx` (lines 286-293) sets `themeSelectedKey` from the canvas selection. Since `!!themeSelectedKey` is now true, `ThemeOverridePopover` renders as `open`. But `themePopoverPosition` is still `{ x: 0, y: 0 }` (its initial state — no update is triggered by the mode switch). The popover opens at `fixed; left: 12px; top: 12px` — the top-left corner of the viewport.

Additionally, the spec says the preview "scrolls to and highlights the corresponding rendered field." Neither happens — no `scrollIntoView`, no highlight ring.

### What should happen

The mode switch handler must: find the DOM element in the preview via `document.querySelector('[data-bind="' + key + '"]')`, compute `getBoundingClientRect()`, set `themePopoverPosition` from the element's position, and scroll the preview to bring the element into view. If no DOM element is found, fall back to opening the popover at center of the preview area with a tooltip.

---

## Finding SD-06: ConditionalGroup's Data Semantics Are Invisible at Authoring Time

**Severity: High — Data Correctness**

### The interaction

A user right-clicks a field in the Layout canvas and selects "Wrap in Conditional Group." They set a `when` expression on the group. They test the form, see the group hide when their condition is false, and assume the hidden fields' data won't submit.

### What happens

`ConditionalGroup` (Component spec §5.18) is a visual-only container that preserves data when its `when` condition makes it non-rendering. This is its documented purpose. But in the Layout workspace:

1. `CONTAINER_PRESETS` in `LayoutCanvas.tsx` lists ConditionalGroup alongside Card, Stack, Grid — containers with no data semantics.
2. The context menu offers "Wrap in Conditional Group" with no description distinguishing it from "Wrap in Collapsible."
3. The inline toolbar shows only the `when` chip and `[...]` overflow — same UI as any other container.

An author who wants "hide these fields and clear their data when condition is false" should use a group with `relevant` in the Definition. A ConditionalGroup is precisely NOT that. Nothing in the Layout workspace disambiguates.

### What should happen

Two options:
1. **Rename in UI**: "Wrap in Conditional Group (data preserved)" — the parenthetical is non-optional for safety.
2. **Callout on selection**: When a ConditionalGroup is selected, the toolbar shows a persistent note: "Hidden when: [condition]. Data is still submitted when hidden. Use `relevant` in the Editor to exclude data."

This is the same `when`/`relevant` callout pattern as SD-03 but surfaced at the container level.

---

## Finding SD-07: Delete Key Does Nothing in Layout Workspace

**Severity: High — Missing Feature**

*Corrected by scout audit (SC-06): the original finding incorrectly claimed the Delete key fires `removeItem`. It actually does nothing at all.*

### The interaction

A user selects a Card layout container in the Layout canvas. The user presses the Delete key.

### What happens

`keyboard.ts:81` has a guard: `if (workspace && workspace !== 'Editor') return;` — the delete handler exits early for ANY workspace that isn't Editor. Since `Shell.tsx:497` sets `data-workspace={activeTab}`, the Layout workspace resolves as `"Layout"` which is `!== 'Editor'`, so the handler returns before calling `delete()`.

The Delete key does absolutely nothing in the Layout workspace. Not the wrong API — no API at all. Users must use the context menu "Remove from Tree" or the popover button to delete containers/fields.

### What should happen

Update `keyboard.ts` to allow Delete in the Layout workspace. Route through the correct API based on selection type:

```tsx
delete: () => {
  if (!scopedSelectedKey) return;
  if (activeTab === 'Layout' && scopedSelectedKey.startsWith('__node:')) {
    const nodeId = scopedSelectedKey.slice(7);
    project.deleteLayoutNode(nodeId);
  } else if (activeTab === 'Layout') {
    project.deleteComponentNode(scopedSelectedKey);
  } else {
    project.removeItem(scopedSelectedKey);
  }
  deselect();
},
```

**Files:** `packages/formspec-studio-core/src/keyboard.ts:81`, `packages/formspec-studio/src/components/Shell.tsx:320-326`

---

## Finding SD-08: MCP Cannot Perform Per-Item Theme Overrides — Feature Parity Gap

**Severity: High — MCP Parity**

### The gap

The spec's Section 0 principle: "Both the Studio UI and the MCP server consume `formspec-studio-core`. Any business logic, convenience function, or optimization that one consumer needs, the other probably needs too."

The Theme mode's headline feature — per-item theme overrides — uses `setThemeOverride`, `clearThemeOverride`, `getPropertySources`, and `getEditableThemeProperties` (in `layout-helpers.ts`).

### What the MCP can do

`handleTheme` in `theme.ts` supports: `set_token`, `remove_token`, `list_tokens`, `set_default`, `list_defaults`, `add_selector`, `list_selectors`. There is no `set_item_override`, `clear_item_override`, `get_item_overrides`, or `get_property_sources` action.

An AI agent using MCP cannot target a specific item with a per-item override. If a designer asks the AI to "make the email field use a floating label style," the AI cannot do it.

Additionally, `component.ts` dispatches directly to `(project as any).core.dispatch` with raw command types, bypassing studio-core helpers entirely. There is no MCP tool for `setColumnSpan` or `setRowSpan`.

### What should happen

Add to `handleTheme`: `set_item_override`, `clear_item_override`, `list_item_overrides` actions calling the studio-core helpers. Add `setColumnSpan` and `setRowSpan` to `handleStyle` or a new `handleLayout` tool.

---

## Finding SD-09: Two-Mode Metaphor Has No Discovery Path for Visual Properties From Layout Mode

**Severity: Medium — Learnability**

### The problem

An author who wants to change the label position for one field will:
1. Notice the field looks wrong in the sidebar preview.
2. Look for a property in the inline toolbar (not there — label position is a Theme concern).
3. Look in the overflow popover (not there — that's Tier 3: a11y, style, cssClass).
4. Eventually discover the Layout/Theme toggle.
5. Switch to Theme mode.
6. Click the field in the preview.
7. Find `labelPosition` in the popover.

Steps 2-4 are a dead zone. The user encounters two surfaces (inline toolbar, overflow popover) that look like "where properties go" but don't contain `labelPosition`. The user must know that the mode toggle exists and that visual properties live there.

### Recommendation

Two interventions:
1. The overflow popover (`PropertyPopover`) should include a "Theme properties →" link when viewing an item. This bridges the discovery gap: "I'm looking for visual properties → they're in Theme mode."
2. The right sidebar preview panel header ("Live Preview") should show a "Customize appearance →" action that switches to Theme mode.

---

## Finding SD-10: Blueprint Sidebar Section Resets on Mode Switch

**Severity: Medium — Context Loss**

### The interaction

User is in Layout mode with Blueprint sidebar showing "Component Tree." Toggles to Theme mode, adjusts a token in "Colors." Toggles back to Layout mode.

### What happens

`BlueprintSidebarInner` (Shell.tsx lines 148-188) computes `visibleSections` from `isThemeMode`. When returning from Theme mode, `activeSection` is `"Colors"` — not in the Layout mode section list. `resolvedSection` falls through to `visibleSections[0]` = `"Structure"`. The user who was viewing "Component Tree" now sees "Structure" with no indication of the change.

### What should happen

Maintain per-mode sidebar section state: `layoutModeSection` and `themeModeSection`, restored when switching back. Simple two-state memoization.

---

## Finding SD-11: Nested Grid Drop Target Disambiguation Is Broken

**Severity: Medium — Interaction Model**

### The interaction

A user creates a Stack containing a Grid with no items. They drag a field from the UnassignedTray into the inner Grid.

### What happens

Both the Stack and the inner Grid are `useDroppable` targets. The Grid is small (0 items, minimal height), so the Stack's droppable region may entirely overlap the Grid's empty placeholder. dnd-kit's default collision detection favors the first registered droppable (often the outer container). The user drops into the Stack when they intended the Grid.

### What should happen

Use dnd-kit's `closestCenter` or a custom collision detection that prefers the innermost droppable whose bounding rect contains the pointer. Alternatively, the outer container's droppable should exclude inner container bounding rects from its hit area.

---

## Finding SD-12: Sidebar Preview and Theme Mode Preview Relationship Unexplained

**Severity: Medium — Journey Coherence**

### The problem

In Layout mode, the right sidebar shows a `<formspec-render>` preview labeled "Live Preview." In Theme mode, a different `<formspec-render>` instance takes over the main canvas — no label, no connection to the sidebar version. The sidebar just disappears. A user who relied on the sidebar preview doesn't understand the transition.

### What should happen

The Theme mode canvas area should include a label: "Theme Preview — click a field to customize." Even without animation, this explains what's happening and that the sidebar preview has been promoted to the main area.

---

## Finding SD-13: Right Sidebar Collapsed State Not Reset on Tab Re-entry

**Severity: Low-Medium — State Coherence**

### The scenario

User collapses the sidebar in Layout mode (`setShowRightPanel(false)`), switches to Mapping tab, returns to Layout. `showRightPanel` is still `false` — the sidebar stays hidden. The compact "Preview" button is only rendered when `compactLayout` is true — on desktop, there's no fallback indicator that the preview is available but hidden.

### What should happen

Either reset sidebar show-state to `true` on tab entry, or show a persistent "Show Preview" affordance in the canvas toolbar when `showRightPanel === false` and `layoutMode === 'layout'`.

---

## Finding SD-14: Studio-Core UI Helpers Extracted But Not Wired Into MCP

**Severity: Low — MCP Parity / Architecture**

### The gap

The spec's Section 8 refactoring list is partially done: `validateTokenName`, `applyBreakpointPresets`, `summarizeSelectorRule`, `getTokensByGroup`, `getGroupedTokens`, `getSortedBreakpoints`, `getEditablePropertiesForNode` all exist in `layout-ui-helpers.ts`.

However, the MCP theme tool (`theme.ts`) dispatches directly to handler commands without calling any of these helpers. The promise of "both consumers use the same logic" is half-fulfilled — the helpers exist but only the Studio UI uses them.

---

---

# Part 3: Scout Findings

*Spec vs implementation gaps, missing features, dead code, wiring, test coverage. Deduplicated against V/SD findings.*

---

## Finding SC-01: FieldBlock Toolbar Column Span Stepper Is Dead — `onSetStyle` Never Wired

**Severity: Critical — Broken Feature**

`InlineToolbar.tsx` `FieldControls` (lines 402-403) calls `onSetStyle?.('gridColumn', ...)` when the stepper buttons are clicked. However, `FieldBlock.tsx` (lines 156-167) renders `InlineToolbar` WITHOUT passing `onSetStyle`. The prop is `undefined`, so `onSetStyle?.()` silently no-ops. The +/- stepper buttons for column span on fields do nothing.

The drag resize handle works because it uses a separate code path: `onResizeColSpan` → `handleResizeColSpan` → `setColumnSpan()`.

**Root cause:** `FieldBlock` does not declare `onSetStyle` as a prop. `render-tree.tsx` passes it to containers (line 175) but never to fields (lines 247-266).

**Fix:** Add `onSetStyle` to `FieldBlockProps`, thread from `render-tree.tsx`, pass to `InlineToolbar`.

**Files:** `FieldBlock.tsx:156`, `InlineToolbar.tsx:402-403`, `render-tree.tsx:261`

---

## Finding SC-02: Grid Row Span Not Implemented — Spec Feature Entirely Missing

**Severity: High — Missing Spec Feature**

The spec (Section 2) defines grid row span as a drag-resizable property with a bottom-edge handle writing `style.gridRow: "span N"` via `setRowSpan`. The studio-core helper `setRowSpan` exists in `layout-helpers.ts:40-48` but has **zero consumers**:

- No bottom-edge resize handle in `FieldBlock.tsx` or `DisplayBlock.tsx`
- No `onResizeRowSpan` callback in `LayoutRenderContext`
- No `handleResizeRowSpan` in `LayoutCanvas.tsx`
- No row span stepper in `InlineToolbar.tsx`
- No `gridRow` parsing in `render-tree.tsx`

Complete dead code in studio-core. No MCP tool exposes it either.

**Files:** `layout-helpers.ts:40-48` (implemented, unused), entire layout workspace (absent)

---

## Finding SC-03: MCP Tools Bypass Studio-Core Via `(project as any).core.dispatch` — 8 Instances

**Severity: High — Architecture Violation**

The spec's Section 0 principle says MCP tools should call studio-core helpers. Instead, 8 instances of `(project as any).core.dispatch(...)` across 6 MCP tool files bypass the entire abstraction layer:

- `theme.ts:72` — all theme mutations
- `component.ts:74,89,110` — addNode, setNodeProperty, removeNode
- `composition.ts:19`
- `behavior-expanded.ts:32`
- `mapping-expanded.ts:26`
- `migration.ts:25`

Every instance uses `as any` to circumvent the type system. When studio-core helpers add validation or clamping (e.g., `setColumnSpan` clamps to [1,12]), MCP tools don't get them. MCP could write `gridColumn: "span 99"` with no clamping.

This extends SD-08's finding (missing per-item override tools) to a systemic layer violation across all MCP tools.

**Files:** `packages/formspec-mcp/src/tools/theme.ts:72`, `component.ts:74,89,110`, `composition.ts:19`, `behavior-expanded.ts:32`, `mapping-expanded.ts:26`, `migration.ts:25`

---

## Finding SC-04: Theme Workspace Components Still Contain Original Business Logic Alongside Extracted Helpers

**Severity: Medium — Incomplete Refactoring**

The spec's Section 8 refactoring list was partially executed. Studio-core helpers exist in `layout-ui-helpers.ts`, but the original UI components still contain their own copies:

1. `ColorPalette.tsx:13-15` — inline token filtering by `color.` prefix. `getTokensByGroup` exists in studio-core but isn't used.
2. `ColorPalette.tsx:22` — inline name sanitization. `validateTokenName` exists but isn't used.
3. `ScreenSizes.tsx:14-15` — inline breakpoint sorting. `getSortedBreakpoints` exists but isn't used.
4. `ScreenSizes.tsx:31-35` — inline `applyPresets()`. `applyBreakpointPresets` exists but isn't used.

Both copies exist simultaneously. The helpers were extracted but the call sites were never migrated.

**Files:** `ColorPalette.tsx:13-22`, `ScreenSizes.tsx:14-35`, `layout-ui-helpers.ts`

---

## Finding SC-05: DisplayBlock Has No Inline Toolbar, No Condition Chip, No PropertyPopover

**Severity: Medium — Feature Parity Gap**

The spec (Section 3) says "All: a '...' overflow button for Tier 3" and the visual condition chip applies to "all types." But `DisplayBlock.tsx` is a simple button with label + resize handle — no `InlineToolbar`, no condition chip, no overflow button, no `PropertyPopover`.

Display items (Heading, Divider) cannot have their `when` condition, accessibility properties, or CSS class edited from the layout workspace. They are selection-only + resize-only.

The spec lists DisplayBlock as "Updated: adds resize handles for span, but retains current structure" (Section 6) — ambiguous on whether toolbar/popover was intended.

**Files:** `DisplayBlock.tsx`

---

## Finding SC-06: All 11 Spec Section 9 E2E Test Scenarios Are Unimplemented

**Severity: Medium — Test Coverage Gap**

Two E2E test files exist (`layout-components.spec.ts` with 24 tests, `layout-wizard-mode.spec.ts` with 6 tests) but none cover the Section 9 scenarios:

1. Drag-resize column span — no test
2. Drag-resize Grid column count — no test
3. Drag-reorder within Grid (spatial) — no test
4. Drag tray item into specific container — no test
5. Container direction change via toolbar — no test
6. Right sidebar live preview updates — no test
7. Theme mode toggle — no test
8. Theme mode field click with override popover — no test
9. Color token change updating preview — no test
10. Selector rule application in preview — no test
11. Theme tab removed from header — no test

Unit/integration coverage (~350+ test cases across 19 files) is substantially better. The gap is exclusively at the Playwright layer.

**Files:** `packages/formspec-studio/tests/e2e/playwright/layout-components.spec.ts`, `layout-wizard-mode.spec.ts`

---

## Finding SC-07: PropertyPopover Accepts `selectionKey` and `nodeId` But Ignores Both

**Severity: Low — Dead Props**

`PropertyPopoverProps` declares `selectionKey` and `nodeId` (lines 11-12) but the function destructures only the props it uses (lines 100-110) — these two are never read. Both callers pass them for nothing.

Combined with the dead `anchorRef` (V-07), three of PropertyPopover's eleven props are dead.

**Files:** `PropertyPopover.tsx:8-12`

---

## Finding SC-08: `useResizeHandle` Returns `isDragging` But No Consumer Uses It

**Severity: Low — Dead State**

`useResizeHandle.ts:105` returns `{ handleProps, isDragging }`. Both consumers (`FieldBlock.tsx:90`, `DisplayBlock.tsx:45`) destructure only `{ handleProps }`. The `isDragging` state is computed but never read. Could be useful for column guides (V-06) but currently wasted.

**Files:** `useResizeHandle.ts:105`, `FieldBlock.tsx:90`, `DisplayBlock.tsx:45`

---

## Finding SC-09: `LayoutContainer.overflowRef` Is Dead Code

**Severity: Low — Dead Code**

`LayoutContainer.tsx:166` creates `const overflowRef = useRef<HTMLButtonElement>(null)`. Passed to `PropertyPopover` as `anchorRef` but: (a) `InlineToolbar` doesn't accept a ref for its overflow button, so `overflowRef.current` is always `null`, and (b) `PropertyPopover` ignores `anchorRef` anyway (V-07). Pure dead code.

**Files:** `LayoutContainer.tsx:166`

---

## Finding SC-10: FieldBlock Passes No-Op `onUnwrap` to PropertyPopover

**Severity: Low — Dead Code**

`FieldBlock.tsx:182` passes `onUnwrap={() => {}}`. Fields are not containers and cannot be unwrapped. The "Unwrap" button is hidden because `isContainer={false}` (line 178). The no-op callback can never be called.

**Files:** `FieldBlock.tsx:182`

---

# Part 4: Code Quality Findings

*Naming, module boundaries, type safety, duplication, dependency direction, component design. Deduplicated against V/SD/SC findings.*

---

## Finding CQ-01: `onSetStyle` vs `onStyleAdd` — Same Operation, Two Names

**Severity: Medium — Naming Inconsistency**

The same operation (writing a key/value to the component node's `style` map) has two names:

| Name | Used by | Defined in |
|---|---|---|
| `onSetStyle` | `InlineToolbar`, `LayoutContainer` (toolbar) | `LayoutContainer` prop, `InlineToolbar` prop |
| `onStyleAdd` | `PropertyPopover`, `FieldBlock`, `LayoutContainer` (popover) | `LayoutContainer` prop, `FieldBlock` prop, `LayoutRenderContext` |

In `render-tree.tsx:175`, `onSetStyle` is wired to `ctx.onStyleAdd`. In `render-tree.tsx:178`, `onStyleAdd` is also wired to `ctx.onStyleAdd`. Both props receive the exact same function. `onStyleAdd` implies "append," `onSetStyle` implies "overwrite" — they do the same thing.

This is the root cause of SC-01 (stepper broken): the naming split made it non-obvious that `FieldBlock` was missing the toolbar callback.

**Fix:** Unify to `onSetStyle` everywhere. Remove `onStyleAdd` from `LayoutContainerProps` (currently has both as separate props, lines 41 and 47, receiving the same callback).

**Files:** `LayoutContainer.tsx:41,47`, `render-tree.tsx:175,178,227,230`, `FieldBlock.tsx:45`

---

## Finding CQ-02: `CompNode` Interface Defined Three Times With Divergent Shapes

**Severity: Medium — DRY Violation**

Independently defined in:
1. `LayoutCanvas.tsx:32-42` — 11 fields including `syntheticPage`, `groupPath`
2. `render-tree.tsx:8-27` — 14 fields including `columns`, `gap`, `direction`, etc.
3. `UnassignedTray.tsx:9-14` — 5 fields (minimal subset)

Each has different fields. Changes to the component tree shape require updating all three. The `render-tree.tsx` version uses `[key: string]: unknown` as an escape hatch, masking type errors.

**Fix:** Define `CompNode` once in studio-core or a shared types file. Import everywhere. `UnassignedTray` can use `Pick<CompNode, ...>`.

**Files:** `LayoutCanvas.tsx:32`, `render-tree.tsx:8`, `UnassignedTray.tsx:9`

---

## Finding CQ-03: `DirtyGuardConfirm` Component Duplicated Verbatim

**Severity: Medium — Code Duplication**

`DirtyGuardConfirm` is copy-pasted identically in `PropertyPopover.tsx:25-52` and `ThemeOverridePopover.tsx:23-50`. Same props, same JSX, same CSS. The dirty-tracking logic (`dirtyInputs` Set, `trackDirty`, `requestClose`, `showDirtyGuard` state) is also duplicated.

**Fix:** Extract `DirtyGuardConfirm` and a `useDirtyGuard` hook into a shared module.

**Files:** `PropertyPopover.tsx:25-52`, `ThemeOverridePopover.tsx:23-50`

---

## Finding CQ-04: `__node:` Prefix Parsing Inlined 6 Times — Existing Helpers Ignored

**Severity: Medium — Shotgun Surgery**

The pattern `selectionKey.startsWith('__node:') ? selectionKey.slice(7) : selectionKey` appears 6 times in `LayoutCanvas.tsx` (lines 189, 195, 202, 210, 218, 233+273). Studio-core exports `isLayoutId()` and `nodeIdFromLayoutId()` for this purpose but `LayoutCanvas` doesn't use them. The magic number `7` is error-prone.

**Fix:** Import and use the existing helpers.

**Files:** `LayoutCanvas.tsx:189,195,202,210,218`

---

## Finding CQ-05: `LayoutContainerProps` Has 22 Props — Missing Parameter Object

**Severity: Medium — Long Parameter List**

9 of the 22 props (`columns`, `gap`, `direction`, `wrap`, `align`, `elevation`, `width`, `position`, `title`, `defaultOpen`, `nodeStyle`) represent the component node's layout properties. They're spread individually in `render-tree.tsx` twice (layout nodes and group nodes), creating 20-line prop blocks each time.

**Fix:** Introduce `ContainerLayoutProps` grouping object. `LayoutContainer` receives `layoutProps: ContainerLayoutProps`.

**Files:** `LayoutContainer.tsx:8-52`, `render-tree.tsx:154-183,205-236`

---

## Finding CQ-06: `render-tree.tsx` Has Identical 30-Line Blocks for Layout Nodes and Group Nodes

**Severity: Medium — Code Duplication**

`renderLayoutTree` renders `LayoutContainer` in two nearly identical blocks: layout nodes (lines 143-184) and group nodes (lines 195-237). Differences are only `nodeType`, `bind`/`bindPath`, `nodeId`, and selection key construction. Everything else — 10 layout props, 6 callbacks — is duplicated.

**Fix:** Extract a `renderContainer()` helper within `render-tree.tsx`.

**Files:** `render-tree.tsx:143-184,195-237`

---

## Finding CQ-07: `getEditableThemeProperties` Ignores Both Parameters — Interface Lie

**Severity: Medium — Dead Parameters**

`layout-helpers.ts:132-137` accepts `_project` and `_itemKey` (both underscore-prefixed, explicitly unused) and always returns the same fixed list. Callers pass arguments expecting per-item customization that doesn't exist. The spec says this should "return property descriptors based on current schema."

Reinforces SD-04 (enum validation). The function signature promises context-dependent results; the body returns a constant.

**Fix:** Implement type-aware filtering (different components expose different properties) or rename to `getAllThemeProperties()` with no parameters.

**Files:** `layout-helpers.ts:132-137`

---

## Finding CQ-08: `LayoutCanvas` Manages Theme Mode State That Belongs in Context

**Severity: Medium — Responsibility Misplacement**

`LayoutCanvas` manages `themeSelectedKey`, `themePopoverPosition`, and `handleThemeFieldSelect` / `handleModeChange` callbacks (lines 93-94, 285-298). This is theme-mode interaction state in the layout canvas component.

`LayoutModeContext` exists but only carries `layoutMode` and `setLayoutMode`. The theme selection state rides alongside in `LayoutCanvas` because there's no theme-mode-specific context. This is the structural blocker for SD-02 (mode switch data loss) and SD-05 (popover at 0,0).

**Fix:** Extend `LayoutModeContext` to hold `themeSelectedKey`, `themePopoverPosition`, and `setThemeSelection`. Theme mode components consume it directly.

**Files:** `LayoutCanvas.tsx:93-94,285-298`, `LayoutModeContext.tsx`

---

## Finding CQ-09: `handleStyleAdd/Remove` Bypass Studio-Core — Inline Read-Merge-Write

**Severity: Low-Medium — Leaky Abstraction**

`LayoutCanvas.tsx:200-215` defines `handleStyleAdd` and `handleStyleRemove` which directly read `project.componentFor()`, manually spread the style object, and call `project.setLayoutNodeProp()`. This is raw component-tree manipulation in a UI component — what the spec's Section 0 says should be in studio-core.

Meanwhile, `setColumnSpan` (studio-core) does the same thing cleanly via `project.setNodeStyleProperty()`.

**Fix:** Add `setStyleProperty` and `removeStyleProperty` to `layout-helpers.ts`. Canvas handlers become one-liner delegations.

**Files:** `LayoutCanvas.tsx:200-215`, `layout-helpers.ts`

---

## Finding CQ-10: Column Span Stepper and Resize Handle Use Divergent Code Paths

**Severity: Low — Divergent Change Risk**

The stepper in `FieldControls` (InlineToolbar.tsx:402-403) writes raw CSS `span ${n}` via `onSetStyle?.('gridColumn', ...)`. The drag handle writes via `setColumnSpan(project, ref, newSpan)` which formats the same string but also clamps to [1,12]. Two code paths with different validation.

**Fix:** Route the stepper through `setColumnSpan` via a dedicated `onSetColumnSpan(ref, n)` callback.

**Files:** `InlineToolbar.tsx:402-403`, `layout-helpers.ts:27-34`

---

## Finding CQ-11: `hasPopoverContent` Detection Logic Duplicated

**Severity: Low-Medium — Feature Envy**

The logic to determine whether Tier 3 properties are configured (dot indicator on overflow button) is duplicated in `FieldBlock.tsx:115-120` and `LayoutContainer.tsx:188-193`. Both inspect `nodeProps.accessibility`, `nodeProps.cssClass`, and `nodeProps.style` identically.

**Fix:** Extract `hasTier3Content(nodeProps)` to a shared utility in the layout workspace.

**Files:** `FieldBlock.tsx:115-120`, `LayoutContainer.tsx:188-193`

---

## Finding CQ-12: `buildContentStyle` Takes Full 22-Prop Type, Uses 7

**Severity: Low — Feature Envy**

`buildContentStyle` (LayoutContainer.tsx:61) takes the full `LayoutContainerProps` object but only reads 7 fields. Couples a pure function to the full component props interface.

**Fix:** Narrow the parameter type. If CQ-05 introduces `ContainerLayoutProps`, use that.

**Files:** `LayoutContainer.tsx:61-98`

---

## Finding CQ-13: `useResizeHandle` Pointer Event Double Cast

**Severity: Low — Type Safety**

`FieldBlock.tsx:105` and `DisplayBlock.tsx:60` use `handleProps.onPointerDown(e as unknown as React.PointerEvent)` — double cast. `React.PointerEvent<HTMLSpanElement>` is structurally compatible with `React.PointerEvent<Element>`. The cast is unnecessary.

**Fix:** Remove the cast or parameterize `useResizeHandle` with a generic.

**Files:** `FieldBlock.tsx:105`, `DisplayBlock.tsx:60`

---

## Finding CQ-14: dnd-kit Event Handlers Typed as `any`

**Severity: Low — Type Safety**

`LayoutDndProvider.tsx:151,157` types both `onDragStart` and `onDragEnd` callbacks as `(event: any) => ...`. The event shape is well-known from dnd-kit.

**Fix:** Import dnd-kit's event types or type the destructured shape inline.

**Files:** `LayoutDndProvider.tsx:151,157`

---

## Finding CQ-15: Tray Item Data Uses Double `as unknown as` Cast

**Severity: Low — Type Safety**

`LayoutDndProvider.tsx:103` casts `sourceData as unknown as UnassignedItemData` with no runtime validation. A type guard would be safer.

**Files:** `LayoutDndProvider.tsx:103`

---

## Finding CQ-16: LayoutCanvas Has 14 `useCallback` Handlers — God Component

**Severity: Low-Medium — Divergent Change**

`LayoutCanvas` defines 14 `useCallback` handlers (lines 180-342), roughly 200 lines of callback definitions. Any change requires reading all 14 to understand impact.

**Fix:** Extract into grouped hooks: `useLayoutNodeOperations(project, deselect)` for node ops, `useLayoutAddOperations(project, ...)` for add ops, and move theme ops to context per CQ-08.

**Files:** `LayoutCanvas.tsx:180-342`

---

# Unified Summary Table

## Visual Design Findings

| # | Finding | Severity | Verdict | Scope |
|---|---------|----------|---------|-------|
| V-01 | Inline toolbar overflows on narrow containers; condition chip unbounded; `[...]` can be clipped | High | Component restructure | `InlineToolbar.tsx` + CSS |
| V-02 | Resize handle hit target is 8px with no touch extension; no always-visible drag affordance | High | CSS fix + implementation gap | `FieldBlock.tsx`, `DisplayBlock.tsx`, `useResizeHandle.ts` |
| V-03 | Theme mode has no visual "authoring mode" signal; selected field not highlighted; crosshair on all areas | High | Component restructure + design addition | `ThemeAuthoringOverlay.tsx`, `LayoutCanvas.tsx` |
| V-04 | ThemeOverridePopover overflows viewport on right/bottom edges; no max-height | Medium | CSS fix | `ThemeOverridePopover.tsx` |
| V-05 | `when` vs `relevant` callout has insufficient visual weight at chip display level | Medium | Design addition | `InlineToolbar.tsx`, `InlineExpression.tsx` |
| V-06 | Ghost overlay, column guides, and numeric tooltip are specced but not implemented; undo stack polluted by drag | Medium | Implementation gap | `useResizeHandle.ts`, `LayoutContainer.tsx` |
| V-07 | PropertyPopover renders inline (not in portal); anchorRef broken for FieldBlock; popover pushes content down | Medium | Component restructure | `PropertyPopover.tsx`, `FieldBlock.tsx` |
| V-08 | Card elevation uses 4 buttons (128px); should be stepper or moved to Tier 3 | Low | Design revision | `InlineToolbar.tsx` |
| V-09 | Toolbar header: 2 segmented controls + 10 buttons wraps 2-3 rows; adds sticky header height | Low-Medium | Design revision | `LayoutCanvas.tsx` |
| V-10 | Theme mode click misses on containers produce no feedback | Low | UX gap | `ThemeAuthoringOverlay.tsx` |
| V-11 | LayoutMode state resets silently on tab switch | Low | Design clarification | `Shell.tsx`, `LayoutModeContext` |

## Service Design Findings

| # | Finding | Severity | Category |
|---|---------|----------|----------|
| SD-01 | Undo stack polluted on every drag step — phantom entries corrupt undo history | Critical | Data Loss |
| SD-02 | Mode switch silently discards unsaved popover edits (no dirty guard on toggle) | Critical | Data Loss |
| SD-03 | `when` callout says "use `relevant`" but provides no navigation to Editor | High | Discoverability |
| SD-04 | Theme override inputs accept invalid enum values with no validation | High | Data Correctness |
| SD-05 | Selection handoff opens popover at (0,0) — positionally broken | High | Interaction Model |
| SD-06 | ConditionalGroup data semantics (data preserved when hidden) invisible at authoring time | High | Data Correctness |
| SD-07 | Delete key does nothing in Layout workspace — keyboard guard too restrictive | High | Missing Feature |
| SD-08 | MCP has no per-item theme override capability — feature parity gap | High | MCP Parity |
| SD-09 | Two-mode metaphor has no discovery path for visual properties from Layout mode | Medium | Learnability |
| SD-10 | Blueprint sidebar section resets silently when switching Layout/Theme modes | Medium | Context Loss |
| SD-11 | Nested Grid in Stack: outer droppable wins over inner droppable — wrong drop target | Medium | Interaction Model |
| SD-12 | Sidebar preview and Theme mode canvas preview have no explained relationship | Medium | Journey Coherence |
| SD-13 | Right sidebar collapsed state not reset on tab re-entry — feedback loop silently lost | Low-Medium | State Coherence |
| SD-14 | Studio-core ui-helpers extracted but not wired into MCP layer | Low | MCP Parity |

## Scout Findings

| # | Finding | Severity | Category |
|---|---------|----------|----------|
| SC-01 | FieldBlock toolbar column span stepper silently broken — `onSetStyle` never wired | Critical | Broken Feature |
| SC-02 | Grid row span — helper exists, zero UI consumers, complete dead code | High | Missing Feature |
| SC-03 | 8 MCP tool instances bypass studio-core via `(project as any).core.dispatch` | High | Layer Violation |
| SC-04 | Theme workspace components still contain original business logic alongside extracted helpers | Medium | Incomplete Refactor |
| SC-05 | DisplayBlock has no toolbar, no condition chip, no popover | Medium | Feature Parity Gap |
| SC-06 | All 11 spec Section 9 E2E test scenarios are unimplemented | Medium | Test Coverage |
| SC-07 | PropertyPopover accepts `selectionKey` and `nodeId` but ignores both | Low | Dead Props |
| SC-08 | `useResizeHandle` returns `isDragging` but no consumer reads it | Low | Dead State |
| SC-09 | `LayoutContainer.overflowRef` created but never attached to DOM | Low | Dead Code |
| SC-10 | FieldBlock passes no-op `onUnwrap` to PropertyPopover | Low | Dead Code |

## Code Quality Findings

| # | Finding | Severity | Category |
|---|---------|----------|----------|
| CQ-01 | `onSetStyle` vs `onStyleAdd` — same operation, two names (root cause of SC-01) | Medium | Naming |
| CQ-02 | `CompNode` interface defined 3x with divergent shapes | Medium | DRY Violation |
| CQ-03 | `DirtyGuardConfirm` component duplicated verbatim | Medium | Duplication |
| CQ-04 | `__node:` prefix parsing inlined 6x, ignoring existing helpers | Medium | Shotgun Surgery |
| CQ-05 | `LayoutContainerProps` has 22 props — missing parameter object | Medium | Long Param List |
| CQ-06 | `render-tree.tsx` has identical 30-line blocks for layout/group nodes | Medium | Duplication |
| CQ-07 | `getEditableThemeProperties` ignores both parameters — interface lie | Medium | Dead Parameters |
| CQ-08 | Theme mode state lives in LayoutCanvas instead of context | Medium | Responsibility |
| CQ-09 | `handleStyleAdd/Remove` bypass studio-core, inline read-merge-write | Low-Medium | Leaky Abstraction |
| CQ-10 | Column span stepper and resize handle use divergent code paths | Low | Divergent Change |
| CQ-11 | `hasPopoverContent` detection logic duplicated | Low-Medium | Feature Envy |
| CQ-12 | `buildContentStyle` takes 22-prop type, uses 7 | Low | Feature Envy |
| CQ-13 | `useResizeHandle` pointer event double cast | Low | Type Safety |
| CQ-14 | dnd-kit event handlers typed as `any` | Low | Type Safety |
| CQ-15 | Tray item data double `as unknown as` cast | Low | Type Safety |
| CQ-16 | LayoutCanvas has 14 `useCallback` handlers — God Component | Low-Medium | Divergent Change |

**Current note:** CQ-11, CQ-12, and CQ-16 are resolved in the current tree. The table above remains the original audit record.

---

# Unified Priority Order for Action

The prioritized backlog is complete. The file clusters below are a record of the implementation work that closed the remaining findings.

## `packages/formspec-studio/src/workspaces/layout/LayoutCanvas.tsx`, `LayoutModeContext.tsx`, `PropertyPopover.tsx`, `ThemeOverridePopover.tsx`
- **Implemented:** `SD-02` dirty-state guard and `CQ-16` callback-surface extraction.

## `packages/formspec-mcp/src/tools/component.ts`, `composition.ts`, `locale.ts`, `mapping-expanded.ts`, `migration.ts`, `ontology.ts`
- **Implemented:** `SC-03` migrated the remaining dispatch calls to studio-core helpers.

## `packages/formspec-mcp/src/tools/theme.ts`
- **Implemented:** `SD-08` item-override actions and `SD-14` shared theme helper wiring.

## `packages/formspec-studio/src/workspaces/layout/LayoutContainer.tsx`, `LayoutDndProvider.tsx`, `FieldBlock.tsx`, `DisplayBlock.tsx`
- **Implemented:** `V-06`, `SD-11`, `CQ-05`, `CQ-14`, and `SC-10`.

## `packages/formspec-studio/src/workspaces/layout/InlineToolbar.tsx`
- **Implemented:** `V-05` chip-level `when`/`relevant` warning indicator.

## `packages/formspec-studio/src/workspaces/theme/ColorPalette.tsx`, `ScreenSizes.tsx`
- **Implemented:** `SC-04` removed the remaining inline theme UI logic copies.

## `packages/formspec-studio/tests/e2e/playwright/layout-components.spec.ts`, `layout-wizard-mode.spec.ts`
- **Implemented:** `SC-06` Playwright coverage for the Section 9 scenarios.

## `packages/formspec-studio-core/src/authoring-helpers.ts`, `layout-helpers.ts`, `packages/formspec-studio/src/components/blueprint/ComponentTree.tsx`, `packages/formspec-studio/src/workspaces/layout/UnassignedTray.tsx`
- **Implemented:** `CQ-02` consolidated the duplicate `CompNode` definitions.
