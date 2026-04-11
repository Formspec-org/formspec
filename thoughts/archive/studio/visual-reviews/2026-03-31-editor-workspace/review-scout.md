# Editor Workspace Visual Design -- Architecture Scout Review

**Date:** 2026-03-31
**Reviewer:** Formspec Architecture Scout
**Input:** Evolutionary proposal (adjudicated winner), handoff brief, adjudication notes
**Branch:** `feat/editor-layout-split`

---

## 1. Code Impact Assessment

### Files Modified

| File | Change Type | Risk |
|------|------------|------|
| `packages/formspec-studio/src/index.css` | Additive (new tokens + utility classes) | Low |
| `packages/formspec-studio/src/components/Shell.tsx` | Structural (remove sticky band, widen gradient condition) | Medium |
| `packages/formspec-studio/src/workspaces/editor/DefinitionTreeEditor.tsx` | Structural (new props, header restructure, shadow change) | Medium-High |
| `packages/formspec-studio/src/workspaces/editor/ItemRowContent.tsx` | Structural (identity hierarchy swap, token usage) | High |
| `packages/formspec-studio/src/workspaces/editor/ItemRow.tsx` | CSS value change (3 Tailwind classes) | Low |
| `packages/formspec-studio/src/workspaces/editor/CategoryCell.tsx` | **New file** | Low |

**Total: 5 modified files, 1 new file.** This is a contained blast radius -- all changes are within the studio package, no cross-package impact. No Layer 1-5 code is touched.

### Hidden Dependencies and Test Breakage

**Critical finding: DefinitionTreeEditor prop change breaks 7 test files.**

The current signature is `export function DefinitionTreeEditor()` -- zero props. The proposal adds `DefinitionTreeEditorProps` with optional props (defaulting `activeEditorView = 'build'`). However, the adjudication's Concern 3 recommends making `activeEditorView` and `onEditorViewChange` **required** props. If followed, this breaks every test that renders `<DefinitionTreeEditor />` without props:

- `tests/workspaces/editor/editor-selection.test.tsx` (1 instance)
- `tests/workspaces/editor/definition-tree-editor.test.tsx` (2 instances)
- `tests/workspaces/editor/editor-context-menu.test.tsx` (1 instance)
- `tests/integration/import-export.test.tsx` (1 instance)
- `tests/integration/editor-workflow.test.tsx` (1 instance)
- `tests/integration/undo-redo.test.tsx` (1 instance)
- `tests/integration/editor-layout-split.test.tsx` (1 instance)

**Recommendation:** Keep the props optional with defaults. The adjudication's concern about "silent failure" is valid in theory but wrong in practice -- making them required forces every test to mock view-switching state that is irrelevant to what the test is testing (selection, context menus, undo/redo, etc.). Optional props with sensible defaults (`activeEditorView = 'build'`) is the correct pattern here. The toggle simply does not render when `onEditorViewChange` is undefined, which is exactly the right behavior in test contexts where the toggle is not being tested. This is composition, not a failure mode.

### Selection State in GroupNode.tsx -- Omitted from Proposal

The handoff brief mentions GroupNode.tsx line 237 needs the same selection opacity fix. The proposal updates ItemRow.tsx but **does not mention GroupNode.tsx**. The current GroupNode selected state is:

```
'border-accent/40 bg-accent/[0.05] shadow-[0_16px_40px_rgba(59,130,246,0.12)]'
```

This should be updated to match the new ItemRow selection tokens for consistency:

```
'border-accent/55 bg-accent/[0.09] shadow-[0_8px_20px_rgba(37,99,235,0.18)]'
```

