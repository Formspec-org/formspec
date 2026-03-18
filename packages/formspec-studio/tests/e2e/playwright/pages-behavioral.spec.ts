/** @filedesc Behavioral E2E tests for Pages workspace — 10 user stories covering the full page lifecycle. */
import { test, expect } from '@playwright/test';
import { waitForApp, switchTab, importProject } from './helpers';

// ── Seeds ────────────────────────────────────────────────────────────

/** Two-page wizard with labeled fields on each page. */
const TWO_PAGE_WIZARD = {
  definition: {
    $formspec: '1.0',
    url: 'urn:pages-behavioral',
    version: '1.0.0',
    title: 'Pages Behavioral',
    formPresentation: { pageMode: 'wizard' },
    items: [
      {
        key: 'personal',
        type: 'group',
        label: 'Personal Info',
        children: [
          { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
          { key: 'email', type: 'field', dataType: 'string', label: 'Email' },
        ],
      },
      {
        key: 'address',
        type: 'group',
        label: 'Address',
        children: [
          { key: 'street', type: 'field', dataType: 'string', label: 'Street' },
          { key: 'city', type: 'field', dataType: 'string', label: 'City' },
          { key: 'zip', type: 'field', dataType: 'string', label: 'Zip Code' },
        ],
      },
    ],
  },
  theme: {
    pages: [
      { id: 'p-personal', title: 'Personal Info', regions: [{ key: 'personal', span: 12 }] },
      { id: 'p-address', title: 'Address', regions: [{ key: 'address', span: 12 }] },
    ],
  },
};

/** Wizard with one page and one unassigned top-level field. */
const WIZARD_WITH_UNASSIGNED = {
  definition: {
    $formspec: '1.0',
    url: 'urn:unassigned',
    version: '1.0.0',
    formPresentation: { pageMode: 'wizard' },
    items: [
      {
        key: 'step1',
        type: 'group',
        label: 'Step 1',
        children: [{ key: 'name', type: 'field', dataType: 'string', label: 'Full Name' }],
      },
      { key: 'phone', type: 'field', dataType: 'string', label: 'Phone Number' },
    ],
  },
  theme: {
    pages: [
      { id: 'p1', title: 'Step 1', regions: [{ key: 'step1', span: 12 }] },
    ],
  },
};

/** Wizard with one page containing three fields at different widths. */
const WIDTH_LAYOUT_SEED = {
  definition: {
    $formspec: '1.0',
    url: 'urn:width-layout',
    version: '1.0.0',
    formPresentation: { pageMode: 'wizard' },
    items: [
      {
        key: 'layout',
        type: 'group',
        label: 'Layout Test',
        children: [
          { key: 'field_a', type: 'field', dataType: 'string', label: 'Field A' },
          { key: 'field_b', type: 'field', dataType: 'string', label: 'Field B' },
          { key: 'field_c', type: 'field', dataType: 'string', label: 'Field C' },
        ],
      },
    ],
  },
  theme: {
    pages: [
      {
        id: 'p-layout',
        title: 'Layout Test',
        regions: [
          { key: 'field_a', span: 12 },
          { key: 'field_b', span: 6 },
          { key: 'field_c', span: 6 },
        ],
      },
    ],
  },
};

/** Wizard with a broken (amber) region — references a key that does not exist. */
const BROKEN_REGION_SEED = {
  definition: {
    $formspec: '1.0',
    url: 'urn:broken',
    version: '1.0.0',
    formPresentation: { pageMode: 'wizard' },
    items: [
      {
        key: 'contact',
        type: 'group',
        label: 'Contact',
        children: [
          { key: 'fname', type: 'field', dataType: 'string', label: 'Name' },
          { key: 'femail', type: 'field', dataType: 'string', label: 'Email' },
        ],
      },
    ],
  },
  theme: {
    pages: [
      {
        id: 'p-contact',
        title: 'Contact',
        regions: [
          { key: 'fname', span: 6 },
          { key: 'old_field', span: 6 },
          { key: 'femail', span: 12 },
        ],
      },
    ],
  },
};

/** Three-page wizard for reordering tests. */
const THREE_PAGE_WIZARD = {
  definition: {
    $formspec: '1.0',
    url: 'urn:three-page',
    version: '1.0.0',
    formPresentation: { pageMode: 'wizard' },
    items: [
      { key: 'step1', type: 'group', label: 'Step 1', children: [{ key: 'f1', type: 'field', dataType: 'string', label: 'Field 1' }] },
      { key: 'step2', type: 'group', label: 'Step 2', children: [{ key: 'f2', type: 'field', dataType: 'string', label: 'Field 2' }] },
      { key: 'step3', type: 'group', label: 'Step 3', children: [{ key: 'f3', type: 'field', dataType: 'string', label: 'Field 3' }] },
    ],
  },
  theme: {
    pages: [
      { id: 'p1', title: 'Step 1', regions: [{ key: 'step1', span: 12 }] },
      { id: 'p2', title: 'Step 2', regions: [{ key: 'step2', span: 12 }] },
      { id: 'p3', title: 'Step 3', regions: [{ key: 'step3', span: 12 }] },
    ],
  },
};

/** Wizard with responsive overrides on one region. */
const RESPONSIVE_SEED = {
  definition: {
    $formspec: '1.0',
    url: 'urn:responsive',
    version: '1.0.0',
    formPresentation: { pageMode: 'wizard' },
    items: [
      {
        key: 'dashboard',
        type: 'group',
        label: 'Dashboard',
        children: [
          { key: 'chart', type: 'field', dataType: 'string', label: 'Summary Chart' },
          { key: 'detail', type: 'field', dataType: 'string', label: 'Detail View' },
        ],
      },
    ],
  },
  theme: {
    breakpoints: { sm: 640, md: 768, lg: 1024 },
    pages: [
      {
        id: 'p-dash',
        title: 'Dashboard',
        regions: [
          { key: 'chart', span: 12 },
          { key: 'detail', span: 12 },
        ],
      },
    ],
  },
};

// ── Helpers ──────────────────────────────────────────────────────────

const ws = (page: import('@playwright/test').Page) =>
  page.locator('[data-testid="workspace-Pages"]');

const card = (page: import('@playwright/test').Page, id: string) =>
  page.locator(`[data-testid="page-card-${id}"]`);

/** Expand a page card by clicking its ▸ toggle button. No-op if already expanded. */
async function expandCard(page: import('@playwright/test').Page, cardId: string) {
  const c = card(page, cardId);
  // The toggle is the ▸ chevron button — last button in the header row
  const toggle = c.getByRole('button').filter({ hasText: '▸' });
  // Only click if not already expanded
  const isExpanded = await toggle.getAttribute('aria-expanded');
  if (isExpanded !== 'true') {
    await toggle.click();
  }
  // Wait for the expanded detail section to appear
  await c.locator('.border-t').first().waitFor({ timeout: 3000 });
}

// ── Story 1: Unassigned field shows on Pages tab ────────────────────

test.describe('Story 1: Unassigned field appears on Pages tab', () => {
  test('a top-level field not placed on any page shows in Unassigned', async ({ page }) => {
    await waitForApp(page);
    await importProject(page, WIZARD_WITH_UNASSIGNED);
    await switchTab(page, 'Pages');

    // "Phone Number" is a top-level field not on any page
    const workspace = ws(page);
    await expect(workspace.getByText(/unassigned/i)).toBeVisible({ timeout: 3000 });
    await expect(workspace.getByText('Phone Number')).toBeVisible();
  });
});

// ── Story 2: Two fields side by side (width layout) ─────────────────

test.describe('Story 2: Grid preview shows different widths', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await importProject(page, WIDTH_LAYOUT_SEED);
    await switchTab(page, 'Pages');
  });

  test('collapsed card shows mini grid with three segments', async ({ page }) => {
    const c = card(page, 'p-layout');
    await expect(c).toBeVisible();
    // Mini grid bar (h-4) shows segments in collapsed state
    const miniGrid = c.locator('.h-4.grid-cols-12');
    const segments = miniGrid.locator('> div');
    await expect(segments).toHaveCount(3);
  });

  test('expanded card shows interactive grid and editable widths', async ({ page }) => {
    await expandCard(page, 'p-layout');
    const c = card(page, 'p-layout');

    // Interactive grid bar (h-8) with clickable segments
    const segments = c.getByRole('button', { name: 'grid segment' });
    await expect(segments).toHaveCount(3);

    // Click first segment to select it — shows a width input
    await segments.first().click();
    const spanInput = c.locator('input[aria-label="grid segment span"]');
    await expect(spanInput).toBeVisible();
    await expect(spanInput).toHaveValue('12');
  });
});

