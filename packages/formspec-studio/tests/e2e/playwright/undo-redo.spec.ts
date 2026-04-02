import { test, expect } from '@playwright/test';
import { addFromPalette, editorFieldRows, importDefinition, waitForApp } from './helpers';

test.describe('Undo / Redo', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, { $formspec: '1.0', url: 'urn:test', items: [] });
    await expect(page.locator('[data-testid="status-bar"]')).toContainText('0 fields');
  });

  test('Undo button removes last added field', async ({ page }) => {
    const fields = editorFieldRows(page);

    await addFromPalette(page, 'Text');
    await expect(fields).toHaveCount(1);

    await page.click('[data-testid="undo-btn"]');
    await expect(fields).toHaveCount(0);
  });

  test('Redo button re-applies the undone change', async ({ page }) => {
    const fields = editorFieldRows(page);

    await addFromPalette(page, 'Text');
    await expect(fields).toHaveCount(1);

    await page.click('[data-testid="undo-btn"]');
    await expect(fields).toHaveCount(0);

    await page.click('[data-testid="redo-btn"]');
    await expect(fields).toHaveCount(1);
  });

  test('keyboard Cmd+Z undoes last change', async ({ page }) => {
    const fields = editorFieldRows(page);

    await addFromPalette(page, 'Text');
    await expect(fields).toHaveCount(1);

    await page.click('[data-testid="workspace-Editor"]', { position: { x: 10, y: 5 } });
    await page.keyboard.press('Meta+z');
    await expect(fields).toHaveCount(0);
  });

  test('keyboard Cmd+Shift+Z redoes the undone change', async ({ page }) => {
    const fields = editorFieldRows(page);

    await addFromPalette(page, 'Text');
    await expect(fields).toHaveCount(1);

    await page.click('[data-testid="workspace-Editor"]', { position: { x: 10, y: 5 } });
    await page.keyboard.press('Meta+z');
    await expect(fields).toHaveCount(0);

    await page.keyboard.press('Meta+Shift+z');
    await expect(fields).toHaveCount(1);
  });

  test('multiple undo steps walk back through history', async ({ page }) => {
    const fields = editorFieldRows(page);

    await addFromPalette(page, 'Text');
    await addFromPalette(page, 'Integer');
    await addFromPalette(page, 'Date');
    await expect(fields).toHaveCount(3);

    await page.click('[data-testid="workspace-Editor"]', { position: { x: 10, y: 5 } });
    await page.keyboard.press('Meta+z');
    await expect(fields).toHaveCount(2);

    await page.keyboard.press('Meta+z');
    await expect(fields).toHaveCount(1);

    await page.keyboard.press('Meta+z');
    await expect(fields).toHaveCount(0);

    await page.keyboard.press('Meta+Shift+z');
    await expect(fields).toHaveCount(1);
  });
});
