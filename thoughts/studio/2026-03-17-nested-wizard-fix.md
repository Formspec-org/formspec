# Fix: Nested Wizard in Preview

**Date**: 2026-03-17
**Status**: Ready to implement
**Branch**: studiofixes

## Bug

The studio preview renders a wizard-inside-wizard when the default S8 intake demo loads. Each outer wizard panel contains a full inner wizard (own sidenav, own Next button, own step indicators).

## Root Cause

`packages/formspec-layout/src/planner.ts:290` — `applyGeneratedPageMode` fires on every node where `prefix === ''`, not just the root.

The root Stack has no `bind`, so its `childPrefix` resolves to `''` (line 278-280). Each group Stack child is planned with `prefix=''` and gets `applyGeneratedPageMode` applied individually. Each child's FIELD children get mismatched against the global `ctx.items` (5 top-level groups), producing a spurious inner Wizard with 5 pages containing one field each.

**Trigger conditions** (all must be true):
1. `formPresentation.pageMode === 'wizard'` (or `'tabs'`)
2. `isStudioGeneratedComponentDoc` returns true (`x-studio-generated` or no `$formspecComponent`)
3. Root component has no `bind` (so children inherit `prefix=''`)
4. Top-level groups have `presentation.layout.page` set

## Fix

### Primary fix — `planner.ts:290`

```typescript
// WAS:
if (!prefix) {
    return applyGeneratedPageMode(node, componentType, ctx);
}

// FIX:
if (applyThemePages) {
    return applyGeneratedPageMode(node, componentType, ctx);
}
```

`applyThemePages` is `true` only on the initial call (`prefix === ''` default) and explicitly `false` for all recursive children (line 285). This already exists and correctly distinguishes root from non-root.

### Secondary fix — title stripping in `applyGeneratedPageMode`

Once the nested wizard is fixed, the explicit page-name path (line 668) should strip the group title to avoid redundant headings (sidenav label + Page h2 + Group h3):

```typescript
// line 668 — was:
page.children.push(node);
// fix:
page.children.push(stripTitleFromGroupNode(node));

// line 725 (same pattern in buildDefinitionPages) — was:
page.children.push(node);
// fix:
page.children.push(stripTitleFromGroupNode(node));
```

## Test Plan

### RED: Write failing tests in `packages/formspec-layout/tests/planner.test.ts`

1. **Nested wizard reproduction** — Use the S8 intake structure: 5 groups with explicit page names, studio-generated component doc with Stack root and Stack children (no bind on root), `pageMode: 'wizard'`. Assert the tree has exactly ONE Wizard node and no nested Wizards.

2. **Title stripping on explicit page path** — Same structure. Assert that the Stack node inside each Page does NOT have a `title` prop.

### GREEN: Apply fixes

1. Change line 290: `!prefix` → `applyThemePages`
2. Change lines 668 and 725: add `stripTitleFromGroupNode`

### VERIFY: Run full planner test suite

```bash
npx playwright test tests/e2e/playwright/
cd packages/formspec-layout && npx vitest run
```

## Files Changed

| File | Change |
|------|--------|
| `packages/formspec-layout/src/planner.ts` | Lines 290, 668, 725 |
| `packages/formspec-layout/tests/planner.test.ts` | Add 2 tests |

## Key Context for Next Session

- `planComponentTree` signature: `(tree, ctx, prefix='', customComponentStack?, applyThemePages=prefix==='')`
- `applyThemePages` is already `false` for all recursive calls (line 285 passes explicit `false`)
- The `applyGeneratedPageMode` function at line 607 checks `isStudioGeneratedComponentDoc`, root component type, and scans `ctx.items` for groups
- `stripTitleFromGroupNode` at line 751 removes `title` from Stack props
- Existing tests at lines 320 and 537 cover implicit/explicit page paths but don't check for nested wizards or title stripping
- Default demo fixture: `packages/formspec-studio/src/fixtures/example-definition.ts`
