# Scout review — Evolutionary proposal (Layout workspace)

**Scope:** Visual/styling alignment per `proposals/evolutionary.md`, validated against current sources in `packages/formspec-studio/src/workspaces/layout/*` and `DragHandle.tsx`.  
**Layer:** Studio (Layer 7) only — no spec/schema/types/engine/core/studio-core contract changes required for presentation.

---

## 1. Symptom (design intent)

The handoff describes **competing accent surfaces** (wizard stepper vs canvas selection), **STACK wireframe inside a framed page**, **truncation**, **toolbar scale**, **equal-weight add actions**, and **drag-handle discoverability**. Evolutionary addresses these with a **three-tier chrome** story (nav muted, canvas selection hero, stack interior escalated).

---

## 2. Trace (code ↔ proposal)

| Proposal item | Current implementation | Fit |
|---------------|------------------------|-----|
| Demote stepper accent | `LayoutStepNav.tsx` lines 74–77: active `bg-accent text-white` | Direct swap to underline/tab style — **low risk** |
| STACK badge / border | `LayoutContainer.tsx` lines 231–235: uppercase `component` chip; shell from `layout-node-styles.ts` (`LAYOUT_CONTAINER_*`) | Badge + border changes are **local**; **conditional “child selected” is not wired** (see below) |
| Add hierarchy | `LayoutCanvas.tsx` 608–633: three controls with same pill pattern | **Local** className / optional wrapper |
| Toolbar 12px + footer attach | `FieldBlock.tsx` 495–515 footer; `InlineToolbar.tsx` pervasive `text-[11px]`, `h-6` controls | Footer wrapper is **FieldBlock** (and likely **DisplayBlock** for parity); **InlineToolbar** needs token pass for 12px / control heights |
| Step two-line labels | `LayoutStepNav.tsx`: single-line button, `shrink-0`, no `title` on label span | Needs layout + **snapshot/E2E** for nav height |
| Key truncation recovery | `FieldBlock.tsx` `renderReadonlyKeyRow`: outer `title={bindPath \|\| itemKey}` but **truncated segment** is inner `itemKey` only | **Partial** recovery today; proposal’s measure/second-line adds **state or CSS** |
| Drag handle | `DragHandle.tsx`: `opacity-0 group-hover`, `focus-visible:opacity-100`; **no `group-focus-within`** | Card is `group` + `tabIndex={0}` in `FieldBlock.tsx` — **one class tweak** can satisfy focus-within visibility |
| Semantic tokens | `layout-node-styles.ts` exports container/leaf only | Adding `LAYOUT_NAV_TAB_ACTIVE` etc. is **consistent** with existing pattern |

---

## 3. Root domino (implementation)

**Primary gap:** “STACK escalates when any child selected” / “solid when descendant selected” is **not expressible** with today’s `LayoutContainer` `selected={ctx.selectedKey === selectionKey}` (`render-tree.tsx` ~153). Selection is **boolean per node**, with **no** `descendantSelected` or `pageContextActive` prop.

**Options (increasing blast radius):**

1. **Narrow:** Escalate STACK only when **`selected === true`** (container itself selected). **Does not** match adjudication’s “when page/ancestor selected” or proposal’s “any child selected.”
2. **Medium:** Pass **`pageSectionActive`** from `LayoutPageSection` / `render-tree` into descendants (context or prop drilling) so stacks inside the **active wizard page** use stronger chrome. Fixes “sketch inside active page” for wizard flow **without** full subtree selection math; **incomplete** if the issue reproduces when a **non-active** page’s child is selected (multi-page edge cases depend on UX).
3. **Correct for “any descendant”:** Precompute in `render-tree.tsx` (or a small helper) whether `ctx.selectedKey` refers to a node **inside** each container’s subtree, then pass `interiorEmphasis` / `hasSelectedDescendant`. **Touches** `render-tree.tsx`, `LayoutContainer` props, and tests.

**Recommendation:** Decide product intent explicitly (active page only vs. descendant selection). If the screenshot problem is “I’m on this wizard step and the STACK still looks like a placeholder,” option 2 may suffice and ships faster.

---

## 4. Product impact

- **Positive:** Clearer **single hero accent** (if `LayoutThemeToggle` is also harmonized — it still uses **solid accent pill** for active mode, `LayoutThemeToggle.tsx` 46–49, i.e. a **third** “marketing pill” next to the demoted stepper).
- **Risk:** Two-line step labels **grow header height** and may worsen **horizontal scroll** on many pages; needs cap (`line-clamp-2` + `title`) and visual QA.
- **Risk:** Smaller **+ Page** / stack split as ghosts may **reduce discoverability** for infrequent actions — acceptable if hierarchy matches intent; verify **touch targets** (44px) on the split control (`AddLayoutContainerSplit` currently `py-1.5`).
- **Accessibility:** `DragHandle` remains **`tabIndex={-1}`** with KN-4 TODO; evolutionary **does not** fix keyboard reorder — only visibility. **Contrast** checks needed if `bg-subtle/40` footer lightens controls.

---

## 5. Architecture concerns

