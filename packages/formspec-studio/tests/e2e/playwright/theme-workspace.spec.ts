import { test, expect, type Page } from '@playwright/test';
import { importProject, switchTab, waitForApp } from './helpers';

const SEED = {
  definition: {
    $formspec: '1.0',
    items: [
      { key: 'name', type: 'field', dataType: 'string' },
    ],
  },
  theme: {
    tokens: { 'color.primary': '#3b82f6', 'font.family': '"Inter", sans-serif', 'spacing.md': '8px' },
    defaults: { labelPosition: 'top' },
    selectors: [
      { match: { type: 'field', dataType: 'string' }, apply: { widget: 'text-input' } },
    ],
    pages: [
      { id: 'intro', title: 'Introduction', regions: [{ key: 'name', span: 12 }] },
    ],
    breakpoints: { mobile: 0, tablet: 768, desktop: 1024 },
  },
};

const EMPTY_SELECTOR_SEED = {
  definition: SEED.definition,
  theme: {
    ...SEED.theme,
    selectors: [],
  },
};

/** Theme authoring lives on the Layout tab blueprint sidebar (no separate Theme workspace or canvas toggle). */
async function openLayoutWithThemeSidebar(page: Page, state: Record<string, unknown>) {
  await waitForApp(page);
  await importProject(page, state);
  await switchTab(page, 'Layout');
  await expect(page.locator('[data-testid="blueprint-sidebar"]')).toBeVisible();
}

function themeSidebar(page: Page) {
  return page.locator('[data-testid="blueprint-sidebar"]');
}

test.describe('Theme Workspace', () => {
  test.beforeEach(async ({ page }) => {
    await openLayoutWithThemeSidebar(page, SEED);
  });

  test('shows the six theme blueprint sections', async ({ page }) => {
    const sidebar = themeSidebar(page);
    for (const section of ['Colors', 'Typography', 'Field Defaults', 'Field Rules', 'Breakpoints', 'All Tokens']) {
      await expect(sidebar.getByRole('button', { name: section })).toBeVisible();
    }
  });

  test('typography section shows typography, spacing, and border controls', async ({ page }) => {
    const sidebar = themeSidebar(page);
    await sidebar.getByRole('button', { name: 'Typography' }).click();

    await expect(sidebar).toContainText('Typography');
    await expect(sidebar).toContainText('Spacing');
    await expect(sidebar).toContainText('Radius');
    await expect(sidebar).toContainText('Font Family');
  });

  test('colors section shows color tokens', async ({ page }) => {
    const sidebar = themeSidebar(page);
    const colorToken = sidebar.locator('[data-testid="color-token-color.primary"]');
    if (!(await colorToken.isVisible())) {
      await sidebar.getByRole('button', { name: 'Colors' }).click();
    }
    await expect(sidebar).toContainText('primary');
    await expect(sidebar.locator('[data-testid="color-value-color.primary"]')).toHaveValue('#3b82f6');
  });

  test('field type rules show selector summary', async ({ page }) => {
    const sidebar = themeSidebar(page);
    const fieldRulesButton = sidebar.getByRole('button', { name: 'Field Rules' });
    const buttonBox = await fieldRulesButton.boundingBox();
    if (!buttonBox) throw new Error('Field Rules button is not visible');
    await page.mouse.click(
      buttonBox.x + (buttonBox.width / 2),
      buttonBox.y + (buttonBox.height / 2),
    );

    await expect(sidebar).toContainText('Selector Rules');
    await expect(sidebar).toContainText('field + string');
  });

  test('adding a selector rule auto-expands the new row', async ({ page }) => {
    await openLayoutWithThemeSidebar(page, EMPTY_SELECTOR_SEED);

    const sidebar = themeSidebar(page);
    const fieldRulesButton = sidebar.getByRole('button', { name: 'Field Rules' });
    const buttonBox = await fieldRulesButton.boundingBox();
    if (!buttonBox) throw new Error('Field Rules button is not visible');
    await page.mouse.click(
      buttonBox.x + (buttonBox.width / 2),
      buttonBox.y + (buttonBox.height / 2),
    );

    await sidebar.locator('[data-testid="selector-rule-add"]').dispatchEvent('click');

    await expect(sidebar.locator('[data-testid="selector-rule-0"]')).toBeVisible();
    await expect(sidebar.locator('[data-testid="selector-rule-type-0"]')).toBeVisible();
  });

  test('screen sizes show breakpoints sorted by width', async ({ page }) => {
    const sidebar = themeSidebar(page);
    await sidebar.getByRole('button', { name: 'Breakpoints' }).click();

    await expect(sidebar).toContainText('3 breakpoints');
    await expect(sidebar.locator('[data-testid^="breakpoint-name-"]')).toHaveText(['mobile', 'tablet', 'desktop']);
  });

  test('empty theme shows empty states', async ({ page }) => {
    await openLayoutWithThemeSidebar(page, {
      definition: SEED.definition,
      theme: {},
    });

    const sidebar = themeSidebar(page);
    await sidebar.getByRole('button', { name: 'Colors' }).click();
    await expect(sidebar).toContainText(/no color tokens defined/i);
    await expect(sidebar.getByRole('button', { name: 'Breakpoints' })).toBeVisible();
  });
});
