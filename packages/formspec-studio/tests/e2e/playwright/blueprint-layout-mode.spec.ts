import { test, expect } from '@playwright/test';
import { importDefinition, switchTab, waitForApp } from './helpers';

const SEED_DEF = {
  $formspec: '1.0' as const,
  url: 'urn:blueprint-layout-e2e',
  version: '1.0.0',
  items: [
    { key: 'name', type: 'field' as const, dataType: 'string' as const, label: 'Full Name' },
  ],
};

/** Layout tab left rail — theme authoring (matches Shell THEME_MODE_BLUEPRINT_SECTIONS). */
const LAYOUT_TAB_THEME_SECTIONS = [
  'Colors',
  'Typography',
  'Field Defaults',
  'Field Rules',
  'Breakpoints',
  'All Tokens',
  'Settings',
] as const;

test.describe('Blueprint in Layout workspace', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, SEED_DEF);
    await switchTab(page, 'Layout');
  });

  test('shows theme authoring blueprint sections in the sidebar', async ({ page }) => {
    const sidebar = page.locator('[data-testid="blueprint-sidebar"]');
    for (const name of LAYOUT_TAB_THEME_SECTIONS) {
      await expect(sidebar.getByTestId(`blueprint-section-${name}`)).toBeVisible();
    }
    await expect(sidebar.getByTestId('blueprint-section-Structure')).toHaveCount(0);
    await expect(sidebar.getByTestId('blueprint-section-Component Tree')).toHaveCount(0);
  });

  test('Layout canvas shows the field while blueprint is theme-focused', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Layout"]');
    await expect(workspace.getByTestId('layout-field-name')).toBeVisible();
  });

  test('Typography and Colors panels open from the blueprint', async ({ page }) => {
    const sidebar = page.locator('[data-testid="blueprint-sidebar"]');

    await sidebar.getByTestId('blueprint-section-Typography').getByRole('button', { name: 'Typography', exact: true }).click();
    await expect(sidebar.getByRole('heading', { name: 'Typography' })).toBeVisible();

    await sidebar.getByTestId('blueprint-section-Colors').getByRole('button', { name: 'Colors', exact: true }).click();
    await expect(sidebar.getByRole('heading', { name: 'Colors' })).toBeVisible();
  });

  test('theme blueprint sections stay available while the layout canvas is in use', async ({ page }) => {
    await expect(page.getByTestId('blueprint-section-Colors')).toBeVisible();
    await expect(page.getByTestId('blueprint-section-Typography')).toBeVisible();

    const workspace = page.locator('[data-testid="workspace-Layout"]');
    await workspace.getByTestId('layout-field-name').click();

    await expect(page.getByTestId('blueprint-section-Typography')).toBeVisible();
    await expect(page.getByTestId('blueprint-section-Colors')).toBeVisible();
  });
});
