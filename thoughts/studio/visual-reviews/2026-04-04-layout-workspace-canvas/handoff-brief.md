# Handoff brief — Layout workspace canvas

## 1. Current state

The Layout tab shows a **sticky chrome header** (flow mode, layout/theme toggle, pill actions) above a **scrollable canvas** of nested **layout containers** (dashed borders, compact header row with mono type badge) and **field/display blocks** styled like the definition **ItemRow** (large `rounded-[18px]` cards, strong blue selection glow, icon tile, optional inline definition editing and description/hint strip, then **InlineToolbar**). Screenshot paths for a live pass: `{review_dir}/screenshots/pass1-*.png` (see `screenshots/README.txt` — PNGs pending manual capture). Structural outline: `screenshots/dom-01-initial.txt`.

## 2. Verdict

**Level 3 — Design-system / component alignment (moderate).** Local patterns are intentional and readable, but **two visual dialects** coexist on one surface (dashed minimal containers vs. glossy card-like leaves), and **selection/focus hierarchy** competes between container chrome, field cards, and toolbar density. This is not a greenfield redesign; it needs **unified rules for elevation, selection, and density** across `LayoutContainer`, `FieldBlock`, and `DisplayBlock`.

## 3. Visual problems

1. **Dialect clash (container vs leaf)**  
   - **Symptom**: Parents look like wireframes (dashed `border-muted`, `rounded`); children look like finished UI (`rounded-[18px]`, `shadow-[0_14px_34px_rgba(59,130,246,0.12)]`). The canvas reads as “box inside sketch.”  
   - **Chain**: `LayoutContainer` `className` uses `border-dashed` + light `bg-surface` → reads low-fidelity. `FieldBlock` uses ItemRow parity → high-fidelity card.  
   - **First domino**: `packages/formspec-studio/src/workspaces/layout/LayoutContainer.tsx` (~213–219) vs `FieldBlock.tsx` shellClasses (~283–291).

2. **Competing selection treatments**  
   - **Symptom**: Multiple “selected” blues (container `border-accent bg-accent/5`, field `border-accent/50` + large shadow, toolbar controls `border-accent`). Eye does not know what is “the” selection.  
   - **Chain**: Independent `selected` branches without shared token or z-index/elevation scale.  
   - **First domino**: No shared `layoutSelection*` utility or tokens; each component picks accent overlays ad hoc (`LayoutContainer.tsx`, `FieldBlock.tsx`, `InlineToolbar.tsx` focus rings).

3. **Vertical rhythm overload when field is selected**  
   - **Symptom**: In a grid, a selected field stacks identity + description/hint + toolbar — cell height spikes; neighbors look misaligned.  
   - **Chain**: Feature accretion in `FieldBlock` (inline edits + `renderSummaryStrip` + `InlineToolbar`) inside grid cell with fixed `gap` from parent only.  
   - **First domino**: `FieldBlock.tsx` layout composition; parent `LayoutContainer` `buildContentStyle` gap does not coordinate with child internal padding.

4. **Toolbar typographic scale vs card title**  
   - **Symptom**: `InlineToolbar` uses `text-[11px]` mono controls under a `text-[17px]/md:text-[18px]` identity row — functional but the toolbar can feel like a **footer sticker** rather than a continuation of the card.  
   - **Chain**: Toolbar optimized for density; card optimized for editor parity.  
   - **First domino**: `InlineToolbar.tsx` (`ToolbarSelect` etc.) vs `FieldBlock` identity typography.

5. **Discoverability of “+ Add Container” menu**  
   - **Symptom**: Menu is `hidden group-hover:flex` — invisible until hover; reads as “missing” on first glance and is weak on touch.  
   - **Chain**: `LayoutCanvas.tsx` container dropdown (~556–579).  
   - **First domino**: Interaction pattern choice in `LayoutCanvas.tsx`, not token.

6. **Resize affordances**  
   - **Symptom**: Column/row handles are thin absolute strips (`w-2` / `h-2`) with hover fill — easy to miss at a glance.  
   - **Chain**: `FieldBlock` / `DisplayBlock` resize spans.  
   - **First domino**: Handle classes on resize touch zones.

## 4. Design constraints

- **Spec**: Theme/Component tiers describe **author** presentation in JSON; Studio layout canvas is **tool chrome**, not a normative renderer. Do not claim spec violations for studio-only styling; preserve **semantic** accuracy (layout structure still reflects component tree).  
- **Accessibility**: Maintain **visible focus** (`focus-visible:ring-*`), **keyboard** selection on blocks, **aria** that matches role (avoid `aria-pressed` on `role="group"` long-term — prefer documented pattern). Touch targets for resize zones already widened — keep ≥24px effective.  
- **Responsive**: Canvas is `max-w-[980px]`; toolbars wrap — proposals must not assume infinite horizontal space.  
- **Preserve**: Tailwind semantic tokens (`border-border`, `bg-surface`, `text-ink`, `accent`), editor **ItemRow** parity for field **identity** (users asked for consistency), existing **dnd-kit** and **resize** behavior.

## 5. Design direction

- **Hierarchy**: One primary “selected” language — **innermost selected node** gets strongest treatment; ancestors get **muted** selection (border or inset line, not second glow).  
- **Density**: Selected field may move **description/hint** to a **collapsible** row or inspector-first to protect grid rhythm; or increase **grid row-gap** when any child is in “expanded edit” state.  
- **Color/contrast**: Keep accent for **one** emphasis per viewport region; use **neutral** borders for structural containers.  
- **Typography**: Align toolbar **section labels** with card **meta** size (e.g. 12px uppercase labels) so toolbar feels part of the card.  
- **Interaction**: Replace hover-only container menu with **click** or **split button** for WCAG 2.2 target and touch.

## 6. Scope boundaries

**In scope**: `LayoutCanvas.tsx` header actions, `LayoutContainer.tsx` shell/header, `FieldBlock.tsx` / `DisplayBlock.tsx` shell and stacking, `InlineToolbar.tsx` visual integration, shared tokens/utilities if needed.  
**Out of scope**: Theme document schema, `<formspec-render>` runtime, definition tree editor chrome (unless explicitly aligning tokens).

## 7. Success criteria

1. **Single selection dialect**: A designer can describe container vs field selection in **one sentence** without “except for dashed boxes.”  
2. **Arm’s-length test**: In a 3-column grid with one field selected, **neighboring cells** remain visually balanced (no accidental “collapsed” look).  
3. **Primary action clarity**: Within the layout header, **one** action reads as primary for “add to layout” (others secondary).  
4. **Focus visible**: Keyboard tab through field → toolbar → popover trigger shows **unambiguous** focus ring without doubling rings.  
5. **No regression**: Drag/reorder, resize spans, and context menu still usable; no new WCAG failures.
