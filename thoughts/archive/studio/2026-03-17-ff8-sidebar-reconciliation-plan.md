# FF8 — Sidebar Source Reconciliation Plan

**Date:** 2026-03-17
**Status:** Planning
**Branch:** studiofixes
**Scope:** Planning only — no code changes

---

## 1. Problem Statement

### The drift scenario

The sidebar (`StructureTree.tsx`) and the editor canvas page tabs (`PageTabs.tsx`, `EditorCanvas.tsx`) both derive the pages list from `definition.items.filter(type === 'group')`. The Pages tab (`PagesTab.tsx`) derives it from `theme.pages` via `resolvePageStructure`. After the bootstrap sync (`createStudioProject` → `autoGeneratePages`), the two sources agree for the initial load.

**Drift case 1 — plain group added via `addGroup`:**
A user (or MCP tool) calls `project.addGroup('section_a', 'Section A')`. This adds a root-level group to `definition.items`. It does NOT call `pages.addPage` or `pages.assignItem`. Result: the sidebar now shows "Section A" as a page button; the Pages tab does not show it as a page card. The Pages tab instead shows "Section A" in its `unassignedItems` section.

**Drift case 2 — page added via `addPage`:**
`addPage` always calls three commands atomically: `definition.addItem` (group), `pages.addPage`, `pages.assignItem`. No drift here — both sources see the new group as a page.

**Drift case 3 — page deleted via `removePage`:**
`removePage` calls `pages.deletePage` and `definition.deleteItem` for each group-backed region. Both sources agree post-delete. No drift.

**Drift case 4 — `pageMode` is `single`:**
`StructureTree` has `isPaged = pageMode === 'wizard' || pageMode === 'tabs'`. In single mode, `pages = []` regardless of how many groups exist. So the sidebar shows nothing. This guard must be preserved for FF8 — the spec is explicit: sidebar remains empty in single mode.

### Why this matters for users

A user who adds a sub-section group via the sidebar item palette (which calls `addGroup` to add a root group) will see that group appear as a fake "page" in the sidebar navigation, but it will never be navigable in wizard/tabs mode because the engine doesn't know to page on it. The sidebar provides misleading navigation cues.

Conversely, if a user renames or reorders pages via the Pages tab, the sidebar may show stale or differently-ordered labels because it reads directly from the definition tree structure rather than the theme page order.

---

## 2. Proposed Change

### Decision: Switch `StructureTree` to read from `theme.pages` (via `resolvePageStructure`)

The sidebar should show exactly what the Pages tab manages. `theme.pages` is the canonical source per the design principle in the pages-tab-redesign spec. `resolvePageStructure` already computes `pages: ResolvedPage[]` from `theme.pages` — we should use that.

The sidebar does not need the full `ResolvedPageStructure`. It needs:
- `mode` — to keep the `isPaged` guard working
- `pages` — ordered list with `id`, `title`, and at minimum one region `key` to map to `activePageKey`
- `itemPageMap` — to derive which definition group backs each theme page (for `activePageKey` sync)

### The `activePageKey` bridging problem

The `activePageKey` context carries a **definition group key** (e.g., `"contact"`), not a theme page ID (e.g., `"page-1742234567-abc123"`). This is because:
- `EditorCanvas` uses `activePageKey` to filter `topLevelGroups.findIndex(g => g.key === activePageKey)` (line 97)
- `PageTabs` reads `items.filter(type === 'group')` and uses `page.key === activePageKey` (line 19, 49)
- `PagesTab` already bridges these: `groupKeyForPage(page, rootGroupKeys)` finds the region key that is a root group

So `activePageKey` is and must remain a definition group key, not a page ID. The sidebar needs to bridge in the same direction PagesTab does: theme page → region key → group key.

### What changes in `StructureTree`

**Replace lines 129–134** (the current pages derivation):

