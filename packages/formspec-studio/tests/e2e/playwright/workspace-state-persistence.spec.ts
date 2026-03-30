import { test, expect } from '@playwright/test';
import { waitForApp, switchTab, importDefinition } from './helpers';

const SEED_DEFINITION = {
  $formspec: '1.0',
  url: 'urn:workspace-persistence',
  version: '1.0.0',
  items: [
    { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
  ],
};

test.describe('Workspace state persistence', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, SEED_DEFINITION);
    await page.waitForSelector('[data-testid="field-name"]');
  });

  test('Delete from the Layout workspace does not remove the editor selection', async ({ page }) => {
    await page.click('[data-testid="field-name"]');
    await switchTab(page, 'Layout');

    await page.keyboard.press('Delete');

    await switchTab(page, 'Editor');
    await expect(page.locator('[data-testid="field-name"]')).toBeVisible();
  });

  test('Editor Manage view persists after switching away and back', async ({ page }) => {
    // Switch to Manage view
    await page.getByRole('radio', { name: 'Manage' }).click();
    await expect(page.getByTestId('manage-section-variables')).toBeVisible();

    // Navigate away to Layout
    await switchTab(page, 'Layout');
    // Navigate back to Editor
    await switchTab(page, 'Editor');

    // Manage view should still be active
    await expect(page.getByRole('radio', { name: 'Manage' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('manage-section-variables')).toBeVisible();
  });
});
