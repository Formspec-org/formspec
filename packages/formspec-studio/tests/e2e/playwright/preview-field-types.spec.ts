import { test, expect } from '@playwright/test';
import { waitForApp, switchTab, seedDefinition } from './helpers';

const PREVIEW_TYPES_DEF = {
  $formspec: '1.0',
  url: 'urn:preview-types',
  version: '1.0.0',
  items: [
    { key: 'fullName', type: 'field', dataType: 'string', label: 'Full Name' },
    { key: 'householdSize', type: 'field', dataType: 'integer', label: 'Household Size' },
    { key: 'birthDate', type: 'field', dataType: 'date', label: 'Birth Date' },
    {
      key: 'maritalStatus',
      type: 'field',
      dataType: 'choice',
      label: 'Marital Status',
      options: [
        { value: 'single', label: 'Single' },
        { value: 'married', label: 'Married' },
      ],
    },
  ],
};

test.describe('Preview field types', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await seedDefinition(page, PREVIEW_TYPES_DEF);
    await switchTab(page, 'Preview');
  });

  test('renders common field types as the correct interactive controls in preview', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Preview"]');

    await expect(workspace.getByRole('textbox', { name: 'Full Name' })).toBeVisible({ timeout: 3000 });
    await expect(workspace.getByRole('spinbutton', { name: 'Household Size' })).toBeVisible();
    await expect(workspace.getByLabel('Birth Date')).toHaveAttribute('type', 'date');
    await expect(workspace.getByRole('combobox', { name: 'Marital Status' })).toBeVisible();
    await expect(workspace.getByRole('option', { name: 'Single' })).toBeAttached();
    await expect(workspace.getByRole('option', { name: 'Married' })).toBeAttached();
  });
});