Current:
```ts
const presentation = definition.formPresentation ?? {};
const isPaged = presentation.pageMode === 'wizard' || presentation.pageMode === 'tabs';
const pages = isPaged ? items.filter((i) => i.type === 'group') : [];
```

New approach:
- Import `usePageStructure` (already exists in `usePageStructure.ts`, reuse it)
- Call `const { structure } = usePageStructure()` at the top of `StructureTree`
- Derive `isPaged = structure.mode === 'wizard' || structure.mode === 'tabs'`
- Derive `pages` from `structure.pages` but mapped to the shape the sidebar renders:
  - Each page needs: a display label (from `page.title`), and a `groupKey` to use as the navigation key
  - `groupKey` is derived by finding a region key that exists in `rootGroupKeys`
  - `itemPageMap` from the structure gives `groupKey → pageId` (reverse: need `pageId → groupKey`)

The sidebar renders pages as a list of buttons where clicking sets `activePageKey` to a group key. After the switch, each sidebar row still needs a group key to set. We need to derive it from the theme page.

**The derivation: theme page → group key**

The `PagesTab` already has this logic in `groupKeyForPage(page, rootGroupKeys)` — it finds the first region key that is a root-level group. This is the correct approach and should be extracted to a shared utility.

However, for the sidebar use case, we can derive this more directly via `structure.itemPageMap`. The `itemPageMap` maps `groupKey → pageId`. We can invert this to `pageId → groupKey` at render time.

### Shape for sidebar rendering

```ts
// After the change, inside StructureTree:
const { structure } = usePageStructure();
const isPaged = structure.mode === 'wizard' || structure.mode === 'tabs';

// Build pageId → first-region-group-key map
const rootGroupSet = useMemo(
  () => new Set(items.filter((i: ItemNode) => i.type === 'group').map((i: ItemNode) => i.key)),
  [items],
);
const sidebarPages = isPaged
  ? structure.pages.map((p) => ({
      id: p.id,
      label: p.title || p.id,
      groupKey: p.regions.find((r) => rootGroupSet.has(r.key))?.key ?? null,
    })).filter((p) => p.groupKey !== null)
  : [];
```

The `filter(p => p.groupKey !== null)` ensures pages with no backing group (broken/orphan theme pages) don't appear as clickable sidebar items — this is silent, consistent with the sidebar being navigation-only.

**Important:** `hasPages` and `activePage` derivation changes:

```ts
const hasPages = sidebarPages.length > 0;
const activePage = sidebarPages.find((p) => p.groupKey === activePageKey) ?? null;
```

The `visibleItems` for the items section still derives from `definition.items` by finding the group whose `key === activePage.groupKey`. This is unchanged in behavior — only the page list source changes.

### What does NOT change

- The `isPaged` guard: sidebar pages section is empty in single mode. Preserved.
- The `activePageKey` type: still a group key string, not a page ID.
- The `handleAddPage` callback: still calls `project.addPage(...)`, which creates the paired group+page atomically.
- The items section: still reads from `definition.items`, filters by active group key.
- `PageTabs.tsx`: not in scope for FF8. It still reads definition groups.
- `EditorCanvas.tsx`: not in scope for FF8. It still reads definition groups.
- The `handleSelectPage` callback: still calls `setActivePageKey(groupKey)`.

---

## 3. Risk Assessment

### Risk 1: Pages with no backing group (orphan theme pages)
A theme page can exist without a corresponding definition group if it was created manually or if the group was deleted without going through `removePage`. The current code would silently omit such pages (`filter(p => p.groupKey !== null)`). This is correct behavior for the sidebar — you can't navigate to a page that has no items to show. The Pages tab handles these with the amber broken-region indicator.

**Mitigation:** The `filter` is explicit and intentional. No user impact — they'd see the orphan page in the Pages tab (amber) but not in the sidebar.

