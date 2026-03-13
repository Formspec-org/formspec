import { test, expect } from '@playwright/test';
import { waitForApp, importDefinition, switchTab } from './helpers';

const WIZARD_DEF = {
  $formspec: '1.0',
  url: 'urn:wizard-preview',
  version: '1.0.0',
  presentation: { pageMode: 'wizard' },
  items: [
    {
      key: 'page1',
      type: 'group',
      label: 'Applicant',
      children: [{ key: 'name', type: 'field', dataType: 'string', label: 'Full Name' }],
    },
    {
      key: 'page2',
      type: 'group',
      label: 'Household',
      children: [{ key: 'size', type: 'field', dataType: 'integer', label: 'Household Size' }],
    },
    {
      key: 'page3',
      type: 'group',
      label: 'Review',
      children: [{ key: 'notes', type: 'display', label: 'Review your answers' }],
    },
  ],
};

test.describe('Wizard mode preview', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, WIZARD_DEF);
    await switchTab(page, 'Preview');
  });

  test('shows only one wizard page at a time with Next navigation', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Preview"]');

    await expect(workspace.getByLabel('Full Name')).toBeVisible({ timeout: 3000 });
    await expect(workspace.getByLabel('Household Size')).not.toBeVisible();
    await expect(workspace.getByRole('button', { name: /continue|next/i })).toBeVisible();
  });

  test('shows a Submit action on the final wizard page', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Preview"]');

    await workspace.getByRole('button', { name: /continue|next/i }).click();
    await workspace.getByRole('button', { name: /continue|next/i }).click();

    await expect(workspace.getByRole('button', { name: /submit/i })).toBeVisible();
  });
});

// ── Cluster J: Page / Wizard Mode bugs ──────────────────────────────────────

const PAGED_DEF = {
  $formspec: '1.0',
  formPresentation: { pageMode: 'wizard' },
  items: [
    {
      key: 'page1',
      type: 'group',
      label: 'Applicant Info',
      children: [{ key: 'name', type: 'field', dataType: 'string', label: 'Full Name' }],
    },
    {
      key: 'page2',
      type: 'group',
      label: 'Household Details',
      children: [{ key: 'size', type: 'field', dataType: 'integer', label: 'Household Size' }],
    },
    {
      key: 'page3',
      type: 'group',
      label: 'Review',
      children: [],
    },
  ],
};

// BUG #10 — Inactive tabs hide labels
// PageTabs renders a label span only when `isActive`. Inactive tabs show
// nothing but a numbered circle; clicking them is difficult and the labels
// are completely hidden from the user.
test.describe('Bug #10 — inactive page tabs show label text', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, PAGED_DEF);
    await page.waitForSelector('[role="tablist"]', { timeout: 5000 });
  });

  test('every page tab shows its label text, not just the active one [BUG-010]', async ({ page }) => {
    const canvas = page.locator('[data-testid="workspace-Editor"]');
    const tablist = canvas.locator('[role="tablist"]');

    // There should be 3 tabs
    const tabs = tablist.locator('[role="tab"]');
    await expect(tabs).toHaveCount(3);

    // All three labels should be visible inside their tab buttons.
    // BUG: only the active tab (tab 0) renders a label span — tabs 1 and 2 are
    // just numbered circles with no text.
    await expect(tablist).toContainText('Applicant Info');
    await expect(tablist).toContainText('Household Details');
    await expect(tablist).toContainText('Review');
  });

  test('inactive tab label is visible before clicking it [BUG-010]', async ({ page }) => {
    const canvas = page.locator('[data-testid="workspace-Editor"]');
    const tablist = canvas.locator('[role="tablist"]');
    const tabs = tablist.locator('[role="tab"]');

    // The second tab (index 1) starts as inactive.
    const secondTab = tabs.nth(1);
    await expect(secondTab).not.toHaveAttribute('aria-selected', 'true');

    // BUG: the label span is wrapped in `{isActive && <span>…</span>}`, so it
    // is absent from the DOM for inactive tabs.
    await expect(secondTab).toContainText('Household Details');
  });
});

