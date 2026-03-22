import { test, expect } from '@playwright/test';

const TOOLS_URL = 'http://localhost:8082/tools.html';

async function gotoRegistryTab(page: import('@playwright/test').Page) {
  await page.goto(TOOLS_URL);
  await page.waitForSelector('html[data-formspec-wasm-ready="1"]', { timeout: 30_000 });
  await page.locator('.tools-tab[data-tab="registry"]').click();
}

test.describe('Extensions Tab', () => {
  test.beforeEach(async ({ page }) => {
    await gotoRegistryTab(page);
  });

  test('auto-loads and displays extension cards', async ({ page }) => {
    await expect(page.locator('.registry-card').first()).toBeVisible({ timeout: 15_000 });
    const count = await page.locator('.registry-card').count();
    expect(count).toBeGreaterThan(5);
  });

  test('shows status and category badges on cards', async ({ page }) => {
    const firstCard = page.locator('.registry-card').first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });
    await expect(firstCard.locator('.badge')).toHaveCount(2);
  });

  test('filter by category shows only matching entries', async ({ page }) => {
    await expect(page.locator('.registry-card').first()).toBeVisible({ timeout: 15_000 });
    const fullCount = await page.locator('.registry-card').count();
    expect(fullCount).toBeGreaterThan(10);

    await page.evaluate(() => {
      const sel = document.getElementById('registry-category');
      if (sel) sel.value = 'function';
      document.getElementById('btn-registry-filter')?.click();
    });

    await expect(page.locator('.registry-card')).toHaveCount(2, { timeout: 10_000 });
    await expect(page.locator('.registry-card').first().locator('.registry-meta')).toContainText('function');
  });
});