// ── Story 3: Deleting a page removes the card and its group ─────────

test.describe('Story 3: Deleting a page', () => {
  test('deleting a page removes the card and reduces page count', async ({ page }) => {
    await waitForApp(page);
    await importProject(page, TWO_PAGE_WIZARD);
    await switchTab(page, 'Pages');

    const workspace = ws(page);
    await expect(card(page, 'p-personal')).toBeVisible();
    await expect(card(page, 'p-address')).toBeVisible();
    await expect(workspace.locator('[data-testid^="page-card-"]')).toHaveCount(2);

    // Expand Address card and click Delete
    await expandCard(page, 'p-address');
    await card(page, 'p-address').getByRole('button', { name: 'Delete' }).click();

    // Address card gone, only one page remains
    await expect(card(page, 'p-address')).not.toBeVisible({ timeout: 2000 });
    await expect(workspace.locator('[data-testid^="page-card-"]')).toHaveCount(1);
  });
});

// ── Story 4: Switching modes — Wizard to Single (pages go dormant) ──

test.describe('Story 4: Mode switching', () => {
  test('switching to Single shows dormant pages, switching back restores', async ({ page }) => {
    await waitForApp(page);
    await importProject(page, TWO_PAGE_WIZARD);
    await switchTab(page, 'Pages');

    const workspace = ws(page);
    await expect(card(page, 'p-personal')).toBeVisible();

    // Switch to Single — pages go dormant
    await workspace.getByRole('button', { name: 'Single' }).click();
    await expect(workspace.getByText(/preserved but not active/i)).toBeVisible({ timeout: 3000 });
    // Page card titles still visible in dormant state
    await expect(workspace.getByText('Personal Info').first()).toBeVisible();
    await expect(workspace.getByText('Address').first()).toBeVisible();

    // Switch back to Wizard — pages active again
    await workspace.getByRole('button', { name: 'Wizard' }).click();
    await expect(card(page, 'p-personal')).toBeVisible({ timeout: 3000 });
    await expect(workspace.getByText(/preserved but not active/i)).not.toBeVisible();
  });
});

