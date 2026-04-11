# Adjudication — Layout workspace canvas

## Comparative analysis

| Criterion | Conservative | Evolutionary | Density |
|-----------|--------------|--------------|---------|
| SC1 Single selection dialect | Partial | **Pass** | **Pass** |
| SC2 Grid balance | Partial | **Pass** | **Pass** |
| SC3 Primary action clarity | Partial | **Pass** | Partial |
| SC4 Focus visible | Pass | Needs verify | Needs verify |
| SC5 No regression | **Pass** | Medium risk | **Higher risk** |
| Addresses all 6 problems | 6 touched lightly | 6 addressed structurally | 6; #3 by removal |
| Respects constraints | **Yes** | Yes (verify focus) | Workflow shift for summary |
| Design coherence | 3/5 — still two dialects | **5/5** | 4/5 — dual radius rules |
| Implementation feasibility | **5/5** | 4/5 | 3/5 — toolbar + grid branching |

## The Verdict

**Winner: `evolutionary.md`**

1. **Why**: It is the only proposal that **unifies selection vocabulary** across containers and leaves while preserving the **ItemRow typography** story inside cards. It directly breaks the domino chain from “independent selected styles” to a **shared rail + fill** system. Conservative leaves the core dialect clash; Density solves grid height by **relocating** description/hint, which conflicts with the explicit product ask to edit inline on the canvas.

2. **Cherry-picks**: From **conservative**: softer shadow reduction (if rail + fill is still too loud in QA). From **density**: **`layoutContext`-aware padding** in grid only (optional phase-2), not removal of summary.

3. **Remaining concerns**: Disclosure pattern for Description/Hint adds **interaction cost**; split-button for containers needs **copy** (“Add Stack” vs “Choose type”). Focus rings must be checked against **`border-l-4`** (and use logical `border-inline-start` for RTL).

4. **Implementation priority**

   1. Extract shared `LAYOUT_SELECTED` (or `layoutNodeSelectedClasses`) and apply to `LayoutContainer`, `FieldBlock`, `DisplayBlock` selected branches.  
   2. Remove/replace heavy `shadow-[0_14px_34px_gba(...)]` on field/display.  
   3. Restyle `LayoutContainer` unselected/selected borders per evolutionary sketch (left rail + softer perimeter).  
   4. Add disclosure toggle for summary strip when toolbar visible or when in grid (product choice).  
   5. Toolbar footer attachment (`border-t`, `bg-subtle/30`).  
   6. LayoutCanvas container control → split or click menu (accessibility).  
   7. Resize corner tick (polish).

**Winner slug for downstream files:** `evolutionary`
