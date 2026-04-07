import { test, expect } from '@playwright/test';
import { waitForApp, switchTab } from './helpers';

test.describe('Workspace Navigation — Tab Switching', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
  });

  test('Editor tab renders Build/Manage toggle', async ({ page }) => {
    // Editor is the default tab
    const workspace = page.locator('[data-testid="workspace-Editor"]');
    await expect(workspace.getByRole('radiogroup', { name: /editor view/i })).toBeVisible();
    await expect(workspace.getByRole('radio', { name: 'Build' })).toBeVisible();
    await expect(workspace.getByRole('radio', { name: 'Manage' })).toBeVisible();
  });

  test('Editor Manage view renders manage sections', async ({ page }) => {
    await page.getByRole('radio', { name: 'Manage' }).click();
    await expect(page.getByTestId('manage-section-option-sets')).toBeVisible();
    await expect(page.getByTestId('manage-section-variables')).toBeVisible();
    await expect(page.getByTestId('manage-section-data-sources')).toBeVisible();
  });

  test('Layout Theme mode shows theme authoring in the blueprint sidebar', async ({ page }) => {
    await switchTab(page, 'Layout');
    await page.locator('[data-testid="layout-theme-toggle"]').getByRole('radio', { name: 'Theme' }).click();
    const sidebar = page.locator('[data-testid="blueprint-sidebar"]');
    await expect(sidebar.getByRole('button', { name: 'Colors' })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: 'Typography' })).toBeVisible();
  });

  test('Layout tab renders layout workspace', async ({ page }) => {
    await switchTab(page, 'Layout');
    const workspace = page.locator('[data-testid="workspace-Layout"]');
    await expect(workspace.getByRole('tab', { name: 'Single' })).toBeVisible();
    await expect(workspace.getByRole('tab', { name: 'Wizard' })).toBeVisible();
    await expect(workspace.getByRole('tab', { name: 'Tabs' })).toBeVisible();
  });

  test('Mapping tab renders mapping workspace', async ({ page }) => {
    await switchTab(page, 'Mapping');
    const workspace = page.locator('[data-testid="workspace-Mapping"]');
    await expect(workspace.getByRole('button', { name: 'Blueprint', exact: true })).toBeVisible();
    await expect(workspace.getByRole('button', { name: 'Rules', exact: true })).toBeVisible();
  });

  test('Preview tab renders preview workspace', async ({ page }) => {
    await switchTab(page, 'Preview');
    await expect(page.getByText('Desktop')).toBeVisible();
    await expect(page.getByText('Tablet')).toBeVisible();
    await expect(page.getByText('Mobile')).toBeVisible();
  });

  test('can navigate back to Editor tab', async ({ page }) => {
    await switchTab(page, 'Layout');
    await switchTab(page, 'Editor');
    await expect(page.locator('[data-testid="tab-Editor"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[data-testid="workspace-Editor"]')).toBeVisible();
  });
});
