import { test, expect } from '@playwright/test';

const TOOLS_URL = 'http://localhost:8082/tools.html';

test.describe('Field Relationships Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(TOOLS_URL);
    await page.waitForSelector('html[data-formspec-wasm-ready="1"]', { timeout: 30_000 });
    await page.locator('.tools-tab[data-tab="dependencies"]').click();
  });

  test('loads dependency graph with SVG nodes', async ({ page }) => {
    await expect(page.locator('#deps-svg .graph-node').first()).toBeVisible({ timeout: 15_000 });
    const n = await page.locator('#deps-svg .graph-node').count();
    expect(n).toBeGreaterThan(10);
  });

  test('graph renders edges between nodes', async ({ page }) => {
    await expect(page.locator('#deps-svg .graph-node').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#deps-svg .edge').first()).toBeVisible({ timeout: 15_000 });
    const edgeCount = await page.locator('#deps-svg .edge').count();
    expect(edgeCount).toBeGreaterThan(0);
  });

  test('clicking a node shows detail panel', async ({ page }) => {
    await expect(page.locator('#deps-svg .graph-node').first()).toBeVisible({ timeout: 15_000 });

    await page.locator('#deps-svg .graph-node').first().click({ force: true });

    await expect(page.locator('#deps-detail-content')).toBeVisible();
    await expect(page.locator('#deps-detail-field')).not.toBeEmpty();
  });

  test('detail panel shows placeholder before clicking', async ({ page }) => {
    await expect(page.locator('#deps-placeholder')).toBeVisible();
    await expect(page.locator('#deps-placeholder')).toContainText('Click a node');
  });
});
