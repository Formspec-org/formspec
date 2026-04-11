# Pages Layout Builder — Phase 1: Core Prerequisites

**Date:** 2026-03-18
**Status:** Draft
**Scope:** formspec-core (type extensions), formspec-studio-core (one new method)
**Prerequisite:** Pages Behavioral API (Phases 0–3 complete)
**Blocks:** Phase 2, Phase 3

---

## 1. Context

The Pages tab layout builder (see parent spec) requires data and API
surface that does not yet exist. This phase adds the minimum extensions
to formspec-core and formspec-studio-core so that Phases 2 and 3 can
build the UI without new backend work.

Three changes are needed:

1. `PageItemView` type extensions (formspec-core)
2. `PageStructureView.breakpointValues` (formspec-core)
3. `moveItemOnPageToIndex` method (formspec-studio-core)

---

## 2. PageItemView Type Extensions

### 2.1 Problem

The layout builder grid canvas (Phase 3) needs to show:
- Type indicator per item (field, group, display)
- Child count for groups ("5 fields")
- Repeat indicator for repeatable groups

The current `PageItemView` type carries only: `key`, `label`, `status`,
`width`, `offset`, `responsive`. No type, child count, or repeatable
information.

### 2.2 Changes

Add three fields to `PageItemView`:

```ts
export interface PageItemView {
  key: string;
  label: string;
  status: 'valid' | 'broken';
  width: number;
  offset?: number;
  responsive: Record<string, {
    width?: number;
    offset?: number;
    hidden?: boolean;
  }>;
  // --- New fields ---
  itemType: 'field' | 'group' | 'display';
  childCount?: number;    // only set for groups
  repeatable?: boolean;   // only set for groups
}
```

### 2.3 Implementation

In `resolvePageView` (`queries/page-view-resolution.ts`), the function
already walks the definition tree to build a label map (`labelMap`).
Extend this walk to also build:
- `typeMap: Map<string, 'field' | 'group' | 'display'>` — maps item key
  to its definition `type`
- `childCountMap: Map<string, number>` — maps group keys to
  `children.length`
- `repeatableMap: Map<string, boolean>` — maps group keys to
  `!!item.repeatable`

Then in the region-to-PageItemView mapping, look up from these maps:

```ts
itemType: typeMap.get(r.key) ?? 'field',
...(childCountMap.has(r.key) && { childCount: childCountMap.get(r.key) }),
...(repeatableMap.get(r.key) && { repeatable: true }),
```

For broken items (key not in definition), `itemType` defaults to `'field'`.

### 2.4 TDD

**RED:**
- Test: `resolvePageView` returns `itemType: 'group'` for group regions
- Test: `resolvePageView` returns `itemType: 'field'` for field regions
- Test: `resolvePageView` returns `itemType: 'display'` for display regions
- Test: `resolvePageView` returns `childCount: 3` for a group with 3 children
- Test: `resolvePageView` returns `repeatable: true` for repeatable groups
- Test: `resolvePageView` returns `itemType: 'field'` for broken regions

**GREEN:** Implement the map extensions in `resolvePageView`.

**VERIFY:** Full `formspec-core` test suite passes.

**Files:**
- Edit: `packages/formspec-core/src/queries/page-view-resolution.ts`
- Edit: `packages/formspec-core/tests/page-view-resolution.test.ts`

---

## 3. PageStructureView.breakpointValues

### 3.1 Problem

The breakpoint switcher (Phase 3) shows tooltips with pixel values
(e.g., "sm (576px)"). `PageStructureView` currently has
`breakpointNames: string[]` but no pixel values.

### 3.2 Changes

Add one field to `PageStructureView`:

```ts
export interface PageStructureView {
  mode: 'single' | 'wizard' | 'tabs';
  pages: PageView[];
  unassigned: PlaceableItem[];
  breakpointNames: string[];
  breakpointValues?: Record<string, number>;  // New
  diagnostics: Array<{ severity: 'warning' | 'error'; message: string }>;
}
```

### 3.3 Implementation

In `resolvePageView`, read `theme.breakpoints` (if present) and pass
through as `breakpointValues`. When `theme.breakpoints` is absent,
`breakpointValues` is `undefined` (the default names `sm`, `md`, `lg`
have no associated pixel values until the user configures them).

```ts
breakpointValues: state.theme.breakpoints ?? undefined,
```

### 3.4 TDD

**RED:**
- Test: `resolvePageView` returns `breakpointValues` matching
  `theme.breakpoints` when present
- Test: `resolvePageView` returns `breakpointValues: undefined` when
  theme has no breakpoints

**GREEN:** One-line addition to `resolvePageView`.

**VERIFY:** Full `formspec-core` test suite passes.

**Files:**
- Edit: `packages/formspec-core/src/queries/page-view-resolution.ts`
- Edit: `packages/formspec-core/tests/page-view-resolution.test.ts`

---

## 4. moveItemOnPageToIndex

### 4.1 Problem

The layout builder needs drag-to-reorder (arbitrary position) and
drag-from-palette (place at specific index). The existing
`reorderItemOnPage(pageId, itemKey, direction)` only moves one position
at a time (up/down). Moving an item from position 8 to position 2
would require 6 calls, each generating a separate undo step.

The underlying handler `pages.reorderRegion` already supports
`targetIndex` — the gap is in the behavioral API surface.

### 4.2 Method Signature

```ts
moveItemOnPageToIndex(
  pageId: string,
  itemKey: string,
  targetIndex: number
): HelperResult
```

### 4.3 Implementation

Follows the same pattern as `reorderItemOnPage` (project.ts line 2485):

1. Validate `pageId` exists in `state.theme.pages`
2. Find the region with matching `itemKey` (via `_regionIndexOf`)
3. Dispatch `pages.reorderRegion` with `{ pageId, key: itemKey, targetIndex }`

This is a thin wrapper — approximately 10 lines.

### 4.4 TDD

**RED:**
- Test: `moveItemOnPageToIndex` moves item from position 0 to position 2
- Test: `moveItemOnPageToIndex` moves item from last position to position 0
- Test: `moveItemOnPageToIndex` with current position is a no-op
- Test: `moveItemOnPageToIndex` throws for unknown pageId
- Test: `moveItemOnPageToIndex` throws for unknown itemKey

**GREEN:** Implement in `project.ts`.

**EXPAND:**
- Test: `moveItemOnPageToIndex` with targetIndex beyond array length
  (clamps to end)
- Test: `moveItemOnPageToIndex` with negative targetIndex (throws)

**VERIFY:** Full `formspec-studio-core` test suite passes.

**Files:**
- Edit: `packages/formspec-studio-core/src/project.ts`
- Edit: `packages/formspec-studio-core/tests/project-methods.test.ts`
- Edit: `packages/formspec-studio-core/src/index.ts` (re-export if needed)

---

## 5. Success Criteria

1. `PageItemView` carries `itemType`, `childCount`, and `repeatable`
2. `PageStructureView` carries `breakpointValues` when theme defines them
3. `moveItemOnPageToIndex` places items at arbitrary positions in one call
4. All existing tests continue to pass (zero regressions)
5. No UI changes — this phase is backend-only
