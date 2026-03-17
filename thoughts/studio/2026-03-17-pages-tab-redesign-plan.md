# Pages Tab Redesign — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the Pages tab to be behavior-driven — mode as toggle, region/span editing consolidated, no leaked internals.

**Architecture:** PagesTab.tsx rewritten from scratch with accordion PageCards, inline title editing, and region editing ported from the orphaned PageDefinitions.tsx. Bootstrap auto-sync in StudioApp seeds theme.pages from definition groups. usePageStructure gets a new buildLabelMap utility and tighter memo deps.

**Tech Stack:** React, TypeScript, Tailwind CSS, formspec-studio-core helpers

**Spec:** `thoughts/studio/2026-03-17-pages-tab-redesign.md`

**Key patterns from existing code:**

- Tests use `project.theme.pages` (NOT `project.state.theme.pages`) — see `pages-tab.test.tsx:62`
- Test helper: `renderPagesTab(overrides?)` creates a project and wraps PagesTab in providers
- Region editing helpers: `project.addRegion`, `project.updateRegion`, `project.deleteRegion`, `project.reorderRegion`, `project.setRegionKey`
- Input reset pattern from PageDefinitions: `key={uniqueId}` + `defaultValue` forces React remount on external changes
- **Known bug (DO NOT FIX — deferred to Fast-Follow 9):** `setRegionKey` dispatches `unassignItem + assignItem`, re-appending region at end instead of preserving position

---

### Task 1: Bootstrap Fix — Seed theme.pages at project creation

**Files:**

- Modify: `packages/formspec-studio/src/studio-app/StudioApp.tsx:9-11`
- Create: `packages/formspec-studio/tests/studio-app/bootstrap.test.ts`

- [ ] **Step 1: Create test directory and write the failing test**

```bash
mkdir -p packages/formspec-studio/tests/studio-app
```

```ts
// packages/formspec-studio/tests/studio-app/bootstrap.test.ts
import { describe, it, expect } from 'vitest';
import { createStudioProject } from '../../src/studio-app/StudioApp';

describe('createStudioProject bootstrap', () => {
  it('seeds theme.pages from definition groups when theme.pages is empty', () => {
    const project = createStudioProject();
    const pages = (project.theme as any).pages ?? [];
    expect(pages.length).toBeGreaterThan(0);
  });

  it('sets pageMode to wizard when groups have page hints', () => {
    const project = createStudioProject();
    expect((project.definition as any).formPresentation?.pageMode).toBe('wizard');
  });

  it('does not overwrite theme.pages when seed provides them', () => {
    const project = createStudioProject({
      seed: {
        definition: { items: [{ key: 'g1', type: 'group', label: 'G1', children: [] }] },
        theme: { pages: [{ id: 'custom', title: 'Custom', regions: [] }] },
      },
    });
    const pages = (project.theme as any).pages ?? [];
    expect(pages.length).toBe(1);
    expect(pages[0].title).toBe('Custom');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/formspec-studio && npx vitest run tests/studio-app/bootstrap.test.ts`
Expected: FAIL — first two tests fail because theme.pages is empty and pageMode is not wizard.

- [ ] **Step 3: Implement the bootstrap**

```ts
// StudioApp.tsx — update createStudioProject
export function createStudioProject(seed?: Parameters<typeof createProject>[0]): Project {
  const project = createProject(seed ?? { seed: { definition: exampleDefinition as any } });
  const themePages = (project.theme as any).pages ?? [];
  const hasGroups = ((project.definition as any).items ?? []).some((i: any) => i.type === 'group');
  if (themePages.length === 0 && hasGroups) {
    project.autoGeneratePages();
  }
  return project;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/formspec-studio && npx vitest run tests/studio-app/bootstrap.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```
