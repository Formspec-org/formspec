import { test, expect, type Page } from '@playwright/test';
import { waitForApp, switchTab, importDefinition } from './helpers';

/** Layout canvas shows fields only after they are placed from Unassigned. */
async function selectLayoutFieldBlock(page: Page, itemKey: string) {
  await switchTab(page, 'Layout');
  const block = page.locator(`[data-testid="layout-field-${itemKey}"]`);
  if (!(await block.isVisible().catch(() => false))) {
    await page.locator(`[data-testid="unassigned-${itemKey}"]`).getByRole('button', { name: /Add/i }).click();
    await block.waitFor({ state: 'visible', timeout: 8000 });
  }
  await block.click();
}

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
    await importDefinition(page, CHOICE_DEF);
  });

  test('choice field renders as select dropdown by default', async ({ page }) => {
    await switchTab(page, 'Preview');
    const workspace = page.locator('[data-testid="workspace-Preview"]');
    await expect(workspace.getByRole('combobox', { name: 'Marital Status' }))
      .toBeVisible({ timeout: 3000 });
  });

  test('widgetHint dropdown shows all renderable widgets for choice fields', async ({ page }) => {
    await selectLayoutFieldBlock(page, 'maritalStatus');

    const widgetSelect = page.getByTestId('toolbar-widget');
    await expect(widgetSelect).toBeVisible();

    // Must match the webcomponent renderer's compatibility matrix
    const options = widgetSelect.locator('option');
    const texts = await options.allTextContents();
    expect(texts.some((t) => t.includes('Default'))).toBe(true);
    expect(texts).toContain('Select');
    expect(texts).toContain('RadioGroup');
    expect(texts).toContain('TextInput');
  });

  test('changing widget dropdown via mouse updates preview rendering', async ({ page }) => {
    await selectLayoutFieldBlock(page, 'maritalStatus');

    const widgetSelect = page.getByTestId('toolbar-widget');
    await expect(widgetSelect).toBeVisible();
    await widgetSelect.selectOption('RadioGroup');

    // Switch to Preview — the DOM should render the new widget
    await switchTab(page, 'Preview');
    const workspace = page.locator('[data-testid="workspace-Preview"]');

    await expect(workspace.getByRole('radiogroup'))
      .toBeVisible({ timeout: 5000 });
    await expect(workspace.getByRole('radio', { name: /Single/ })).toBeVisible();
    await expect(workspace.getByRole('radio', { name: /Married/ })).toBeVisible();
  });

  test('switching widget back to Select re-renders as dropdown', async ({ page }) => {
    await selectLayoutFieldBlock(page, 'maritalStatus');
    const widgetSelect = page.getByTestId('toolbar-widget');
    await widgetSelect.selectOption('RadioGroup');

    // Switch back to Select
    await widgetSelect.selectOption('Select');

    // Preview should render as combobox again
    await switchTab(page, 'Preview');
    const workspace = page.locator('[data-testid="workspace-Preview"]');
    await expect(workspace.getByRole('combobox', { name: 'Marital Status' }))
      .toBeVisible({ timeout: 5000 });
  });
});

// Reproduces the exact user flow: wizard-mode definition, choice field, widget change via UI
test.describe('widget change works in wizard mode', () => {
  const WIZARD_CHOICE_DEF = {
    $formspec: '1.0',
    url: 'urn:wizard-widget-test',
    version: '1.0.0',
    formPresentation: { pageMode: 'wizard' },
    items: [
      {
        key: 'priority',
        type: 'field',
        dataType: 'choice',
        label: 'Priority',
        options: [
          { value: 'low', label: 'Low' },
          { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' },
        ],
      },
    ],
  };

  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, WIZARD_CHOICE_DEF);
  });

  test('choice field renders as select by default, radiogroup after widget change', async ({ page }) => {
    // Verify default rendering
    await switchTab(page, 'Preview');
    const workspace = page.locator('[data-testid="workspace-Preview"]');
    await expect(workspace.getByRole('combobox', { name: /priority/i }))
      .toBeVisible({ timeout: 5000 });

    // Switch to Layout, select the field, then change its component type.
    await selectLayoutFieldBlock(page, 'priority');

    const widgetSelect = page.getByTestId('toolbar-widget');
    await expect(widgetSelect).toBeVisible();
    await widgetSelect.selectOption('RadioGroup');

    // Switch to Preview — should now render as a radiogroup
    await switchTab(page, 'Preview');
    await expect.poll(async () => (
      page.evaluate(() => {
        const el = document.querySelector('formspec-render') as any;
        return el?.componentDocument?.tree?.children?.[0]?.component ?? null;
      })
    )).toBe('RadioGroup');

    const previewState = await page.evaluate(() => {
      const el = document.querySelector('formspec-render') as any;
      const tree = el?.componentDocument?.tree;
      const findFirstBindComponent = (node: any): string | null => {
        if (!node) return null;
        if (node.bind && node.component) return node.component;
        for (const c of node.children ?? []) {
          const hit = findFirstBindComponent(c);
          if (hit) return hit;
        }
        return null;
      };
      return {
        componentRoot: tree?.component ?? null,
        fieldComponent: findFirstBindComponent(tree),
      };
    });
    expect(previewState.componentRoot).toBe('Stack');
    expect(previewState.fieldComponent).toBe('RadioGroup');

    await expect(workspace.getByRole('radiogroup'))
      .toBeVisible({ timeout: 5000 });
    await expect(workspace.getByRole('radio', { name: /Low/ })).toBeVisible();
    await expect(workspace.getByRole('radio', { name: /High/ })).toBeVisible();
  });
});
