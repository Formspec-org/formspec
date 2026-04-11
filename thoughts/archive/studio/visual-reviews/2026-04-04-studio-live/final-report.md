# Final report — Studio Layout workspace (live visual review)

## 1. Executive summary

**Target:** Formspec Studio **Layout** tab at **`http://localhost:5173/studio/`** (Wizard + Layout mode) — canvas chrome, `LayoutContainer` stack regions, and **ItemRow-style** `FieldBlock` cards. **Phase 1** used **real PNG screenshots** and **DOM snapshots** saved under `screenshots/`. **Verdict:** Level 3 — unify **selection and surface dialect** and address **responsive truncation**. **Winner:** **`proposals/evolutionary.md`** — shared **left-accent selection**, remove heavy diffuse glow, **details disclosure** for dense layouts, **toolbar footer** band, improved **Add Container** control. **Service designer** and **scout** endorse with RTL, discoverability, tooltip/cherry-pick notes. **Phase 6 (post-implementation QA)** is **not run** until code lands; use the command’s `qa-validation` prompt and save `qa-validation.md`.

## 2. Winning proposal

- **File:** `proposals/evolutionary.md`  
- **Direction:** Moderate restructure — unified selection language, shared classes, disclosure for secondary copy, split/click improvement for containers.

## 3. Review consensus

- **Unify selection styling** across container and field/display.  
- **Reduce or remove** large blue diffuse shadow on selected fields; use **systematic** accent (rail + fill).  
- **Grid / narrow viewports** need **disclosure** and/or **context-aware density**; live capture shows **ellipsis** on keys and **wizard** steps.  
- **Container add** must not rely on **hover-only** discovery.

## 4. Open concerns

- **Focus rings** vs `border-l-4` — verify in browser after implementation.  
- **Disclosure** discoverability — badge / default-open when description or hint non-empty (service designer).  
- **Stepper + key truncation** — may need **follow-up PR** (title attributes, min-width, or horizontal scroll).

## 5. Implementation plan (ordered)

1. Add `layout-node-styles.ts` exporting shared selected/unselected layout classes.  
2. Apply to `LayoutContainer`, `FieldBlock`, `DisplayBlock`; remove duplicated heavy shadow from field/display selected state.  
3. Restyle container shell toward **left rail + perimeter** (evolutionary sketch).  
4. Wrap `renderSummaryStrip` in disclosure when toolbar visible or when `parentContainerType === 'grid'` (product toggle).  
5. Toolbar footer: `border-t` + muted band on field/display.  
6. `LayoutCanvas`: replace hover-only container menu with **click** or **split button**; add `aria-expanded` / focus handling as needed.  
7. Optional: corner resize tick; **`border-inline-start`** for RTL.  
8. Follow-up: wizard stepper + field key **truncation UX** (tooltips / layout).  
9. Run layout Vitest + relevant Playwright; add **`verify-*.png`** to `screenshots/` and complete **`qa-validation.md`**.

## 6. Files to modify

| File | Change |
|------|--------|
| `packages/formspec-studio/src/workspaces/layout/LayoutContainer.tsx` | Selected/unselected shell classes; align with shared layout selection tokens |
| `packages/formspec-studio/src/workspaces/layout/FieldBlock.tsx` | Shell classes; disclosure for summary; toolbar footer wrapper |
| `packages/formspec-studio/src/workspaces/layout/DisplayBlock.tsx` | Same as field where applicable |
| `packages/formspec-studio/src/workspaces/layout/LayoutCanvas.tsx` | Container add control; optional stepper overflow |
| `packages/formspec-studio/src/workspaces/layout/InlineToolbar.tsx` | Optional footer context (wrapper may live in parent only) |
| **New** `layout-node-styles.ts` (under `layout/`) | Shared `LAYOUT_NODE_*` class strings |
| Tests under `tests/workspaces/layout/` | Update assertions if DOM/class names change |

---

**Next step:** If you want this implemented in-repo, confirm and we can drive **`proposals/evolutionary.md`** + this plan in code, then run **Phase 6** QA against `handoff-brief.md` success criteria.
