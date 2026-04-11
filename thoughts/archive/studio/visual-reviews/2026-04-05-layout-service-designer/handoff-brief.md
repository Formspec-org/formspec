# Handoff brief — Studio Layout workspace (post-evolution capture, 2026-04-05)

## 1. Current state

On **`http://localhost:5173/studio/`**, **Layout** (Wizard + Layout) shows a **unified left-accent selection vocabulary** on both the **page/stack container** and **field cards** (inline-start rail, subtle `bg-accent/[0.06]`), **label-first field blocks** (≈19–21px headline, read-only mono **key + datatype** row beneath with **no gap** between `groupPathPrefix` and `itemKey`), a **collapsible “Description & hint”** disclosure when the inline toolbar is present, and a split **+ Stack** add control. **Screenshots:** `screenshots/pass1-01-layout.png` (canvas + stepper), `screenshots/pass1-02-field-selected.png` (Full Legal Name selected via Items tree — canvas shows rail + toolbar footer). **DOM outline:** `screenshots/dom-01-layout-initial.txt`.

## 2. Verdict

**Level 2 — Polish / hierarchy tuning (light).** The prior **Level 3** issues around **competing selection chrome** and **runaway selected height** are **largely addressed** (`layout-node-styles.ts`, `FieldBlock` disclosure, `PropertyPopover` behavior). What remains is **accent budgeting** (wizard stepper still **full fill `bg-accent text-white`** while canvas selection also uses accent), **structural “sketch vs product”** (dashed **STACK** inside a **selected** framed page), **narrow-viewport truncation** (step labels, mono keys), and **chrome density** (three add actions + 11px toolbar band).

## 3. Visual problems

1. **Wizard stepper vs canvas selection (dual “hero” accent)**  
   - **Symptom**: Active step is a **solid blue pill**; selected container/leaf uses **accent rail + tint** — two strong accent surfaces fight for “where am I.”  
   - **Chain**: `LayoutStepNav` active tab → `bg-accent text-white` (`LayoutStepNav.tsx` ~74–77); canvas → `LAYOUT_*_SELECTED` (`layout-node-styles.ts`).  
   - **First domino**: `packages/formspec-studio/src/workspaces/layout/LayoutStepNav.tsx` (active step treatment) *or* deliberate **token contract** that demotes one of the two.

2. **Dashed STACK inside selected page (residual dialect clash)**  
   - **Symptom**: Outer page reads as **authored frame**; inner **STACK** still reads **wireframe** even when the parent is selected.  
   - **Chain**: `LAYOUT_CONTAINER_UNSELECTED` + stack label chrome in `LayoutContainer.tsx` vs selected page border from shared tokens.  
   - **First domino**: `packages/formspec-studio/src/workspaces/layout/LayoutContainer.tsx` (stack shell when ancestor page is selected / theme mode).

3. **Truncation at narrow widths**  
   - **Symptom**: Step labels (e.g. “Househ…”) and mono **keys** still **ellipsis**; technical identity can be ambiguous.  
   - **Chain**: `overflow-x-auto` nav + `truncate` on key span (`FieldBlock.tsx` `renderReadonlyKeyRow`, `LayoutStepNav` button content).  
   - **First domino**: `LayoutStepNav.tsx` + `FieldBlock.tsx` (overflow strategy: `title`, tooltip, two-line wrap, or horizontal scroll in row).

4. **Toolbar band typography vs headline**  
   - **Symptom**: **11px**-class controls sit under **~19–21px** label — improved by disclosure, but footer still feels like a **different scale** than the card headline.  
   - **Chain**: `InlineToolbar.tsx` density + `FieldBlock` footer wrapper (`border-t` band).  
   - **First domino**: `packages/formspec-studio/src/workspaces/layout/InlineToolbar.tsx` + footer wrapper classes in `FieldBlock.tsx`.

5. **Primary add actions still equal-weight**  
   - **Symptom**: **+ Item / + Page / + Stack** compete with the stepper for attention on short viewports.  
   - **Chain**: `LayoutCanvas.tsx` header action cluster — same visual language for all three.  
   - **First domino**: `packages/formspec-studio/src/workspaces/layout/LayoutCanvas.tsx` (hierarchy: primary vs secondary, grouping, overflow menu).

6. **Drag handle discoverability**  
   - **Symptom**: Reorder handle is **low-opacity until hover**; automation had to select via **Items tree** — risk for keyboard/touch users discovering reorder.  
   - **Chain**: `DragHandle` + parent `group` hover styles in layout blocks.  
   - **First domino**: `packages/formspec-studio/src/components/ui/DragHandle.tsx` / `FieldBlock.tsx` wrapper.

## 4. Design constraints

- **Theme / presentation**: Respect Formspec **Theme** tier for tokens and density (`specs/theme/theme-spec.llm.md`); do not invent non-spec field semantics on the canvas.  
- **Accessibility**: WCAG **2.2** contrast; **visible focus** (`focus-visible:ring-*` already present in several nodes — preserve/improve); selection state meaningful to AT (`aria-pressed` on field group in `FieldBlock.tsx`).  
- **Responsive**: Usable at **narrow widths**; touch targets **≥ 44px** where controls are touch-primary.  
- **Preserve**: **ItemRow parity** intent — inline **label** edit, **description/hint** reachable (disclosure is acceptable), **properties** via toolbar/popover; **keys read-only** on canvas as now.

## 5. Design direction

- **Hierarchy**: Pick **one** “hero” accent for navigation (stepper **or** canvas selection) and **mute** the other to outline/text/link style.  
- **Container interior**: When page is selected, **STACK** chrome should **escalate** from sketch to **sub-frame** (lighter dashed → solid muted border or shared tint) so nesting reads intentional.  
- **Truncation**: Prefer **native `title` + visible full name on focus** or **second line** for long keys; stepper: **min-width** or **tooltip** on truncate.  
- **Toolbar**: Slightly **raise** base size or **unify** with card caption scale (12–13px) so the footer reads as part of the card system.  
- **Adds**: **One** primary “add to this layout” affordance; demote page/stack to split or overflow.

## 6. Scope boundaries

- **In scope**: `LayoutCanvas.tsx`, `LayoutStepNav.tsx`, `LayoutContainer.tsx`, `FieldBlock.tsx`, `DisplayBlock.tsx`, `InlineToolbar.tsx`, `DragHandle.tsx`, `layout-node-styles.ts`.  
- **Out of scope**: Core definition schema, engine, unrelated workspaces except shared components.

## 7. Success criteria

1. **Single accent hero** — At a glance, **either** the active wizard step **or** the selected canvas node leads saturation; the other uses outline/muted fill.  
2. **Nesting reads deliberate** — Selected page + inner STACK does not read “placeholder inside product” (same family as outer frame).  
3. **Truncation recoverable** — Every truncated step label or key has **full text recoverable** (tooltip, title, or expand) without devtools.  
4. **Toolbar legibility** — Footer controls are readable at **arm’s length** vs the headline (not “sticker strip”).  
5. **No functional regression** — Disclosure, popover, DnD, label/description/hint/property flows remain **reachable**.
