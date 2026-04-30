import { test, expect } from '@playwright/test';
import { importProject, waitForApp } from './helpers';

/** Minimal grid so Design / Layout mode has bound fields on the canvas. */
const LAYOUT_GRID_SEED = {
  definition: {
    $formspec: '1.0',
    url: 'urn:design-mode-e2e',
    version: '1.0.0',
    formPresentation: { pageMode: 'single' },
    items: [
      { key: 'firstName', type: 'field', dataType: 'string', label: 'First Name' },
      { key: 'lastName', type: 'field', dataType: 'string', label: 'Last Name' },
    ],
  },
  component: {
    $formspecComponent: '0.1',
    version: '0.1.0',
    targetDefinition: { url: 'urn:design-mode-e2e' },
    tree: {
      component: 'Form',
      children: [
        {
          component: 'Page',
          nodeId: 'page-main',
          title: 'Main',
          _layout: true,
          children: [
            {
              component: 'Grid',
              nodeId: 'grid-main',
              _layout: true,
              columns: 2,
              children: [
                { component: 'TextInput', bind: 'firstName' },
                { component: 'TextInput', bind: 'lastName' },
              ],
            },
          ],
        },
      ],
    },
  },
};

test.describe('Studio Design Mode', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await importProject(page, LAYOUT_GRID_SEED);
    await page.click('[data-testid="mode-toggle-design"]');
    await expect(page.locator('[data-testid="design-canvas-shell"]')).toBeVisible();
    await expect(page.locator('[data-testid="workspace-Layout"]')).toBeVisible();
  });

  test('layout field selects and shows column resize affordance in grid', async ({ page }) => {
    const row = page.locator('[data-testid="layout-field-firstName"]');
    await row.click();
    await expect(row).toHaveAttribute('aria-pressed', 'true');
    await expect(row.locator('[data-testid="resize-handle-col"]')).toBeVisible();
  });

});
