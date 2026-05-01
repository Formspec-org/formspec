import { test, expect } from '@playwright/test';
import { importDefinition } from './helpers';
import { exampleDefinition } from '../../../src/fixtures/example-definition.js';

test.describe('Studio first-run onboarding', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'formspec:provider-config',
        JSON.stringify({ provider: 'google', apiKey: 'playwright-e2e-placeholder-key' }),
      );
    });
    await page.goto('?onboarding=1');
  });

  test('loads shell with chat first; Edit shows blank editor', async ({ page }) => {
    await expect(page.locator('[data-testid="shell"]')).toBeVisible();
    await expect(page.locator('[data-testid="chat-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="mode-toggle-chat"]')).toHaveAttribute('aria-selected', 'true');
    await page.locator('[data-testid="mode-toggle-edit"]').click();
    await expect(page.locator('[data-testid="workspace-Editor"]')).toBeVisible();
    await expect(page.getByText('No items defined')).toBeVisible();
  });

  test('can import the Section 8 starter definition and open the editor', async ({ page }) => {
    await expect(page.locator('[data-testid="shell"]')).toBeVisible();
    await importDefinition(page, exampleDefinition);
    await expect(page.getByText('Section 8 HCV — Intake')).toBeVisible();
    await page.locator('[data-testid="mode-toggle-edit"]').click();
    await expect(page.locator('[data-testid="workspace-Editor"]')).toBeVisible();
  });

  test('can import a JSON definition via account menu and see fields in the editor', async ({ page }) => {
    const definition = {
      $formspec: '1.0',
      url: 'urn:onboarding-drop',
      version: '0.1.0',
      title: 'Dropped Source Form',
      status: 'draft',
      items: [
        { key: 'fullName', type: 'field', dataType: 'string', label: 'Full Name' },
        { key: 'income', type: 'field', dataType: 'decimal', label: 'Income' },
      ],
    };

    await expect(page.locator('[data-testid="shell"]')).toBeVisible();
    await importDefinition(page, definition);
    await page.locator('[data-testid="mode-toggle-edit"]').click();
    await expect(page.getByTestId('tree-item-fullName')).toBeVisible();
    await expect(page.getByTestId('tree-item-income')).toBeVisible();
  });

  test('command palette opens with Ctrl/Cmd+K and Escape closes it', async ({ page }) => {
    await expect(page.locator('[data-testid="shell"]')).toBeVisible();
    const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.press(`${mod}+KeyK`);
    await expect(page.getByTestId('command-palette')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('command-palette')).toHaveCount(0);
  });

  test('Form Settings opens from the account menu', async ({ page }) => {
    await expect(page.locator('[data-testid="shell"]')).toBeVisible();
    await page.getByRole('button', { name: 'Open account menu' }).click();
    await page.getByRole('menuitem', { name: 'Form Settings' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});