### Risk 2: Active page selection breaks during drift
Currently if `activePageKey` is set to a definition group key that is NOT in `theme.pages` (because it was a plain group added via `addGroup`), the sidebar's `auto-select first page` `useEffect` would reset it. After the change, the auto-select logic keys off `sidebarPages` not `pages`. Since `sidebarPages` is derived from `theme.pages`, a plain-group `activePageKey` that isn't a theme page would correctly get cleared. This is the right behavior.

**Mitigation:** The `useEffect` auto-select logic (lines 137–146) already handles this: if `activePageKey` is not in the page list, it resets to `pages[0].key`. After the change, it should key off `sidebarPages[0].groupKey` instead of `pages[0].key`.

### Risk 3: `usePageStructure` import in `StructureTree`
`StructureTree` is in `packages/formspec-studio/src/components/blueprint/`. `usePageStructure` is in `packages/formspec-studio/src/workspaces/pages/`. This is an intra-package import — no layer violation. Both are in the same package (`formspec-studio`). The import path will be `../../workspaces/pages/usePageStructure`.

**Mitigation:** Verify no circular dependencies. `usePageStructure` imports `useProjectState` and `resolvePageStructure` from `formspec-studio-core`. `StructureTree` imports `useDefinition`, `useProject`, etc. No circular dependency risk.

### Risk 4: Performance regression from `usePageStructure` call
`usePageStructure` calls `resolvePageStructure` via `useMemo`. Adding this hook to `StructureTree` means `resolvePageStructure` is now called from two components: `PagesTab` (when mounted) and `StructureTree` (always visible). Since `useMemo` is per-instance, this is two separate computations.

**Mitigation:** This is acceptable given `resolvePageStructure` is a cheap pure function (array map + set lookup). If it becomes a performance concern, extract a shared context — but that's out of scope for FF8.

### Risk 5: Tests using definition-group seeds without theme pages
The existing `structure-tree.test.tsx` tests use seeds with `type: 'group'` items but no `theme.pages`. After the change, these tests would render 0 sidebar pages (since `theme.pages` is empty), making tests like "shows labels" see "Contact" only once (in Items section, not Pages).

**This is the primary test impact.** See Section 5 for the test plan.

### Risk 6: `wizard-mode.spec.ts` E2E test
The wizard mode E2E test likely clicks page buttons in the sidebar. If it seeds a definition with groups but no `theme.pages`, the bootstrap sync in `createStudioProject` will auto-generate pages. E2E tests go through the full app, so the bootstrap runs. No risk here — E2E tests should continue to work.

**Mitigation:** Verify the E2E test does not bypass `createStudioProject` (e.g., import a raw definition without bootstrapping). If it uses `importDefinition`, the bootstrap doesn't re-run — potential issue. Check the spec.

---

## 4. Implementation Steps

### Step 1: Extract `groupKeyForPage` to a shared utility

**File:** `packages/formspec-studio/src/workspaces/pages/usePageStructure.ts`

Add a new exported utility function:

```ts
/**
 * Given a resolved page and a set of known root group keys,
 * returns the first region key that is a root-level definition group.
 * Returns null if no region maps to a group key.
 */
export function findGroupKeyForPage(
  page: ResolvedPage,
  rootGroupKeys: Set<string>,
): string | null {
  for (const region of page.regions ?? []) {
    if (rootGroupKeys.has(region.key)) return region.key;
  }
  return null;
}
```

This is currently duplicated as `groupKeyForPage` in `PagesTab.tsx` (line 28). `PagesTab.tsx` should be updated to import and use `findGroupKeyForPage` from `usePageStructure.ts`.

### Step 2: Update `StructureTree` to read from `usePageStructure`

**File:** `packages/formspec-studio/src/components/blueprint/StructureTree.tsx`

**Add import:**
```ts
import { usePageStructure, findGroupKeyForPage } from '../../workspaces/pages/usePageStructure';
```

**Remove:**
- `import { useDefinition } from '../../state/useDefinition';` — still needed for `visibleItems` derivation

**Replace lines 120–134** (variable declarations inside `StructureTree`):

