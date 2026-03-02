import { expect, test } from '@playwright/test';
import { gotoStudio, propertyInput } from './helpers';

test.describe('Formspec Studio - Topbar and Sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await gotoStudio(page);
  });

  test('edits form title and updates topbar metadata from root properties', async ({ page }) => {
    const titleInput = page.getByLabel('Form title');
    await titleInput.fill('Grant Intake');
    await expect(titleInput).toHaveValue('Grant Intake');

    await page.locator('.tree-header').click();
    await propertyInput(page, 'Version').fill('2.1.0');
    await propertyInput(page, 'Status').selectOption('active');

    const meta = page.locator('.topbar-meta');
    await expect(meta).toContainText('v2.1.0');
    await expect(meta).toContainText('active');
  });

  test('shows import and export toasts', async ({ page }) => {
    await page.getByRole('button', { name: 'Import project' }).click();
    await expect(page.locator('.toast')).toContainText('Import flow is planned for Phase 2');

    await page.getByRole('button', { name: 'Export project' }).click();
    await expect(page.locator('.toast').first()).toContainText('Export flow is planned for Phase 2');
  });

  test('switches artifacts and renders empty-state tabs for unconfigured documents', async ({ page }) => {
    await page.locator('.sidebar-tab[title="Component"]').click();
    await expect(page.locator('.empty-tab-title')).toHaveText('Component not configured');

    await page.locator('.sidebar-tab[title="Theme"]').click();
    await expect(page.locator('.empty-tab-title')).toHaveText('Theme not configured');

    await page.locator('.sidebar-tab[title="Definition"]').click();
    await expect(page.locator('.tree-editor')).toBeVisible();
  });

  test('toggles between guided and JSON modes for definition', async ({ page }) => {
    await page.getByRole('button', { name: 'JSON' }).click();
    await expect(page.locator('.json-editor-textarea')).toBeVisible();

    await page.getByRole('button', { name: 'Guided' }).click();
    await expect(page.locator('.tree-editor')).toBeVisible();
  });
});