// BUG #11 — Page mode hides root-level non-group items
// EditorCanvas computes `displayItems = hasPaged ? [topLevelGroups[activePageIndex]] : items`.
// Any root-level non-group items (type field or display) in a paged definition are
// silently omitted from `topLevelGroups` and therefore never appear in the canvas.
test.describe('Bug #11 — root-level non-group items visible in paged editor', () => {
  test('root-level field outside groups is visible in paged editor canvas [BUG-011]', async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, {
      $formspec: '1.0',
      formPresentation: { pageMode: 'wizard' },
      items: [
        // A root-level field that is NOT inside any group
        { key: 'introText', type: 'display', label: 'Introduction' },
        {
          key: 'pageOne',
          type: 'group',
          label: 'Page One',
          children: [{ key: 'myField', type: 'field', dataType: 'string', label: 'My Field' }],
        },
      ],
    });

    // The display item at the root should be rendered in the editor canvas.
    // BUG: topLevelGroups = items.filter(i => i.type === 'group') excludes it,
    // so displayItems never includes the root-level display block.
    const canvas = page.locator('[data-testid="workspace-Editor"]');
    await expect(canvas.locator('[data-testid="display-introText"]')).toBeVisible({ timeout: 5000 });
  });
});

// BUG #44 — Page tabs cannot be renamed via double-click
// PageTabs renders simple <button> elements with no double-click handler.
// Double-clicking a tab should put the label into an inline edit mode, but
// the current implementation has no such affordance.
test.describe('Bug #44 — double-click page tab opens inline label editor', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, PAGED_DEF);
    await page.waitForSelector('[role="tablist"]', { timeout: 5000 });
  });

  test('double-clicking active tab label opens an inline text input [BUG-044]', async ({ page }) => {
    const canvas = page.locator('[data-testid="workspace-Editor"]');
    const tablist = canvas.locator('[role="tablist"]');
    const firstTab = tablist.locator('[role="tab"]').first();

    // Double-click the active tab to enter rename mode.
    // BUG: PageTabs has no onDoubleClick handler — the tab stays as a plain button.
    await firstTab.dblclick();

    // After double-click, an <input> element should appear inside or near the tab.
    await expect(tablist.locator('input')).toBeVisible({ timeout: 2000 });
  });

  test('editing the label in the inline input renames the page group [BUG-044]', async ({ page }) => {
    const canvas = page.locator('[data-testid="workspace-Editor"]');
    const tablist = canvas.locator('[role="tablist"]');
    const firstTab = tablist.locator('[role="tab"]').first();

    await firstTab.dblclick();

    const labelInput = tablist.locator('input').first();
    await expect(labelInput).toBeVisible({ timeout: 2000 });

    // Clear and type a new label
    await labelInput.fill('Personal Details');
    await labelInput.press('Enter');

    // The tab should now display the new label
    await expect(firstTab).toContainText('Personal Details');
  });
});

// BUG #73 — First field blocked in empty paged definition
// definition.addItem throws when pageMode is 'wizard' and no parentPath is
// provided, even if there are no groups yet and the user is trying to add the
// very first item (a group, which acts as the first page).
// In practice, when adding the first field to a freshly paged-but-empty def,
// the UI should allow adding a group (page) without error.
test.describe('Bug #73 — adding first item to empty paged definition does not throw', () => {
  test('can add a field to an empty wizard-mode definition [BUG-073]', async ({ page }) => {
    await waitForApp(page);
    // Start with wizard mode but no items at all
    await importDefinition(page, {
      $formspec: '1.0',
      formPresentation: { pageMode: 'wizard' },
      items: [],
    });

    // The add-item button should be present and clickable
    await page.waitForSelector('[data-testid="add-item"]', { timeout: 5000 });
    await page.click('[data-testid="add-item"]');

    const searchInput = page.locator('input[placeholder="Search field types…"]');
    await searchInput.fill('text');

    // BUG: clicking "Text" dispatches definition.addItem with no parentPath
    // which hits the guard in definition-items.ts that throws for paged defs.
    // A console error and no new field appears.
    await page.getByRole('button', { name: 'Text Short text — names,' }).click();

    // A new field block should appear in the canvas — no error should occur
    const canvas = page.locator('[data-testid="workspace-Editor"]');
    await expect(canvas.locator('[data-testid^="field-"]').first()).toBeVisible({ timeout: 3000 });
  });
});

