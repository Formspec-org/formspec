import { test, expect } from '@playwright/test';
import { waitForApp, switchTab } from './helpers';

test.describe('Workspace Navigation — Tab Switching', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
  });

  test('Logic tab renders logic workspace', async ({ page }) => {
    await switchTab(page, 'Logic');
    const workspace = page.locator('[data-testid="workspace-Logic"]');
    // LogicTab renders a FilterBar with section pills: "All Logic", "Values", "Behaviors", "Rules"
    await expect(workspace.getByRole('button', { name: 'All Logic' })).toBeVisible();
    await expect(workspace.getByRole('button', { name: 'Values' })).toBeVisible();
    await expect(workspace.getByRole('button', { name: 'Behaviors' })).toBeVisible();
    await expect(workspace.getByRole('button', { name: 'Rules' })).toBeVisible();
  });

  test('Data tab renders data workspace', async ({ page }) => {
    await switchTab(page, 'Data');
    const workspace = page.locator('[data-testid="workspace-Data"]');
    // DataTab uses DataPillar section filter buttons: "All Data", "Structure", "Tables", "Sources", "Simulation"
    await expect(workspace.getByRole('button', { name: 'All Data' })).toBeVisible();
    await expect(workspace.getByRole('button', { name: 'Structure' })).toBeVisible();
    await expect(workspace.getByRole('button', { name: 'Sources' })).toBeVisible();
  });

  test('Theme tab renders theme workspace', async ({ page }) => {
    await switchTab(page, 'Theme');
    const workspace = page.locator('[data-testid="workspace-Theme"]');
    // ThemeTab has sub-tabs: "Tokens", "Defaults", "Selectors", etc.
    await expect(workspace.getByRole('button', { name: 'Tokens' })).toBeVisible();
    await expect(workspace.getByRole('button', { name: 'Defaults' })).toBeVisible();
  });

  test('Mapping tab renders mapping workspace', async ({ page }) => {
    await switchTab(page, 'Mapping');
    const workspace = page.locator('[data-testid="workspace-Mapping"]');
    // MappingTab has sub-tabs: "Config", "Rules", "Adapter", "Preview"
    await expect(workspace.getByRole('button', { name: 'Config', exact: true })).toBeVisible();
    await expect(workspace.getByRole('button', { name: 'Rules', exact: true })).toBeVisible();
  });

  test('Preview tab renders preview workspace', async ({ page }) => {
    await switchTab(page, 'Preview');
    // PreviewTab has viewport switcher with "Desktop", "Tablet", "Mobile" buttons
    await expect(page.getByText('Desktop')).toBeVisible();
    await expect(page.getByText('Tablet')).toBeVisible();
    await expect(page.getByText('Mobile')).toBeVisible();
  });

  test('can navigate back to Editor tab', async ({ page }) => {
    await switchTab(page, 'Logic');
    await switchTab(page, 'Editor');
    await expect(page.locator('[data-testid="tab-Editor"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[data-testid="workspace-Editor"]')).toBeVisible();
  });
});