feat: bootstrap theme.pages from definition groups at project creation
```

---

### Task 2: usePageStructure — buildLabelMap and memo fix

**Files:**

- Rewrite: `packages/formspec-studio/src/workspaces/pages/usePageStructure.ts`
- Create: `packages/formspec-studio/tests/workspaces/pages/use-page-structure.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/formspec-studio/tests/workspaces/pages/use-page-structure.test.ts
import { describe, it, expect } from 'vitest';
import { buildLabelMap } from '../../../src/workspaces/pages/usePageStructure';

describe('buildLabelMap', () => {
  it('maps item keys to labels', () => {
    const items = [
      { key: 'name', label: 'Full Name', type: 'field' },
      { key: 'email', label: 'Email', type: 'field' },
    ];
    const map = buildLabelMap(items);
    expect(map.get('name')).toBe('Full Name');
    expect(map.get('email')).toBe('Email');
  });

  it('falls back to key when label is absent', () => {
    const items = [{ key: 'age', type: 'field' }];
    const map = buildLabelMap(items);
    expect(map.get('age')).toBe('age');
  });

  it('walks children recursively', () => {
    const items = [
      {
        key: 'group1', label: 'Group', type: 'group',
        children: [{ key: 'child1', label: 'Child', type: 'field' }],
      },
    ];
    const map = buildLabelMap(items);
    expect(map.get('group1')).toBe('Group');
    expect(map.get('child1')).toBe('Child');
  });

  it('returns empty map for empty items', () => {
    expect(buildLabelMap([]).size).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/formspec-studio && npx vitest run tests/workspaces/pages/use-page-structure.test.ts`
Expected: FAIL — `buildLabelMap` not exported.

- [ ] **Step 3: Implement buildLabelMap and fix usePageStructure**

```ts
// usePageStructure.ts — full rewrite
import { useMemo } from 'react';
import { resolvePageStructure, type ResolvedPageStructure } from 'formspec-studio-core';
import { useProjectState } from '../../state/useProjectState';

export function buildLabelMap(items: any[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of items) {
    map.set(item.key, item.label ?? item.key);
    if (item.children) {
      for (const [k, v] of buildLabelMap(item.children)) {
        map.set(k, v);
      }
    }
  }
  return map;
}

export function usePageStructure(allItemKeys?: string[]): ResolvedPageStructure {
  const state = useProjectState();

  const labelMap = useMemo(
    () => buildLabelMap(state.definition.items ?? []),
    [state.definition.items],
  );

  const keys = useMemo(
    () => allItemKeys ?? Array.from(labelMap.keys()),
    [allItemKeys, labelMap],
  );

  return useMemo(
    () => resolvePageStructure(state, keys),
    [state.theme, state.definition, keys],
  );
}

export { type ResolvedPageStructure };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/formspec-studio && npx vitest run tests/workspaces/pages/use-page-structure.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```
feat: replace flattenItemKeys with buildLabelMap, fix useMemo deps
```

---

### Task 3: PagesTab Rewrite — Core structure and mode selector

**Files:**

- Rewrite: `packages/formspec-studio/src/workspaces/pages/PagesTab.tsx`
- Rewrite: `packages/formspec-studio/tests/workspaces/pages/pages-tab.test.tsx`

This task builds the shell: mode selector, single-mode states, page list with accordion. No region editing yet — that's Task 4.

- [ ] **Step 1: Rewrite tests for the new behavior**

Replace the contents of `pages-tab.test.tsx`. Keep the `renderPagesTab` helper pattern but update assertions for the new design. The existing tests for `tier-status-banner`, `PAGEMODE_MISMATCH` diagnostic, `auto-generate`, and `wizard component warning` are all removed — those features no longer exist.

```ts
// packages/formspec-studio/tests/workspaces/pages/pages-tab.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PagesTab } from '../../../src/workspaces/pages/PagesTab';
import { createProject, type Project } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';

const BASE_DEF = {
  items: [
    { key: 'name', type: 'field', dataType: 'string', label: 'Name' },
    { key: 'email', type: 'field', dataType: 'string', label: 'Email' },
  ],
};

function renderPagesTab(overrides?: {
  definition?: Record<string, unknown>;
  theme?: Record<string, unknown>;
}) {
  const project = createProject({
    seed: {
      definition: { ...BASE_DEF, ...overrides?.definition } as any,
      theme: overrides?.theme as any,
    },
  });
  const result = render(
    <ProjectProvider project={project}>
      <PagesTab />
    </ProjectProvider>,
  );
  return { ...result, project };
}

describe('PagesTab', () => {
  it('shows mode selector with Single, Wizard, Tabs', () => {
    renderPagesTab({
      definition: { formPresentation: { pageMode: 'wizard' } },
      theme: { pages: [{ id: 'p1', title: 'Step 1', regions: [] }] },
    });
    expect(screen.getByText('Single')).toBeInTheDocument();
    expect(screen.getByText('Wizard')).toBeInTheDocument();
    expect(screen.getByText('Tabs')).toBeInTheDocument();
  });

  it('does not render a PAGES heading', () => {
    renderPagesTab({
      definition: { formPresentation: { pageMode: 'wizard' } },
      theme: { pages: [{ id: 'p1', title: 'Step 1', regions: [] }] },
    });
    expect(screen.queryByRole('heading', { name: /pages/i })).not.toBeInTheDocument();
  });

  it('single mode with no pages shows empty state', () => {
    renderPagesTab();
    expect(screen.getByText(/switch to wizard or tabs/i)).toBeInTheDocument();
  });

  it('single mode with existing pages shows dormant info bar', () => {
    renderPagesTab({
      definition: { formPresentation: { pageMode: 'single' } },
      theme: { pages: [{ id: 'p1', title: 'Dormant Page', regions: [] }] },
    });
    expect(screen.getByText(/preserved but not active/i)).toBeInTheDocument();
    expect(screen.getByText('Dormant Page')).toBeInTheDocument();
  });

  it('wizard mode renders page cards with titles', () => {
    renderPagesTab({
      definition: { formPresentation: { pageMode: 'wizard' } },
      theme: {
        pages: [
          { id: 'p1', title: 'Step 1', regions: [{ key: 'name', span: 12 }] },
          { id: 'p2', title: 'Step 2', regions: [{ key: 'email', span: 6 }] },
        ],
      },
    });
    expect(screen.getByText('Step 1')).toBeInTheDocument();
    expect(screen.getByText('Step 2')).toBeInTheDocument();
  });

  it('mode selector dispatches setFlow', async () => {
    const { project } = renderPagesTab();
    await act(async () => {
      screen.getByText('Wizard').click();
    });
    expect((project.definition as any).formPresentation?.pageMode).toBe('wizard');
  });

  it('add page button creates a new page with default title', async () => {
    const { project } = renderPagesTab({
      definition: { formPresentation: { pageMode: 'wizard' } },
      theme: { pages: [{ id: 'p0', title: 'Existing', regions: [] }] },
    });
    await act(async () => {
      screen.getByRole('button', { name: /add page/i }).click();
    });
    expect((project.theme.pages as any[]).length).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/formspec-studio && npx vitest run tests/workspaces/pages/pages-tab.test.tsx`
Expected: FAIL — old PagesTab has different structure (heading exists, single-mode message different, etc.).

- [ ] **Step 3: Implement PagesTab shell**

Rewrite `PagesTab.tsx` from scratch. Follow the spec's data flow:

```tsx
// PagesTab.tsx — key structure (implement fully with styling)
import { useState, useMemo } from 'react';
import { WorkspacePage, WorkspacePageSection } from '../../components/ui/WorkspacePage';
import { usePageStructure, buildLabelMap } from './usePageStructure';
import { useProject } from '../../state/useProject';
import { useProjectState } from '../../state/useProjectState';
import type { ResolvedPage } from 'formspec-studio-core';

export function PagesTab() {
  const state = useProjectState();
  const project = useProject();
  const [expandedPageId, setExpandedPageId] = useState<string | null>(null);

  // Build label map and derive key list for page structure resolution
  const labelMap = useMemo(
    () => buildLabelMap(state.definition.items ?? []),
    [state.definition.items],
  );
  const allItemKeys = useMemo(() => Array.from(labelMap.keys()), [labelMap]);
  const structure = usePageStructure(allItemKeys);

  const isSingle = structure.mode === 'single';
  const hasPages = structure.pages.length > 0;

  return (
    <WorkspacePage className="overflow-y-auto">
      {/* Sticky header: mode selector only, no heading */}
      <WorkspacePageSection
        padding="px-7"
        className="sticky top-0 bg-bg-default/80 backdrop-blur-md z-20 pt-6 pb-4 border-b border-border/40"
      >
        <ModeSelector mode={structure.mode} onSetMode={(m) => project.setFlow(m)} />
      </WorkspacePageSection>

      <WorkspacePageSection className="flex-1 py-6 space-y-6">
        {/* Single mode states */}
        {isSingle && !hasPages && (
          <p className="text-[12px] text-muted">
            Switch to Wizard or Tabs to organize your form into pages.
          </p>
        )}
        {isSingle && hasPages && (
          <p className="text-[12px] text-muted">
            Pages are preserved but not active in single mode.
          </p>
        )}

        {/* Page list */}
        {hasPages && (
          <div className={isSingle ? 'opacity-50 pointer-events-none' : ''}>
            <div className="space-y-3">
              {structure.pages.map((page, i) => (
                <PageCard
                  key={page.id}
                  page={page}
                  index={i}
                  total={structure.pages.length}
                  labelMap={labelMap}
                  isExpanded={expandedPageId === page.id}
                  onToggle={() => setExpandedPageId(
                    expandedPageId === page.id ? null : page.id
                  )}
                  onDelete={() => project.removePage(page.id)}
                  onMoveUp={() => project.reorderPage(page.id, 'up')}
                  onMoveDown={() => project.reorderPage(page.id, 'down')}
                  onUpdateTitle={(title) => project.updatePage(page.id, { title })}
                />
              ))}
            </div>
          </div>
        )}

        {/* Add page — only in wizard/tabs mode */}
        {!isSingle && (
          <button
            type="button"
            aria-label="Add page"
            onClick={() => project.addPage('New Page')}
            className="text-[11px] text-accent hover:text-accent-hover font-bold uppercase tracking-wider"
          >
            + Add Page
          </button>
        )}
      </WorkspacePageSection>
    </WorkspacePage>
  );
}
```

**ModeSelector** — reuse existing sub-component, remove redundant `role="button"` and `aria-label`.

**PageCard** collapsed state:

- Number badge (`index + 1`)
- Title with hover pencil icon → click enters edit mode (input, blur/Enter commits, Escape cancels)
- Double-click on title text also enters edit mode
- Item count: `page.regions.length` → "N items" or "Empty" when 0
- 12-column grid preview at 16px (`h-4`), amber fill for `exists: false` regions
- Expand/collapse via `<button aria-expanded={isExpanded}>`
- Chevron icon rotates on expand

**PageCard** receives `isExpanded` + `onToggle` as props (lifted state in PagesTab for accordion).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/formspec-studio && npx vitest run tests/workspaces/pages/pages-tab.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```
feat: rewrite PagesTab — mode toggle, accordion, inline title editing
```

---

### Task 4: PageCard Region Editing

**Files:**

- Modify: `packages/formspec-studio/src/workspaces/pages/PagesTab.tsx` (PageCard expanded section)
- Modify: `packages/formspec-studio/tests/workspaces/pages/pages-tab.test.tsx`

Port region editing from the patterns in the orphaned `PageDefinitions.tsx`. Reference `PageDefinitions.tsx:174-228` for the region row UI pattern.

- [ ] **Step 1: Write failing tests for region editing**

Add to `pages-tab.test.tsx`:

```ts
describe('PageCard region editing', () => {
  function renderWithExpandedCard() {
    const result = renderPagesTab({
      definition: { formPresentation: { pageMode: 'wizard' } },
      theme: {
        pages: [{
          id: 'p1', title: 'Step 1',
          regions: [{ key: 'name', span: 12 }, { key: 'email', span: 6 }],
        }],
      },
    });
    // Click the expand button on the first card
    const expandBtn = screen.getAllByRole('button', { expanded: false })[0];
    fireEvent.click(expandBtn);
    return result;
  }

  it('expanded card shows region list with resolved labels', () => {
    renderWithExpandedCard();
    expect(screen.getByText('Name')).toBeInTheDocument(); // resolved from 'name' key
    expect(screen.getByText('Email')).toBeInTheDocument(); // resolved from 'email' key
  });

  it('add region button adds a span-12 region', async () => {
    const { project } = renderWithExpandedCard();
    await act(async () => {
      screen.getByRole('button', { name: /add region/i }).click();
    });
    expect(((project.theme as any).pages[0].regions as any[]).length).toBe(3);
  });

  it('delete region button removes the region', async () => {
    const { project } = renderWithExpandedCard();
    const deleteButtons = screen.getAllByRole('button', { name: /del/i });
    await act(async () => {
      deleteButtons[0].click();
    });
    expect(((project.theme as any).pages[0].regions as any[]).length).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/formspec-studio && npx vitest run tests/workspaces/pages/pages-tab.test.tsx`
Expected: FAIL — region editing UI not yet in PageCard.

- [ ] **Step 3: Implement region editing in expanded PageCard**

Add to PageCard's expanded section (shown when `isExpanded` is true):

- 32px grid preview (`h-8`) with amber fill for `exists: false` regions
- Region list below the grid. Each row:
  - Resolved label: `labelMap.get(region.key) ?? region.key`
  - Span: `<input type="number" min={1} max={12} />` with blur-to-save pattern (compare trimmed value to current, only dispatch if changed)
  - Reorder: Up/Down buttons disabled at array boundaries
  - Delete: button per row
- `+ Add Region` button at bottom of list
- Use `key={rk-${ri}-${region.key}}` reset pattern from PageDefinitions for inputs

Handlers:

- `project.addRegion(page.id, 12)` — default span 12
- `project.updateRegion(page.id, regionIndex, 'span', parsedValue)`
- `project.deleteRegion(page.id, regionIndex)`
- `project.reorderRegion(page.id, regionIndex, direction)`

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/formspec-studio && npx vitest run tests/workspaces/pages/pages-tab.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```
feat: add region editing to PageCard — span controls, add/remove/reorder
```

---

### Task 5: Sidebar Rename

**Files:**

- Modify: `packages/formspec-studio/src/components/blueprint/StructureTree.tsx:234-237`

- [ ] **Step 1: Write a failing test for the new label**

Check `packages/formspec-studio/tests/components/blueprint/structure-tree.test.tsx` for any "Wizard Pages" assertions. There are none currently, so add a simple assertion:

```ts
// Add to structure-tree.test.tsx
it('sidebar shows "Pages" heading (not "Wizard Pages")', () => {
  renderTree({ definition: { formPresentation: { pageMode: 'wizard' } } });
  expect(screen.getByText('Pages')).toBeInTheDocument();
  expect(screen.queryByText('Wizard Pages')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/formspec-studio && npx vitest run tests/components/blueprint/structure-tree.test.tsx`
Expected: FAIL — text is still "Wizard Pages".

- [ ] **Step 3: Change "Wizard Pages" to "Pages"**

In `StructureTree.tsx`:

- Line 235: Change `Wizard Pages` → `Pages`
- Line 237: Change `title="Add wizard page"` → `title="Add page"`

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/formspec-studio && npx vitest run tests/components/blueprint/structure-tree.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```
fix: rename sidebar "Wizard Pages" → "Pages"
```

---

### Task 6: Cleanup — Delete PageDefinitions.tsx and its tests

**Files:**

- Delete: `packages/formspec-studio/src/workspaces/theme/PageDefinitions.tsx`
- Delete: `packages/formspec-studio/tests/workspaces/theme/page-definitions.test.tsx`

- [ ] **Step 1: Verify PageDefinitions is not imported anywhere**

Run: `grep -r "PageDefinitions" packages/formspec-studio/src/`
Expected: No results (already confirmed orphaned).

- [ ] **Step 2: Delete the source file and its test file**

```bash
rm packages/formspec-studio/src/workspaces/theme/PageDefinitions.tsx
rm packages/formspec-studio/tests/workspaces/theme/page-definitions.test.tsx
```

- [ ] **Step 3: Build check**

Run: `cd packages/formspec-studio && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```
chore: delete orphaned PageDefinitions.tsx and its tests
```

---

### Task 7: Update E2E Tests

**Files:**

- Rewrite: `packages/formspec-studio/tests/e2e/playwright/pages-workspace.spec.ts`

- [ ] **Step 1: Rewrite E2E tests for new behavior**

Remove tests that assert removed features:

- `tier-status-banner` tests (banner removed)
- `PAGEMODE_MISMATCH` diagnostic display (diagnostics panel removed)
- `wizard component shadowed` banner (hasWizardComponent branching removed)
- `auto-generate creates pages` (Generate from Groups removed)

Update existing tests:

- Mode selector test: remove "generate" button assertion
- Add page test: verify new page gets default title "New Page"

Add new tests using Playwright selectors:

```ts
test('single mode with no pages shows empty state', async ({ page }) => {
  // Navigate to Pages tab with single-page seed
  await expect(page.getByText(/switch to wizard or tabs/i)).toBeVisible();
});

test('single mode with existing pages shows dormant info bar', async ({ page }) => {
  // Use PAGEMODE_MISMATCH_SEED (single mode + theme pages)
  await expect(page.getByText(/preserved but not active/i)).toBeVisible();
  // Pages still visible but dimmed
});

test('wizard mode shows page cards with item counts', async ({ page }) => {
  // Use WIZARD_THEME_SEED
  await expect(page.getByText('Step 1')).toBeVisible();
  await expect(page.getByText('Step 2')).toBeVisible();
  await expect(page.getByText(/\d+ items?/)).toBeVisible();
});

test('accordion: only one card expanded at a time', async ({ page }) => {
  // Expand card 1 via its expand button
  // Expand card 2 → card 1 should collapse
  // Verify via aria-expanded attributes
});

test('add page creates card with default title', async ({ page }) => {
  await page.getByRole('button', { name: /add page/i }).click();
  await expect(page.getByText('New Page')).toBeVisible({ timeout: 2000 });
});
```

- [ ] **Step 2: Run the full E2E suite**

Run: `npx playwright test tests/e2e/playwright/pages-workspace.spec.ts`
Expected: All pass.

- [ ] **Step 3: Commit**

```
test: update Pages tab E2E tests for redesigned behavior
```

---

## Verification

After all tasks complete:

1. **Unit tests**: `cd packages/formspec-studio && npx vitest run`
2. **E2E tests**: `npx playwright test tests/e2e/playwright/pages-workspace.spec.ts`
3. **Type check**: `cd packages/formspec-studio && npx tsc --noEmit`
4. **Visual check**: Start dev server (`cd packages/formspec-studio && npx vite --port 5199`), open Pages tab:
   - Wizard mode: 5 pages visible with titles, accordion expand, region grid, region editing
   - Switch to Single: pages dimmed with "preserved but not active" info bar
   - Switch to Tabs: pages active again
   - Add page: new card with "New Page" title
   - Edit title: hover pencil, click, type, blur to save
   - Region span: expand card, change a number, blur to save
   - Sidebar: shows "PAGES" heading (not "WIZARD PAGES")
