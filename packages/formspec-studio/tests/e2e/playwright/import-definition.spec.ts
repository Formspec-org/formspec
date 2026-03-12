import { test, expect } from '@playwright/test';
import { waitForApp, switchTab, seedDefinition, dispatch } from './helpers';

const IMPORT_DEFINITION = JSON.stringify({
  $formspec: '1.0',
  url: 'urn:formspec:e2e-test',
  version: '1.0.0',
  title: 'E2E Test Form',
  items: [
    { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
    { key: 'age', type: 'field', dataType: 'integer', label: 'Age' },
    { key: 'notes', type: 'display', label: 'Please review carefully' },
  ],
  binds: { name: { required: 'true' } },
  shapes: [{ name: 'ageValid', severity: 'error', constraint: '$age >= 0' }],
});

test.describe('Import Definition', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    // Clear the definition to have a clean slate for import tests
    await seedDefinition(page, { $formspec: '1.0', url: 'urn:test', items: [] });
  });

  test('Import dialog opens and shows Definition selected by default', async ({ page }) => {
    // Click the Import button in the Header
    await page.click('[data-testid="import-btn"]');

    // Import dialog should be visible
    await expect(page.locator('[data-testid="import-dialog"]')).toBeVisible();

    // "Definition" should be the selected artifact type (has accent styling)
    const definitionBtn = page.locator('[data-testid="import-dialog"]').getByRole('button', { name: 'Definition' });
    await expect(definitionBtn).toHaveClass(/bg-accent/);
  });

  test('import a definition via dialog', async ({ page }) => {
    // Click the Import button
    await page.click('[data-testid="import-btn"]');
    await page.waitForSelector('[data-testid="import-dialog"]');

    // Ensure "Definition" is selected (default)
    const dialog = page.locator('[data-testid="import-dialog"]');
    await expect(dialog.getByRole('button', { name: 'Definition' })).toHaveClass(/bg-accent/);

    // Paste JSON into the textarea
    await dialog.locator('textarea').fill(IMPORT_DEFINITION);

    // Click the Load button
    await dialog.getByRole('button', { name: 'Load' }).click();

    // Dialog should close
    await expect(page.locator('[data-testid="import-dialog"]')).not.toBeVisible();

    // Editor should show 3 blocks: field-name, field-age, display-notes
    const canvas = page.locator('[data-testid="workspace-Editor"]');
    await expect(canvas.locator('[data-testid="field-name"]')).toBeVisible();
    await expect(canvas.locator('[data-testid="field-age"]')).toBeVisible();
    await expect(canvas.locator('[data-testid="display-notes"]')).toBeVisible();

    // Switch to Logic tab
    await switchTab(page, 'Logic');

    // Bind for "name" should be visible
    await expect(page.locator('[data-testid="workspace-Logic"]')).toContainText('name');

    // Shape "ageValid" should be visible
    await expect(page.locator('[data-testid="workspace-Logic"]')).toContainText('ageValid');

    // StatusBar should show correct counts
    const statusBar = page.locator('[data-testid="status-bar"]');
    await expect(statusBar).toContainText('2 fields');
    await expect(statusBar).toContainText('1 bind');
    await expect(statusBar).toContainText('1 shape');
  });

  test('cancel closes dialog without changes', async ({ page }) => {
    // Click Import
    await page.click('[data-testid="import-btn"]');
    await page.waitForSelector('[data-testid="import-dialog"]');

    // Click Cancel
    await page.locator('[data-testid="import-dialog"]').getByRole('button', { name: 'Cancel' }).click();

    // Dialog should close
    await expect(page.locator('[data-testid="import-dialog"]')).not.toBeVisible();

    // Canvas should still be empty (no fields imported)
    await expect(page.locator('[data-testid="workspace-Editor"]').locator('[data-testid^="field-"]')).toHaveCount(0);
  });

  test('Escape closes the import dialog', async ({ page }) => {
    await page.click('[data-testid="import-btn"]');
    await page.waitForSelector('[data-testid="import-dialog"]');

    await page.keyboard.press('Escape');

    await expect(page.locator('[data-testid="import-dialog"]')).not.toBeVisible();
  });

  test('import does not clear undo history (bug #18)', async ({ page }) => {
    // Add a field so there is at least one undoable action in the history
    await dispatch(page, {
      type: 'definition.addItem',
      payload: { key: 'preImportField', type: 'field', dataType: 'string' },
    });
    await page.waitForSelector('[data-testid="field-preImportField"]', { timeout: 5000 });

    // Undo button must be enabled before the import
    await expect(page.locator('[data-testid="undo-btn"]')).not.toBeDisabled();

    // Open the import dialog and load a new definition
    await page.click('[data-testid="import-btn"]');
    const dialog = page.locator('[data-testid="import-dialog"]');
    await dialog.locator('textarea').fill(IMPORT_DEFINITION);
    await dialog.getByRole('button', { name: 'Load' }).click();
    await expect(page.locator('[data-testid="import-dialog"]')).not.toBeVisible();

    // Bug #18: after importing, undo history is cleared so the undo button becomes disabled.
    // The correct behaviour is that the import itself is undoable (or at minimum that
    // a confirmation prevents silent history loss). Assert that undo is still available.
    await expect(page.locator('[data-testid="undo-btn"]')).not.toBeDisabled();
  });

  test('reopening the import dialog resets previous text and artifact type', async ({ page }) => {
    await page.click('[data-testid="import-btn"]');
    const dialog = page.locator('[data-testid="import-dialog"]');
    await dialog.getByRole('button', { name: 'Mapping' }).click();
    await dialog.locator('textarea').fill('{"stale": true}');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('[data-testid="import-dialog"]')).not.toBeVisible();

    await page.click('[data-testid="import-btn"]');
    const reopened = page.locator('[data-testid="import-dialog"]');
    await expect(reopened.getByRole('button', { name: 'Definition' })).toHaveClass(/bg-accent/);
    await expect(reopened.locator('textarea')).toHaveValue('');
  });
});
