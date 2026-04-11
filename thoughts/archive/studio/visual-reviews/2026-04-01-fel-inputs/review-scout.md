# FEL Input Fixes -- Architecture Scout Review

**Date:** 2026-04-01
**Reviewer:** Architecture Scout
**Scope:** P1-P9 fixes from `audit.md` across `formspec-studio-core` and `formspec-studio`

---

## Verification Summary

| # | Fix | Verified | Notes |
|---|-----|----------|-------|
| P3 | Path highlighting tokenizer | PASS | Greedy merge of `$`/`@` + continuation tokens is correct. Edge cases tested: `$a`, `$a.b.c`, `$a[0].b`, `$members[*].mInc`, `@variable`, `$a + $b`. 19 tests pass. |
| P1 | useLayoutEffect for autoFocus | PASS | `useLayoutEffect` fires synchronously after DOM layout, before paint. Resize + focus in correct order. |
| P5 | useLayoutEffect for autoResize | PASS | Same effect as P1 -- `autoResize` runs before `focus()`, ensuring textarea height is set before first paint. |
| P2 | Error state visibility | PASS | `border-error bg-error/5` on syntax error, error message text below textarea, mutually exclusive with keyboard hint. |
| P4 | Display mode syntax highlighting | PASS | `HighlightedExpression` component exported from `InlineExpression.tsx`, renders `buildFELHighlightTokens` with `TOKEN_CLASS` map. |
| P6 | Autocomplete labels | PASS | `opt.label` shown below `$path` when label differs from path. Correct conditional. |
| P7 | Unified expression display | PASS | BindCard fallback uses `HighlightedExpression`. Styling matches InlineExpression chip. |
| P8 | Double reference button | PASS | `FELReferencePopup` fully removed from BindCard. Only present in InlineExpression editing mode. |
| P9 | Save gesture hint | PASS | `Cmd+Return save / Esc cancel` hint below textarea, hidden when syntax error is shown. |

## Type Checking

- `formspec-studio-core`: clean (0 errors)
- `formspec-studio`: clean (0 errors)

## Test Results

- **formspec-studio-core**: 729/729 passed (23 test files)
- **formspec-studio UI/logic tests**: 149/149 passed (20 test files)
- **Pre-existing failures** (4 tests, all unrelated to FEL): `add-item-palette`, `import-export`, `structure-tree`, `definition-tree-editor` -- these fail on `main` as well and involve editor layout changes on the `feat/editor-layout-split` branch

## Tokenizer Analysis (P3)

The `buildFELHighlightTokens` merge logic at `fel-editor-utils.ts:132-148` is architecturally sound:

1. `PATH_CONTINUATION_TOKENS` includes exactly the right set: `Identifier`, `Dot`, `LSquare`, `RSquare`, `Asterisk`, `NumberLiteral`
2. Adjacency check (`next.start !== pathEnd`) prevents merging across whitespace
3. Forward scan consumes all continuation tokens and advances the loop index by `consumed`
4. `expression.slice(startOffset, pathEnd)` produces a single text span for the entire path

**Known limitation** (not a regression, noted for future reference): `@instance('tab').field` highlights `@instance` as a path but `field` after the closing paren is NOT highlighted as a path, because `LRound` breaks the continuation chain. This is acceptable -- the `@instance(...)` construct is syntactically a function call, not a simple path.

## Issues Found and Fixed

### 1. Dead code in InlineExpression (cleaned up)

- **Removed** empty `useEffect` with comment-only body (lines 53-55 old)
- **Removed** unused `useRef` import
- **Removed** unused `useEffect` import
- **Removed** dead `save()` function that was never called (`saveWith` is used instead)

### 2. ShapeCard missing HighlightedExpression (extended P7)

**File:** `packages/formspec-studio/src/components/ui/ShapeCard.tsx`

The audit identified ShapeCard as "Surface F" with plain monospace expression display. It was not listed in the implementation changes, but it is the same class of problem as P7 (inconsistent expression rendering). Applied `HighlightedExpression` to the constraint display, matching the styling of BindCard and InlineExpression. Added `data-testid="shape-constraint"` for testability.

### 3. Test updates for ShapeCard highlighting

**Files:**
- `packages/formspec-studio/tests/components/ui/shape-card.test.tsx` -- updated to use `getByTestId` + `textContent` instead of `getByText` (expression text is now split across highlighted spans)
- `packages/formspec-studio/tests/workspaces/logic/shapes-section.test.tsx` -- same pattern, updated constraint assertion to use `getAllByTestId('shape-constraint')` with `textContent` matching

Both test files pass (4/4 and 10/10).

## Architecture Assessment

The implementation follows the correct layer boundaries:

- **Studio-core** (Layer 6) owns the tokenizer logic (`buildFELHighlightTokens`) and exports types (`FELHighlightToken`)
- **Studio** (Layer 7) owns the React components that consume the tokenizer: `HighlightedExpression`, `FELEditor`, `InlineExpression`, `BindCard`, `ShapeCard`
- No upward dependency violations
- `HighlightedExpression` is correctly placed in `InlineExpression.tsx` as a shared component for display-mode expression rendering, and imported by `BindCard.tsx` and `ShapeCard.tsx`

The `TOKEN_CLASS` map in `InlineExpression.tsx` and the inline className logic in `FELEditor.tsx` use the same color scheme (green for paths, accent for keywords, logic for functions, amber for literals, muted for operators) but are not DRY'd into a shared constant. This is acceptable -- the editor overlay needs different formatting (underline on functions, font-bold on keywords) that the display chips do not. The display `TOKEN_CLASS` map is simpler by design.

## Files Modified in This Review

- `/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/ui/InlineExpression.tsx` -- removed dead code (imports, empty useEffect, unused save function)
- `/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/ui/ShapeCard.tsx` -- applied HighlightedExpression, added data-testid
- `/Users/mikewolfd/Work/formspec/packages/formspec-studio/tests/components/ui/shape-card.test.tsx` -- updated assertion for highlighted expression
- `/Users/mikewolfd/Work/formspec/packages/formspec-studio/tests/workspaces/logic/shapes-section.test.tsx` -- updated assertion for highlighted expression
