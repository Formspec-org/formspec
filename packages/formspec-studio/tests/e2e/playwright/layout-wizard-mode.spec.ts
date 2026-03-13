import { test, expect } from '@playwright/test';
import { addFromPalette, importDefinition, waitForApp } from './helpers';

const WIZARD_SEED = {
  $formspec: '1.0',
  url: 'urn:wizard-layout',
  version: '1.0.0',
  formPresentation: { pageMode: 'wizard' },
  items: [
    {
      key: 'page1',
      type: 'group',
      label: 'Page One',
      children: [
        { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
        { key: 'email', type: 'field', dataType: 'string', label: 'Email' },
      ],
    },
  ],
};

test.describe('Layout Components in Wizard Mode', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, WIZARD_SEED);
    await page.waitForSelector('[data-testid="field-name"]', { timeout: 5000 });
  });

  test('adding a Card in wizard mode preserves page fields', async ({ page }) => {
    await addFromPalette(page, 'Card');

    // Card appears on canvas
    await expect(page.locator('[data-item-type="layout"]')).toHaveCount(1);

    // Page fields still visible
    await expect(page.locator('[data-testid="field-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="field-email"]')).toBeVisible();
  });

  test('wrapping a field in Card via context menu keeps it visible in wizard mode', async ({ page }) => {
    // Right-click the name field and wrap it
    await page.click('[data-testid="field-name"]', { button: 'right' });
    await page.click('[data-testid="ctx-wrapInCard"]');

    // Card created
    const layoutBlock = page.locator('[data-item-type="layout"]');
    await expect(layoutBlock).toHaveCount(1);

    // The wrapped field is still visible inside the Card
    await expect(page.locator('[data-testid="field-name"]')).toBeVisible();
    // Other field also still visible
    await expect(page.locator('[data-testid="field-email"]')).toBeVisible();
  });

  test('wrap and unwrap preserves field in wizard mode', async ({ page }) => {
    // Wrap
    await page.click('[data-testid="field-name"]', { button: 'right' });
    await page.click('[data-testid="ctx-wrapInCard"]');
    await expect(page.locator('[data-item-type="layout"]')).toHaveCount(1);

    // Unwrap via properties panel (wrapper is auto-selected after wrap)
    const properties = page.locator('[data-testid="properties"]');
    await properties.locator('button:has-text("Unwrap")').click();

    // Card removed, field preserved
    await expect(page.locator('[data-item-type="layout"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="field-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="field-email"]')).toBeVisible();
  });

  test('adding a new field after wrapping preserves the Card in wizard mode', async ({ page }) => {
    // Wrap name field
    await page.click('[data-testid="field-name"]', { button: 'right' });
    await page.click('[data-testid="ctx-wrapInCard"]');

    // Add a new Integer field
    await addFromPalette(page, 'Integer');

    // Card still exists with wrapped field inside
    const layoutBlock = page.locator('[data-item-type="layout"]');
    await expect(layoutBlock).toHaveCount(1);
    await expect(page.locator('[data-testid="field-name"]')).toBeVisible();
  });

  test('multiple layout types can coexist in wizard mode', async ({ page }) => {
    await addFromPalette(page, 'Card');
    await expect(page.locator('[data-item-type="layout"]')).toHaveCount(1);

    await addFromPalette(page, 'Stack');
    await expect(page.locator('[data-item-type="layout"]')).toHaveCount(2);

    // Fields still visible
    await expect(page.locator('[data-testid="field-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="field-email"]')).toBeVisible();
  });
});