Remove:
```ts
const definition = useDefinition();
// ...
const items = (definition.items ?? []) as ItemNode[];
// ...
const presentation = definition.formPresentation ?? {};
const isPaged = presentation.pageMode === 'wizard' || presentation.pageMode === 'tabs';
const pages = isPaged ? items.filter((i) => i.type === 'group') : [];
const hasPages = pages.length > 0;
```

Replace with:
```ts
const definition = useDefinition();
const { structure } = usePageStructure();
const items = (definition.items ?? []) as ItemNode[];

const isPaged = structure.mode === 'wizard' || structure.mode === 'tabs';

// Derive which definition groups exist at root level (for group-key lookup)
const rootGroupSet = useMemo(
  () => new Set(items.filter((i) => i.type === 'group').map((i) => i.key)),
  [items],
);

// Sidebar pages: theme.pages mapped to { id, label, groupKey }
// Pages without a backing root group are omitted (orphan/broken pages)
const pages = useMemo(
  () =>
    isPaged
      ? structure.pages
          .map((p) => ({
            id: p.id,
            label: p.title || p.id,
            groupKey: findGroupKeyForPage(p, rootGroupSet),
          }))
          .filter((p): p is { id: string; label: string; groupKey: string } => p.groupKey !== null)
      : [],
  [isPaged, structure.pages, rootGroupSet],
);
const hasPages = pages.length > 0;
```

**Update `useEffect` auto-select** (lines 137–146): Change `pages.some((p) => p.key === activePageKey)` to `pages.some((p) => p.groupKey === activePageKey)` and `setActivePageKey(pages[0].key)` to `setActivePageKey(pages[0].groupKey)`.

Replace:
```ts
useEffect(() => {
  if (hasPages) {
    if (activePageKey && pages.some((p) => p.key === activePageKey)) return;
    setActivePageKey(pages[0].key);
  } else {
    setActivePageKey(null);
  }
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [hasPages, pages.map((p) => p.key).join(',')]);
```

With:
```ts
useEffect(() => {
  if (hasPages) {
    if (activePageKey && pages.some((p) => p.groupKey === activePageKey)) return;
    setActivePageKey(pages[0].groupKey);
  } else {
    setActivePageKey(null);
  }
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [hasPages, pages.map((p) => p.groupKey).join(',')]);
```

**Update `activePage` derivation** (line 148):
```ts
// Before:
const activePage = pages.find((p) => p.key === activePageKey) ?? null;

// After:
const activePage = pages.find((p) => p.groupKey === activePageKey) ?? null;
```

**Update `visibleItems` derivation** (lines 149–151): The active group for items must come from `definition.items` using the `groupKey`:
```ts
const visibleItems = hasPages
  ? (items.find((i) => i.key === activePage?.groupKey)?.children ?? []) as ItemNode[]
  : items;
```

**Update `handleSelectPage`** (line 154–163): Change `setActivePageKey(key)` — `key` was the group key before. Now each page object has `groupKey`. The callback should receive `groupKey`:
```ts
const handleSelectPage = useCallback(
  (groupKey: string) => {
    setActivePageKey(groupKey);
    select(groupKey, 'group');
    requestAnimationFrame(() => {
      scrollToTarget(groupKey);
    });
  },
  [scrollToTarget, select, setActivePageKey],
);
```

**Update `handleActivatePath`** (lines 165–171): Already uses `pageKey` from path — no change needed.

**Update `handleAddPage`** (line 174–182):
```ts
const insertedPageKey = result.affectedPaths[0] ?? 'new_page';
```
`affectedPaths[0]` from `addPage` is the definition group key (see `project.ts` line 1800: `affectedPaths: [finalKey]`). This is already the group key. No change needed.

**Update JSX page list** (lines 245–270): Change `p.key` references to `p.groupKey` and `p.label || p.key` to `p.label`:
- `onClick={() => handleSelectPage(p.groupKey)}`
- `isActive = activePageKey === p.groupKey`
- `{p.label}` (title from theme page)

