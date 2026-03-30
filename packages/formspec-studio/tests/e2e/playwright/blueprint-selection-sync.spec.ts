import { test, expect } from '@playwright/test';
import { waitForApp, importDefinition, propertiesPanel, switchTab } from './helpers';

const SEED_DEFINITION = {
  $formspec: '1.0',
  items: [
    { key: 'firstName', type: 'field', dataType: 'string' },
    { key: 'lastName', type: 'field', dataType: 'string' },
    { key: 'email', type: 'field', dataType: 'string' },
    {
      key: 'address',
      type: 'group',
      children: [{ key: 'street', type: 'field', dataType: 'string' }],
    },
  ],
};

const PAGED_BLUEPRINT_DEFINITION = {
  $formspec: '1.0',
  formPresentation: { pageMode: 'wizard' },
  items: [
    {
      key: 'pageOne',
      type: 'group',
      label: 'Page One',
      children: [{ key: 'firstName', type: 'field', dataType: 'string' }],
    },
    {
      key: 'pageTwo',
      type: 'group',
      label: 'Page Two',
      children: [{ key: 'email', type: 'field', dataType: 'string' }],
    },
  ],
};

test.describe('Blueprint Selection Sync', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, SEED_DEFINITION);
    // Wait for the first field to be rendered before proceeding
    await page.waitForSelector('[data-testid="field-firstName"]', { timeout: 5000 });
  });

  test('Structure Tree click populates the Properties panel', async ({ page }) => {
    // Click on "firstName" in the Structure Tree
    await page.click('[data-testid="tree-item-firstName"]');

    // Properties panel should show "firstName" in the key input
    const properties = propertiesPanel(page);
    await expect(properties.locator('input[type="text"]').first()).toHaveValue('firstName');

    // Properties panel should show data type info (String)
    await expect(properties).toContainText('String');
  });

  test('Editor canvas click highlights the tree item', async ({ page }) => {
    // Click on the field block in the Editor canvas
    await page.click('[data-testid="field-firstName"]');

    // The tree item for firstName should now be selected (has accent styling)
    const treeItem = page.locator('[data-testid="tree-item-firstName"]');
    await expect(treeItem).toBeVisible();

    // Selected tree item gets bg-accent/10 text-accent classes
    await expect(treeItem).toHaveClass(/text-accent/);
  });

  test('Selection persists across tab switches', async ({ page }) => {
    // Select firstName in the editor
    await page.click('[data-testid="field-firstName"]');

    // Verify it is selected before switching
    const properties = propertiesPanel(page);
    await expect(properties.locator('input[type="text"]').first()).toHaveValue('firstName');

    // Switch to Layout tab
    await switchTab(page, 'Layout');

    // Switch back to Editor tab
    await switchTab(page, 'Editor');

    // Field block should still have selected styling (border-accent)
    await expect(page.locator('[data-testid="field-firstName"]')).toHaveClass(/border-accent/);

    // Properties panel should still show "firstName"
    await expect(properties.locator('input[type="text"]').first()).toHaveValue('firstName');
  });

  test('Clicking canvas background deselects the item', async ({ page }) => {
    // Select firstName first
    await page.click('[data-testid="field-firstName"]');
    const properties = propertiesPanel(page);
    await expect(properties.locator('input[type="text"]').first()).toHaveValue('firstName');

    // Click on the canvas container background (outside any field block)
    // Use the workspace container and click at the very top (above field blocks)
    await page.click('[data-testid="workspace-Editor"]', { position: { x: 10, y: 5 } });

    // When deselected, the right rail shows Form Health panel (not field properties).
    await expect(properties).toContainText('Form Health');
    await expect(properties).toContainText('Issues');
  });

  test('Clicking a structure item in another layout step activates that step and selects the field', async ({ page }) => {
    // Editor/Layout split: the Editor tree is flat, but the StructureTree
    // sidebar still scopes authored Page content by the active layout step.
    // Switch to the second step in the sidebar to reveal its children.
    await importDefinition(page, PAGED_BLUEPRINT_DEFINITION);

    // Wait for the sidebar page buttons to appear
    await page.waitForSelector('[data-testid="tree-item-pageOne.firstName"]', { timeout: 5000 });

    // Switch to Page Two in the StructureTree sidebar (scope to sidebar)
    const sidebar = page.locator('aside').first();
    await sidebar.getByRole('button', { name: /page two/i }).click();

    // Now the tree item for email should be visible
    await page.click('[data-testid="tree-item-pageTwo.email"]');

    // Properties panel should show the email field
    await expect(propertiesPanel(page).locator('input[type="text"]').first()).toHaveValue('email');
  });
});