// ── Story 5: Sidebar ↔ Pages tab sync ────────────────────────────────

test.describe('Story 5: Sidebar and Pages tab expand sync', () => {
  test('clicking a page entry in the sidebar expands its page card', async ({ page }) => {
    await waitForApp(page);
    await importProject(page, TWO_PAGE_WIZARD);
    await switchTab(page, 'Pages');

    // The sidebar page list has numbered buttons like "2 Address"
    const sidebar = page.getByRole('complementary').first();
    const addressBtn = sidebar.getByRole('button', { name: /Address/ }).first();
    await addressBtn.click();

    // The Address page card should auto-expand
    const addressCard = card(page, 'p-address');
    await expect(addressCard.locator('.border-t').first()).toBeVisible({ timeout: 3000 });
  });
});

// ── Story 6: Hiding a field on small screens (responsive) ───────────

test.describe('Story 6: Responsive breakpoint overrides', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await importProject(page, RESPONSIVE_SEED);
    await switchTab(page, 'Pages');
  });

  test('toggling responsive panel shows breakpoint controls', async ({ page }) => {
    await expandCard(page, 'p-dash');
    const c = card(page, 'p-dash');

    // Click "resp▾" button for the first field
    const respButton = c.getByRole('button', { name: /responsive/i }).first();
    await respButton.click();

    // Breakpoint labels should appear
    await expect(c.getByText('sm').first()).toBeVisible({ timeout: 2000 });
    await expect(c.getByText('md').first()).toBeVisible();
    await expect(c.getByText('lg').first()).toBeVisible();

    // Each row has a "hide" checkbox
    const hideCheckboxes = c.locator('input[type="checkbox"]');
    await expect(hideCheckboxes.first()).toBeVisible();
  });

  test('checking "hide" on sm breakpoint sets the override', async ({ page }) => {
    await expandCard(page, 'p-dash');
    const c = card(page, 'p-dash');

    // Open responsive for first field
    const respButton = c.getByRole('button', { name: /responsive/i }).first();
    await respButton.click();
    await c.getByText('sm').first().waitFor({ timeout: 2000 });

    // The first checkbox (sm row) controls "hide"
    const hideCheckbox = c.locator('input[type="checkbox"]').first();
    await hideCheckbox.check();
    await expect(hideCheckbox).toBeChecked();
  });
});

// ── Story 7: Creating a new page ─────────────────────────────────────