**Update `itemsSectionLabel`** (lines 219–222):
```ts
const itemsSectionLabel = hasPages && activePage
  ? activePage.label
  : 'Items';
```

### Step 3: Update `PagesTab.tsx` to use extracted utility

**File:** `packages/formspec-studio/src/workspaces/pages/PagesTab.tsx`

- Remove the local `groupKeyForPage` function (lines 27–33)
- Add import: `import { findGroupKeyForPage } from './usePageStructure';`
- Replace all uses of `groupKeyForPage(p, keys)` with `findGroupKeyForPage(p, keys)`

This is a pure refactor with no behavior change.

### Step 4: Update unit tests for `StructureTree`

**File:** `packages/formspec-studio/tests/components/blueprint/structure-tree.test.tsx`

The existing tests use seeds with definition groups but no `theme.pages`. After the change, these seeds need theme pages to make the sidebar show pages. Update seeds that test paged behavior:

**Tests to update:**

1. **`'shows labels'` (line 67):** The test expects "Contact" to appear in the Pages section. After the change, the `treeDef` seed has a group `contact` but no `theme.pages`, so the sidebar shows no pages. Fix: either add a `theme: { pages: [...] }` seed or update the assertion to only check the Items section label. Since the test's intent is just to verify labels render, the simpler fix is to assert the label appears at least once (it'll appear in Items, not Pages).

2. **`'selects the inserted collision-safe page key after adding a page with a colliding generated key'` (line 121):** This test seeds with `formPresentation: { pageMode: 'wizard' }` and one group but no theme pages. After `addPage` is called, `theme.pages` gets updated. The sidebar will then read from the new `theme.pages`. The test checks that the new page button has `text-accent` styling. After the change, the page button is rendered from `theme.pages` data, not definition groups. The `result.affectedPaths[0]` is the group key `new_page`; the theme page title is `'New Page'`. The test asserts:
   - `screen.getByRole('button', { name: /new page/i })` — still valid (matches `p.label`)
   - The newly added page is active — still valid (`activePageKey === groupKey`)
   - The existing page is not active — still valid

   However: the seed has an existing group `page1` but no `theme.pages`. So the existing group `page1` will NOT appear in the sidebar before `addPage` is called. After `addPage`, only the new page (backed by theme page) will appear. The test currently checks that "Existing Page" button doesn't have `text-accent`. After the change, "Existing Page" may not appear in the sidebar at all. **Fix:** Update the seed to also have a theme page for the existing group, OR update the assertion.

3. **`'selects the canonical inserted path after adding a colliding item from the palette'` (line 170):** Seeds with `formPresentation: { pageMode: 'wizard' }` and a group `page1` with no theme pages. After the change, `sidebarPages` will be empty (no theme pages) even though `isPaged = true`. The add-item button title will be "Add item" (not "Add item to Page 1"). The test clicks `screen.getByTitle(/add item to/i)` which won't match. **Fix:** Seed must include `theme: { pages: [{ id: 'page-1', title: 'Page 1', regions: [{ key: 'page1', span: 12 }] }] }` OR change the button title assertion.

4. **`'labels the pages section as "Pages" not "Wizard Pages"'` (line 229):** Seeds with `formPresentation: { pageMode: 'wizard' }` and a group `page1` but no theme pages. After the change, `sidebarPages` is empty. The test clicks `screen.getByTitle('Add page')` and expects `screen.getByText('Pages')`. These don't depend on pages being listed — the "Pages" heading and "Add page" button always render. This test should still pass.

**New test to add:**

```
'renders pages from theme.pages, not definition groups'
- Seed: definition with a plain group ('section_a') but no theme page for it,
  plus a theme page ('page-123') with a region keyed to a different group ('form_page'),
  and that group also in definition.items
- In wizard mode, the sidebar should show 'form_page' (from theme.pages) but NOT 'section_a'
  (the plain group not in theme.pages)
```

