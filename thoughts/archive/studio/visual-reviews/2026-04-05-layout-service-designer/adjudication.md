# Adjudication — Layout workspace visual proposals (2026-04-05)

## Comparative analysis

| Criterion | Conservative | Evolutionary | Density |
|-----------|--------------|------------|---------|
| **Single accent hero** | pass — demotes stepper fill | pass — underline / transparent nav | pass — tick/dot only |
| **Nesting deliberate** | partial — conditional STACK | pass — tiered chrome model | pass — neutral stack rule |
| **Truncation recoverable** | pass — mostly `title` | pass — 2-line / measure | pass — title + copy |
| **Toolbar legibility** | partial — +1px bump | pass — footer attach + 12px | risk — icon-first may obscure |
| **No functional regression** | pass — low blast radius | pass — moderate changes | fail risk — Insert menu + icon toolbar |

| Meta | Conservative | Evolutionary | Density |
|------|--------------|------------|---------|
| **Addresses all problems (6)** | 6/6 (some partial) | 6/6 | 6/6 (toolbar risk) |
| **Respects constraints** | yes | yes | yes (with tooltip discipline) |
| **Design coherence** | 4/5 — minimal delta | 5/5 — aligns nav/frame/stack | 4/5 — powerful but shifts learnability |
| **Implementation feasibility** | 5/5 | 4/5 | 3/5 — Insert menu + toolbar refactor |

## The Verdict

1. **Winner: Evolutionary** — Best **cost/benefit**: fixes the **dual hero accent** and **STACK dialect** with a **coherent three-tier chrome story**, improves **toolbar attachment** without the **density** proposal’s **interaction risk** (icon-only toolbar).  
2. **Cherry-picks** — From **Conservative**: verify **`title`** on step labels is **always** full `page.title` (cheap). From **Density**: optional **copy bind path** micro-affordance later if truncation remains noisy.  
3. **Remaining concerns** — Two-line step labels may **increase nav height**; must cap **max lines** and test **overflow-x**. **Theme mode** sibling controls need a quick **audit** so pills do not reappear.  
4. **Implementation priority**  
   1. `LayoutStepNav.tsx` — active state → **underline / non-fill** (single accent hero).  
   2. `LayoutContainer.tsx` — **STACK** chrome when page/ancestor selected (escalate from sketch).  
   3. `LayoutCanvas.tsx` — **add-button hierarchy** (Item primary, others ghost / grouped).  
   4. `FieldBlock.tsx` footer + `InlineToolbar.tsx` — **12px** scale + subtle **inner shadow** attach.  
   5. `DragHandle` / `FieldBlock` — **focus-within** full opacity + verify touch zones.

**Winner slug:** `evolutionary`
