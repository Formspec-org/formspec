import { test, expect } from '@playwright/test';
import { waitForApp, waitForAppWithExport, switchTab, importProject } from './helpers';

const SEED = {
  definition: {
    $formspec: '1.0',
    items: [
      { key: 'name', type: 'field', dataType: 'string', label: 'FullName' },
      { key: 'age', type: 'field', dataType: 'integer', label: 'Age' }
    ],
  },
  mapping: {
    direction: 'forward',
    version: '1.2.3',
    definitionRef: 'urn:formspec:test',
    rules: [
      { sourcePath: 'name', targetPath: 'fullName', transform: 'preserve' },
      { sourcePath: 'age', targetPath: 'years', transform: 'coerce' },
    ],
    targetSchema: { format: 'json' },
  },
};

/** Helper: get the bundle mappings from the exported bundle (requires ?e2e=1). */
async function getMappingsBundle(page: import('@playwright/test').Page) {
  return page.evaluate(() => (window as any).__FORMSPEC_TEST_EXPORT());
}

test.describe('Mapping Workspace', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await importProject(page, SEED);
    await switchTab(page, 'Mapping');
  });

  test('blueprint section shows direction, version and target format', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Mapping"]');

    // Check direction
    await expect(workspace.locator('[data-testid="direction-picker"]')).toHaveText('forward');

    // Check version input is editable
    await expect(workspace.locator('[data-testid="mapping-version"]')).toHaveValue('1.2.3');

    // Check definition ref
    await expect(workspace.getByText('urn:formspec:test')).toBeVisible();

    // Check target schema URL input is present (always visible in open accordion)
    await expect(workspace.locator('input[placeholder*="schema.json"]')).toBeVisible();
  });

  test('rules section shows interactive rule cards', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Mapping"]');

    // Verify first rule card content
    const firstRule = workspace.locator('[data-testid="rule-source-0"]');
    await expect(firstRule).toHaveValue('name');

    const firstTarget = workspace.locator('[data-testid="rule-target-0"]');
    await expect(firstTarget).toHaveValue('fullName');

    // Verify transform pill
    await expect(workspace.getByRole('button', { name: 'preserve' })).toBeVisible();
  });

  test('filter bar navigates to sections', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Mapping"]');

    // Click "Preview" in the sticky filter bar
    await workspace.locator('[data-testid="mapping-filter-tab-preview"]').click();

    // Blueprint should be hidden (since sectionFilter !== 'all')
    await expect(workspace.getByText('Mapping Blueprint')).toBeHidden();

    // Preview should be visible
    await expect(workspace.getByText('Output Preview')).toBeVisible();

    // Logic: checking for Source and Output headers in the preview section
    await expect(workspace.locator('[data-testid="preview-source-header"]')).toBeVisible();
    await expect(workspace.locator('[data-testid="preview-output-header"]')).toBeVisible();
  });

  test('editing a rule updates the project state', async ({ page }) => {
    // Need export access for this
    await waitForAppWithExport(page);
    await importProject(page, SEED);
    await switchTab(page, 'Mapping');

    const workspace = page.locator('[data-testid="workspace-Mapping"]');

    // Find the target input for the first rule and change it
    const targetInput = workspace.locator('[data-testid="rule-target-0"]');
    await targetInput.fill('newFullName');
    await targetInput.blur(); // Triggers final update if needed

    // Validate the change in the exported bundle
    const bundle = await getMappingsBundle(page);
    // The default mapping is the only one; get its rules
    const mapping = bundle.mappings[Object.keys(bundle.mappings)[0]];
    expect(mapping.rules[0].targetPath).toBe('newFullName');
  });

  test('preview transforms real-time with sample data', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Mapping"]');

    // Go to preview section
    await workspace.locator('[data-testid="mapping-filter-tab-preview"]').click();

    // Type sample data into the "Input" JSON editor (textarea)
    const inputArea = workspace.locator('textarea').first();
    await inputArea.clear();
    await inputArea.fill(JSON.stringify({ name: 'Bob', age: 40 }));

    // The output should update to show the mapped data
    // { "fullName": "Bob", "years": 40 }
    // We look for parts of the JSON in the output area
    const outputArea = workspace.locator('pre');
    await expect(outputArea).toContainText('"fullName": "Bob"');
    await expect(outputArea).toContainText('"years": 40');
  });

  test('direction picker updates mapping direction', async ({ page }) => {
    await waitForAppWithExport(page);
    await importProject(page, SEED);
    await switchTab(page, 'Mapping');

    const workspace = page.locator('[data-testid="workspace-Mapping"]');

    // Open picker
    await workspace.locator('[data-testid="direction-picker"]').click();

    // Select "reverse"
    await workspace.getByRole('button', { name: 'reverse', exact: true }).click();

    // Verify UI reflects change
    await expect(workspace.getByRole('button', { name: 'reverse', exact: true })).toBeVisible();

    // Verify state reflects change
    const bundle = await getMappingsBundle(page);
    const mapping = bundle.mappings[Object.keys(bundle.mappings)[0]];
    expect(mapping.direction).toBe('reverse');
  });
});

