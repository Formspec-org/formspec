import { test, expect } from '@playwright/test';
import { waitForApp, switchTab, seedProject } from './helpers';

const SEED = {
  definition: {
    $formspec: '1.0',
    items: [
      { key: 'name', type: 'field', dataType: 'string' },
    ],
  },
  theme: {
    tokens: { primaryColor: '#3b82f6', fontSize: '14px', spacing: '8px' },
    defaults: { labelPosition: 'above', density: 'comfortable', pageMode: 'single' },
    selectors: [
      { match: { type: 'field', dataType: 'string' }, properties: { widget: 'text-input' } },
    ],
  },
};

test.describe('Theme Workspace', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await seedProject(page, SEED);
    await switchTab(page, 'Theme');
  });

  test('token editor shows key-value pairs for tokens', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Theme"]');
    // Tokens tab is active by default
    await expect(workspace.getByText('primaryColor', { exact: true })).toBeVisible();
    await expect(workspace.getByText('#3b82f6', { exact: true })).toBeVisible();
    await expect(workspace.getByText('fontSize', { exact: true })).toBeVisible();
    await expect(workspace.getByText('14px', { exact: true })).toBeVisible();
    await expect(workspace.getByText('spacing', { exact: true })).toBeVisible();
    await expect(workspace.getByText('8px', { exact: true })).toBeVisible();
  });

  test('defaults editor shows key-value pairs after clicking Defaults sub-tab', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Theme"]');
    await workspace.getByRole('button', { name: 'Defaults' }).click();
    await expect(workspace.getByText('labelPosition', { exact: true })).toBeVisible();
    await expect(workspace.getByText('above', { exact: true })).toBeVisible();
    await expect(workspace.getByText('density', { exact: true })).toBeVisible();
    await expect(workspace.getByText('comfortable', { exact: true })).toBeVisible();
    await expect(workspace.getByText('pageMode', { exact: true })).toBeVisible();
    await expect(workspace.getByText('single', { exact: true })).toBeVisible();
  });

  test('selector list shows match criteria and properties after clicking Selectors sub-tab', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Theme"]');
    await workspace.getByRole('button', { name: 'Selectors' }).click();
    // SelectorList renders match entries as "key: value" spans
    await expect(workspace.getByText(/type: field/)).toBeVisible();
    await expect(workspace.getByText(/dataType: string/)).toBeVisible();
    // Properties entry
    await expect(workspace.getByText(/widget: text-input/)).toBeVisible();
  });

  test('empty state shows "No tokens defined" when theme has no tokens', async ({ page }) => {
    // Seed an empty theme
    await seedProject(page, {
      definition: SEED.definition,
      theme: {},
    });
    const workspace = page.locator('[data-testid="workspace-Theme"]');
    await expect(workspace.getByText('No tokens defined')).toBeVisible();
  });

  test('empty state shows "No defaults defined" when theme has no defaults', async ({ page }) => {
    await seedProject(page, {
      definition: SEED.definition,
      theme: {},
    });
    const workspace = page.locator('[data-testid="workspace-Theme"]');
    await workspace.getByRole('button', { name: 'Defaults' }).click();
    await expect(workspace.getByText('No defaults defined')).toBeVisible();
  });

  test('empty state shows "No selectors defined" when theme has no selectors', async ({ page }) => {
    await seedProject(page, {
      definition: SEED.definition,
      theme: {},
    });
    const workspace = page.locator('[data-testid="workspace-Theme"]');
    await workspace.getByRole('button', { name: 'Selectors' }).click();
    await expect(workspace.getByText('No selectors defined')).toBeVisible();
  });

  // BUG-029: All Theme workspace sub-tabs are empty stubs — none have an add affordance.
  // RED: Every sub-tab in the Theme workspace (Tokens, Defaults, Selectors, Item Overrides,
  // Page Layouts, Breakpoints) either renders a plain read-only list or a bare empty-state
  // message. None of them include a button or control to add a new entry. The spec requires
  // each tab to have an add affordance so authors can create theme entries without manually
  // editing JSON.
  test('all theme sub-tabs provide an add affordance (button/link to add a new entry) [BUG-029]', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Theme"]');

    // Check each sub-tab for an add affordance (a button/link containing "add", "+", or "new").
    // The add affordance must be present whether the tab has content or is in empty state.
    const addPattern = /add|^\+$|new entry|new token|new selector|new default|new breakpoint/i;

    // ── Tokens tab (active by default) ──────────────────────────────
    await expect(
      workspace.getByRole('button', { name: addPattern }).or(
        workspace.getByRole('link', { name: addPattern })
      )
    ).toBeVisible({ timeout: 3000 });

    // ── Defaults sub-tab ────────────────────────────────────────────
    await workspace.getByRole('button', { name: 'Defaults' }).click();
    await expect(
      workspace.getByRole('button', { name: addPattern }).or(
        workspace.getByRole('link', { name: addPattern })
      )
    ).toBeVisible({ timeout: 3000 });

    // ── Selectors sub-tab ───────────────────────────────────────────
    await workspace.getByRole('button', { name: 'Selectors' }).click();
    await expect(
      workspace.getByRole('button', { name: addPattern }).or(
        workspace.getByRole('link', { name: addPattern })
      )
    ).toBeVisible({ timeout: 3000 });

    // ── Item Overrides sub-tab ──────────────────────────────────────
    await workspace.getByRole('button', { name: 'Item Overrides' }).click();
    await expect(
      workspace.getByRole('button', { name: addPattern }).or(
        workspace.getByRole('link', { name: addPattern })
      )
    ).toBeVisible({ timeout: 3000 });

    // ── Page Layouts sub-tab ────────────────────────────────────────
    await workspace.getByRole('button', { name: 'Page Layouts' }).click();
    await expect(
      workspace.getByRole('button', { name: addPattern }).or(
        workspace.getByRole('link', { name: addPattern })
      )
    ).toBeVisible({ timeout: 3000 });

    // ── Breakpoints sub-tab ─────────────────────────────────────────
    await workspace.getByRole('button', { name: 'Breakpoints' }).click();
    await expect(
      workspace.getByRole('button', { name: addPattern }).or(
        workspace.getByRole('link', { name: addPattern })
      )
    ).toBeVisible({ timeout: 3000 });
  });
});
