# Final report — Layout workspace visual review (2026-04-05)

## 1. Executive summary

This review targets **Formspec Studio → Layout** (Wizard + Layout mode) **after** the recent evolution: **shared inline-start selection rails** (`layout-node-styles.ts`), **label-first / read-only key** rows, **Description & hint** disclosure, **PropertyPopover** clamping and outside-click close, and split **+ Stack**. Phase 1 concludes at **Verdict Level 2 (polish)** — prior Level 3 dialect and selected-height issues are **mostly resolved**; remaining work is **accent budgeting**, **STACK vs frame** coherence, **truncation recovery**, **toolbar scale**, **add-button hierarchy**, and **drag affordance**. **Adjudication** selects **`evolutionary`**: demote **wizard stepper** fill to **underline / non-fill**, **tier** nav vs page vs stack chrome, **raise** toolbar readability and **attach** footer visually, **hierarchy** for add buttons, **focus-within** drag visibility. **formspec-service-designer** **conditionally endorses** the winner, asking for **capped two-line steps**, **≥44px** targets, **touch** reorder visibility, and **RTL** verification. **formspec-scout** calls implementation **mostly viable** but flags **`LayoutThemeToggle` / `LayoutPageSection`** as **remaining accent competitors**, and **`STACK` “child selected”** as **not wired** without **`render-tree`** / context work — product must pick **narrow vs descendant-aware** rule before coding.

## 2. Winning proposal

- **Name:** Evolutionary (`proposals/evolutionary.md`)  
- **Direction:** Realign **stepper**, **page frame**, and **STACK interior** into one chrome story; **canvas selection** stays the saturated hero; **toolbar** reads as part of the card.

## 3. Review consensus (visual handoff + service-designer + scout)

- **Single hero accent** should **not** be solved by **`LayoutStepNav` alone** — **theme toggle** (and possibly **active page section** chrome) must move in the **same design pass**.  
- **`STACK` escalation** needs an **explicit product rule**: container `selected` only vs **active wizard page** vs **true descendant selection** — scout maps each to **blast radius**.  
- **Two-line** steps/keys trade **ellipsis** for **height and layout-shift** risk — cap with **`line-clamp`** + **`title`**, prefer over **per-row measurement** unless required.  
- **Touch and AT**: **underline-only** tabs and **ghost** secondary adds need **contrast**, **hit area**, and **linkage** checks (step ↔ canvas).  
- **DisplayBlock** should stay **visually in sync** with **FieldBlock** for footer/toolbar.

## 4. Open concerns / disagreements

- **Service-designer:** Risk that **muting** the stepper **weakens wayfinding** if step ↔ canvas linkage is weak for some users; **ghost + Page** may be **overlooked** or cause **wrong-object adds**.  
- **Scout:** **Descendant-selected STACK** is **non-trivial**; **narrow** interpretation may **not** match screenshot pain; **theme toggle** pill **re-breaks** “single hero” if ignored.

## 5. Implementation plan (ordered)

1. **`LayoutStepNav.tsx`** — Active step: **outline / underline**, not `bg-accent text-white`; add **`title`** with full page title; cap height (`line-clamp-2` if wrapping).  
2. **`LayoutThemeToggle.tsx`** (+ optionally **`LayoutPageSection`** active chrome) — **Demote** solid accent pill to match nav vocabulary (scout §5).  
3. **`LayoutContainer.tsx` + `render-tree.tsx` (+ optional context)** — Define and implement **one** STACK rule: *recommended first slice:* “**active wizard page**” context for stronger interior chrome; upgrade to **descendant-selected** only if product requires.  
4. **`LayoutCanvas.tsx`** — **+ Item** primary; **+ Page** and **+ Stack** split **secondary** / grouped; verify **44px** touch targets on split.  
5. **`FieldBlock.tsx` + `DisplayBlock.tsx`** — Footer **attach** (subtle inner shadow / `bg-subtle`); **`InlineToolbar.tsx`** internal **12px** scale and control heights (not wrapper only).  
6. **`DragHandle.tsx` / `FieldBlock.tsx`** — **`group-focus-within`** visibility + consider **higher baseline opacity** for **touch** (service-designer §6).  
7. **Tests** — Update snapshots / Playwright for **`page-nav-tab-*`**, add controls, wizard layout; **RTL** spot-check for **inline-start** rails.

## 6. Files to modify

| File | Change |
|------|--------|
| `packages/formspec-studio/src/workspaces/layout/LayoutStepNav.tsx` | Active tab styling; `title`; optional two-line clamp |
| `packages/formspec-studio/src/workspaces/layout/LayoutThemeToggle.tsx` | Demote active pill to align accent budget |
| `packages/formspec-studio/src/workspaces/layout/LayoutPageSection.tsx` | Optional: soften `border-accent` when canvas is hero |
| `packages/formspec-studio/src/workspaces/layout/LayoutContainer.tsx` | STACK/badge/border per chosen rule |
| `packages/formspec-studio/src/workspaces/layout/render-tree.tsx` | Prop/context for page-active or descendant-selected |
| `packages/formspec-studio/src/workspaces/layout/LayoutCanvas.tsx` | Add-button hierarchy |
| `packages/formspec-studio/src/workspaces/layout/FieldBlock.tsx` | Footer attach; drag visibility hooks |
| `packages/formspec-studio/src/workspaces/layout/DisplayBlock.tsx` | Parity with FieldBlock footer/toolbar shell |
| `packages/formspec-studio/src/workspaces/layout/InlineToolbar.tsx` | 12px / control heights |
| `packages/formspec-studio/src/workspaces/layout/layout-node-styles.ts` | Optional exported nav/stack semantic strings |
| `packages/formspec-studio/src/components/ui/DragHandle.tsx` | `group-focus-within`, baseline opacity |

---

**Phase 6:** After implementation, run visual QA per pipeline (`qa-validation.md`, `screenshots/verify-*.png`).

**Status line:** Verdict **Level 2**; winner **`evolutionary`**; service-designer **conditional endorse**; scout **viable with STACK rule + theme-toggle pass**.
