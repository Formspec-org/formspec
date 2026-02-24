import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { gotoHarness, mountDefinition, submitAndGetResponse } from '../helpers/harness';

const fixturePath = path.resolve(__dirname, '../../fixtures/kitchen-sink-smoke.definition.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const componentFixturePath = path.resolve(__dirname, '../../fixtures/kitchen-sink-smoke.component.json');
const componentFixture = JSON.parse(fs.readFileSync(componentFixturePath, 'utf8'));

test.describe('Smoke: Kitchen Sink Flow', () => {
  test('should execute the core kitchen-sink flow in harness smoke mode', async ({ page }) => {
    await gotoHarness(page);
    await mountDefinition(page, fixture);
    await page.evaluate((componentDocument) => {
      const renderer: any = document.querySelector('formspec-render');
      renderer.componentDocument = componentDocument;
    }, componentFixture);

    const userName = page.locator('input[name="userName"]');
    const showAdvanced = page.locator('input[name="showAdvanced"]');
    const theme = page.locator('select[name="theme"]');
    const notificationEmail = page.locator('.formspec-checkbox-group input[name="notifications"][value="email"]');

    await expect(page.locator('h2', { hasText: 'Basic Information' })).toBeVisible();
    await expect(userName).toHaveValue('John Doe');
    await userName.fill('Shelley Agent');

    await showAdvanced.check();
    await theme.selectOption('dark');
    await notificationEmail.check();

    await page.locator('.formspec-wizard-next').click();
    await expect(page.locator('h2', { hasText: 'Inventory Management' })).toBeVisible();

    const price = page.locator('input[name="inventory[0].price"]');
    const quantity = page.locator('input[name="inventory[0].quantity"]');
    const itemName = page.locator('input[name="inventory[0].itemName"]');
    await itemName.fill('Laptop');
    await price.fill('100');
    await quantity.fill('2');

    const addRow = page.locator('.formspec-repeat-add').first();
    await addRow.click();
    await page.fill('input[name="inventory[1].itemName"]', 'Monitor');
    await page.fill('input[name="inventory[1].price"]', '50');
    await page.fill('input[name="inventory[1].quantity"]', '1');

    const summary = page.locator('.formspec-summary');
    await expect(summary.locator('dd')).toHaveText('250');
    await expect(page.locator('tbody tr')).toHaveCount(2);

    await page.locator('.formspec-wizard-next').click();
    await expect(page.locator('h2', { hasText: 'Financials & Schedule' })).toBeVisible();

    await page.fill('input[name="budget"]', '500');
    await page.locator('button.formspec-tab', { hasText: 'Dates' }).click();
    await page.fill('input[name="startDate"]', '2026-01-01');
    await page.fill('input[name="endDate"]', '2026-01-15');

    const response = await submitAndGetResponse<any>(page);
    expect(response.data.userName).toBe('Shelley Agent');
    expect(response.data.showAdvanced).toBe(true);
    expect(response.data.theme).toBe('dark');
    expect(response.data.notifications).toContain('email');
    expect(response.data.inventory).toHaveLength(2);
    expect(response.data.inventory?.[0]).toMatchObject({
      itemName: 'Laptop',
      price: 100,
      quantity: 2,
      subtotal: 200
    });
    expect(response.data.inventory?.[1]).toMatchObject({
      itemName: 'Monitor',
      price: 50,
      quantity: 1,
      subtotal: 50
    });
    expect(response.data.grandTotal).toBe(250);
    expect(response.data.budget).toBe(500);
    expect(response.data.startDate).toBe('2026-01-01');
    expect(response.data.endDate).toBe('2026-01-15');
  });
});
