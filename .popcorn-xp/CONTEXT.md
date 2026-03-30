# Task: ItemRow UX Overhaul (9-phase plan)

Restructure the ItemRow expanded panel from three implementation-oriented zones (field config, behavior, options) into four task-oriented accordion categories (Visibility, Validation, Value, Data format). Replace cryptic pill abbreviations with verb-intent labels. Add inline advisory callouts. Add expression error states. Consolidate competing "+" actions.

**Plan:** `thoughts/plans/2026-03-30-itemrow-ux-implementation.md`
**Branch:** `feat/editor-layout-split` (existing, has uncommitted changes)

## Phases
1. Shared vocabulary layer (pill text, summary input labels)
2. Summary grid: category-aligned slots
3. Accordion component (new)
4. Advisory callout component (new)
5. BindCard enhancements (verb-intent headers, advanced disclosure, error state)
6. ItemRowLowerPanel restructure (the big rewrite)
7. AddBehaviorMenu consolidation + display-item filtering
8. Expression error states (wire FEL diagnostics to BindCard)
9. Playwright E2E updates

## Roles
- `scout`: Map affected files across all phases, identify unknowns and ordering risks
- `expert`: Correctness risks in Phase 6 (state model change) and Phase 8 (FEL diagnostics)
- `tester`: Test plan across all layers (unit, integration, e2e) for all 9 phases

## Current Driver
- Round 1: Parallel orientation — all agents scouting
- Navigator: main thread
- Status: driving

## Checklist
- [ ] Phase 1: Update pill text and summaryInputLabel values
- [ ] Phase 2: Category-aligned summary grid
- [ ] Phase 3: AccordionSection component
- [ ] Phase 4: AdvisoryCallout component + buildAdvisories
- [ ] Phase 5: BindCard verb-intent headers, advanced disclosure, error/tip props
- [ ] Phase 6: ItemRowLowerPanel accordion restructure
- [ ] Phase 7: AddBehaviorMenu consolidation
- [ ] Phase 8: Expression error states
- [ ] Phase 9: Playwright E2E updates
- [ ] Final verification
