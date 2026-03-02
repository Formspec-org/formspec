import { expect, test } from '@playwright/test';
import { gotoStudio } from './helpers';

test.describe('Formspec Studio - JSON and Diagnostics', () => {
  test.beforeEach(async ({ page }) => {
    await gotoStudio(page);
    await page.getByRole('button', { name: 'JSON' }).click();
    await expect(page.locator('.json-editor-textarea')).toBeVisible();
  });

  test('applies JSON edits and syncs back to guided tree', async ({ page }) => {
    const editor = page.locator('.json-editor-textarea');
    const current = await editor.inputValue();
    const updated = current.replace('Untitled Form', 'Grant Intake JSON');

    await editor.fill(updated);
    await page.getByRole('button', { name: 'Apply Changes' }).click();
    await expect(page.locator('.json-editor-status.applied')).toContainText('Applied');

    await page.getByRole('button', { name: 'Guided' }).click();
    await expect(page.locator('.tree-header-title')).toHaveText('Grant Intake JSON');
  });

  test('shows parse errors for invalid JSON', async ({ page }) => {
    await page.locator('.json-editor-textarea').fill('{');
    await page.getByRole('button', { name: 'Apply Changes' }).click();

    await expect(page.locator('.json-editor-status.error')).toContainText('Unexpected end of JSON input');
  });

  test('shows engine diagnostics when JSON applies but definition is invalid', async ({ page }) => {
    await page.locator('.json-editor-textarea').fill('{}');
    await page.getByRole('button', { name: 'Apply Changes' }).click();

    await page.getByRole('tab', { name: 'Diagnostics' }).click();
    await expect(page.locator('.diagnostics-badge')).toHaveText('1');
    await expect(page.locator('.diagnostics-row').first()).toContainText('Engine error:');
  });

  test('shows empty diagnostics state for valid definition', async ({ page }) => {
    await page.getByRole('tab', { name: 'Diagnostics' }).click();
    await expect(page.locator('.diagnostics-empty')).toContainText('No issues found');
  });
});