test.describe('Story 7: Creating a new page', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await importProject(page, TWO_PAGE_WIZARD);
    await switchTab(page, 'Pages');
  });

  test('clicking Add Page creates a new card', async ({ page }) => {
    const workspace = ws(page);
    const cardsBefore = await workspace.locator('[data-testid^="page-card-"]').count();

    await workspace.getByRole('button', { name: /add page/i }).click();

    // Wait for new card to appear
    await expect(workspace.locator('[data-testid^="page-card-"]')).toHaveCount(cardsBefore + 1, { timeout: 3000 });
  });

  test('renaming a page updates the card title', async ({ page }) => {
    const workspace = ws(page);
    await workspace.getByRole('button', { name: /add page/i }).click();
    // The new card auto-expands. Find the title and click to edit.
    const newCard = workspace.locator('[data-testid^="page-card-"]').last();
    // Click the title button (contains "New Page ✎")
    await newCard.getByRole('button', { name: /New Page/ }).click();

    // Fill the editable input
    const titleInput = newCard.locator('input[type="text"]').first();
    await titleInput.fill('Payment Details');
    await titleInput.press('Enter');

    await expect(newCard.getByText('Payment Details').first()).toBeVisible({ timeout: 2000 });
  });
});

// ── Story 8: Reordering wizard steps ─────────────────────────────────

test.describe('Story 8: Reordering pages with move buttons', () => {
  test('move-down on first page changes page order', async ({ page }) => {
    await waitForApp(page);
    await importProject(page, THREE_PAGE_WIZARD);
    await switchTab(page, 'Pages');

    const cards = ws(page).locator('[data-testid^="page-card-"]');
    await expect(cards).toHaveCount(3);

    // Expand first card and click Move Down
    await expandCard(page, 'p1');
    await card(page, 'p1').getByRole('button', { name: 'Move Down' }).click();

    // First card should now be Step 2
    const firstCardText = await cards.first().innerText();
    expect(firstCardText).toContain('Step 2');
  });
});

// ── Story 9: Switching from Wizard to Tabs ──────────────────────────

test.describe('Story 9: Wizard to Tabs mode switch', () => {
  test('switching to Tabs keeps page cards and changes preview layout', async ({ page }) => {
    await waitForApp(page);
    await importProject(page, TWO_PAGE_WIZARD);
    await switchTab(page, 'Pages');

    // Switch to Tabs
    await ws(page).getByRole('button', { name: 'Tabs' }).click();

    // Page cards still there
    await expect(card(page, 'p-personal')).toBeVisible();
    await expect(card(page, 'p-address')).toBeVisible();

    // Preview should render with tab navigation (clickable tab buttons)
    await switchTab(page, 'Preview');
    const preview = page.locator('[data-testid="workspace-Preview"]');
    // Tab buttons should be visible (Tab 1, Tab 2, etc.)
    await expect(preview.getByRole('button', { name: /Tab 1/i })).toBeVisible({ timeout: 5000 });
    // Should NOT have wizard-style Continue/Next buttons
    await expect(preview.getByRole('button', { name: /continue|next/i }).first()).not.toBeVisible({ timeout: 1000 });
  });
});

// ── Story 10: Broken (amber) field on a page ────────────────────────

test.describe('Story 10: Broken field indicator', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await importProject(page, BROKEN_REGION_SEED);
    await switchTab(page, 'Pages');
  });

  test('collapsed card shows amber segment for nonexistent field', async ({ page }) => {
    const c = card(page, 'p-contact');
    await expect(c).toBeVisible();

    // Mini grid: 3 segments, 1 amber, 2 valid
    const amberSegments = c.locator('.bg-amber-300\\/30');
    await expect(amberSegments).toHaveCount(1);
    const validSegments = c.locator('.bg-accent\\/20');
    await expect(validSegments).toHaveCount(2);
  });

  test('expanded card shows broken field key and allows removal', async ({ page }) => {
    await expandCard(page, 'p-contact');
    const c = card(page, 'p-contact');

    // The broken field shows its raw key (appears in both grid and list)
    await expect(c.getByText('old_field').first()).toBeVisible();

    // Interactive grid has an amber segment
    const amberButton = c.locator('.grid-cols-12.gap-1 .bg-amber-100\\/50');
    await expect(amberButton).toBeVisible();

    // Click it to select, then remove
    await amberButton.click();
    const removeBtn = c.locator('[aria-label="remove segment"]');
    await expect(removeBtn).toBeVisible();
    await removeBtn.click();

    // Only 2 segments remain
    const remaining = c.getByRole('button', { name: 'grid segment' });
    await expect(remaining).toHaveCount(2);
  });
});
