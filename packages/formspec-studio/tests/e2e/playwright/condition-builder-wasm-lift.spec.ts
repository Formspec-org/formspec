/** @filedesc E2E: multi-clause relevant bind opens guided ConditionBuilder (WASM-backed parseFELToGroup). */
import { test, expect } from '@playwright/test';
import { importDefinition, waitForApp } from './helpers';

const DEFINITION_WITH_AND_RELEVANT = {
  $formspec: '1.0',
  url: 'urn:e2e-condition-lift',
  version: '1.0.0',
  items: [
    { key: 'minAge', type: 'field', dataType: 'integer', label: 'Minimum age' },
    { key: 'status', type: 'field', dataType: 'string', label: 'Status' },
  ],
  binds: {
    minAge: {
      relevant: "$minAge >= 18 and $status = 'ok'",
    },
  },
};

const DEFINITION_WITH_OR_RELEVANT = {
  $formspec: '1.0',
  url: 'urn:e2e-condition-lift-or',
  version: '1.0.0',
  items: [
    { key: 'a', type: 'field', dataType: 'integer', label: 'A' },
    { key: 'b', type: 'field', dataType: 'integer', label: 'B' },
  ],
  binds: {
    a: {
      relevant: '$a > 0 or $b > 0',
    },
  },
};

test.describe('Condition builder — WASM lift of AND chain', () => {
  test('guided editor shows two field rows for a lifted multi-clause relevant bind', async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, DEFINITION_WITH_AND_RELEVANT);

    await page.locator('[data-testid="field-minAge"]').click();
    await page.getByTestId('field-minAge-category-Visibility').click();

    const preview = page.getByTestId('condition-builder-preview');
    await expect(preview).toBeVisible();
    await preview.click();

    const builder = page.getByTestId('condition-builder');
    await expect(builder).toBeVisible();

    const fieldSelects = builder.locator('select[aria-label="Field"]');
    await expect(fieldSelects).toHaveCount(2);
    await expect(fieldSelects.nth(0)).toHaveValue('minAge');
    await expect(fieldSelects.nth(1)).toHaveValue('status');

    await expect(builder.getByRole('button', { name: /Switch to any match/i })).toBeVisible();
  });

  test('guided editor shows OR logic for a lifted or-chain relevant bind', async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, DEFINITION_WITH_OR_RELEVANT);

    await page.locator('[data-testid="field-a"]').click();
    await page.getByTestId('field-a-category-Visibility').click();

    const preview = page.getByTestId('condition-builder-preview');
    await expect(preview).toBeVisible();
    await preview.click();

    const builder = page.getByTestId('condition-builder');
    await expect(builder).toBeVisible();

    const fieldSelects = builder.locator('select[aria-label="Field"]');
    await expect(fieldSelects).toHaveCount(2);
    await expect(fieldSelects.nth(0)).toHaveValue('a');
    await expect(fieldSelects.nth(1)).toHaveValue('b');

    await expect(builder.getByRole('button', { name: /Switch to all match/i })).toBeVisible();
  });
});
