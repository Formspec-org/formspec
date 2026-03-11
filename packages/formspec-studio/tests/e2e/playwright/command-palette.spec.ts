import { test, expect } from '@playwright/test';
import { waitForApp, seedDefinition } from './helpers';

const SEED_DEFINITION = {
  $formspec: '1.0',
  items: [
    { key: 'firstName', type: 'field', dataType: 'string', label: 'First Name' },
    { key: 'lastName', type: 'field', dataType: 'string', label: 'Last Name' },
    { key: 'age', type: 'field', dataType: 'integer', label: 'Age' },
  ],
};

test.describe('Command Palette', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await seedDefinition(page, SEED_DEFINITION);
    await page.waitForSelector('[data-testid="field-firstName"]', { timeout: 5000 });
  });

  test('open and close with keyboard', async ({ page }) => {
    // Press Meta+k to open the palette
    await page.keyboard.press('Meta+k');

    // The command palette should be visible
    await expect(page.locator('[data-testid="command-palette"]')).toBeVisible();

    // Press Escape to close
    await page.keyboard.press('Escape');

    // The command palette should be gone
    await expect(page.locator('[data-testid="command-palette"]')).not.toBeVisible();
  });

  test('search filters field results', async ({ page }) => {
    // Open palette
    await page.keyboard.press('Meta+k');
    await page.waitForSelector('[data-testid="command-palette"]');

    // Type "first" in the search input
    await page.fill('[data-testid="command-palette"] input', 'first');

    // "firstName" should appear in results
    const results = page.locator('[data-testid="palette-result"]');
    await expect(results.filter({ hasText: 'firstName' })).toBeVisible();

    // "lastName" should not be visible (filtered out)
    await expect(results.filter({ hasText: 'lastName' })).not.toBeVisible();
  });

  test('click result selects item and closes palette', async ({ page }) => {
    // Open palette
    await page.keyboard.press('Meta+k');
    await page.waitForSelector('[data-testid="command-palette"]');

    // Type "firstName" to narrow results
    await page.fill('[data-testid="command-palette"] input', 'firstName');

    // Click the firstName result
    await page.locator('[data-testid="palette-result"]').filter({ hasText: 'firstName' }).click();

    // Palette should close
    await expect(page.locator('[data-testid="command-palette"]')).not.toBeVisible();

    // Properties panel should show "firstName" (item is selected)
    const properties = page.locator('[data-testid="properties"]');
    await expect(properties.locator('input[type="text"]').first()).toHaveValue('firstName');
  });
});
