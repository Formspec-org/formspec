import { test, expect } from '@playwright/test';
import { waitForApp, importDefinition, switchTab } from './helpers';

const TWO_FIELD_DEF = {
  $formspec: '1.0',
  url: 'urn:canvas-two',
  version: '1.0.0',
  items: [
    { key: 'firstName', type: 'field', dataType: 'string', label: 'First Name' },
    { key: 'lastName', type: 'field', dataType: 'string', label: 'Last Name' },
  ],
};

test.describe('Canvas Direct Manipulation', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, TWO_FIELD_DEF);
  });

  test('selecting a field in the editor shows selected styling', async ({ page }) => {
    const row = page.locator('[data-testid="field-firstName"]');
    await row.click();
    await expect(row).toHaveClass(/border-accent/);
  });

  test('Design workspace shows layout canvas after import', async ({ page }) => {
    await switchTab(page, 'Layout');
    await expect(page.locator('[data-testid="design-canvas-shell"]')).toBeVisible();
    await expect(page.locator('[data-testid="workspace-Layout"]')).toBeVisible();
  });

  test('switching back to Edit preserves field list', async ({ page }) => {
    await switchTab(page, 'Layout');
    await switchTab(page, 'Editor');
    await expect(page.locator('[data-testid="field-firstName"]')).toBeVisible();
    await expect(page.locator('[data-testid="field-lastName"]')).toBeVisible();
  });
});
