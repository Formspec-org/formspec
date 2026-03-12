import { test, expect } from '@playwright/test';
import { waitForApp, switchTab, seedDefinition } from './helpers';

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
    await seedDefinition(page, SEED_DEFINITION);
    await page.waitForSelector('[data-testid="field-name"]');
  });

  test('Delete from the Data workspace does not remove the editor selection', async ({ page }) => {
    await page.click('[data-testid="field-name"]');
    await switchTab(page, 'Data');

    await page.keyboard.press('Delete');

    await switchTab(page, 'Editor');
    await expect(page.locator('[data-testid="field-name"]')).toBeVisible();
  });

  test('Data workspace keeps the active sub-tab after switching away and back', async ({ page }) => {
    await switchTab(page, 'Data');
    const dataWorkspace = page.locator('[data-testid="workspace-Data"]');
    await dataWorkspace.getByRole('button', { name: 'Option Sets' }).click();
    await expect(dataWorkspace).toContainText(/option set|no option sets/i);

    await switchTab(page, 'Logic');
    await switchTab(page, 'Data');

    await expect(page.locator('[data-testid="workspace-Data"]').getByRole('button', { name: 'Option Sets' })).toHaveClass(/border-b-2|text-accent/);
  });
});
