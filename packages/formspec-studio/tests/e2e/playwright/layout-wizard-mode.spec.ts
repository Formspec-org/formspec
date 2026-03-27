import { test, expect } from '@playwright/test';
import { importDefinition, waitForApp } from './helpers';

/*
 * Editor/Layout workspace split:
 *
 * These tests tested layout operations (add Card, wrap/unwrap) in wizard mode
 * while on the Editor tab. The Editor is now a pure definition tree with no
 * layout awareness. Layout operations live in the Layout tab with different
 * selectors (layout-field-*, layout-container-*, layout-ctx-*).
 *
 * All tests are skipped until the Layout tab's add-container and wrap-in-layout
 * affordances are fully wired for wizard mode.
 */

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

  // The Editor tree shows all items flat — wizard mode fields are always visible
  test('wizard mode fields are visible in Editor tree without page filtering', async ({ page }) => {
    await expect(page.locator('[data-testid="field-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="field-email"]')).toBeVisible();
  });

  test.skip('adding a Card in wizard mode preserves page fields', async () => {
    // Needs rewrite: layout containers are added via Layout tab
  });

  test.skip('wrapping a field in Card via context menu keeps it visible in wizard mode', async () => {
    // Needs rewrite: wrap actions are in Layout tab context menu
  });

  test.skip('wrap and unwrap preserves field in wizard mode', async () => {
    // Needs rewrite for Layout tab
  });

  test.skip('adding a new field after wrapping preserves the Card in wizard mode', async () => {
    // Needs rewrite for Layout tab
  });

  test.skip('multiple layout types can coexist in wizard mode', async () => {
    // Needs rewrite for Layout tab
  });
});