1. **Accent budget > stepper:** After demoting `LayoutStepNav`, **`LayoutThemeToggle`** and **`LayoutPageSection`** (`active ? 'border-accent shadow-sm'`) can still compete with canvas rail selection. Evolutionary **bonus** (“audit theme toggle”) is **architecturally necessary** for “single hero,” not optional polish.
2. **Token home:** Centralizing in `layout-node-styles.ts` is **good**; avoid a second parallel module unless exports grow enough to justify `layout-chrome.ts`.
3. **ButtonGroup:** Proposal references a **ButtonGroup** divider — confirm an existing primitive in `packages/formspec-studio/src/components/ui/` or implement a **minimal** `inline-flex` + `divide-x` to avoid importing dead patterns.
4. **Descendant selection / context:** Any new React context should stay **layout-workspace-local** (not global app shell) to preserve dependency clarity.
5. **DisplayBlock parity:** Handoff scope lists `DisplayBlock.tsx`. If footer/toolbar styling mirrors `FieldBlock`, plan **both** for visual consistency.

---

## 6. Suggested modifications (to the proposal)

1. **Spell out the third accent:** Add an explicit decision for **`LayoutThemeToggle`** (e.g. active = outline + text-accent, inactive muted) in the same change set as `LayoutStepNav`.
2. **Clarify STACK rule:** Replace ambiguous “any child selected” with **one of:** (a) descendant-of-this-node in tree matches `selectedKey`, (b) active `LayoutPageSection` only, or (c) this STACK `selected` only — then implement exactly one.
3. **Prefer `title` + `line-clamp` over resize observers** for keys unless product requires dynamic second line; **ResizeObserver / scrollWidth** in every row is heavier and harder in tests.
4. **InlineToolbar:** Raising to 12px implies updating **shared subcomponents** (`ToolbarSelect`, `Stepper`, `ToolbarIconBtn` heights), not only the wrapper — call that out in task breakdown.
5. **LayoutPageSection:** Consider demoting **active** border-accent if canvas selection is the hero (handoff: “either stepper or canvas” — page frame is a **fourth** player).

---

## 7. Implementation viability

**Overall: viable (4/5)** — aligned with adjudication. Most work is **Tailwind class composition** and **small prop/context** additions. The only **4/5 → 3/5** risk is **descendant-aware STACK styling** if product insists on full subtree semantics without a helper.

**Spec verification:** Not dispatched to spec-expert. Presentation-only; handoff correctly points at Theme tier for **token discipline**, not new field semantics.

---

## 8. Estimated blast radius

### Files likely touched (direct)

| File | Nature of change |
|------|------------------|
| `LayoutStepNav.tsx` | Active/inactive classes; optional two-line label layout; `title` on tabs |
| `LayoutCanvas.tsx` | Add-button hierarchy; optional group wrapper; `AddLayoutContainerSplit` styling |
| `LayoutContainer.tsx` | STACK/header chrome; new props if context/descendant logic added |
| `layout-node-styles.ts` | New exported constants (`LAYOUT_NAV_TAB_ACTIVE`, stack shell variants) |
| `FieldBlock.tsx` | Footer bg/shadow; optional focus-within coupling to drag handle (via `DragHandle` classes) |
| `DisplayBlock.tsx` | Parity with field footer/toolbar shell if applicable |
| `InlineToolbar.tsx` | Font sizes, control heights, collapsed badge scale |
| `DragHandle.tsx` | `group-focus-within:opacity-100`; optional `min-w-*` for touch |
| `LayoutThemeToggle.tsx` | Active state demotion (recommended) |
| `LayoutPageSection.tsx` | Optional active border demotion (if pursuing strict single-hero) |

### Files possibly touched (if subtree / page context)

| File | Nature of change |
|------|------------------|
| `render-tree.tsx` | Compute and pass descendant selection or page-active context |
| New: small helper under `layout/` | `selectionInSubtree(node, selectedKey)` — keep pure for unit tests |

### Consumers / tests

| Area | Examples |
|------|----------|
| Unit / RTL | `layout-canvas.test.tsx`, `toolbar-expansion.test.tsx`, `field-block-inline-edit.test.tsx`, `property-popover.test.tsx`, `layout-canvas.test.tsx` (selectors on `layout-add-*`, nav tabs) |
| Playwright | `layout-components.spec.ts`, `layout-wizard-mode.spec.ts`, `wizard-mode.spec.ts`, `helpers.ts` |
| Visual / snapshots | Any screenshot diffs under `thoughts/studio/visual-reviews/` if captured |

**Studio-core / engine / schemas:** **0 files** for pure styling. **1+ files** only if selection helper is pushed down (not recommended for presentation-only need).

---

## 9. Action

**Returned to parent / implementer** — no craftsman dispatched from scout.

**Suggested execution order** (matches adjudication §4, adjusted): (1) `LayoutStepNav` + **`LayoutThemeToggle`** together, (2) STACK rule **after** locking descendant vs page-active semantics, (3) `LayoutCanvas` adds, (4) `FieldBlock`/`DisplayBlock` footer + `InlineToolbar`, (5) `DragHandle` focus-within + touch width.

---

## 10. Evidence anchors (source lines)

- Stepper pill: `LayoutStepNav.tsx` 74–77  
- Theme toggle pill: `LayoutThemeToggle.tsx` 46–49  
- Page section accent: `LayoutPageSection.tsx` 16–18  
- Container selection: `layout-node-styles.ts` 4–8; `LayoutContainer.tsx` 214–216  
- Selection wiring: `render-tree.tsx` 145–154  
- Add cluster: `LayoutCanvas.tsx` 608–633  
- Field footer: `FieldBlock.tsx` 495–515  
- Toolbar scale: `InlineToolbar.tsx` e.g. 72, 101, 153  
- Drag handle: `DragHandle.tsx` 23  
