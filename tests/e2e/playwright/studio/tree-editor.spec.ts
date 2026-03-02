import { expect, test } from '@playwright/test';
import { gotoStudio, selectTreeNode, treeNodeByLabel } from './helpers';

test.describe('Formspec Studio - Tree Editor', () => {
  test.beforeEach(async ({ page }) => {
    await gotoStudio(page);
  });

  test('renders the seeded definition tree', async ({ page }) => {
    await expect(page.locator('.tree-header-title')).toHaveText('Untitled Form');
    await expect(page.locator('.tree-node')).toHaveCount(4);
  });

  test('adds a new root field inline and auto-selects it', async ({ page }) => {
    await page.locator('.tree-add-root .tree-add-btn').click();
    await page.fill('.inline-add-input', 'Phone Number');
    await page.press('.inline-add-input', 'Enter');

    await expect(page.locator('.tree-node-label', { hasText: 'Phone Number' })).toBeVisible();
    await expect(page.locator('.property-type-header')).toContainText('Field');
    await expect(page.locator('.studio-input[value="phone-number"]')).toBeVisible();
  });

  test('adds a child field inside a group', async ({ page }) => {
    await selectTreeNode(page, 'Basic Information');
    await page
      .locator('.tree-group-add-row .tree-add-btn', {
        hasText: '+ Add Item',
      })
      .first()
      .click();

    await page.fill('.inline-add-input', 'Department');
    await page.selectOption('.inline-add-type', 'field');
    await page.click('.inline-add-confirm');

    await expect(treeNodeByLabel(page, 'Department')).toBeVisible();
  });

  test('moves root item up and down with action buttons', async ({ page }) => {
    await selectTreeNode(page, 'Additional Notes');
    await page.getByTitle('Move up').click();

    const rootLabels = page
      .locator('.tree-node-wrapper[data-depth="0"] .tree-node-label')
      .allInnerTexts();
    await expect(rootLabels).resolves.toEqual(['Additional Notes', 'Basic Information']);

    await selectTreeNode(page, 'Additional Notes');
    await page.getByTitle('Move down').click();
    await expect(page.locator('.tree-node-wrapper[data-depth="0"] .tree-node-label').first()).toHaveText(
      'Basic Information',
    );
  });

  test('deletes an item and clears selected item panel', async ({ page }) => {
    await selectTreeNode(page, 'Additional Notes');
    await page.getByTitle('Delete').click();

    await expect(treeNodeByLabel(page, 'Additional Notes')).toHaveCount(0);
    await expect(page.locator('.properties-empty')).toContainText('Select an item');
  });

  test('collapses and expands groups in tree', async ({ page }) => {
    await expect(treeNodeByLabel(page, 'Full Name')).toBeVisible();
    await treeNodeByLabel(page, 'Basic Information').locator('.tree-node-toggle').click();
    await expect(treeNodeByLabel(page, 'Full Name')).toHaveCount(0);

    await treeNodeByLabel(page, 'Basic Information').locator('.tree-node-toggle').click();
    await expect(treeNodeByLabel(page, 'Full Name')).toBeVisible();
  });
});
