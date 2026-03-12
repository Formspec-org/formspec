import { test, expect } from '@playwright/test';
import { waitForApp, switchTab, seedProject } from './helpers';

const SEED = {
  definition: {
    $formspec: '1.0',
    items: [{ key: 'name', type: 'field', dataType: 'string' }],
  },
  mapping: {
    direction: 'outbound',
    definitionRef: 'urn:formspec:test',
    rules: [
      { source: 'name', target: 'fullName', transform: 'preserve' },
      { source: 'age', target: 'years', transform: 'coerce' },
    ],
    adapter: { format: 'JSON', options: { pretty: true } },
  },
};

test.describe('Mapping Workspace', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await seedProject(page, SEED);
    await switchTab(page, 'Mapping');
  });

  test('config tab shows direction pill and definition ref', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Mapping"]');
    // Config tab is active by default
    // MappingConfig renders a "Configuration" section with direction pill and definition ref
    await expect(workspace.getByText('outbound')).toBeVisible();
    await expect(workspace.getByText('urn:formspec:test')).toBeVisible();
  });

  test('rules sub-tab shows rule cards with source → target and transform', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Mapping"]');
    await workspace.getByRole('button', { name: 'Rules' }).click();
    // RuleCard renders: source text, arrow (→), target text, transform pill
    await expect(workspace.getByText('name', { exact: true })).toBeVisible();
    await expect(workspace.getByText('fullName', { exact: true })).toBeVisible();
    await expect(workspace.getByText('preserve')).toBeVisible();
    await expect(workspace.getByText('age', { exact: true })).toBeVisible();
    await expect(workspace.getByText('years', { exact: true })).toBeVisible();
    await expect(workspace.getByText('coerce')).toBeVisible();
  });

  test('adapter sub-tab shows format pill and options', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Mapping"]');
    await workspace.getByRole('button', { name: 'Adapter' }).click();
    // AdapterConfig renders Section "Adapter" with format pill and options key-value
    await expect(workspace.getByText('JSON')).toBeVisible();
    await expect(workspace.getByText('pretty')).toBeVisible();
    await expect(workspace.getByText('true', { exact: true })).toBeVisible();
  });

  test('preview sub-tab shows direction pill and Input/Output split pane', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Mapping"]');
    await workspace.getByRole('button', { name: 'Preview' }).click();
    // MappingPreview renders direction pill, then split pane with Input and Output headers
    await expect(workspace.getByText('outbound')).toBeVisible();
    await expect(workspace.getByText('Input', { exact: true })).toBeVisible();
    await expect(workspace.getByText('Output', { exact: true })).toBeVisible();
  });

  test('clicking the config direction badge opens a direction picker', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Mapping"]');

    await workspace.getByText('outbound', { exact: true }).click();

    await expect(workspace.getByRole('option', { name: 'inbound' })).toBeVisible();
    await expect(workspace.getByRole('option', { name: 'outbound' })).toBeVisible();
    await expect(workspace.getByRole('option', { name: 'bidirectional' })).toBeVisible();
  });

  test('Escape closes the direction picker after it opens', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Mapping"]');

    await workspace.getByText('outbound', { exact: true }).click();
    await expect(workspace.getByRole('option', { name: 'inbound' })).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(workspace.getByRole('option', { name: 'inbound' })).toBeHidden();
  });

  test('Configuration stays collapsed after leaving Config and returning', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Mapping"]');

    await expect(workspace.getByText('Direction', { exact: true })).toBeVisible();

    await workspace.getByRole('button', { name: /configuration/i }).click();
    await expect(workspace.getByText('Direction', { exact: true })).toBeHidden();

    await workspace.getByRole('button', { name: 'Rules' }).click();
    await workspace.getByRole('button', { name: 'Config' }).click();

    await expect(workspace.getByText('Direction', { exact: true })).toBeHidden();
  });
});
