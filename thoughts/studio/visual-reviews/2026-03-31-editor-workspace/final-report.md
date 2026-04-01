# Editor Workspace Visual Design Review — Final Report

**Date:** 2026-03-31
**Target:** `packages/formspec-studio/src/workspaces/editor/`
**Branch:** `feat/editor-layout-split`

---

## Executive Summary

The editor workspace was assessed for visual design quality. The visual-designer agent identified 8 problems — nearly invisible selection state, wasted vertical space from a sticky toggle bar, empty category cells with no click affordance, an overpowering master card shadow, a Form Health panel with competing red badges, an inconsistent warm gradient, and a fragmented typography scale. Three proposals were generated (Conservative, Evolutionary, Density-focused) and evaluated. The **Evolutionary** proposal was selected as the winner for its structural improvements and maintainable artifacts (CategoryCell component, type scale tokens). Both cross-functional reviewers (service-designer and architecture scout) conditionally endorsed the proposal.

**Post-review decision:** The proposals recommended swapping the label/key hierarchy (label primary, key secondary). This was overridden — the key stays primary. Studio is a definition authoring tool where the machine key is the canonical identifier for the data structure. The key-first presentation is intentional and correct for this audience. The label remains secondary. Typography refinements (type scale tokens, contrast improvements) still apply to the existing key-primary/label-secondary ordering.

---

## Winning Proposal: Evolutionary

**Direction:** Moderate restructuring — improve the design system where it's incoherent, restructure components where the markup fights the CSS.

**Key changes:**
1. Move Build/Manage toggle from sticky band into DefinitionTreeEditor header (reclaim 48px)
2. ~~Swap label/key hierarchy~~ **Overridden** — key stays primary (canonical data structure presentation). Typography refinements (type scale tokens, label contrast bump) still apply.
3. Strengthen selection state — `bg-accent/[0.09]`, `border-accent/50`
4. Extract `CategoryCell` component with "Add [category]..." affordance
5. Reduce master card shadow to `0_4px_16px_rgba(30,24,16,0.04)`
6. Introduce type scale tokens (`--font-size-key`, `--font-size-label`, etc.)
7. Extend warm gradient to Manage view
8. Fix error count badge in OutputBlueprint.tsx

---

## Review Consensus (All Three Reviewers Agree)

1. ~~**Label-first hierarchy is correct.**~~ **Overridden by project owner.** Key stays primary — Studio presents the canonical data structure, not a form-filling UI. The key is the primary identifier for the authoring audience. Label remains secondary with a contrast bump to `text-ink/80`.
2. **Selection state values are well-calibrated.** `bg-accent/[0.09]` + `border-accent/50` passes the arm's-length test without being heavy.
3. **CategoryCell extraction is architecturally sound.** Clean separation, reusable pattern, correct prop interface.
4. **Ring should be hover-only**, not persistent on all empty categories. The italic "Add..." placeholder provides sufficient persistent affordance.
5. **The `--state-*` token definitions are invalid CSS and should be deleted.** Component code uses Tailwind opacity modifiers directly and does not reference these tokens.
6. **`letter-spacing-[...]` must be `tracking-[...]`** (invalid Tailwind utility name).
7. **DefinitionTreeEditor props should stay optional** with defaults. Making them required would break 7 test files for zero user benefit.

---

## Open Concerns (Reviewer Disagreements / Flagged Risks)

| # | Concern | Source | Resolution |
|---|---------|--------|------------|
| ~~1~~ | ~~**Tab cycling regression**~~ | ~~Service Designer~~ | N/A — no DOM swap, key stays primary. No Tab logic change needed. |
| 2 | **CategoryCell onClick fires on expanded categories** — persistent affordance makes double-click more likely | Service Designer (Required) | Add `!isExpanded` guard to onClick |
| 3 | **GroupNode.tsx selection state omitted** — proposal updates ItemRow but not GroupNode | Scout | Update GroupNode line 237 to `border-accent/55 bg-accent/[0.09]` |
| 4 | **Missing `data-testid` on CategoryCell** — breaks existing test selectors | Scout | Add `testId` prop, render `data-testid` |
| 5 | **OutputBlueprint.tsx line 321 has `text-error` badge** — all proposals claimed already resolved; it is not | Scout | Change to `text-amber-600 dark:text-amber-400` |
| 6 | **Rename `.ring-empty`** — collides with Tailwind's `ring-*` namespace | Scout | Rename to `.border-affordance` or use inline Tailwind classes |

