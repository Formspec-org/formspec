import { test, expect, type Page } from '@playwright/test';
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

const THEME_PROJECT = {
  ...WIZARD_PROJECT,
  theme: {
    tokens: {
      'color.primary': '#3b82f6',
    },
    defaults: {},
    selectors: [
      { match: { type: 'field' }, apply: { widget: 'textarea' } },
    ],
    breakpoints: {
      mobile: 0,
      tablet: 768,
      desktop: 1024,
    },
  },
};

async function openLayoutContainerMenu(page: Parameters<typeof waitForApp>[0]) {
  await page.locator('[data-testid="layout-add-container"]').hover();
  await expect(page.locator('[data-testid="layout-add-card"]')).toBeVisible();
}

function activeLayoutPage(page: Page) {
  return page.locator('[data-testid^="layout-page-"]').first();
}

function activeLayoutStack(page: Page) {
  return page.locator('[data-testid^="layout-container-"]').filter({ hasText: 'Stack' }).first();
}

async function clickPreviewField(page: Page, bind: string) {
  const field = page.locator(`[data-testid="formspec-preview-host"] [data-bind="${bind}"]`);
  await expect(field).toBeVisible();
  const box = await field.boundingBox();
  if (!box) {
    throw new Error(`Preview field ${bind} is not visible`);
  }

  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

test.describe('Layout Components in Wizard Mode', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await importProject(page, WIZARD_PROJECT);
  });

  // The Editor tree shows all items flat — wizard mode fields are always visible
  test('wizard mode fields are visible in Editor tree without page filtering', async ({ page }) => {
    await switchTab(page, 'Editor');

    await expect(page.locator('[data-testid="field-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="field-email"]')).toBeVisible();
  });

  test('adding a Card in wizard mode preserves page fields', async ({ page }) => {
    await switchTab(page, 'Layout');
    await openLayoutContainerMenu(page);
    await page.click('[data-testid="layout-add-card"]');

    await expect(page.locator('[data-testid^="layout-container-"]').filter({ hasText: 'Card' })).toHaveCount(1);
    await expect(activeLayoutPage(page)).toBeVisible();
  });

  test('wrapping a field in Card via context menu keeps it visible in wizard mode', async ({ page }) => {
    await switchTab(page, 'Layout');
    await activeLayoutStack(page).getByRole('button', { name: /^Stack$/ }).click({ button: 'right' });
    await page.click('[data-testid="layout-ctx-wrapInCard"]');

    await expect(page.getByRole('button', { name: /^Card$/ })).toHaveCount(1);
    await expect(activeLayoutPage(page)).toBeVisible();
  });

  test('wrap and unwrap preserves field in wizard mode', async ({ page }) => {
    await switchTab(page, 'Layout');
    await activeLayoutStack(page).getByRole('button', { name: /^Stack$/ }).click({ button: 'right' });
    await page.click('[data-testid="layout-ctx-wrapInCard"]');

    const card = page.locator('[data-testid^="layout-container-"]').filter({ hasText: 'Card' });
    await card.getByRole('button', { name: /card/i }).click({ button: 'right' });
    await page.click('[data-testid="layout-ctx-unwrap"]');

    await expect(page.locator('[data-testid^="layout-container-"]').filter({ hasText: 'Card' })).toHaveCount(0);
    await expect(activeLayoutPage(page)).toBeVisible();
  });

  test('adding a new layout item after wrapping preserves the Card in wizard mode', async ({ page }) => {
    await switchTab(page, 'Layout');
    await activeLayoutStack(page).getByRole('button', { name: /^Stack$/ }).click({ button: 'right' });
    await page.click('[data-testid="layout-ctx-wrapInCard"]');

    await page.click('[data-testid="layout-add-item"]');
    await page.locator('[data-testid="add-item-palette"]').getByRole('button', { name: /Text Short text/i }).click();

    await expect(page.getByRole('button', { name: /^Card$/ })).toHaveCount(1);
  });

  test('multiple layout types can coexist in wizard mode', async ({ page }) => {
    await switchTab(page, 'Layout');
    await openLayoutContainerMenu(page);
    await page.click('[data-testid="layout-add-card"]');
    await openLayoutContainerMenu(page);
    await page.click('[data-testid="layout-add-stack"]');

    await expect(page.locator('[data-testid^="layout-container-"]').filter({ hasText: 'Card' })).toHaveCount(1);
    await expect(page.locator('[data-testid^="layout-container-"]').filter({ hasText: 'Stack' })).toHaveCount(2);
  });
});

test.describe('Layout Theme Mode', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await importProject(page, THEME_PROJECT);
    await switchTab(page, 'Layout');
    await page.waitForSelector('[data-testid="page-nav"]', { timeout: 5000 });
  });

  test('switching to Theme mode shows the overlay and hides the right sidebar', async ({ page }) => {
    await page.locator('[data-testid="layout-theme-toggle"]').getByRole('radio', { name: 'Theme' }).click();

    await expect(page.locator('[data-testid="theme-authoring-overlay"]')).toBeVisible();
    await expect(page.locator('[data-testid="properties-panel"]')).toHaveCount(0);
  });

  test('clicking a preview field in Theme mode opens the override popover', async ({ page }) => {
    await page.locator('[data-testid="layout-theme-toggle"]').getByRole('radio', { name: 'Theme' }).click();

    await clickPreviewField(page, 'name');

    await expect(page.locator('[data-testid="theme-override-popover"]')).toBeVisible();
  });

  test('editing the color token updates the preview host theme document', async ({ page }) => {
    await page.locator('[data-testid="layout-theme-toggle"]').getByRole('radio', { name: 'Theme' }).click();
    const sidebar = page.locator('[data-testid="blueprint-sidebar"]');

    const colorInput = sidebar.locator('[data-testid="color-value-color.primary"]');
    await colorInput.fill('#ef4444', { force: true });
    await colorInput.blur();

    await expect.poll(async () => page.evaluate(() => {
      const preview = document.querySelector('formspec-render') as HTMLElement & {
        themeDocument?: { tokens?: Record<string, unknown> };
      } | null;
      return preview?.themeDocument?.tokens?.['color.primary'] ?? null;
    })).toBe('#ef4444');
  });

  test('selector rules apply in the preview popover', async ({ page }) => {
    await page.locator('[data-testid="layout-theme-toggle"]').getByRole('radio', { name: 'Theme' }).click();
    await clickPreviewField(page, 'name');

    await expect(page.locator('[data-testid="theme-override-popover"]')).toContainText('selector #1: field');
  });

  test('the header does not expose a Theme tab', async ({ page }) => {
    await expect(page.locator('[data-testid="tab-Theme"]')).toHaveCount(0);
  });
});
