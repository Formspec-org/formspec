import { test, expect } from '@playwright/test';

const TOOLS_URL = 'http://localhost:8082/tools.html';

test.describe('Tools Dashboard: Page Load & Tab Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(TOOLS_URL);
  });

  test('page loads with header and back link', async ({ page }) => {
    await expect(page.locator('.site-header h1')).toHaveText('Form Intelligence Dashboard');
    const backLink = page.locator('a[href="index.html"]');
    await expect(backLink).toBeVisible();
    await expect(backLink).toHaveText(/Back to Examples/);
  });

  test('all 5 tabs are visible', async ({ page }) => {
    const tabs = page.locator('.tools-tab');
    await expect(tabs).toHaveCount(5);
    await expect(tabs.nth(0)).toHaveText(/Expression Tester/);
    await expect(tabs.nth(1)).toHaveText(/Download & Export/);
    await expect(tabs.nth(2)).toHaveText(/Version Comparison/);
    await expect(tabs.nth(3)).toHaveText(/Extensions/);
    await expect(tabs.nth(4)).toHaveText(/Field Relationships/);
  });

  test('first tab is active by default', async ({ page }) => {
    const firstTab = page.locator('.tools-tab').first();
    await expect(firstTab).toHaveClass(/active/);
    const firstPanel = page.locator('.tools-panel').first();
    await expect(firstPanel).toBeVisible();
  });

  test('clicking a tab switches content', async ({ page }) => {
    const tabs = page.locator('.tools-tab');
    const panels = page.locator('.tools-panel');

    // Click "Download & Export" (second tab)
    await tabs.nth(1).click();
    await expect(tabs.nth(1)).toHaveClass(/active/);
    await expect(tabs.nth(0)).not.toHaveClass(/active/);
    await expect(panels.nth(1)).toBeVisible();
    await expect(panels.nth(0)).toBeHidden();

    // Click "Extensions" (fourth tab)
    await tabs.nth(3).click();
    await expect(tabs.nth(3)).toHaveClass(/active/);
    await expect(panels.nth(3)).toBeVisible();
    await expect(panels.nth(1)).toBeHidden();
  });
});
