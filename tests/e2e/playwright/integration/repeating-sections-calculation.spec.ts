import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { gotoHarness, mountDefinition, submitAndGetResponse } from '../helpers/harness';

const fixturePath = path.resolve(__dirname, '../../fixtures/repeating-sections.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

test.describe('Integration: Repeating Sections Calculation', () => {
  test('should add repeat rows and recompute subtotals when line items are edited', async ({ page }) => {
    await gotoHarness(page);
    await mountDefinition(page, fixture);

    // First instance should be there
    const price0 = page.locator('input[name="lineItems[0].price"]');
    const quantity0 = page.locator('input[name="lineItems[0].quantity"]');
    const subtotal0 = page.locator('input[name="lineItems[0].subtotal"]');

    await price0.fill('10');
    await quantity0.fill('3');
    await page.waitForTimeout(50);
    await expect(subtotal0).toHaveValue('30');

    // Add another instance
    const addBtn = page.locator('button', { hasText: 'Add Line Items' });
    await addBtn.click();

    const price1 = page.locator('input[name="lineItems[1].price"]');
    const quantity1 = page.locator('input[name="lineItems[1].quantity"]');
    const subtotal1 = page.locator('input[name="lineItems[1].subtotal"]');

    await price1.fill('20');
    await quantity1.fill('2');
    await page.waitForTimeout(50);
    await expect(subtotal1).toHaveValue('40');

    // Check response
    const response = await submitAndGetResponse<any>(page);

    expect(response.data).toEqual({
        lineItems: [
            { price: 10, quantity: 3, subtotal: 30 },
            { price: 20, quantity: 2, subtotal: 40 }
        ]
    });
  });
});
