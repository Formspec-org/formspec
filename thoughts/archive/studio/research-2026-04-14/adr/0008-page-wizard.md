# Cross-Tier Pages & Wizard Implementation

## Context

The studio has three separate page/wizard concepts across tiers (Definition pageMode → Theme pages → Component Wizard) but only exposes Tier 2 editing (PageDefinitions pillar) with zero cross-tier awareness. Users must manually keep tiers in sync — there's no UI for `formPresentation.pageMode`, no orphan detection for renamed keys, and no auto-sync between documents.

**Goal**: Make pages tier-transparent. Like the mapping workspace (where `mapping.autoGenerateRules` reads definition items and writes mapping rules atomically), users think "I want a wizard" — the studio handles tier plumbing internally.

**Scope**: Full cross-tier — resolution layer, cross-tier commands, unified Pages workspace, auto-sync, key rename propagation, conflict diagnostics. Defer `pages.upgradeToWizard` (synthesizing a component Wizard tree from theme pages) to follow-on work.

---

## Architecture

### Key Design Decisions

1. **`pages.*` commands always write to Tier 2 (theme).** No dynamic tier dispatch. Theme pages are the natural home for "I want pages." If a Tier 3 Wizard exists, the workspace shows a banner + deep-link to Component Tree. An explicit `pages.upgradeToWizard` (deferred) converts theme pages into a Wizard component.