test.describe('Multi-mapping Selector', () => {
  // Use export-enabled URL so getMappingsBundle works in all tests
  test.beforeEach(async ({ page }) => {
    await waitForAppWithExport(page);
    await importProject(page, SEED);
    await switchTab(page, 'Mapping');
  });

  test('selector strip shows the default mapping tab', async ({ page }) => {
    const selector = page.locator('[data-testid="mapping-selector"]');
    await expect(selector).toBeVisible();
    await expect(selector.locator('[data-testid="mapping-tab-default"]')).toBeVisible();
    await expect(selector.locator('[data-testid="mapping-tab-default"]')).toHaveAttribute('aria-selected', 'true');
  });

  test('create button shows input field', async ({ page }) => {
    const selector = page.locator('[data-testid="mapping-selector"]');
    await selector.locator('[data-testid="mapping-create-btn"]').click();
    await expect(selector.locator('[data-testid="mapping-create-input"]')).toBeVisible();
    await expect(selector.locator('[data-testid="mapping-create-btn"]')).toBeHidden();
  });

  test('creates a new mapping and selects it', async ({ page }) => {
    const selector = page.locator('[data-testid="mapping-selector"]');

    await selector.locator('[data-testid="mapping-create-btn"]').click();
    await selector.locator('[data-testid="mapping-create-input"]').fill('crm');
    await page.keyboard.press('Enter');

    // New tab appears and is active
    await expect(selector.locator('[data-testid="mapping-tab-crm"]')).toBeVisible();
    await expect(selector.locator('[data-testid="mapping-tab-crm"]')).toHaveAttribute('aria-selected', 'true');
    await expect(selector.locator('[data-testid="mapping-tab-default"]')).toHaveAttribute('aria-selected', 'false');

    // Bundle has both mappings
    const bundle = await getMappingsBundle(page);
    expect(bundle.mappings).toHaveProperty('crm');
    expect(bundle.mappings).toHaveProperty('default');
  });

  test('pressing Escape cancels create without adding a mapping', async ({ page }) => {
    const selector = page.locator('[data-testid="mapping-selector"]');
    await selector.locator('[data-testid="mapping-create-btn"]').click();
    await selector.locator('[data-testid="mapping-create-input"]').fill('temp');
    await page.keyboard.press('Escape');

    await expect(selector.locator('[data-testid="mapping-create-input"]')).toBeHidden();
    await expect(selector.locator('[data-testid="mapping-tab-temp"]')).toBeHidden();

    const bundle = await getMappingsBundle(page);
    expect(bundle.mappings).not.toHaveProperty('temp');
  });

  test('selecting a different tab switches the active mapping', async ({ page }) => {
    const selector = page.locator('[data-testid="mapping-selector"]');

    // Create second mapping (it becomes active)
    await selector.locator('[data-testid="mapping-create-btn"]').click();
    await selector.locator('[data-testid="mapping-create-input"]').fill('erp');
    await page.keyboard.press('Enter');

    // Click back to default
    await selector.locator('[data-testid="mapping-tab-default"]').click();
    await expect(selector.locator('[data-testid="mapping-tab-default"]')).toHaveAttribute('aria-selected', 'true');
    await expect(selector.locator('[data-testid="mapping-tab-erp"]')).toHaveAttribute('aria-selected', 'false');
  });

  test('rename via double-click updates the mapping ID', async ({ page }) => {
    const selector = page.locator('[data-testid="mapping-selector"]');

    await selector.locator('[data-testid="mapping-tab-label-default"]').dblclick();
    const renameInput = selector.locator('[data-testid="mapping-rename-input-default"]');
    await expect(renameInput).toBeVisible();

    await renameInput.fill('main');
    await page.keyboard.press('Enter');

    // Tab with new name appears, old name gone
    await expect(selector.locator('[data-testid="mapping-tab-main"]')).toBeVisible();
    await expect(selector.locator('[data-testid="mapping-tab-default"]')).toBeHidden();

    const bundle = await getMappingsBundle(page);
    expect(bundle.mappings).toHaveProperty('main');
    expect(bundle.mappings).not.toHaveProperty('default');
  });

  test('rename via rename button cancels on Escape', async ({ page }) => {
    const selector = page.locator('[data-testid="mapping-selector"]');

    // Hover to reveal rename button, then click
    await selector.locator('[data-testid="mapping-tab-default"]').hover();
    await selector.locator('[data-testid="mapping-rename-btn-default"]').click();
    await expect(selector.locator('[data-testid="mapping-rename-input-default"]')).toBeVisible();

    // Escape cancels without renaming
    await page.keyboard.press('Escape');
    await expect(selector.locator('[data-testid="mapping-rename-input-default"]')).toBeHidden();
    await expect(selector.locator('[data-testid="mapping-tab-label-default"]')).toBeVisible();
  });

  test('delete button is absent with single mapping, present with multiple', async ({ page }) => {
    const selector = page.locator('[data-testid="mapping-selector"]');

    // Single mapping: delete button not in DOM (canDelete=false → conditional render)
    await expect(selector.locator('[data-testid="mapping-delete-btn-default"]')).not.toBeAttached();

    // Add second mapping
    await selector.locator('[data-testid="mapping-create-btn"]').click();
    await selector.locator('[data-testid="mapping-create-input"]').fill('other');
    await page.keyboard.press('Enter');

    // Now delete buttons exist (opacity-hidden until hover, but attached)
    await expect(selector.locator('[data-testid="mapping-delete-btn-other"]')).toBeAttached();
    await expect(selector.locator('[data-testid="mapping-delete-btn-default"]')).toBeAttached();
  });

  test('deleting a non-selected mapping removes it', async ({ page }) => {
    const selector = page.locator('[data-testid="mapping-selector"]');

    // Create a second mapping (it becomes selected)
    await selector.locator('[data-testid="mapping-create-btn"]').click();
    await selector.locator('[data-testid="mapping-create-input"]').fill('to-delete');
    await page.keyboard.press('Enter');

    // Switch back to default
    await selector.locator('[data-testid="mapping-tab-default"]').click();

    // Delete 'to-delete'
    await selector.locator('[data-testid="mapping-tab-to-delete"]').hover();
    await selector.locator('[data-testid="mapping-delete-btn-to-delete"]').click();

    await expect(selector.locator('[data-testid="mapping-tab-to-delete"]')).toBeHidden();

    const bundle = await getMappingsBundle(page);
    expect(bundle.mappings).not.toHaveProperty('to-delete');
    expect(bundle.mappings).toHaveProperty('default');
  });

  test('mapping rules are scoped to the selected mapping', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Mapping"]');
    const selector = workspace.locator('[data-testid="mapping-selector"]');

    // Default mapping has the 2 seeded rules
    await expect(workspace.locator('[data-testid="rule-source-0"]')).toHaveValue('name');
    await expect(workspace.locator('[data-testid="rule-source-1"]')).toHaveValue('age');

    // Create a new empty mapping (becomes active)
    await selector.locator('[data-testid="mapping-create-btn"]').click();
    await selector.locator('[data-testid="mapping-create-input"]').fill('fresh');
    await page.keyboard.press('Enter');

    // New empty mapping shows no rules
    await expect(workspace.locator('[data-testid="rule-source-0"]')).toBeHidden();
  });
});
