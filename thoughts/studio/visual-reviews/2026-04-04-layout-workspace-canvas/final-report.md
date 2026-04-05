# Final report — Layout workspace canvas visual design review

## 1. Executive summary

**Target:** Formspec Studio **Layout** tab — `LayoutCanvas` chrome plus `LayoutContainer`, `FieldBlock`, and `DisplayBlock` on the authoring canvas. Assessment used **code + structural DOM outline** (live PNGs deferred; see `screenshots/README.txt`). **Verdict:** Level 3 — harmonize **selection and surface dialect** across structural vs leaf nodes. **Winning direction:** **Evolutionary** proposal — shared **left-accent selection rail** + subdued fill, **remove duplicate heavy glow**, optional **details disclosure** for description/hint in dense grids, **toolbar visually attached** to card footer, **split/click improvement** for “Add Container.” **Service designer** and **scout** endorsed with RTL, discoverability, and small-module extraction notes. **Phase 6 (post-implementation QA)** is **not run** — run after implementation using the command’s `qa-validation` prompt.

## 2. Winning proposal

- **File:** `proposals/evolutionary.md`  
- **Direction:** Moderate restructure — unified selection language, shared classes, disclosure for secondary copy, split control for containers.

## 3. Review consensus

All three lenses agree:

- **Unify selection styling** across container and field/display (biggest win).  
- **Reduce or remove** the large blue diffuse shadow on selected fields in favor of **systematic** accent usage.  
- **Grid vertical stacking** needs **disclosure** and/or **context-aware density** — not status quo.  
- **Container add** must not rely on **hover-only** discovery.

## 4. Open concerns

- **Focus rings** vs `border-l-4` (evolutionary) — verify in browser.  
- **Disclosure** vs “always visible” inline editing — product may prefer **badge + default-open when non-empty** (service designer).  
- **Density** proposal’s **grid-only smaller radius** is a useful **phase-2** cherry-pick, not part of the winner’s MVP.

## 5. Implementation plan (ordered)

1. Add `layout-node-styles.ts` (or equivalent) exporting shared selected/unselected layout classes.  
2. Apply to `LayoutContainer`, `FieldBlock`, `DisplayBlock`; remove duplicated shadow from field/display selected state.  
3. Restyle container shell toward **left rail + perimeter** (evolutionary sketch).  
4. Wrap `renderSummaryStrip` in disclosure when `showToolbar` or when `parentContainerType === 'grid'` (product toggle).  
5. Toolbar footer: `border-t` + muted band on field/display.  
6. `LayoutCanvas`: replace hover-only container menu with **click** or **split button**; add `aria-expanded` / focus trap as needed.  
7. Optional: corner resize tick; optional: `border-inline-start` for RTL.  
8. Run `packages/formspec-studio` layout Vitest + relevant Playwright; capture **pass1** / **verify** screenshots into `screenshots/`.  
9. Run **Phase 6** `qa-validation` prompt; save `qa-validation.md`.

## 6. Files to modify

| File | Change |
|------|--------|
| `packages/formspec-studio/src/workspaces/layout/LayoutContainer.tsx` | Selected/unselected shell classes; align with shared layout selection tokens |
| `packages/formspec-studio/src/workspaces/layout/FieldBlock.tsx` | Shell classes; disclosure for summary; toolbar footer wrapper |
| `packages/formspec-studio/src/workspaces/layout/DisplayBlock.tsx` | Same as field where applicable |
| `packages/formspec-studio/src/workspaces/layout/LayoutCanvas.tsx` | Container add control interaction + a11y |
| `packages/formspec-studio/src/workspaces/layout/InlineToolbar.tsx` | Optional compact/footer context (wrapper may live in parent only) |
| **New** `layout-node-styles.ts` (under `layout/`) | Shared `LAYOUT_NODE_*` class strings |
| Tests under `tests/workspaces/layout/` | Update assertions if DOM/class names change |

---

**User next step:** Confirm if you want **implementation** dispatched (e.g. frontend-artisan / craftsman) following this plan. **Phase 6** runs **after** merge.
