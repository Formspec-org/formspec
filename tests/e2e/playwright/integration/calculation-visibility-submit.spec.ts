import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { gotoHarness, mountDefinition, submitAndGetResponse } from '../helpers/harness';

const fixturePath = path.resolve(__dirname, '../../fixtures/shopping-cart.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

test.describe('Integration: Dynamic Calculation, Visibility, and Submit', () => {
  test('should recalculate totals and toggle discount visibility when price and quantity change', async ({ page }) => {
    page.on('console', msg => console.log('Browser log:', msg.text()));
    page.on('pageerror', err => console.log('Browser err:', err));

    await gotoHarness(page);

    // Pass the fixture JSON into the renderer
    await mountDefinition(page, fixture);

    // Initial state checks
    const priceInput = page.locator('input[name="price"]');
    const quantityInput = page.locator('input[name="quantity"]');
    const totalInput = page.locator('input[name="total"]');
    const discountInput = page.locator('input[name="discountCode"]');
    const discountField = page.locator('.formspec-field[data-name="discountCode"]');

    await expect(totalInput).toHaveValue('0');
    
    // Discount field should be hidden initially because total <= 50
    await expect(discountField).toHaveClass(/formspec-hidden/);

    // Fill in values
    await priceInput.fill('10');
    await quantityInput.fill('2');

    // Wait slightly for the event cycle to complete
    await page.waitForTimeout(50);

    // Total should update via calculate expression: price * quantity
    await expect(totalInput).toHaveValue('20');
    
    // Still hidden (20 <= 50)
    await expect(discountField).toHaveClass(/formspec-hidden/);

    // Fill in a value to trigger visibility
    await priceInput.fill('30');
    await page.waitForTimeout(50);
    
    await expect(totalInput).toHaveValue('60');

    // Total > 50, discountCode should be visible
    await expect(discountField).not.toHaveClass(/formspec-hidden/);

    // Test Response emission
    await discountInput.fill('SUMMER20');
    await page.waitForTimeout(50);
    
    // Evaluate response from the component
    const response = await submitAndGetResponse<any>(page);

    expect(response.data).toEqual({
        price: 30,
        quantity: 2,
        total: 60,
        discountCode: 'SUMMER20'
    });
  });
});
