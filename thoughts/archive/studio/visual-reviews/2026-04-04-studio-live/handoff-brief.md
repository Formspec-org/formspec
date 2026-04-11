# Handoff brief — Studio Layout workspace (live capture)

## 1. Current state

On **`http://localhost:5173/studio/`**, the **Layout** tab (Wizard + Layout radio) shows a **dense chrome stack**: workspace tabs, then Single/Wizard/Tabs, then **+ Item / + Page / + Add Container**, then a **horizontal wizard stepper** (e.g. “1 Applicant Information” as a solid blue pill with underline, “2 Househ…” truncated). The canvas is a **card titled “Applicant Information”** with a **blue outline**, enclosing a **dashed “STACK”** region and an **ItemRow-style field block** (large rounded card, **Aa** glyph tile, mono **key** + blue **datatype**, human **label** “Full Legal Name”, pencil affordances). **Screenshots:** `screenshots/pass1-01-initial.png` (full page after opening Layout), `screenshots/pass1-02-field-selected.png` (after selecting Full Legal Name via step nav), `screenshots/pass1-03-desktop-viewport.png` (viewport). **DOM outlines:** `screenshots/dom-01-layout-initial.txt`, `screenshots/dom-02-field-selected.txt`.

## 2. Verdict

**Level 3 — Design-system / component alignment (moderate).** Live capture confirms **two visual dialects** on one surface (wireframe-like **dashed stack** vs **polished field card**), **competing blue emphasis** (wizard pill vs page border vs field chrome), and **responsive stress** (truncated step labels and **truncated field keys** e.g. `app.n…`). Fixable without a full redesign by **shared selection/elevation rules**, **density-aware typography**, and **overflow strategy** for keys and stepper labels.

## 3. Visual problems

1. **Dialect clash (container vs leaf)**  
   - **Symptom**: Dashed inner “STACK” reads as placeholder; nested field card reads as finished product — “sketch inside product.”  
   - **Chain**: `LayoutContainer` / stack chrome → dashed border + muted label; `FieldBlock` → `rounded-[18px]`, filled surfaces, strong icon tile.  
   - **First domino**: `packages/formspec-studio/src/workspaces/layout/LayoutContainer.tsx` (container/stack shell classes) vs `FieldBlock.tsx` (shellClasses).

2. **Competing selection and accent**  
   - **Symptom**: Wizard step “1 Applicant Information” is a **solid blue pill**; outer page card also uses **blue border**; field selection adds **toolbar** — multiple “active” blues without one clear focal hierarchy.  
   - **Chain**: Independent accent usage in stepper, container selected state, and field/toolbar.  
   - **First domino**: `LayoutCanvas.tsx` / stepper styling + `LayoutContainer.tsx` + `FieldBlock.tsx` / `InlineToolbar.tsx` (no shared `layoutSelection*` module).

3. **Responsive truncation and density**  
   - **Symptom**: Step label “Househ…” and mono key **`app.n…`** truncate; stacked **+ Item / + Page / + Add Container** consume vertical space on narrow widths.  
   - **Chain**: Fixed horizontal stepper + mono `truncate` on key + responsive layout breakpoints for toolbar.  
   - **First domino**: wizard stepper + field identity row styles in `LayoutCanvas.tsx` / `FieldBlock.tsx` (and related layout CSS).

4. **Selected field vertical growth**  
   - **Symptom**: After selection, DOM exposes **Edit description**, **Edit hint**, **More properties** — inline summary + toolbar increases block height; in grids this exaggerates row imbalance (see prior code assessment; live DOM confirms affordance surface).  
   - **Chain**: `FieldBlock` composes summary strip + `InlineToolbar` when selected.  
   - **First domino**: `FieldBlock.tsx` composition; optional disclosure/grid-aware compaction.

5. **Toolbar vs card typography scale**  
   - **Symptom**: Dense **11px**-class controls under **~17–18px** identity — toolbar can feel like an appended strip rather than part of the card system.  
   - **Chain**: `InlineToolbar.tsx` density vs `FieldBlock` title row.  
   - **First domino**: `InlineToolbar.tsx` + parent wrapper in `FieldBlock.tsx`.

6. **Primary actions in chrome**  
   - **Symptom**: Three add actions compete visually with the stepper; on small viewports they dominate before the canvas.  
   - **Chain**: Equal-weight pill buttons in header region.  
   - **First domino**: `LayoutCanvas.tsx` action button cluster.

## 4. Design constraints

- **Theme / presentation**: Page and layout structure follow Formspec **Theme** tier for presentation tokens (see `specs/theme/theme-spec.llm.md` — page layout, density, widget chrome). Do not invent non-spec field semantics.  
- **Accessibility**: WCAG **2.2** contrast for text and controls; **visible focus** for keyboard users; selection state exposed to AT (`aria-pressed` / roles where used — preserve or improve).  
- **Responsive**: Layout workspace must remain usable at **narrow widths** (truncation strategy, touch targets ≥ 44px where interactive).  
- **Preserve**: ItemRow **parity** intent for field identity (key, type, label, optional description/hint editing) — do not remove inline editing to “fix” density without replacement UX.

## 5. Design direction

- **Hierarchy**: One **primary** accent anchor for “where am I” (either step **or** selected node — not both at full saturation).  
- **Spacing / density**: **Grid-aware** compaction for selected blocks; consider **disclosure** for description/hint when space is tight.  
- **Color / contrast**: Prefer **rail / ring / subtle fill** over large diffuse **glow** shadows for selection.  
- **Typography**: Stepper labels need **minimum readable width** or **tooltip/full name** on truncate; mono keys need **title attribute** or horizontal scroll in cell vs hard ellipsis.  
- **Interaction**: Container “add” should be **discoverable** without hover-only reliance; toolbar visually **attached** to card (footer band).

## 6. Scope boundaries

- **In scope**: `LayoutCanvas`, `LayoutContainer`, `FieldBlock`, `DisplayBlock`, `InlineToolbar`, shared selection tokens/helpers, responsive chrome.  
- **Out of scope**: Core form definition schema, engine eval, unrelated Editor/Mapping/Preview workspaces (unless shared component).

## 7. Success criteria

1. **Single selection dialect** — Container and field selected states read as **one family** (shared rail/ring/tokens), not three different blues.  
2. **Grid balance** — Selected field height **does not** break neighbor alignment beyond one compact toolbar row without user expanding details.  
3. **Primary action clarity** — “Add to layout” hierarchy is obvious; container add is **discoverable** on keyboard + touch.  
4. **Focus visible** — Every interactive control in the layout canvas shows a **visible** focus indicator.  
5. **No functional regression** — Inline edit flows (label, description, hint, properties) remain **reachable** after visual changes.
