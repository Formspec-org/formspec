import { test, expect } from '@playwright/test';
import { addFromPalette, editorFieldRows, importDefinition, switchTab, waitForApp } from './helpers';

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
    await importDefinition(page, { $formspec: '1.0', url: 'urn:test', items: [] });
    await expect(page.locator('[data-testid="status-bar"]')).toContainText('0 fields');
  });

  test('Import dialog opens and shows Definition selected by default', async ({ page }) => {
    await page.click('button[aria-label="Account menu"]');
    await page.click('[data-testid="import-btn"]');
    await expect(page.locator('[data-testid="import-dialog"]')).toBeVisible();

    const definitionBtn = page.locator('[data-testid="import-dialog"]').getByRole('button', { name: 'Definition' });
    await expect(definitionBtn).toHaveClass(/bg-accent/);
  });

  test('import a definition via dialog', async ({ page }) => {
    await page.click('button[aria-label="Account menu"]');
    await page.click('[data-testid="import-btn"]');
    await page.waitForSelector('[data-testid="import-dialog"]');

    const dialog = page.locator('[data-testid="import-dialog"]');
    await expect(dialog.getByRole('button', { name: 'Definition' })).toHaveClass(/bg-accent/);
    await dialog.locator('textarea').fill(IMPORT_DEFINITION);
    await dialog.getByRole('button', { name: 'Load' }).click();

    await expect(page.locator('[data-testid="import-dialog"]')).not.toBeVisible();

    const canvas = page.locator('[data-testid="workspace-Editor"]');
    await expect(canvas.locator('[data-testid="field-name"]')).toBeVisible();
    await expect(canvas.locator('[data-testid="field-age"]')).toBeVisible();
    await switchTab(page, 'Layout');
    const layout = page.locator('[data-testid="workspace-Layout"]');
    await expect(layout.locator('[data-testid="layout-display-notes"]')).toBeVisible();

    await switchTab(page, 'Editor');
    // Switch to Manage view to verify logic content imported
    await page.getByRole('radio', { name: 'Manage' }).click();
    const workspace = page.locator('[data-testid="workspace-Editor"]');
    await expect(workspace).toContainText('name');
    await expect(workspace).toContainText('ageValid');

    const statusBar = page.locator('[data-testid="status-bar"]');
    await expect(statusBar).toContainText('2 fields');
    await expect(statusBar).toContainText('1 bind');
    await expect(statusBar).toContainText('1 shape');
  });

  test('cancel closes dialog without changes', async ({ page }) => {
    await page.click('button[aria-label="Account menu"]');
    await page.click('[data-testid="import-btn"]');
    await page.waitForSelector('[data-testid="import-dialog"]');

    await page.locator('[data-testid="import-dialog"]').getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('[data-testid="import-dialog"]')).not.toBeVisible();
    await expect(editorFieldRows(page)).toHaveCount(0);
  });

  test('Escape closes the import dialog', async ({ page }) => {
    await page.click('button[aria-label="Account menu"]');
    await page.click('[data-testid="import-btn"]');
    await page.waitForSelector('[data-testid="import-dialog"]');

    await page.keyboard.press('Escape');

    await expect(page.locator('[data-testid="import-dialog"]')).not.toBeVisible();
  });

  test('import does not clear undo history (bug #18)', async ({ page }) => {
    await addFromPalette(page, 'Text');
    await expect(editorFieldRows(page)).toHaveCount(1);
    await expect(page.locator('[data-testid="undo-btn"]')).not.toBeDisabled();

    await page.click('button[aria-label="Account menu"]');
    await page.click('[data-testid="import-btn"]');
    const dialog = page.locator('[data-testid="import-dialog"]');
    await dialog.locator('textarea').fill(IMPORT_DEFINITION);
    await dialog.getByRole('button', { name: 'Load' }).click();
    await expect(page.locator('[data-testid="import-dialog"]')).not.toBeVisible();

    await expect(page.locator('[data-testid="undo-btn"]')).not.toBeDisabled();

    await page.click('[data-testid="undo-btn"]');
    await expect(editorFieldRows(page)).toHaveCount(1);
  });

  test('reopening the import dialog resets previous text and artifact type', async ({ page }) => {
    await page.click('button[aria-label="Account menu"]');
    await page.click('[data-testid="import-btn"]');
    const dialog = page.locator('[data-testid="import-dialog"]');
    await dialog.getByRole('button', { name: 'Mapping' }).click();
    await dialog.locator('textarea').fill('{"stale": true}');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('[data-testid="import-dialog"]')).not.toBeVisible();

    await page.click('button[aria-label="Account menu"]');
    await page.click('[data-testid="import-btn"]');
    const reopened = page.locator('[data-testid="import-dialog"]');
    await expect(reopened.getByRole('button', { name: 'Definition' })).toHaveClass(/bg-accent/);
    await expect(reopened.locator('textarea')).toHaveValue('');
  });
});
