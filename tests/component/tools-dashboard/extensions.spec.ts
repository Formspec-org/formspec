import { test, expect } from '@playwright/test';

const TOOLS_URL = 'http://localhost:8082/tools.html';

const MOCK_ENTRIES = [
  { name: 'x-grants-gov-ssn', category: 'dataType', version: '1.0.0', status: 'stable', description: 'SSN with formatting.' },
  { name: 'x-grants-gov-duns', category: 'dataType', version: '1.0.0', status: 'stable', description: 'DUNS number.' },
  { name: 'x-grants-fiscal-year', category: 'function', version: '0.9.0', status: 'draft', description: 'Fiscal year calculation.' },
];

test.describe('Extensions Tab', () => {
  test.beforeEach(async ({ page }) => {
    // Mock /registry with optional query params
    await page.route('**/registry?**', async (route) => {
      const url = new URL(route.request().url());
      const cat = url.searchParams.get('category');
      const stat = url.searchParams.get('status');
      let filtered = MOCK_ENTRIES;
      if (cat) filtered = filtered.filter((e) => e.category === cat);
      if (stat) filtered = filtered.filter((e) => e.status === stat);
      await route.fulfill({ json: { entries: filtered } });
    });
    await page.route(/\/registry$/, (route) =>
      route.fulfill({ json: { entries: MOCK_ENTRIES } })
    );

    await page.goto(TOOLS_URL);
    await page.locator('.tools-tab[data-tab="registry"]').click();
  });

  test('auto-loads and displays extension cards', async ({ page }) => {
    await expect(page.locator('.registry-card')).toHaveCount(3);
    await expect(page.locator('.registry-card h4').first()).toHaveText('x-grants-gov-ssn');
  });

  test('shows status and category badges on cards', async ({ page }) => {
    const firstCard = page.locator('.registry-card').first();
    await expect(firstCard.locator('.badge')).toHaveCount(2); // status + category
    await expect(firstCard.locator('.badge').first()).toContainText('stable');
  });

  test('filter by category shows only matching entries', async ({ page }) => {
    await page.locator('#registry-category').selectOption('function');
    await page.click('#btn-registry-filter');
    await expect(page.locator('.registry-card')).toHaveCount(1);
    await expect(page.locator('.registry-card h4').first()).toHaveText('x-grants-fiscal-year');
  });
});