---

## Implementation Plan

Ordered by visual impact, highest first. Incorporates all reviewer corrections.

### Phase 1: Layout & Space Recovery
1. **Remove sticky Build/Manage band** — `Shell.tsx` lines 419-426. Delete the sticky wrapper div.
2. **Move BuildManageToggle into DefinitionTreeEditor header** — Add optional props (`activeEditorView`, `onEditorViewChange`, `manageCount`) with defaults. Render toggle in card header alongside title.
3. **Reduce master card shadow** — `DefinitionTreeEditor.tsx` line 382. Change `shadow-[0_24px_70px_rgba(30,24,16,0.08)]` to `shadow-[0_4px_16px_rgba(30,24,16,0.04)]`.
4. **Extend warm gradient to Manage view** — `Shell.tsx` line 391. Change condition from `activeEditorView === 'build'` to `activeTab === 'Editor'`.

### Phase 2: Typography Refinement (key stays primary)
5. **Keep key as primary identity** — no hierarchy swap. Apply type scale tokens to existing key/label ordering for consistency.
6. **Bump label contrast** — increase from `text-ink/72` to `text-ink/80` so it reads clearly as secondary without being buried.
7. **Reduce group key font size** — 20-22px → 18-20px to align with field row scale.

### Phase 3: Selection & Affordance
9. **Update ItemRow.tsx selection state** — `bg-accent/[0.09]`, `border-accent/50`. Keep existing shadow.
10. **Update GroupNode.tsx selection state** — `border-accent/55 bg-accent/[0.09] shadow-[0_8px_20px_rgba(37,99,235,0.18)]`.
11. **Create `CategoryCell.tsx`** — Extract from SummaryColumn. Include `testId` prop. Render "Add [category]..." italic when empty+selected. Ring on **hover only** (`hover:ring-1 hover:ring-accent/15`). Add `!isExpanded` guard to onClick.
12. **Increase category label contrast** — `text-ink/62` to `text-ink/72`.

### Phase 4: Tokens
13. **Add type scale tokens to `index.css`** — `--font-size-key: 17px`, `--font-size-label: 14px`, `--font-size-category-label: 11px`, `--font-size-category-value: 14px`, etc. (preserving existing key-primary sizes).
14. **Add `.text-empty` utility** — `color-mix(in srgb, var(--color-ink) 35%, transparent); font-style: italic`.
15. **Do NOT add `--state-*` tokens or `.state-selected`/`.state-hover` utilities** — use Tailwind opacity modifiers directly.
16. **Use `tracking-[...]` not `letter-spacing-[...]`** everywhere.

### Phase 5: Form Health Badge
18. **Fix OutputBlueprint.tsx line 321** — Change `text-error` to `text-amber-600 dark:text-amber-400` for the error count badge (data validation results, not structural errors).

---

## Files to Modify

| File | Changes | Phase |
|------|---------|-------|
| `Shell.tsx` | Remove sticky band (lines 419-426); extend gradient condition (line 391) | 1 |
| `DefinitionTreeEditor.tsx` | Add optional props for toggle; render toggle in header; reduce shadow (line 382) | 1 |
| `ItemRowContent.tsx` | Bump label contrast; apply type scale tokens; extract CategoryCell usage | 2, 3 |
| `ItemRow.tsx` | Update selection state classes (line 546) | 3 |
| `GroupNode.tsx` | Update selection state classes (line 237) | 3 |
| `CategoryCell.tsx` | **NEW FILE** — extracted from SummaryColumn with testId, hover ring, isExpanded guard | 3 |
| `index.css` | Add type scale tokens, `.text-empty` utility | 4 |
| `OutputBlueprint.tsx` | Change error count badge from `text-error` to `text-amber-600` (line 321) | 5 |

**Total:** 7 modified files, 1 new file. All within `packages/formspec-studio/`. No cross-package impact.