### Step 5: Review E2E tests

**File:** `packages/formspec-studio/tests/e2e/playwright/wizard-mode.spec.ts`

Read this file to check if it imports a definition (bypassing bootstrap) or uses `importDefinition`. If it uses `importDefinition`, the bootstrap auto-generate won't run. May need to update fixtures to include `theme.pages`.

**File:** `packages/formspec-studio/tests/e2e/playwright/pages-workspace.spec.ts`

These tests test PagesTab behavior. Since PagesTab already reads from `theme.pages`, no changes needed. But verify the sidebar sync tests (FF10) don't break.

---

## 5. Test Plan

### 5a. Unit tests — `structure-tree.test.tsx`

| Test | Action |
|---|---|
| `'renders items as indented tree'` | No change needed — tree nodes in Items section unaffected |
| `'shows type icons'` | No change needed |
| `'shows labels'` | Update assertion: "Contact" appears in Items section; expect `getAllByText('Contact').length >= 1` (already uses `getAllByText`) |
| `'selecting a node updates selection'` | No change needed |
| `'scrolls the matching canvas block into view'` | No change needed |
| `'selects the inserted collision-safe page key after adding a page'` | Update seed: add theme pages for both groups OR adjust assertion for "Existing Page" |
| `'selects the canonical inserted path after adding a colliding item from the palette'` | Update seed to include theme page for `page1` group, OR change title assertion to `'Add item to Page 1'` after adding theme page |
| `'labels the pages section as "Pages" not "Wizard Pages"'` | No change needed — heading/button always render |
| `'uses the locally constructed path for selection when adding from the palette'` | No change needed — flat form, no pages |

**New test to add:**
```
'sidebar shows only theme.pages, not plain definition groups'
- Plain group in definition without theme page → does NOT appear in sidebar
- Group backed by theme page → DOES appear in sidebar
```

### 5b. Unit tests — `usePageStructure.test.ts`

Add test for `findGroupKeyForPage`:
```
'findGroupKeyForPage returns the first region key that is a root group'
'findGroupKeyForPage returns null when no region key is a root group'
```

### 5c. E2E tests — `wizard-mode.spec.ts`

Review and update fixture seeds as needed. If any test seeds a paged form via `importDefinition` (raw JSON), add `theme.pages` to the fixture so the sidebar shows pages.

### 5d. E2E tests — `pages-workspace.spec.ts`

Review sidebar-sync tests (if any). No changes expected since PagesTab is unchanged.

---

## 6. Deferred Items

### Explicitly out of scope for FF8

- **`PageTabs.tsx` and `EditorCanvas.tsx` reconciliation:** These also read from definition groups. Reconciling these to `theme.pages` is a separate effort (larger blast radius — touches the editor canvas rendering and component tree filtering). FF8 is sidebar-only.

- **`activePageKey` refactoring to use page IDs:** The `activePageKey` context currently carries definition group keys. A cleaner design would use theme page IDs. This would require updating `EditorCanvas`, `PageTabs`, `PagesTab`, and `StructureTree` simultaneously. Deferred to a separate pass after all consumers are reconciled.

- **`findGroupKeyForPage` edge cases:** What if a theme page has multiple regions pointing to root groups? The current logic uses the first match. A page with two root-group regions is an unusual configuration. Handling this is deferred — for now, first-match is the documented behavior.

- **FF10: Sidebar ↔ Pages Tab sync** (the spec's separate fast-follow): clicking a page in the sidebar highlights the corresponding card in the Pages tab. This is listed as FF10 in the pages-tab-redesign spec and is separate from FF8.

- **Bootstrap reconciliation for `importDefinition`:** When a user imports a definition JSON that has groups but no theme pages, `autoGeneratePages` is not called (bootstrap only runs at `createStudioProject` time). After FF8, the sidebar would show no pages. This is a related but separate concern — it falls under the import workflow, not the sidebar source change.
