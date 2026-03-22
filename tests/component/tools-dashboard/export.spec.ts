import { test, expect } from '@playwright/test';

const TOOLS_URL = 'http://localhost:8082/tools.html';

test.describe('Download & Export Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(TOOLS_URL);
    await page.waitForSelector('html[data-formspec-wasm-ready="1"]', { timeout: 30_000 });
    await expect(page.locator('.export-card')).toHaveCount(3);
    await page.locator('.tools-tab[data-tab="export"]').click();
    await page.locator('#export-input-data').fill('{"orgName":"Community Health Partners"}');
  });

  test('shows three export format cards', async ({ page }) => {
    await expect(page.locator('.export-card')).toHaveCount(3);
    await expect(page.locator('.export-card h4').nth(0)).toHaveText('JSON');
    await expect(page.locator('.export-card h4').nth(1)).toHaveText('CSV');
    await expect(page.locator('.export-card h4').nth(2)).toHaveText('XML');
  });

  test('clicking JSON export runs mapping and shows output', async ({ page }) => {
    await page.locator('button[data-format="json"]').click();
    await expect(page.locator('#export-result')).toBeVisible();
    await expect(page.locator('#export-result-format')).toContainText('JSON');
    await expect(page.locator('#export-result-content')).not.toBeEmpty();
  });

  test('clicking CSV export runs mapping and shows output', async ({ page }) => {
    await page.locator('button[data-format="csv"]').click();
    await expect(page.locator('#export-result')).toBeVisible();
    await expect(page.locator('#export-result-format')).toContainText('CSV');
    await expect(page.locator('#export-result-content')).not.toBeEmpty();
  });

  test('clicking XML export runs mapping and shows output', async ({ page }) => {
    await page.locator('button[data-format="xml"]').click();
    await expect(page.locator('#export-result')).toBeVisible();
    await expect(page.locator('#export-result-format')).toContainText('XML');
    await expect(page.locator('#export-result-content')).not.toBeEmpty();
  });
});