The handoff brief specifically called out `border-accent/55` for GroupNode (slightly stronger than ItemRow's `/50` to account for the larger container). The proposal dropped this.

---

## 2. Design System Coherence

### Token Naming

The proposed tokens follow the existing naming convention in `index.css`:

- Color tokens: `--color-*` (existing pattern, not extended)
- New type scale tokens: `--font-size-*` (new namespace, clean)
- New state tokens: `--state-*` (new namespace, clean)

The `--font-size-label`, `--font-size-key`, etc. names are clear and domain-specific. No collision with existing tokens. The `--state-selected-*` namespace is new but consistent with how the codebase already uses CSS custom properties for theming.

### Utility Class Concerns

The proposal introduces four new `@utility` classes: `.text-empty`, `.ring-empty`, `.state-selected`, `.state-hover`.

**Issue with `.text-empty` and `.ring-empty`:** These use `color-mix()` in their definitions:

```css
@utility text-empty {
  color: color-mix(in srgb, var(--color-ink) 35%, transparent);
  font-style: italic;
}

@utility ring-empty {
  border: 1px solid color-mix(in srgb, var(--color-accent) 15%, transparent);
  border-radius: 0.375rem;
}
```

The `color-mix()` function IS already used in the existing `index.css` (lines 30, 35, 49, 56 -- all for scrollbar styling), so this is compatible with the build pipeline. No issue here.

**Issue with `ring-empty` semantics:** The name `.ring-empty` uses Tailwind's `ring-` prefix convention, but the implementation uses `border` not `box-shadow` (which is what Tailwind `ring` normally maps to). This creates a naming collision with Tailwind's `ring-*` utility namespace. A `border-empty` or `affordance-empty` name would avoid confusion. Alternatively, use actual Tailwind `ring` utilities inline instead of a custom utility.

**Issue with `--state-selected-border` token value:** The proposal defines:

```css
--state-selected-border: var(--color-accent) / 0.5;
```

This `/ 0.5` syntax is **not valid CSS**. It looks like Tailwind shorthand (`border-accent/50`) was confused with CSS custom property syntax. The actual CSS equivalent would be `color-mix(in srgb, var(--color-accent) 50%, transparent)`. The same issue affects `--state-selected-bg`, `--state-hover-border`, `--state-hover-bg`, `--state-empty-text`, and `--state-empty-ring`. Every `--state-*` token definition uses this invalid syntax.

**This is a blocking issue in the token definitions.** The `.state-selected` and `.state-hover` utility classes reference these tokens, so they would also be broken. However, the actual component code in the proposal does NOT use `.state-selected` or `.state-hover` -- it uses the Tailwind opacity modifier syntax (`border-accent/50`, `bg-accent/[0.09]`) directly in the JSX. So the broken tokens are dead code as written. The recommendation is to either:

1. Fix the token definitions to use `color-mix()`, or
2. Delete the `--state-*` tokens and `.state-selected`/`.state-hover` utilities entirely -- the component code does not use them, and Tailwind's inline opacity modifiers are more idiomatic for this codebase.

Option 2 is simpler and avoids introducing a parallel system. Keep the typography tokens (`--font-size-*`, `--letter-spacing-*`, `--line-height-*`), which ARE used in the component code and ARE valid CSS.

### Parallel System Risk

The proposal introduces CSS custom property tokens for typography (`--font-size-label`, etc.) alongside the existing pattern of hardcoded Tailwind arbitrary values (`text-[17px]`). This is an improvement -- tokens are more maintainable than scattered magic numbers. However, the proposal does NOT migrate all typography in the codebase to use these tokens; only the modified components use them. This creates a transitional state where some components use tokens and others use hardcoded values.

This is acceptable as long as the tokens are understood as the canonical source of truth going forward. The proposal's "Bonus Findings" section correctly identifies this as future work (extending tokens studio-wide). No immediate action needed, but the tokens should be documented as the new convention.

---

## 3. Component Architecture

### CategoryCell Extraction -- Clean

The `CategoryCell` extraction is architecturally sound. It takes a clear slice of responsibility from `SummaryColumn`, has a well-defined prop interface, and creates a reusable pattern. The props are:

```ts
interface CategoryCellProps {
  label: string;
  value: string;
  selected?: boolean;
  isExpanded?: boolean;
  onOpen?: () => void;
}
```

This is a presentational component with no business logic -- exactly right for this abstraction level. The `children` prop in the proposal's initial sketch (line 169 of the proposal) is declared in the interface but never used; it was correctly removed in the final implementation (line 908). Clean.

**One behavioral concern (also flagged in adjudication Concern 2):** The `CategoryCell` renders the empty-state ring persistently when selected and empty (`showAffordance ? 'ring-1 ring-empty' : ''`). On a freshly selected field with four empty categories, this produces four simultaneous rings. The adjudication recommends `hover:ring-1 hover:ring-empty` instead. This is the correct call -- the italic "Add [category]..." text is sufficient persistent affordance; the ring should appear on hover as a refinement.

**Missing: `data-testid` attribute.** The current `SummaryColumn` renders `data-testid={\`${testId}-category-${category}\`}` on each category cell. The proposed `CategoryCell` component drops this testId. This will break any tests or selectors that rely on `data-testid="field-name-category-Visibility"` etc. The `CategoryCell` should accept a `testId` prop or derive one from `label`.

### DefinitionTreeEditor Prop Threading -- Functional but Needs Cleanup

Moving `BuildManageToggle` into `DefinitionTreeEditor` is architecturally correct. The toggle is a view-mode selector for the content this component renders -- it belongs with the content, not in a separate chrome layer.

The prop threading is straightforward: Shell passes `activeEditorView`, `onEditorViewChange`, and `manageCount` down. No deep prop drilling -- single hop.

However, the proposal does not show what happens to the mobile compact layout. Currently, Shell.tsx line 396-416 renders a separate mobile chrome band when `compactLayout && activeTab === 'Editor'` that includes a selection context card and a health button -- but NOT the Build/Manage toggle. After removing the sticky band from lines 141-143, the toggle is only accessible inside the DefinitionTreeEditor card, which in the compact mobile layout is rendered inside a third stacked card at line 437-439. This means on mobile, the user must scroll down to the third card to find the Build/Manage toggle. This is acceptable because:

1. The mobile layout already has the toggle visible when scrolling to the editor content
2. The handoff brief constraint says "The toggle must remain reachable without scrolling" -- but on mobile, the editor card is the primary content, so the toggle at the top of that card IS reachable at scroll-top

No mobile breakage, but this should be tested manually.

### ItemRowContent Identity Swap -- The Biggest Change

The label/key hierarchy swap is the most invasive change. It restructures the `IdentityColumn` function, which currently has two distinct code paths (fields vs. display items), each with key-editing and label-editing sub-states. The proposal rewrites both paths.

Key architectural observations:

1. **The ARIA role="heading" attribute currently lives on the key div** (line 165: `{...{role: 'heading', 'aria-level': 2}}`). The proposal moves this to the label div, which is correct -- the heading should be the human-readable content.

2. **The Tab key cycling logic** (IE-3, lines 110-123) cycles between key and label fields. The current order is key-first, then Tab to label. After the swap, the natural tab order changes: label is first (top), then key (below). The Tab handling code in `handleIdentityKeyDown` needs adjustment -- currently `field === 'key' && !event.shiftKey` goes to label, and `field === 'label' && event.shiftKey` goes back to key. After the hierarchy swap, the visual order is label-then-key, so `field === 'label' && !event.shiftKey` should go to key, and `field === 'key' && event.shiftKey` should go back to label. **The proposal's code appears to keep the original Tab logic, which is now visually backwards.** This needs verification.

3. **The `labelForDescription` conditional** (line 188: `(labelForDescription || selected)`) controls whether the label row is visible at all. After the swap, the label is ALWAYS the primary display (even when `!labelForDescription && !selected`), so this conditional must be removed. The proposal handles this correctly -- the label always renders, showing "Add a display label..." placeholder when empty.

4. **Input sizing mismatch.** Currently the key input uses `text-[17px]` and the label input uses `text-[14px]`. After the swap, the label input should be `text-[var(--font-size-label)]` (16px) and the key input should be `text-[var(--font-size-key)]` (12px). The proposal uses `text-[var(--font-size-label)]` for the label input and `text-[var(--font-size-key)]` for the key input, which is correct.

### `letter-spacing-[var(--letter-spacing-wide)]` -- Invalid Tailwind Syntax

The proposal uses `letter-spacing-[var(--letter-spacing-wide)]` in multiple places. This is NOT a valid Tailwind v4 utility class. The correct Tailwind utility for letter-spacing is `tracking-[var(--letter-spacing-wide)]`. The existing codebase consistently uses `tracking-[0.08em]`, `tracking-[0.14em]` etc. The proposal should use `tracking-[var(--letter-spacing-wide)]` instead.

---

## 4. Domino Check

### Problem 1 (Sticky Band) -- First Domino Correctly Identified

The brief identifies Shell.tsx line 141-143 as the first domino. The proposal removes this and moves the toggle into DefinitionTreeEditor. This is correct -- the sticky band existed because the toggle was structurally orphaned from its content.

### Problem 2 (Key/Label Hierarchy) -- First Domino Correctly Identified

The brief identifies ItemRowContent.tsx line 163 as the first domino -- the primary identity slot is given to the machine key. The proposal swaps the render order: label first (primary), key second (secondary). This directly addresses the root cause. No papering over.

### Problem 3 (Selection State) -- First Domino Correctly Identified

Pure CSS value change. No deeper issue. The current values (`/30`, `/[0.05]`) are simply too subtle. The proposed values (`/50`, `/[0.09]`) are calibrated correctly. Direct fix.

### Problem 4 (Empty Category Affordance) -- First Domino Correctly Identified

The brief identifies the `SummaryColumn` category rendering as the first domino -- no affordance markup exists for the empty state. The `CategoryCell` extraction adds a persistent text affordance and a hover ring. This is the correct fix location.

### Problem 5 (Master Card Shadow) -- First Domino Correctly Identified

DefinitionTreeEditor.tsx line 382 shadow value. Pure CSS fix. Direct.

### Problem 6 (Form Health Panel) -- Proposal Correctly Identifies a Non-Issue

The handoff brief described a "6 errors in text-error red" badge. The proposal (and adjudication) identified this as a red herring -- `FormHealthPanel.tsx` already uses amber. However, my trace found the real issue: **`OutputBlueprint.tsx` DOES use `text-error`**. Specifically:

- Line 179: `${hasError ? 'text-error' : ''}` (value text when constraint failed)
- Line 190: `${hasError ? 'text-error' : ''}` (editable value field when error)
- Line 197: `text-error/70` (required field indicator)
- Line 202: `v.severity === 'error' ? 'text-error'` (validation message coloring)
- Line 242: `'text-error'` (count pill)
- Line 321: `text-error` ("6 errors" badge text)

The adjudication explicitly asked for this grep to be done. The proposals assumed the issue was already resolved. **Line 321 is exactly the "6 errors" badge the brief described.** It exists in `OutputBlueprint.tsx`, not `FormHealthPanel.tsx`. The proposal should include changing `OutputBlueprint.tsx` line 321's `text-error` to `text-amber-600 dark:text-amber-400` for the error count badge, since these are data validation results from example values, not form structural errors. The inline `text-error` usage on individual validation messages (lines 179, 190, 202) is arguably correct -- constraint failures on specific values ARE errors in the validation domain.

### Problem 7 (Manage Gradient) -- Correct

One-line condition change. No deeper issue.

### Problem 8 (Typography Scale) -- Correct in Direction, Self-Corrects After P2

The brief correctly identified the lack of a type scale system as the first domino. The proposal introduces tokens. After the label/key swap, the active size count naturally collapses from 9 to approximately 5 (11px, 12px, 14px, 16px, 18px). The tokens codify this reduced set.

---

## 5. Spec Compliance

The handoff brief explicitly states: "The editor operates entirely at Tier 1 (definition items/binds) -- no component tree or theme cascade is active in the Build view." The proposed changes are all presentation-layer (CSS/markup) and do not introduce theme-tier or component-tier semantics. No spec compliance issues.

The category names (Visibility, Validation, Value, Format) map directly to bind categories per the spec. The proposal preserves these names and groupings. The `CategoryCell` renders them as-is without renaming.

The label/key separation is preserved per the brief's constraint: "Inline editing of key and label must preserve separate affordance paths." The proposal maintains separate click handlers, separate inline inputs, and separate EditMark indicators for key and label.

Display items maintain visual distinction from field items. The proposal preserves the existing display-item code path, which uses the `isField` conditional to render different identity layouts.

---

## Implementation Viability

**Can this be implemented cleanly?** Yes, with the corrections noted below. The changes are contained to one package, affect a well-defined set of files, and follow the existing patterns.

**Uncomfortable compromises:** None required. The proposal is evolutionary, not revolutionary.

---

## Architecture Concerns

### Concern A: Invalid CSS Custom Property Syntax in State Tokens (Blocking)

The `--state-*` token definitions use `var(--color-accent) / 0.5` which is not valid CSS. Either fix with `color-mix()` or delete the tokens (the component code uses Tailwind modifiers directly and does not reference these tokens).

**Recommendation:** Delete the `--state-*` tokens and the `.state-selected`/`.state-hover` utility classes. They are unused by the actual component code and introduce dead CSS.

### Concern B: Invalid Tailwind Utility Name (Blocking)

`letter-spacing-[var(--letter-spacing-wide)]` is not a valid Tailwind utility. Must be `tracking-[var(--letter-spacing-wide)]`.

### Concern C: `ring-empty` Naming Collision (Minor)

The `.ring-empty` utility uses `border` not `box-shadow`, conflicting with Tailwind's `ring-*` namespace. Rename to `.border-affordance` or use inline Tailwind classes.

### Concern D: Missing data-testid on CategoryCell (Test Breakage)

`CategoryCell` must propagate `data-testid` to avoid breaking existing test selectors.

### Concern E: GroupNode Selection State Omitted (Incomplete)

GroupNode.tsx line 237 selected state classes are not updated to match the new ItemRow values.

### Concern F: Tab Key Cycling Direction After Hierarchy Swap (Behavioral Bug)

The Tab key cycling between key and label inputs may be visually backwards after swapping the hierarchy. Verify and adjust the `handleIdentityKeyDown` logic.

### Concern G: OutputBlueprint.tsx `text-error` Badge (Unresolved)

The "6 errors" badge at `OutputBlueprint.tsx:321` uses `text-error`. This is the actual source of the red badge described in the brief. The proposal declares Problem 6 resolved by observation -- it is not.

---

## Suggested Modifications

1. **Delete `--state-*` tokens and `.state-selected`/`.state-hover` utilities.** The component code uses Tailwind opacity modifiers directly. The tokens are dead CSS with invalid syntax.

2. **Replace `letter-spacing-[...]` with `tracking-[...]`** throughout the proposal's component code.

3. **Rename `.ring-empty` to `.border-affordance`** or use inline `ring-1 ring-accent/15` and `hover:ring-1 hover:ring-accent/15`.

4. **Add `testId` prop to `CategoryCell`** and render `data-testid={testId}` on the outer `<div>`. In `SummaryColumn`, pass `testId={\`${testId}-category-${category}\`}`.

5. **Keep `DefinitionTreeEditorProps` optional** (with defaults). Do not make props required per the adjudication's Concern 3 -- this would break 7 test files for no user-facing benefit.

6. **Update GroupNode.tsx selected state** to `'border-accent/55 bg-accent/[0.09] shadow-[0_8px_20px_rgba(37,99,235,0.18)]'`.

7. **Change `CategoryCell` ring to hover-only** per the adjudication Concern 2: `showAffordance ? 'hover:ring-1 hover:ring-accent/15' : ''`.

8. **Fix OutputBlueprint.tsx line 321** error count badge from `text-error` to `text-amber-600 dark:text-amber-400`.

9. **Verify Tab key cycling direction** in `handleIdentityKeyDown` after the label/key swap. The forward Tab (no Shift) from label should now go to key (the element below), and Shift+Tab from key should go back to label (the element above).

---

## Estimated Blast Radius

### Files Directly Modified

| File | Lines Affected | Test Files That May Break |
|------|---------------|--------------------------|
| `index.css` | ~30 lines added after line 128 | `tests/styles/theme-token-usage.test.ts` (verifies token declarations) |
| `Shell.tsx` | Lines 140-147, 391 | No direct tests for the sticky band |
| `DefinitionTreeEditor.tsx` | Props signature, header section, line 382 | 7 test files if props made required; 0 if kept optional |
| `ItemRowContent.tsx` | Lines 72-316 (IdentityColumn), 318-450 (SummaryColumn) | `tests/workspaces/editor/definition-tree-editor.test.tsx` (identity assertions), `editor-selection.test.tsx` (className assertions) |
| `ItemRow.tsx` | Lines 544-549 | `editor-selection.test.tsx` line 48 (`toContain('border-accent')` -- still passes since `border-accent/50` contains `border-accent`) |
| `GroupNode.tsx` | Line 237 | No direct tests for selection classes |
| `CategoryCell.tsx` (new) | Full file | None (new) |
| `OutputBlueprint.tsx` | Line 321 | No direct tests for badge color |

### Risk Assessment

- **High confidence changes:** Selection state (P3), master card shadow (P5), gradient extension (P7), category label contrast. These are pure CSS value changes with no structural impact.
- **Medium confidence changes:** CategoryCell extraction (P4), toggle relocation (P1). These are structural but well-contained. The CategoryCell extraction must include the `data-testid` prop.
- **Requires care:** Identity hierarchy swap (P2). This is the most invasive change. The Tab cycling, ARIA role, and conditional rendering all need attention. Test the identity editing flow end-to-end after implementation.

### Unintended Side Effects Risk

- **Low.** All changes are within `packages/formspec-studio/`. No cross-package dependencies. No engine, core, or studio-core code is touched. The changes are purely presentational (CSS) and structural (React component hierarchy). The only consumers of these components are the studio app itself.

### E2E Test Impact

The E2E tests in `packages/formspec-studio/tests/e2e/playwright/` primarily interact via `data-testid` selectors, not CSS classes. The selection test at `editor-selection.test.tsx` uses `className.toContain('border-accent')`, which will still pass with `border-accent/50`. The main E2E risk is the toggle relocation -- any E2E test that expects the toggle in a specific DOM position relative to the canvas would need updating. A grep for toggle-related E2E selectors found no matches, so this is low risk.
