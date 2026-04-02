import { test, expect } from '@playwright/test';
import { importProject, switchTab, waitForApp } from './helpers';

/*
 * Editor/Layout workspace split:
 *
 * These tests tested layout operations (add Card, wrap/unwrap) in wizard mode
 * while on the Editor tab. The Editor is now a pure definition tree with no
 * layout awareness. Layout operations live in the Layout tab with different
 * selectors (layout-field-*, layout-container-*, layout-ctx-*).
 *
 * Rewrite these against the real Layout workspace affordances rather than the
 * old Editor-side layout model.
 */

const WIZARD_PROJECT = {
  definition: {
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
  },
  component: {
    $formspecComponent: '0.1',
    tree: {
      component: 'Form',
      children: [
        {
          component: 'Page',
          nodeId: 'page-one',
          title: 'Page One',
          _layout: true,
          children: [
            { component: 'TextInput', bind: 'name' },
            { component: 'TextInput', bind: 'email' },
          ],
        },
      ],
    },
  },
};

test.describe('Layout Components in Wizard Mode', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await importProject(page, WIZARD_PROJECT);
    await page.waitForSelector('[data-testid="field-name"]', { timeout: 5000 });
  });

  // The Editor tree shows all items flat — wizard mode fields are always visible
  test('wizard mode fields are visible in Editor tree without page filtering', async ({ page }) => {
    await expect(page.locator('[data-testid="field-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="field-email"]')).toBeVisible();
  });

  test('adding a Card in wizard mode preserves page fields', async ({ page }) => {
    await switchTab(page, 'Layout');
    await page.click('[data-testid="layout-add-card"]');

    await expect(page.locator('[data-testid^="layout-container-"]').filter({ hasText: 'Card' })).toHaveCount(1);
    await expect(page.locator('[data-testid="layout-container-page1"]')).toBeVisible();
  });

  test('wrapping a field in Card via context menu keeps it visible in wizard mode', async ({ page }) => {
    await switchTab(page, 'Layout');
    await page.locator('[data-testid="layout-container-page1"]').getByRole('button', { name: /page one/i }).click({ button: 'right' });
    await page.click('[data-testid="layout-ctx-wrapInCard"]');

    await expect(page.getByRole('button', { name: /^Card$/ })).toHaveCount(1);
    await expect(page.locator('[data-testid="layout-container-page1"]')).toBeVisible();
  });

  test('wrap and unwrap preserves field in wizard mode', async ({ page }) => {
    await switchTab(page, 'Layout');
    await page.locator('[data-testid="layout-container-page1"]').getByRole('button', { name: /page one/i }).click({ button: 'right' });
    await page.click('[data-testid="layout-ctx-wrapInCard"]');

    const card = page.locator('[data-testid^="layout-container-"]').filter({ hasText: 'Card' });
    await card.getByRole('button', { name: /card/i }).click({ button: 'right' });
    await page.click('[data-testid="layout-ctx-unwrap"]');

    await expect(page.locator('[data-testid^="layout-container-"]').filter({ hasText: 'Card' })).toHaveCount(0);
    await expect(page.locator('[data-testid="layout-container-page1"]')).toBeVisible();
  });

  test('adding a new layout item after wrapping preserves the Card in wizard mode', async ({ page }) => {
    await switchTab(page, 'Layout');
    await page.locator('[data-testid="layout-container-page1"]').getByRole('button', { name: /page one/i }).click({ button: 'right' });
    await page.click('[data-testid="layout-ctx-wrapInCard"]');

    await page.click('[data-testid="layout-add-item"]');
    await page.getByRole('button', { name: 'Text Short text — names,' }).click();

    await expect(page.getByRole('button', { name: /^Card$/ })).toHaveCount(1);
  });

  test('multiple layout types can coexist in wizard mode', async ({ page }) => {
    await switchTab(page, 'Layout');
    await page.click('[data-testid="layout-add-card"]');
    await page.click('[data-testid="layout-add-stack"]');

    await expect(page.locator('[data-testid^="layout-container-"]').filter({ hasText: 'Card' })).toHaveCount(1);
    await expect(page.locator('[data-testid^="layout-container-"]').filter({ hasText: 'Stack' })).toHaveCount(1);
  });
});
