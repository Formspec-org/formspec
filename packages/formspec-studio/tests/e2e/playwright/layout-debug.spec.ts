import { test, expect } from '@playwright/test';
import { waitForApp, seedDefinition } from './helpers';

test('debug: component tree state after add Card then add field', async ({ page }) => {
  await waitForApp(page);
  await seedDefinition(page, {
    $formspec: '1.0',
    url: 'urn:debug-tree',
    version: '1.0.0',
    items: [],
  });

  // 1. Add a Card from palette
  await page.click('[data-testid="add-item"]');
  await page.locator('[data-testid="add-item-palette"]').waitFor();
  await page.locator('[data-testid="add-item-palette"] button:has-text("Card")').click();
  await expect(page.locator('[data-item-type="layout"]')).toHaveCount(1);

  // Dump tree state after Card
  const treeAfterCard = await page.evaluate(() => {
    return JSON.stringify((window as any).__testProject__.state.component.tree, null, 2);
  });
  console.log('=== Tree after adding Card ===');
  console.log(treeAfterCard);

  // 2. Add a Text field from palette
  await page.click('[data-testid="add-item"]');
  await page.locator('[data-testid="add-item-palette"]').waitFor();
  await page.locator('[data-testid="add-item-palette"]').getByRole('button', { name: /^Text Short/ }).click();
  await page.waitForTimeout(200);

  // Dump tree state after field
  const treeAfterField = await page.evaluate(() => {
    return JSON.stringify((window as any).__testProject__.state.component.tree, null, 2);
  });
  console.log('=== Tree after adding field ===');
  console.log(treeAfterField);

  // Dump definition state
  const defItems = await page.evaluate(() => {
    return JSON.stringify((window as any).__testProject__.state.definition.items, null, 2);
  });
  console.log('=== Definition items ===');
  console.log(defItems);

  // Check DOM structure
  const fieldInCard = await page.locator('[data-item-type="layout"]').locator('[data-item-type="field"]').count();
  const fieldAnywhere = await page.locator('[data-item-type="field"]').count();
  console.log(`Fields inside card DOM: ${fieldInCard}, total fields: ${fieldAnywhere}`);

  await page.screenshot({ path: '/tmp/tree-state.png', fullPage: true });
});