2. **Pages workspace is a new top-level tab** between Data and Theme in the workspace tabs. PageDefinitions is removed from ThemeTab (grid layout details move into the Pages workspace's page cards).

3. **Auto-sync is explicit inside handlers** — `pages.addPage` also sets `pageMode: 'wizard'`; `pages.deletePage` of last page resets to `'single'`. No ambient middleware.

### Layer Stack

```
PagesTab (UI)                    ← workspace component
  └─ usePageStructure() hook     ← React hook
       └─ resolvePageStructure() ← pure resolution function (studio-core)
            ├─ reads component tree (Tier 3)
            ├─ reads theme.pages (Tier 2)
            └─ reads definition groups/pageMode (Tier 1)

pages.* command handlers         ← cross-tier writes (studio-core)
  ├─ writes theme.pages (primary)
  ├─ writes definition.formPresentation (auto-sync)
  └─ reads definition.items (for auto-generate)

definition.renameItem / .deleteItem ← extended with region key rewriting
```

---

## Implementation Steps (TDD)

### Step 1: Page Resolution Function

**Create**: `packages/formspec-studio-core/src/page-resolution.ts`
**Test**: `packages/formspec-studio-core/tests/page-resolution.test.ts`

Pure function `resolvePageStructure(state, definitionItemKeys)` that returns:

```typescript
interface ResolvedPageStructure {
  mode: 'single' | 'wizard' | 'tabs';
  pages: ResolvedPage[];
  controllingTier: 'component' | 'theme' | 'definition' | 'none';
  diagnostics: PageDiagnostic[];
  wizardConfig: { showProgress: boolean; allowSkip: boolean };
}
```

Resolution priority: Tier 3 Wizard → Tier 2 theme.pages → Tier 1 groups with layout.page → none.

Diagnostics generated:

- `SHADOWED_THEME_PAGES` — Wizard exists AND theme.pages populated
- `UNKNOWN_REGION_KEY` — theme region key not in definition items
- `PAGEMODE_MISMATCH` — theme.pages exist but definition says `pageMode: 'single'`

Export from `packages/formspec-studio-core/src/index.ts`.

**Tests (RED first)**:

1. No pages anywhere → `mode='single'`, `controllingTier='none'`, `pages=[]`
2. Definition `pageMode='wizard'` + groups with `layout.page` → infers pages from groups
3. `theme.pages` populated → `controllingTier='theme'`, pages from theme
4. Wizard in component tree + theme.pages → `controllingTier='component'`, `SHADOWED_THEME_PAGES` diagnostic
5. Region key not in definition items → `UNKNOWN_REGION_KEY` diagnostic
6. `pageMode='single'` + theme.pages → `PAGEMODE_MISMATCH` diagnostic

### Step 2: Cross-Tier Page Command Handlers

**Create**: `packages/formspec-studio-core/src/handlers/pages.ts`
**Test**: `packages/formspec-studio-core/tests/pages-handlers.test.ts`
**Edit**: `packages/formspec-studio-core/src/handlers.ts` (add `import './handlers/pages.js'`)

Commands:

| Command | Reads | Writes | Behavior |
|---------|-------|--------|----------|
| `pages.setMode` | — | `definition.formPresentation.pageMode`, `theme.pages` | Set mode; if `'single'` + theme.pages exist → clear them; if `'wizard'` + no pages → init empty array |
| `pages.addPage` | — | `theme.pages`, `definition.formPresentation` | Append page, auto-set `pageMode='wizard'` |
| `pages.deletePage` | — | `theme.pages`, `definition.formPresentation` | Delete by `id`; if last page → set `pageMode='single'` |
| `pages.reorderPages` | — | `theme.pages` | Swap adjacent by `id` + direction |
| `pages.setPageProperty` | — | `theme.pages` | Update title/description by page `id` |
| `pages.assignItem` | — | `theme.pages` | Add region `{ key, span }` to page; if already on another page, move it |
| `pages.unassignItem` | — | `theme.pages` | Remove region by key from page |
| `pages.setWizardConfig` | — | delegates to `component.setWizardProperty` | Set `showProgress`/`allowSkip` |
| `pages.autoGenerate` | `definition.items` | `theme.pages`, `definition.formPresentation` | Walk groups with `layout.page` hints, create theme pages, set `pageMode='wizard'` |

**Tests (RED first)**:

1. `pages.addPage` creates theme page + sets `pageMode='wizard'`
2. `pages.deletePage` by id (not index); deleting last page resets `pageMode='single'`
3. `pages.setMode('wizard')` initializes empty `theme.pages`
4. `pages.setMode('single')` clears `theme.pages`
5. `pages.assignItem` adds region to correct page
6. `pages.assignItem` moves item if already on different page
7. `pages.unassignItem` removes region
8. `pages.autoGenerate` creates pages from group `layout.page` hints
9. `pages.autoGenerate` with no groups creates single-page fallback
10. `pages.propagateKeyRename` updates all region keys

### Step 3: Extend Definition Rename/Delete for Region Keys

**Edit**: `packages/formspec-studio-core/src/handlers/definition-items.ts`
**Test**: Extend `packages/formspec-studio-core/tests/cross-artifact.test.ts`

In `definition.renameItem` handler (after line 561, theme items rewrite):

```typescript
// Rewrite theme region keys
if (state.theme.pages) {
  for (const page of state.theme.pages) {
    if (page.regions) {
      for (const region of page.regions) {
        if (region.key === oldKey) region.key = newKey;
      }
    }
  }
}
```

In `definition.deleteItem` handler (after line 497, theme items cleanup):

```typescript
// Remove orphaned theme regions
if (state.theme.pages) {
  for (const page of state.theme.pages) {
    if (page.regions) {
      page.regions = page.regions.filter(r => !deletedKeys.has(r.key));
    }
  }
}
```

**Tests (RED first)**:

1. `renameItem` rewrites theme region keys across all pages
2. `deleteItem` removes orphaned regions from all pages

### Step 4: Pages Workspace UI

**Create**: `packages/formspec-studio/src/workspaces/pages/PagesTab.tsx`
**Create**: `packages/formspec-studio/src/workspaces/pages/usePageStructure.ts`
**Test**: `packages/formspec-studio/tests/workspaces/pages/pages-tab.test.tsx`

Component structure:

```
PagesTab
├── TierStatusBanner
│   - controllingTier='none': "Single-page form. Enable wizard mode to add pages."
│   - controllingTier='definition': "Pages inferred from groups. Add theme pages for control."
│   - controllingTier='theme': (no banner — this is the active editing surface)
│   - controllingTier='component': "Wizard component active. Theme pages shadowed." + [Open Component Tree]
├── ModeSelector (single / wizard / tabs toggle)
├── PageList
│   └── PageCard (expandable)
│       ├── Editable title
│       ├── ItemAssignmentList (items on this page, with remove button)
│       ├── GridPreview (mini 12-col bar, reuse pattern from PageDefinitions)
│       ├── AddItemDropdown (unassigned items)
│       └── Delete / reorder controls
├── AddPageButton
├── WizardConfig (showProgress, allowSkip — visible when mode is wizard)
├── AutoGenerateButton ("Generate from definition groups")
└── DiagnosticsPanel (warnings from resolvePageStructure)
```

`usePageStructure()` hook:

```typescript
export function usePageStructure() {
  const state = useProjectState();
  const allItemKeys = useMemo(() => flattenItemKeys(state.definition.items), [state.definition.items]);
  return useMemo(() => resolvePageStructure(state, allItemKeys), [state, allItemKeys]);
}
```

**Tests (RED first)**:

1. Renders empty state banner when `mode='single'`
2. ModeSelector dispatches `pages.setMode`
3. Add page button dispatches `pages.addPage`
4. Page cards display page titles and assigned items
5. Assign item dispatches `pages.assignItem`
6. Auto-generate button dispatches `pages.autoGenerate`
7. Wizard config visible only in wizard mode
8. Diagnostics panel shows warnings
9. Tier status banner shows wizard warning when component Wizard exists

### Step 5: Shell + ThemeTab Wiring

**Edit**: `packages/formspec-studio/src/components/Shell.tsx`

- Add `Pages: PagesTab` to `WORKSPACES` record (after Data, before Theme)
- Update `formspec:navigate-workspace` handler if needed

**Edit**: `packages/formspec-studio/src/workspaces/theme/ThemeTab.tsx`

- Remove PageDefinitions pillar from "Pages & Layout" zone
- Rename zone to "Layout" (only contains ScreenSizes)

**Edit**: `packages/formspec-studio/tests/components/shell.test.tsx`

- Add Pages tab assertions

**Edit**: `packages/formspec-studio/tests/workspaces/theme/theme-tab.test.tsx`

- Remove PageDefinitions assertions, update zone filter tests

**Edit**: `packages/formspec-studio/tests/e2e/playwright/theme-workspace.spec.ts`

- Update or remove page-related E2E assertions (pages now in Pages tab)

---

## Critical Files

| File | Action | Purpose |
|------|--------|---------|
| `packages/formspec-studio-core/src/page-resolution.ts` | Create | Cross-tier resolution function |
| `packages/formspec-studio-core/tests/page-resolution.test.ts` | Create | Resolution tests |
| `packages/formspec-studio-core/src/handlers/pages.ts` | Create | Cross-tier page commands |
| `packages/formspec-studio-core/tests/pages-handlers.test.ts` | Create | Command handler tests |
| `packages/formspec-studio-core/src/handlers.ts` | Edit | Register new handler module |
| `packages/formspec-studio-core/src/index.ts` | Edit | Export `resolvePageStructure` |
| `packages/formspec-studio-core/src/handlers/definition-items.ts` | Edit | Add region key rewriting to rename/delete |
| `packages/formspec-studio-core/tests/cross-artifact.test.ts` | Edit | Add region rewrite tests |
| `packages/formspec-studio/src/workspaces/pages/PagesTab.tsx` | Create | Pages workspace UI |
| `packages/formspec-studio/src/workspaces/pages/usePageStructure.ts` | Create | React hook |
| `packages/formspec-studio/tests/workspaces/pages/pages-tab.test.tsx` | Create | UI tests |
| `packages/formspec-studio/src/components/Shell.tsx` | Edit | Wire Pages tab |
| `packages/formspec-studio/src/workspaces/theme/ThemeTab.tsx` | Edit | Remove PageDefinitions |

## Existing Code to Reuse

- `resolveThemeCascade()` in `theme-cascade.ts` — pattern for the resolution function
- `registerHandler()` in `handler-registry.ts` — handler registration
- `rewriteAllPathReferences()` in `definition-items.ts` — cross-artifact rewrite pattern
- `mapping.autoGenerateRules` in `handlers/mapping.ts` — read-one-tier-write-another pattern
- `PageDefinitions.tsx` grid preview — reuse the 12-col grid bar pattern in PageCards
- `AppearanceSection.tsx` — cross-tier provenance display pattern

## Deferred

- `pages.upgradeToWizard` — synthesize Wizard component tree from theme pages (requires component tree synthesis)
- Generated component tree respecting pages — `_rebuildComponentTree()` producing Wizard instead of flat Stack
- Blueprint sidebar "Pages" section — summary widget like MappingsList

## Verification

1. **Unit tests**: Run `npm run test:unit` — all page-resolution and handler tests pass
2. **Cross-artifact tests**: Rename/delete item correctly rewrites theme region keys
3. **UI tests**: PagesTab renders modes, pages, diagnostics correctly
4. **Manual smoke test**: In studio, toggle wizard mode → pages appear → assign items → preview shows paginated form
5. **E2E**: Update theme-workspace.spec.ts for moved PageDefinitions
