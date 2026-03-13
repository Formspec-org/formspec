import { test, expect } from '@playwright/test';
import { waitForApp, switchTab, seedDefinition, selectField, dispatch } from './helpers';

const CHOICE_DEF = {
  $formspec: '1.0',
  url: 'urn:widget-hint-test',
  version: '1.0.0',
  items: [
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

test.describe('widgetHint affects preview rendering', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await seedDefinition(page, CHOICE_DEF);
  });

  test('choice field renders as select dropdown by default', async ({ page }) => {
    await switchTab(page, 'Preview');
    const workspace = page.locator('[data-testid="workspace-Preview"]');
    await expect(workspace.getByRole('combobox', { name: 'Marital Status' }))
      .toBeVisible({ timeout: 3000 });
  });

  test('changing widget to RadioGroup renders radio buttons in preview', async ({ page }) => {
    // First verify default rendering in preview
    await switchTab(page, 'Preview');
    const workspace = page.locator('[data-testid="workspace-Preview"]');
    await expect(workspace.getByRole('combobox', { name: 'Marital Status' }))
      .toBeVisible({ timeout: 3000 });

    // Switch back to Editor, dispatch the component tree widget change
    await switchTab(page, 'Editor');
    await dispatch(page, {
      type: 'component.setFieldWidget',
      payload: { fieldKey: 'maritalStatus', widget: 'RadioGroup' },
    });

    // Switch to Preview — the debounced sync (300ms) + rAF re-render needs time
    await switchTab(page, 'Preview');

    // Should now be a radiogroup, not a combobox
    await expect(workspace.getByRole('radiogroup'))
      .toBeVisible({ timeout: 5000 });
    await expect(workspace.getByRole('radio', { name: /Single/ })).toBeVisible();
    await expect(workspace.getByRole('radio', { name: /Married/ })).toBeVisible();
  });

  test('widgetHint dropdown in properties panel shows correct component names', async ({ page }) => {
    // Select the field in the editor
    await selectField(page, 'maritalStatus');

    // The widget dropdown should contain actual component names
    const widgetSelect = page.getByLabel('Widget');
    await expect(widgetSelect).toBeVisible();

    // Check that options match the renderer's PascalCase names
    const options = widgetSelect.locator('option');
    const texts = await options.allTextContents();
    expect(texts).toContain('Select');
    expect(texts).toContain('RadioGroup');
  });

  test('changing widget dropdown in UI updates preview rendering', async ({ page }) => {
    // Select the field in the editor so the properties panel shows
    await selectField(page, 'maritalStatus');

    // Change the widget dropdown via UI interaction
    const widgetSelect = page.getByLabel('Widget');
    await expect(widgetSelect).toBeVisible();
    await widgetSelect.selectOption('RadioGroup');

    // Switch to Preview
    await switchTab(page, 'Preview');
    const workspace = page.locator('[data-testid="workspace-Preview"]');

    // Should now render radio buttons
    await expect(workspace.getByRole('radiogroup'))
      .toBeVisible({ timeout: 5000 });
    await expect(workspace.getByRole('radio', { name: /Single/ })).toBeVisible();
    await expect(workspace.getByRole('radio', { name: /Married/ })).toBeVisible();
  });
});
