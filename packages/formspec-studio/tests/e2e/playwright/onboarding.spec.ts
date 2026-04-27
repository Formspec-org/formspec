import { test, expect } from '@playwright/test';

test.describe('Studio first-run onboarding', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?onboarding=1');
  });

  test('opens the assistant workspace before the shell and continues with the same blank project', async ({ page }) => {
    await expect(page.locator('[data-testid="assistant-workspace"]')).toBeVisible();
    await expect(page.getByText('What form are you building?')).toBeVisible();
    await expect(page.getByText('Untitled form · Assistant workspace')).toBeVisible();
    await expect(page.getByTestId('source-dropzone')).toBeVisible();
    await expect(page.getByText('Drop PDF, form, or JSON')).toBeVisible();
    await expect(page.getByRole('button', { name: /Section 8 HCV intake ready/i })).toBeVisible();

    await page.getByRole('button', { name: 'Enter workspace' }).first().click();

    await expect(page.locator('[data-testid="shell"]')).toBeVisible();
    await expect(page.locator('[data-testid="assistant-workspace"]')).toHaveCount(0);
    await expect(page.getByText('No items defined')).toBeVisible();
    await expect(page.evaluate(() => localStorage.getItem('formspec-studio:onboarding-completed:v1'))).resolves.toBe('1');
  });

  test('can load the starter before entering Studio', async ({ page }) => {
    await page.getByRole('button', { name: /Use selected starter/i }).click();
    await expect(page.getByRole('heading', { name: 'Section 8 HCV — Intake' })).toBeVisible();

    await page.getByRole('button', { name: 'Enter workspace' }).first().click();

    await expect(page.locator('[data-testid="shell"]')).toBeVisible();
    await expect(page.getByTestId('tree-item-app')).toBeVisible();
  });

  test('can load a JSON source file and continue with its fields', async ({ page }) => {
    const definition = {
      $formspec: '1.0',
      name: 'dropped-source',
      title: 'Dropped Source Form',
      status: 'draft',
      items: [
        { key: 'fullName', type: 'field', label: 'Full Name', dataType: 'string' },
        { key: 'income', type: 'field', label: 'Income', dataType: 'decimal' },
      ],
    };

    await page.getByLabel('Upload source document').setInputFiles({
      name: 'definition.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(definition)),
    });

    await expect(page.getByText('definition.json loaded as current draft')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Dropped Source Form' })).toBeVisible();

    await page.getByRole('button', { name: 'Enter workspace' }).first().click();

    await expect(page.locator('[data-testid="shell"]')).toBeVisible();
    await expect(page.getByTestId('tree-item-fullName')).toBeVisible();
    await expect(page.getByTestId('tree-item-income')).toBeVisible();
  });

  test('assistant: command palette opens with Ctrl/Cmd+K and Escape closes it', async ({ page }) => {
    await expect(page.locator('[data-testid="assistant-workspace"]')).toBeVisible();
    const isMac = await page.evaluate(() => /Mac|iPhone|iPod|iPad/i.test(navigator.platform));
    await page.keyboard.press(`${isMac ? 'Meta' : 'Control'}+KeyK`);
    await expect(page.getByTestId('command-palette')).toBeVisible();
    await expect(page.getByPlaceholder(/Search this draft/i)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('command-palette')).toHaveCount(0);
  });

  test('assistant: Metadata opens form settings dialog', async ({ page }) => {
    await expect(page.locator('[data-testid="assistant-workspace"]')).toBeVisible();
    await page.getByRole('button', { name: /formspec 1\.0 metadata/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('assistant: Escape closes mobile sheet when open', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 720 });
    await expect(page.locator('[data-testid="assistant-workspace"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.fixed.inset-0.z-30')).toHaveCount(0);
    await page.getByRole('button', { name: 'Overview' }).click();
    await expect(page.getByText('Form overview')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText('Form overview')).toHaveCount(0);
  });
});
