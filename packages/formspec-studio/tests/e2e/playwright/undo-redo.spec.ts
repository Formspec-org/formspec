import { test, expect } from '@playwright/test';
import { waitForApp, dispatch, seedDefinition } from './helpers';

test.describe('Undo / Redo', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
  });

  // Helper: add a field via dispatch and wait for its block to appear.
  async function addField(page: any, key: string) {
    await dispatch(page, {
      type: 'definition.addItem',
      payload: { key, type: 'field', dataType: 'string' },
    });
    await page.waitForSelector(`[data-testid="field-${key}"]`, { timeout: 5000 });
  }

  test('Undo button removes last added field', async ({ page }) => {
    await addField(page, 'testField');

    // Field block should be visible
    await expect(page.locator('[data-testid="field-testField"]')).toBeVisible();

    // Click Undo
    await page.click('[data-testid="undo-btn"]');

    // Field should be gone
    await expect(page.locator('[data-testid="field-testField"]')).not.toBeVisible();

    // Undo button should now be disabled (nothing left to undo)
    await expect(page.locator('[data-testid="undo-btn"]')).toBeDisabled();
  });

  test('Redo button re-applies the undone change', async ({ page }) => {
    await addField(page, 'testField');

    // Undo it
    await page.click('[data-testid="undo-btn"]');
    await expect(page.locator('[data-testid="field-testField"]')).not.toBeVisible();

    // Redo it
    await page.click('[data-testid="redo-btn"]');

    // Field should be back
    await expect(page.locator('[data-testid="field-testField"]')).toBeVisible();
  });

  test('keyboard Cmd+Z undoes last change', async ({ page }) => {
    await addField(page, 'kbField');

    // Press Cmd+Z
    await page.keyboard.press('Meta+z');

    await expect(page.locator('[data-testid="field-kbField"]')).not.toBeVisible();
  });

  test('keyboard Cmd+Shift+Z redoes the undone change', async ({ page }) => {
    await addField(page, 'kbRedoField');

    // Undo via keyboard
    await page.keyboard.press('Meta+z');
    await expect(page.locator('[data-testid="field-kbRedoField"]')).not.toBeVisible();

    // Redo via keyboard
    await page.keyboard.press('Meta+Shift+z');
    await expect(page.locator('[data-testid="field-kbRedoField"]')).toBeVisible();
  });

  test('multiple undo steps walk back through history', async ({ page }) => {
    await addField(page, 'fieldA');
    await addField(page, 'fieldB');
    await addField(page, 'fieldC');

    // All three should be visible
    await expect(page.locator('[data-testid="field-fieldA"]')).toBeVisible();
    await expect(page.locator('[data-testid="field-fieldB"]')).toBeVisible();
    await expect(page.locator('[data-testid="field-fieldC"]')).toBeVisible();

    // Undo fieldC
    await page.keyboard.press('Meta+z');
    await expect(page.locator('[data-testid="field-fieldC"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="field-fieldA"]')).toBeVisible();
    await expect(page.locator('[data-testid="field-fieldB"]')).toBeVisible();

    // Undo fieldB
    await page.keyboard.press('Meta+z');
    await expect(page.locator('[data-testid="field-fieldB"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="field-fieldA"]')).toBeVisible();

    // Undo fieldA
    await page.keyboard.press('Meta+z');
    await expect(page.locator('[data-testid="field-fieldA"]')).not.toBeVisible();

    // Redo once — fieldA comes back
    await page.keyboard.press('Meta+Shift+z');
    await expect(page.locator('[data-testid="field-fieldA"]')).toBeVisible();
    await expect(page.locator('[data-testid="field-fieldB"]')).not.toBeVisible();
  });
});
