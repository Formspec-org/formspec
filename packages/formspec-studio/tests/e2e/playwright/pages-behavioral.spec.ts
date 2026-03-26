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

/** Two pages: first has content, second is empty (deletable). */
const TWO_PAGE_WITH_EMPTY = {
  definition: {
    $formspec: '1.0',
    url: 'urn:two-one-empty',
    version: '1.0.0',
    title: 'Delete Page Test',
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
    ],
  },
  theme: {
    pages: [
      { id: 'p-personal', title: 'Personal Info', regions: [{ key: 'personal', span: 12 }] },
      { id: 'p-extra', title: 'Extra', regions: [] },
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
  page.locator('[data-testid="workspace-Layout"]');

const card = (page: import('@playwright/test').Page, id: string) =>
  page.locator(`[data-testid="page-card-${id}"]`);

/** Page cards no longer use accordion collapse — wait for the inline grid canvas. */
async function expandCard(page: import('@playwright/test').Page, cardId: string) {
  await card(page, cardId).locator('[data-grid-canvas]').waitFor({ timeout: 5000 });
}

// ── Story 1: Unassigned field shows on Pages tab ────────────────────

test.describe('Story 1: Unassigned field appears on Pages tab', () => {
  test('a top-level field not placed on any page shows in Unassigned', async ({ page }) => {
    await waitForApp(page);
    await importProject(page, WIZARD_WITH_UNASSIGNED);
    await switchTab(page, 'Layout');

    // "Phone Number" is a top-level field not on any page
    const workspace = ws(page);
    await expect(workspace.getByRole('region', { name: /unassigned items/i })).toBeVisible({
      timeout: 3000,
    });
    // Unassigned row label; avoid strict-mode clash with "+ Phone Number" quick-add chip.
    await expect(workspace.getByText('Phone Number', { exact: true }).first()).toBeVisible();
  });
});

// ── Story 2: Two fields side by side (width layout) ─────────────────

test.describe('Story 2: Grid preview shows different widths', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await importProject(page, WIDTH_LAYOUT_SEED);
    await switchTab(page, 'Layout');
  });

  test('page card shows three grid segments for three regions', async ({ page }) => {
    const c = card(page, 'p-layout');
    await expect(c).toBeVisible();
    await expect(c.locator('[data-grid-item]')).toHaveCount(3);
  });

  test('expanded card lists fields with width summaries', async ({ page }) => {
    await expandCard(page, 'p-layout');
    const c = card(page, 'p-layout');

    await expect(c.getByText('Field A').first()).toBeVisible();
    await expect(c.getByText('Field B').first()).toBeVisible();
    await expect(c.getByText('Field C').first()).toBeVisible();
    await expect(c.getByText('12/12').first()).toBeVisible();
    await expect(c.getByText('6/12').first()).toBeVisible();
  });
});

// ── Story 3: Deleting a page removes the card and its group ─────────

test.describe('Story 3: Deleting a page', () => {
  test('deleting a page removes the card and reduces page count', async ({ page }) => {
    await waitForApp(page);
    await importProject(page, TWO_PAGE_WITH_EMPTY);
    await switchTab(page, 'Layout');

    const workspace = ws(page);
    await expect(card(page, 'p-personal')).toBeVisible();
    await expect(card(page, 'p-extra')).toBeVisible();
    await expect(workspace.locator('[data-testid^="page-card-"]')).toHaveCount(2);

    await expandCard(page, 'p-extra');
    const extra = card(page, 'p-extra');
    await extra.getByRole('button', { name: /delete page/i }).click();
    await extra.getByRole('button', { name: /confirm delete/i }).click();

    await expect(card(page, 'p-extra')).not.toBeVisible({ timeout: 2000 });
    await expect(workspace.locator('[data-testid^="page-card-"]')).toHaveCount(1);
  });
});

// ── Story 4: Switching modes — Wizard to Single (pages go dormant) ──

test.describe('Story 4: Mode switching', () => {
  test('switching to Single shows dormant pages, switching back restores', async ({ page }) => {
    await waitForApp(page);
    await importProject(page, TWO_PAGE_WIZARD);
    await switchTab(page, 'Layout');

    const workspace = ws(page);
    await expect(card(page, 'p-personal')).toBeVisible();

    // Switch to Single — pages go dormant
    await workspace.getByRole('button', { name: 'Single' }).click();
    await expect(workspace.getByText(/2 pages preserved/i)).toBeVisible({ timeout: 3000 });

    // Switch back to Wizard — pages active again
    await workspace.getByRole('button', { name: 'Wizard' }).click();
    await expect(card(page, 'p-personal')).toBeVisible({ timeout: 3000 });
    await expect(workspace.getByText(/pages? preserved/i)).not.toBeVisible();
  });
});

// ── Story 5: Sidebar ↔ Pages tab sync ────────────────────────────────

