/** @filedesc Playwright E2E tests for Phase 3 Focus Mode — 15 behavioral flows. */
import { test, expect } from '@playwright/test';
import { waitForApp, switchTab, importProject } from './helpers';

// ── Fixtures ──────────────────────────────────────────────────────────

/** Wizard form with 3 pages, mixed field types, one unplaced field. */
const FOCUS_MODE_SEED = {
  definition: {
    $formspec: '1.0',
    url: 'urn:focus-e2e',
    version: '1.0.0',
    title: 'Focus Mode E2E',
    status: 'draft',
    formPresentation: { pageMode: 'wizard' },
    items: [
      { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
      { key: 'email', type: 'field', dataType: 'string', label: 'Email Address' },
      { key: 'contact', type: 'group', label: 'Contact Info', children: [
        { key: 'phone', type: 'field', dataType: 'string', label: 'Phone' },
        { key: 'fax', type: 'field', dataType: 'string', label: 'Fax' },
      ]},
      { key: 'notes', type: 'field', dataType: 'string', label: 'Notes' },
    ],
  },
  theme: {
    pages: [
      { id: 'p1', title: 'Personal', regions: [{ key: 'name', span: 12 }, { key: 'email', span: 6 }] },
      { id: 'p2', title: 'Contact', regions: [{ key: 'contact', span: 8 }] },
      { id: 'p3', title: 'Review', regions: [] },
    ],
  },
};

/** Single mode with dormant pages — for dormant flow. */
const DORMANT_SEED = {
  definition: {
    $formspec: '1.0',
    url: 'urn:dormant-e2e',
    version: '1.0.0',
    formPresentation: { pageMode: 'single' },
    items: [
      { key: 'name', type: 'field', dataType: 'string', label: 'Name' },
    ],
  },
  theme: {
    pages: [
      { id: 'dp1', title: 'Dormant Page', regions: [{ key: 'name', span: 12 }] },
    ],
  },
};

/** Wizard with breakpoints configured — for responsive flows. */
const RESPONSIVE_SEED = {
  definition: {
    $formspec: '1.0',
    url: 'urn:responsive-e2e',
    version: '1.0.0',
    formPresentation: { pageMode: 'wizard' },
    items: [
      { key: 'fname', type: 'field', dataType: 'string', label: 'First Name' },
      { key: 'email', type: 'field', dataType: 'string', label: 'Email' },
    ],
  },
  theme: {
    breakpoints: { sm: 576, md: 768, lg: 1024 },
    pages: [
      { id: 'r1', title: 'Responsive', regions: [{ key: 'fname', span: 8 }, { key: 'email', span: 4 }] },
    ],
  },
};

// ── Helpers ────────────────────────────────────────────────────────────

/** Navigate to Pages tab and enter Focus Mode on a page card. */
async function enterFocusMode(page: import('@playwright/test').Page, pageCardTestId: string) {
  await switchTab(page, 'Pages');
  const card = page.locator(`[data-testid="${pageCardTestId}"]`);

  // Expand the card
  await card.getByRole('button', { expanded: false }).click();

  // Click Edit Layout and wait for Focus Mode to render
  await card.getByRole('button', { name: /edit layout/i }).click();
  await page.getByLabel('Page title').waitFor();
}

/** Locate the SelectionToolbar (scoped to avoid collisions with GridItemBlock role="button"). */
function toolbar(page: import('@playwright/test').Page) {
  return page.locator('[data-testid="selection-toolbar"]');
}

// ── Tests ─────────────────────────────────────────────────────────────

test.describe('Focus Mode', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
  });

  // ── Flow 1: Enter Focus Mode from a page card ────────────────────

  test('1. enter Focus Mode from a page card', async ({ page }) => {
    await importProject(page, FOCUS_MODE_SEED);
    await enterFocusMode(page, 'page-card-p1');

    // Overview elements should be gone (page cards not visible)
    await expect(page.locator('[data-testid="page-card-p1"]')).not.toBeVisible();

    // Focus Mode elements present: editable title, back button, breakpoint bar
    await expect(page.getByLabel('Page title')).toHaveValue('Personal');
    await expect(page.getByRole('button', { name: /back/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Base', pressed: true })).toBeVisible();
  });

  // ── Flow 2: Exit Focus Mode via Back arrow and Escape ────────────

  test('2. exit Focus Mode via Back button returns to overview', async ({ page }) => {
    await importProject(page, FOCUS_MODE_SEED);
    await enterFocusMode(page, 'page-card-p1');

    await page.getByRole('button', { name: /back/i }).click();

    // Overview restored — page cards and mode selector visible
    await expect(page.locator('[data-testid="page-card-p1"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Wizard' })).toBeVisible();
  });

  test('2b. Escape deselects item first, then exits Focus Mode', async ({ page }) => {
    await importProject(page, FOCUS_MODE_SEED);
    await enterFocusMode(page, 'page-card-p1');

    // Select an item on the grid
    await page.locator('[data-grid-item]').first().locator('[role="button"]').click();
    // Toolbar should appear
    await expect(toolbar(page)).toBeVisible();

    // First Escape — deselects (should still be in Focus Mode)
    await page.keyboard.press('Escape');
    await expect(toolbar(page)).not.toBeVisible();
    await expect(page.getByLabel('Page title')).toBeVisible();

    // Second Escape — exits Focus Mode
    await page.locator('[data-grid-canvas]').focus();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="page-card-p1"]')).toBeVisible();
  });

  // ── Flow 3: Navigate between pages without leaving Focus Mode ────

  test('3. navigate between pages with prev/next arrows', async ({ page }) => {
    await importProject(page, FOCUS_MODE_SEED);
    await enterFocusMode(page, 'page-card-p1');

    // Should show 1 / 3, prev disabled
    await expect(page.getByText('1 / 3')).toBeVisible();
    await expect(page.getByRole('button', { name: /previous page/i })).toBeDisabled();

    // Click Next
    await page.getByRole('button', { name: /next page/i }).click();
    await expect(page.getByLabel('Page title')).toHaveValue('Contact');
    await expect(page.getByText('2 / 3')).toBeVisible();

    // Click Next again
    await page.getByRole('button', { name: /next page/i }).click();
    await expect(page.getByLabel('Page title')).toHaveValue('Review');
    await expect(page.getByText('3 / 3')).toBeVisible();
    await expect(page.getByRole('button', { name: /next page/i })).toBeDisabled();

    // Click Prev
    await page.getByRole('button', { name: /previous page/i }).click();
    await expect(page.getByLabel('Page title')).toHaveValue('Contact');
  });

  // ── Flow 4: Select an item block to see width controls ────────────

  test('4. clicking a grid block shows the selection toolbar', async ({ page }) => {
    await importProject(page, FOCUS_MODE_SEED);
    await enterFocusMode(page, 'page-card-p1');

    // Click the first grid item
    await page.locator('[data-grid-item]').first().locator('[role="button"]').click();

    // Selection toolbar should appear with width presets (scoped to toolbar)
    const tb = toolbar(page);
    await expect(tb).toBeVisible();
    await expect(tb.getByRole('button', { name: 'Full' })).toBeVisible();
    await expect(tb.getByRole('button', { name: 'Half' })).toBeVisible();
    await expect(tb.getByRole('button', { name: 'Third' })).toBeVisible();
    await expect(tb.getByRole('button', { name: 'Quarter' })).toBeVisible();
  });

  // ── Flow 5: Resize a field using width presets ─────────────────────

  test('5. clicking Half preset resizes the block to 6/12', async ({ page }) => {
    await importProject(page, FOCUS_MODE_SEED);
    await enterFocusMode(page, 'page-card-p1');

    // "Full Name" is the first item, at span 12
    await page.locator('[data-grid-item]').first().locator('[role="button"]').click();

    const tb = toolbar(page);
    // Verify Full is currently pressed
    await expect(tb.getByRole('button', { name: 'Full', pressed: true })).toBeVisible();

    // Click Half
    await tb.getByRole('button', { name: 'Half' }).click();

    // Half should now be pressed, Full not
    await expect(tb.getByRole('button', { name: 'Half', pressed: true })).toBeVisible();
    await expect(tb.getByRole('button', { name: 'Full', pressed: false })).toBeVisible();
  });

  // ── Flow 6: Set a custom column width ──────────────────────────────

  test('6. custom width input sets non-preset width', async ({ page }) => {
    await importProject(page, FOCUS_MODE_SEED);
    await enterFocusMode(page, 'page-card-p1');

    await page.locator('[data-grid-item]').first().locator('[role="button"]').click();

    const tb = toolbar(page);
    // Change custom width to 5
    const widthInput = tb.getByLabel('custom width');
    await widthInput.fill('5');
    await widthInput.press('Enter');

    // No preset should be pressed (5 doesn't match any)
    await expect(tb.getByRole('button', { name: 'Full', pressed: true })).not.toBeVisible();
    await expect(tb.getByRole('button', { name: 'Half', pressed: true })).not.toBeVisible();
  });

  // ── Flow 7: Add an offset to push a field right ────────────────────

  test('7. offset toggle reveals input and sets offset', async ({ page }) => {
    await importProject(page, FOCUS_MODE_SEED);
    await enterFocusMode(page, 'page-card-p1');

    await page.locator('[data-grid-item]').nth(1).locator('[role="button"]').click();

    const tb = toolbar(page);
    // Click Offset toggle
    await tb.getByRole('button', { name: 'Offset' }).click();

    // Offset input should appear
    const offsetInput = tb.getByLabel('offset');
    await expect(offsetInput).toBeVisible();

    // Set offset to 3
    await offsetInput.fill('3');
    await offsetInput.press('Enter');
    await expect(offsetInput).toBeVisible();
  });

  // ── Flow 8: Remove an item from the page ───────────────────────────

  test('8. remove button removes item from grid and returns it to palette', async ({ page }) => {
    await importProject(page, FOCUS_MODE_SEED);
    await enterFocusMode(page, 'page-card-p1');

    // Count grid items before
    await expect(page.locator('[data-grid-item]')).toHaveCount(2); // name + email

    // Click the remove button on the first block (opacity-0 until hover, use force)
    const firstBlock = page.locator('[data-grid-item]').first();
    await firstBlock.locator('button[aria-label="remove"]').click({ force: true });

    // Should now have 1 item
    await expect(page.locator('[data-grid-item]')).toHaveCount(1);
  });

  // ── Flow 9: See an empty page with guidance ────────────────────────

  test('9. empty page shows guidance message', async ({ page }) => {
    await importProject(page, FOCUS_MODE_SEED);
    // p3 (Review) has no regions
    await enterFocusMode(page, 'page-card-p3');

    await expect(page.getByText(/drag fields from the palette/i)).toBeVisible();
  });

  // ── Flow 10: Switch to a responsive breakpoint ─────────────────────

  test('10. clicking a breakpoint button switches the active breakpoint', async ({ page }) => {
    await importProject(page, RESPONSIVE_SEED);
    await enterFocusMode(page, 'page-card-r1');

    // Base is active by default
    await expect(page.getByRole('button', { name: 'Base', pressed: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'md', pressed: false })).toBeVisible();

    // Click md
    await page.getByRole('button', { name: 'md' }).click();

    // md should now be pressed, Base not
    await expect(page.getByRole('button', { name: 'md', pressed: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Base', pressed: false })).toBeVisible();
  });

  // ── Flow 11: Set a responsive override at a non-base breakpoint ────

  test('11. width preset at non-base breakpoint writes responsive override', async ({ page }) => {
    await importProject(page, RESPONSIVE_SEED);
    await enterFocusMode(page, 'page-card-r1');

    // Select the first block (fname, width 8) while on base
    await page.locator('[data-grid-item]').first().locator('[role="button"]').click();
    const tb = toolbar(page);
    await expect(tb).toBeVisible();

    // Deselect, then switch to md breakpoint
    await page.locator('[data-grid-canvas]').click();
    await page.getByRole('button', { name: 'md' }).click();
    await expect(page.getByRole('button', { name: 'md', pressed: true })).toBeVisible();

    // Select the first block again at md breakpoint
    await page.locator('[data-grid-item]').first().locator('[role="button"]').click();
    await expect(tb).toBeVisible();

    // Click Half (6) — writes to md responsive, not base
    await tb.getByRole('button', { name: 'Half' }).click();
    await expect(tb.getByRole('button', { name: 'Half', pressed: true })).toBeVisible();

    // Switch back to Base and re-select — base width should still be 8
    await page.locator('[data-grid-canvas]').click();
    await page.getByRole('button', { name: 'Base' }).click();
    await page.locator('[data-grid-item]').first().locator('[role="button"]').click();
    // 8 doesn't match any preset (Full=12, Half=6, Third=4, Quarter=3)
    await expect(tb.getByRole('button', { name: 'Full', pressed: true })).not.toBeVisible();
    await expect(tb.getByRole('button', { name: 'Half', pressed: true })).not.toBeVisible();
  });

  // ── Flow 12: Quick-add an unplaced field from the palette ──────────

  test('12. quick-add from palette places item on page at full width', async ({ page }) => {
    await importProject(page, FOCUS_MODE_SEED);
    // p3 (Review) is empty
    await enterFocusMode(page, 'page-card-p3');

    // Empty state visible
    await expect(page.getByText(/drag fields from the palette/i)).toBeVisible();

    // Find an unplaced item's + button in the palette and click it
    const paletteItem = page.locator('[data-testid="palette-item-notes"]');
    await paletteItem.getByRole('button', { name: /add to page/i }).click();

    // Empty state should be gone, grid item should appear
    await expect(page.getByText(/drag fields from the palette/i)).not.toBeVisible();
    await expect(page.locator('[data-grid-item]')).toHaveCount(1);
  });

  // ── Flow 13: Understand placement status across pages ──────────────

  test('13. palette shows items placed on other pages as greyed with checkmark', async ({ page }) => {
    await importProject(page, FOCUS_MODE_SEED);
    // Enter Focus Mode on p1 (has 'name' and 'email')
    await enterFocusMode(page, 'page-card-p1');

    // 'name' is placed on THIS page — should show checkmark
    const nameItem = page.locator('[data-testid="palette-item-name"]');
    await expect(nameItem.locator('[data-placed="true"]')).toBeVisible();

    // 'contact' is a group on p2 — palette lists children; both are placed via propagation.
    const phoneItem = page.locator('[data-testid="palette-item-phone"]');
    await expect(phoneItem.locator('[data-placed="true"]')).toBeVisible();

    // 'notes' is unplaced — should show + button, not checkmark
    const notesItem = page.locator('[data-testid="palette-item-notes"]');
    await expect(notesItem.getByRole('button', { name: /add to page/i })).toBeVisible();
    await expect(notesItem.locator('[data-placed="true"]')).not.toBeVisible();
  });

  // ── Flow 14: Collapse and reopen the field palette ─────────────────

  test('14. closing palette expands grid, Fields button reopens it', async ({ page }) => {
    await importProject(page, FOCUS_MODE_SEED);
    await enterFocusMode(page, 'page-card-p1');

    // Palette header should be visible
    await expect(page.getByRole('button', { name: /close palette/i })).toBeVisible();

    // Close it
    await page.getByRole('button', { name: /close palette/i }).click();

    // Palette should be gone, "Fields" button should appear in top bar
    await expect(page.getByRole('button', { name: /close palette/i })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /open palette/i })).toBeVisible();

    // Reopen it
    await page.getByRole('button', { name: /open palette/i }).click();
    await expect(page.getByRole('button', { name: /close palette/i })).toBeVisible();
  });

  // ── Flow 15: Edit a dormant page layout in single mode ─────────────

  test('15. dormant page in single mode is fully editable with Dormant badge', async ({ page }) => {
    await importProject(page, DORMANT_SEED);
    await switchTab(page, 'Pages');

    // Should see dormant info
    await expect(page.getByText(/preserved but not active/i)).toBeVisible();

    // Expand the dormant card and enter Focus Mode
    const card = page.locator('[data-testid="page-card-dp1"]');
    await card.getByRole('button', { expanded: false }).click();
    await card.getByRole('button', { name: /edit layout/i }).click();
    await page.getByLabel('Page title').waitFor();

    // Should be in Focus Mode with Dormant badge
    await expect(page.getByLabel('Page title')).toHaveValue('Dormant Page');
    await expect(page.locator('[data-testid="workspace-Pages"]').getByText('Dormant')).toBeVisible();

    // Grid should show the placed item
    await expect(page.locator('[data-grid-item]')).toHaveCount(1);

    // Editing works — select and use a preset
    await page.locator('[data-grid-item]').first().locator('[role="button"]').click();
    const tb = toolbar(page);
    await expect(tb).toBeVisible();
    await tb.getByRole('button', { name: 'Half' }).click();
    await expect(tb.getByRole('button', { name: 'Half', pressed: true })).toBeVisible();

    // Back button returns to overview
    await page.getByRole('button', { name: /back/i }).click();
    await expect(page.getByText(/preserved but not active/i)).toBeVisible();
  });
});