// BUG #74 — Added page selects wrong activePageKey after key collision rename
// StructureTree.handleAddPage generates key = `page${n}` (e.g. "page1"), then
// dispatches definition.addItem. When "page1" already exists, the handler
// renames it to "page1_1". But handleAddPage schedules
// `setActivePageKey("page1")` via requestAnimationFrame — pointing to the
// ORIGINAL (colliding) key that was renamed, not the actual inserted key.
test.describe('Bug #74 — new page tab is selected after key collision rename', () => {
  test('activePageKey follows the actual inserted key when a collision rename occurs [BUG-074]', async ({ page }) => {
    await waitForApp(page);
    // Seed a definition that already has "page1" so the next "Add Page" click
    // will produce a collision and the handler will rename it to "page1_1".
    await importDefinition(page, {
      $formspec: '1.0',
      formPresentation: { pageMode: 'wizard' },
      items: [
        {
          key: 'page1',
          type: 'group',
          label: 'Existing Page',
          children: [],
        },
      ],
    });

    await page.waitForSelector('[role="tablist"]', { timeout: 5000 });

    // Click the "Add wizard page" button in the Structure Tree sidebar
    const sidebar = page.locator('aside').first();
    await sidebar.getByTitle('Add wizard page').click();

    // After insertion, the newly added page should be the active one.
    // BUG: setActivePageKey is called with "page1" (the pre-rename key), but
    // the actual inserted key is "page1_1", so activePageKey stays at the OLD
    // page rather than jumping to the new one.

    // Wait for the new tab to appear
    const canvas = page.locator('[data-testid="workspace-Editor"]');
    const tablist = canvas.locator('[role="tablist"]');
    await expect(tablist.locator('[role="tab"]')).toHaveCount(2, { timeout: 3000 });

    // The newly inserted page tab should be selected (aria-selected="true")
    const lastTab = tablist.locator('[role="tab"]').last();
    await expect(lastTab).toHaveAttribute('aria-selected', 'true');
  });
});

// BUG #75 — Active-page normalization requires StructureTree to be mounted
// The auto-select-first-page logic lives in a useEffect inside StructureTree.
// When the user is on a blueprint sidebar section other than "Structure" (e.g.
// "Settings"), StructureTree is not mounted, so its useEffect never fires.
// Loading a paged definition with the Settings sidebar open leaves
// activePageKey as null, causing the editor to show no page content.
test.describe('Bug #75 — first page tab auto-selected even when StructureTree not mounted', () => {
  test('first page is active when a paged definition is loaded with Settings sidebar open [BUG-075]', async ({ page }) => {
    await waitForApp(page);

    // Switch the sidebar to "Settings" so StructureTree is NOT rendered
    await page.click('[data-testid="blueprint-section-Settings"]');
    await page.waitForSelector('[data-testid="blueprint-section-Settings"].active, [data-testid="blueprint-section-Settings"][aria-selected="true"], [data-testid="blueprint-section-Settings"][data-active="true"]', {
      timeout: 3000,
    }).catch(() => {
      // Selector may not use those exact attributes; continue — the click is enough
    });

    // Now load a paged definition while Settings is active (StructureTree not mounted)
    await importDefinition(page, PAGED_DEF);

    // The editor canvas should show a tablist
    const canvas = page.locator('[data-testid="workspace-Editor"]');
    await expect(canvas.locator('[role="tablist"]')).toBeVisible({ timeout: 5000 });

    // The first page tab should be auto-selected
    // BUG: activePageKey is null because StructureTree's useEffect never ran.
    // The tablist shows, but no tab has aria-selected="true", and the canvas
    // shows no items for the "current" page.
    const firstTab = canvas.locator('[role="tab"]').first();
    await expect(firstTab).toHaveAttribute('aria-selected', 'true');

    // At least one item from the first page should be visible in the canvas
    await expect(canvas.locator('[data-testid="field-name"]')).toBeVisible({ timeout: 3000 });
  });
});
