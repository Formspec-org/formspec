import { test, expect, type Page } from '@playwright/test';
import { addFromLayoutPalette, waitForApp, importDefinition, switchTab } from './helpers';

const WIZARD_DEF = {
  $formspec: '1.0',
  url: 'urn:wizard-preview',
  version: '1.0.0',
  formPresentation: { pageMode: 'wizard' },
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
    await expect(workspace.getByRole('button', { name: /continue|next/i }).first()).toBeVisible();
  });

  test('shows a Submit action on the final wizard page', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Preview"]');

    await workspace.getByRole('button', { name: /continue|next/i }).first().click();
    await workspace.getByRole('button', { name: /continue|next/i }).first().click();

    await expect(workspace.getByRole('button', { name: /submit/i }).first()).toBeVisible();
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

/** Page title button in Layout step nav (excludes drag handles). */
function layoutPageTabByTitle(page: Page, title: RegExp | string) {
  return page.locator('[data-testid="page-nav"]').locator('[data-testid^="page-nav-tab-"]').filter({ hasText: title });
}

// BUG #10 — Inactive tabs hide labels
// RESOLVED by Editor/Layout split: The Editor no longer has page tabs.
// Wizard step navigation is now in the Layout tab (LayoutStepNav component).
// The old GroupTabs component that had this bug has been removed.
test.describe('Bug #10 — inactive page tabs show label text', () => {
  test('every page tab shows its label text, not just the active one [BUG-010]', async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, PAGED_DEF);
    await switchTab(page, 'Layout');

    await expect(layoutPageTabByTitle(page, /Applicant Info/i)).toBeVisible();
    await expect(layoutPageTabByTitle(page, /Household Details/i)).toBeVisible();
    await expect(layoutPageTabByTitle(page, /Review/i)).toBeVisible();
  });

  test('inactive tab label is visible before clicking it [BUG-010]', async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, PAGED_DEF);
    await switchTab(page, 'Layout');

    const inactiveTab = layoutPageTabByTitle(page, /Household Details/i);
    await expect(inactiveTab).toBeVisible();
    await expect(inactiveTab).not.toHaveAttribute('aria-current', 'page');
  });
});

// BUG #11 — Editor definition tree omits display-tier rows (they are authored in Layout).
test.describe('Bug #11 — root-level non-group items visible in paged editor', () => {
  test('root-level field and group visible in Editor; display rows are layout-only [BUG-011]', async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, {
      $formspec: '1.0',
      formPresentation: { pageMode: 'wizard' },
      items: [
        { key: 'introText', type: 'display', label: 'Introduction' },
        {
          key: 'pageOne',
          type: 'group',
          label: 'Page One',
          children: [{ key: 'myField', type: 'field', dataType: 'string', label: 'My Field' }],
        },
      ],
    });

    const editor = page.locator('[data-testid="workspace-Editor"]');
    await expect(editor.locator('[data-testid="group-pageOne"]')).toBeVisible();
    await expect(editor.locator('[data-testid="field-myField"]')).toBeVisible();
    await expect(editor.locator('[data-testid="display-introText"]')).toHaveCount(0);
  });
});

// BUG #44 — Page tabs cannot be renamed via double-click
// RESOLVED by Editor/Layout split: The Editor no longer has page tabs.
// Page renaming is now done in the Layout tab via the page card title editor.
test.describe('Bug #44 — double-click page tab opens inline label editor', () => {
  test('double-clicking active tab label opens an inline text input [BUG-044]', async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, PAGED_DEF);
    await switchTab(page, 'Layout');

    await layoutPageTabByTitle(page, /Applicant Info/i).dblclick();
    await expect(page.locator('[data-testid="page-nav-rename-input"]')).toBeVisible();
  });

  test('editing the label in the inline input renames the page group [BUG-044]', async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, PAGED_DEF);
    await switchTab(page, 'Layout');

    await layoutPageTabByTitle(page, /Applicant Info/i).dblclick();
    const renameInput = page.locator('[data-testid="page-nav-rename-input"]');
    await renameInput.fill('Applicant Basics');
    await renameInput.press('Enter');

    await expect(layoutPageTabByTitle(page, /Applicant Basics/i)).toBeVisible();

    await switchTab(page, 'Editor');
    await expect(page.locator('[data-testid="group-page1"]')).toContainText('Applicant Basics');
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

    const searchInput = page.locator('input[placeholder="Search inputs and groups..."]');
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

// BUG #74 — Added page selects wrong activeGroupKey after key collision rename
// RESOLVED by Editor/Layout split: The Editor no longer has page tabs or
// activeGroupKey. Page management is handled in the Layout tab.
test.describe('Bug #74 — new page tab is selected after key collision rename', () => {
  test('new Layout page becomes active even when its generated group key collides [BUG-074]', async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, {
      $formspec: '1.0',
      formPresentation: { pageMode: 'wizard' },
      items: [
        {
          key: 'page_1',
          type: 'group',
          label: 'Page 1',
          children: [{ key: 'first', type: 'field', dataType: 'string', label: 'First' }],
        },
        {
          key: 'page_3',
          type: 'group',
          label: 'Page 3',
          children: [{ key: 'third', type: 'field', dataType: 'string', label: 'Third' }],
        },
      ],
    });
    await switchTab(page, 'Layout');

    await page.click('[data-testid="layout-add-page"]');

    const pageTabs = page.locator('[data-testid^="page-nav-tab-"]');
    await expect(pageTabs).toHaveCount(3);
    await expect(pageTabs.nth(2)).toHaveAttribute('aria-current', 'page');

    await addFromLayoutPalette(page, 'Card');
    await expect(page.locator('[data-testid^="layout-container-"][data-component="Card"]')).toHaveCount(1);

    await pageTabs.nth(0).click();
    await expect(page.locator('[data-testid^="layout-container-"][data-component="Card"]')).toHaveCount(0);
  });
});

// BUG #75 — Active-page normalization requires StructureTree to be mounted
// RESOLVED by Editor/Layout split: The Editor no longer has page tabs or
// activeGroupKey. It shows ALL items in a flat tree regardless of page mode.
// Page management is handled in the Layout tab.
test.describe('Bug #75 — first page tab auto-selected even when StructureTree not mounted', () => {
  test('Editor shows all paged items regardless of sidebar section [BUG-075]', async ({ page }) => {
    await waitForApp(page);

    // Switch the sidebar to "Settings" so StructureTree is NOT rendered
    await page.click('[data-testid="blueprint-section-Settings"]');

    // Load a paged definition while Settings is active
    await importDefinition(page, PAGED_DEF);

    // The Editor tree shows ALL items flat — no page filtering
    const canvas = page.locator('[data-testid="workspace-Editor"]');
    await expect(canvas.locator('[data-testid="field-name"]')).toBeVisible({ timeout: 5000 });
  });
});
