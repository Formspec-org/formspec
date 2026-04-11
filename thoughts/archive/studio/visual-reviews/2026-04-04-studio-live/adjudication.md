# Adjudication — Studio Layout workspace (live-validated)

**Live evidence:** `handoff-brief.md` + `screenshots/pass1-*.png` + `screenshots/dom-*.txt` from `http://localhost:5173/studio/` (Layout / Wizard).

## Comparative analysis

| Criterion | Conservative | Evolutionary | Density |
|-----------|--------------|--------------|---------|
| SC1 Single selection dialect | Partial | **Pass** | **Pass** |
| SC2 Grid balance | Partial | **Pass** | **Pass** |
| SC3 Primary action clarity | Partial | **Pass** | Partial |
| SC4 Focus visible | Pass | Needs verify | Needs verify |
| SC5 No regression | **Pass** | Medium risk | **Higher risk** |
| Addresses all 6 problems | 6 touched lightly | 6 addressed structurally | 6; #3 by removal / branch |
| Respects constraints | **Yes** | Yes (verify focus + RTL) | Workflow shift for inline summary |
| Design coherence | 3/5 — dialect remains | **5/5** | 4/5 — dual radius rules |
| Implementation feasibility | **5/5** | 4/5 | 3/5 — grid branching + toolbar |

## The Verdict

**Winner: `evolutionary.md`**

1. **Why**: Live capture reinforces **competing blues** and **dialect clash**; evolutionary is the only proposal that **unifies selection vocabulary** (shared left rail + fill) while keeping **ItemRow identity** inside cards. It also targets **vertical growth** via disclosure without deleting the product requirement for inline description/hint on canvas.

2. **Cherry-picks**: From **conservative**: softer shadow reduction if rail+fill is loud in QA; **title** on truncated keys. From **density**: optional **`layoutContext`-aware** padding in grid only (phase 2), not removal of summary.

3. **Remaining concerns**: Disclosure adds **interaction cost**; split-button for containers needs clear **labels**; use **`border-inline-start`** for RTL; **wizard stepper** truncation may still need **tooltip** or scroll — not fully solved inside field-only changes.

4. **Implementation priority**

   1. Extract shared `layoutNodeSelectedClasses` / `LAYOUT_SELECTED` → `LayoutContainer`, `FieldBlock`, `DisplayBlock`.  
   2. Remove/replace heavy diffuse `shadow-[0_14px_34px_rgba(59,130,246,0.12)]` on field/display selected shells.  
   3. Restyle container stack chrome per evolutionary sketch (left rail + softer perimeter vs dashed-only sketch).  
   4. Disclosure toggle for description/hint when toolbar visible or in grid (product choice).  
   5. Toolbar footer band (`border-t`, `bg-subtle/30`).  
   6. `LayoutCanvas` container control → split or explicit menu (a11y).  
   7. Resize corner tick (polish).  
   8. **Follow-up**: stepper label truncation + key ellipsis (title/tooltip or layout).

**Winner slug for downstream files:** `evolutionary`