test.describe('Story 5: Sidebar and Pages tab expand sync', () => {
  test('clicking a page entry in the sidebar expands its page card', async ({ page }) => {
    await waitForApp(page);
    await importProject(page, TWO_PAGE_WIZARD);
    await switchTab(page, 'Layout');

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
    await switchTab(page, 'Layout');
  });

  test('Focus Mode shows breakpoint bar (sm / md / lg)', async ({ page }) => {
    await expandCard(page, 'p-dash');
    await card(page, 'p-dash').getByRole('button', { name: /edit layout/i }).click();
    await page.getByLabel('Page title').waitFor();

    await expect(page.getByRole('button', { name: 'sm', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'md', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'lg', exact: true })).toBeVisible();
  });

  test('selecting a block at md breakpoint shows width toolbar', async ({ page }) => {
    await expandCard(page, 'p-dash');
    await card(page, 'p-dash').getByRole('button', { name: /edit layout/i }).click();
    await page.getByLabel('Page title').waitFor();

    await page.getByRole('button', { name: 'md', exact: true }).click();
    await page.locator('[data-grid-item]').first().locator('[role="button"]').click();
    const tb = page.locator('[data-testid="selection-toolbar"]');
    await expect(tb).toBeVisible();
    await expect(tb.getByRole('button', { name: 'Half' })).toBeVisible();
  });
});

// ── Story 7: Creating a new page ─────────────────────────────────────

test.describe('Story 7: Creating a new page', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await importProject(page, TWO_PAGE_WIZARD);
    await switchTab(page, 'Layout');
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
    await workspace.getByRole('button', { name: /add page/i }).first().click();
    // addPage seeds title "Page N" (see handleAddPage in PagesTab).
    const newCard = workspace.locator('[data-testid^="page-card-"]').last();
    await newCard.getByRole('button', { name: /Edit title: Page / }).click();

    // Fill the editable input
    const titleInput = newCard.locator('input[type="text"]').first();
    await titleInput.fill('Payment Details');
    await titleInput.press('Enter');

    await expect(newCard.getByText('Payment Details').first()).toBeVisible({ timeout: 2000 });
  });
});

// ── Story 8: Reordering wizard steps ─────────────────────────────────

test.describe('Story 8: Reordering pages with drag handle', () => {
  test('dragging first page card below second changes order', async ({ page }) => {
    test.skip(true, '@dnd-kit DOM sortable: Playwright dragTo does not reliably fire dnd-kit sensors');
    await waitForApp(page);
    await importProject(page, THREE_PAGE_WIZARD);
    await switchTab(page, 'Layout');

    const cards = ws(page).locator('[data-testid^="page-card-"]');
    await expect(cards).toHaveCount(3);

    const first = card(page, 'p1');
    const second = card(page, 'p2');
    await first.hover();
    const handle = first.locator('[data-testid="drag-handle"]');
    await handle.dragTo(second);

    const firstCardText = await cards.first().innerText();
    expect(firstCardText).toContain('Step 2');
  });
});

// ── Story 9: Switching from Wizard to Tabs ──────────────────────────

test.describe('Story 9: Wizard to Tabs mode switch', () => {
  test('switching to Tabs keeps page cards and changes preview layout', async ({ page }) => {
    await waitForApp(page);
    await importProject(page, TWO_PAGE_WIZARD);
    await switchTab(page, 'Layout');

    // Switch to Tabs
    await ws(page).getByRole('button', { name: 'Tabs' }).click();

    // Tab buttons visible for both pages (only active tab renders its panel)
    await expect(ws(page).getByRole('tab', { name: 'Personal Info' })).toBeVisible();
    await expect(ws(page).getByRole('tab', { name: 'Address' })).toBeVisible();
    await expect(card(page, 'p-personal')).toBeVisible();

    // Preview should render with tab navigation using theme page titles
    await switchTab(page, 'Preview');
    const preview = page.locator('[data-testid="workspace-Preview"]');
    const host = preview.locator('[data-testid="formspec-preview-host"]');
    const tabs = host.locator('[role="tab"]');
    await expect(tabs).toHaveCount(2, { timeout: 8000 });
    await expect(tabs.nth(0)).toContainText(/Personal Info/i);
    await expect(tabs.nth(1)).toContainText(/Address/i);
    // Tabs mode: no wizard Continue/Next in the live preview chrome
    await expect(preview.getByRole('button', { name: /continue|next/i }).first()).not.toBeVisible({ timeout: 1000 });
  });
});

// ── Story 10: Broken (amber) field on a page ────────────────────────

test.describe('Story 10: Broken field indicator', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await importProject(page, BROKEN_REGION_SEED);
    await switchTab(page, 'Layout');
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

    await expect(c.getByText('old_field').first()).toBeVisible();

    const brokenRow = c.locator('[data-grid-item]').filter({ hasText: 'old_field' });
    await brokenRow.locator('button[aria-label="remove"]').click({ force: true });

    await expect(c.getByText('old_field')).not.toBeVisible();
    await expect(c.getByText('Name').first()).toBeVisible();
    await expect(c.getByText('Email').first()).toBeVisible();
  });
});
