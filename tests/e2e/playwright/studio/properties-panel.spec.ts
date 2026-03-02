import { expect, test } from '@playwright/test';
import { gotoStudio, propertyInput, selectTreeNode, treeNodeByLabel } from './helpers';

test.describe('Formspec Studio - Properties Panel', () => {
  test.beforeEach(async ({ page }) => {
    await gotoStudio(page);
  });

  test('edits root metadata and updates tree header', async ({ page }) => {
    await page.locator('.tree-header').click();
    await expect(page.locator('.property-type-header')).toContainText('Form Metadata');

    await propertyInput(page, 'Title').fill('Grant Intake Form');
    await propertyInput(page, 'URL').fill('https://example.gov/forms/grant-intake');

    await expect(page.locator('.tree-header-title')).toHaveText('Grant Intake Form');
    await expect(page.locator('.tree-header-meta')).toContainText('https://example.gov/forms/grant-intake');
  });

  test('edits field identity and behavior properties', async ({ page }) => {
    await selectTreeNode(page, 'Full Name');
    await expect(page.locator('.property-type-header')).toContainText('Field');

    await propertyInput(page, 'Label').fill('Legal Name');
    await propertyInput(page, 'Key').fill('legalName');
    await propertyInput(page, 'Data Type').selectOption('date');
    await propertyInput(page, 'Required').fill('true()');
    await propertyInput(page, 'Calculate').fill("'Jane Doe'");
    await propertyInput(page, 'Constraint').fill('string-length(.) > 0');
    await propertyInput(page, 'Relevant').fill('true()');

    const node = treeNodeByLabel(page, 'Legal Name');
    await expect(node.locator('.tree-node-key')).toContainText('legalName');
    await expect(node.locator('.tree-node-badge')).toHaveText('date');
    await expect(node.locator('.tree-node-bind[title="Required"]')).toBeVisible();
    await expect(node.locator('.tree-node-bind[title="Calculated"]')).toBeVisible();
    await expect(node.locator('.tree-node-bind[title="Constraint"]')).toBeVisible();
    await expect(node.locator('.tree-node-bind[title="Conditional"]')).toBeVisible();
  });

  test('edits group repeat settings and persists in JSON', async ({ page }) => {
    await selectTreeNode(page, 'Basic Information');
    await expect(page.locator('.property-type-header')).toContainText('Group');

    await propertyInput(page, 'Repeatable').selectOption('true');
    await propertyInput(page, 'Min Repeat').fill('1');
    await propertyInput(page, 'Max Repeat').fill('3');

    await page.getByRole('button', { name: 'JSON' }).click();
    const json = await page.locator('.json-editor-textarea').inputValue();
    expect(json).toContain('"repeatable": true');
    expect(json).toContain('"minRepeat": 1');
    expect(json).toContain('"maxRepeat": 3');
  });

  test('closes and re-opens properties panel', async ({ page }) => {
    await page.locator('.properties-close').click();
    await expect(page.locator('.studio-properties')).toHaveCount(0);
    await expect(page.locator('.properties-toggle-btn')).toBeVisible();

    await page.locator('.properties-toggle-btn').click();
    await expect(page.locator('.studio-properties')).toBeVisible();
  });
});
