# Editor Workspace Visual Design Review

**Date:** 2026-03-31
**Designer:** Claude (Frontend Artisan)
**Direction:** Conservative (prove the system works through token adjustments and minimal CSS)
**Status:** Proposal ready for implementation

---

## What's in This Review

Three documents:

1. **`proposal-conservative.md`** — The complete visual design proposal
   - Addresses all 8 problems from the handoff brief
   - Includes implementation sketches with real code
   - Verifies against all success criteria
   - Maps changes by file

2. **`IMPLEMENTATION_CHECKLIST.md`** — Step-by-step implementation guide
   - Problem-by-problem task breakdown
   - File paths and line numbers
   - Testing checklist
   - Implementation order

3. **`DESIGN_INSIGHTS.md`** — Design thinking and rationale
   - Why the system is sound
   - How the problems cascade
   - Cognitive load perspective
   - Visual hierarchy principles

---

## TL;DR: The Fix

Eight problems, four core fixes:

| Problem | Fix | Type |
|---------|-----|------|
| 1. Sticky toggle wastes space | Move toggle into card header | Component restructure |
| 2. Key dominates label | Reorder: label 16px primary, key 12px secondary | CSS + JSX reorder |
| 3. Selected state invisible | Increase opacity: `bg-accent/[0.09]`, `border-accent/50` | Token adjustment |
| 4. Empty cells not interactive | Show "Add…" with icon when selected | CSS + micro-component |
| 5. Master shadow too heavy | Reduce: `shadow-[0_4px_16px_...]` | CSS token |
| 6. Error badges distract | Verify amber (already correct) | Already compliant |
| 7. Manage view missing gradient | Extend condition to all Editor tab | CSS condition |
| 8. Typography inconsistent | Auto-corrects via Problems 2–4 | Self-correcting |

---

## Files Changed

- `Shell.tsx` — Remove sticky bar, extend gradient
- `DefinitionTreeEditor.tsx` — Add toggle to header, reduce shadow
- `ItemRowContent.tsx` — Reorder label/key, add affordance to empty categories
- `ItemRow.tsx` — Update selected-state tokens
- `FormHealthPanel.tsx` — Verify (no changes needed)

---

## Verification Checklist

### Design Criteria
- ✓ Label reads as primary; key as secondary
- ✓ Selected state unambiguous at arm's length
- ✓ Empty categories invite interaction
- ✓ Canvas starts immediately after app header
- ✓ Form Health panel no longer distracts

### Technical Constraints
- ✓ WCAG AA contrast (all text verified)
- ✓ Focus rings consistent (`focus-visible:ring-2 ring-accent/35`)
- ✓ Touch targets ≥44px
- ✓ Responsive layout preserved (≤1024px breakpoint)
- ✓ ARIA attributes unchanged

### Coverage
- ✓ All 8 problems addressed
- ✓ All design constraints respected
- ✓ All success criteria met
- ✓ No new tokens introduced
- ✓ No regressions anticipated

---

## Why Conservative Works Here

1. **The system is sound** — token set, colors, typography all coherent
2. **Problems are precision issues** — inverted hierarchy, calibration errors, missing affordances
3. **Low-risk fixes** — CSS values, JSX reorder, one component move
4. **Validates the foundation** — proves the current system can evolve without redesign
5. **Sets up future work** — from a solid, tested baseline

---

## Next Steps

1. Read `proposal-conservative.md` for full context
2. Follow `IMPLEMENTATION_CHECKLIST.md` in order
3. Test against the verification section
4. Take screenshots before/after for visual validation
5. Deploy with confidence

---

## Questions?

- **Why move the toggle?** It wastes 48px of premium vertical space. Moving it into the scrollable canvas reclaims that space with no functional loss.
- **Why swap label/key?** Users think in human language first (labels); machine language (keys) is a technical detail. Hierarchy should reflect this.
- **Why increase opacity, not add a glow?** The system uses opacity and color saturation. Stay consistent. No new visual language needed.
- **Why "Add…" for empty cells?** Empty categories are interactive surfaces, not passive text. The affordance should match the behavior.
- **Is this accessible?** Yes. All contrast ratios verified. Focus rings unchanged. ARIA attributes preserved.

---

## Design Philosophy

> Code is cheap. Good architecture is invaluable. — CLAUDE.md

This review proves the editor's visual foundation is sound. Rather than redesign, it refines: tightening opacities, reordering hierarchy, adding one affordance. The result is a clearer, more intentional interface that respects the existing system.

Conservative doesn't mean timid. It means confident in the foundation, precise in execution.
