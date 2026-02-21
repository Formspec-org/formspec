import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const fixturePath = path.resolve(__dirname, '../fixtures/shopping-cart.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

test.describe('Formspec <formspec-render> Component', () => {
  test('dynamic calculation and visibility evaluation', async ({ page }) => {
    page.on('console', msg => console.log('Browser log:', msg.text()));
    page.on('pageerror', err => console.log('Browser err:', err));

    await page.goto('http://127.0.0.1:8080/');
    await page.waitForSelector('formspec-render', { state: 'attached' });

    // Pass the fixture JSON into the renderer
    await page.evaluate((data) => {
      const renderer: any = document.querySelector('formspec-render');
      renderer.definition = data;
    }, fixture);

    // Initial state checks
    const priceInput = page.locator('input[name="price"]');
    const quantityInput = page.locator('input[name="quantity"]');
    const totalInput = page.locator('input[name="total"]');
    const discountInput = page.locator('input[name="discountCode"]');

    await expect(totalInput).toHaveValue('0');
    
    // Discount input wrapper should be hidden initially because total <= 50
    const discountWrapper = discountInput.locator('..');
    await expect(discountWrapper).toHaveCSS('display', 'none');

    // Fill in values
    await priceInput.fill('10');
    await quantityInput.fill('2');

    // Wait slightly for the event cycle to complete
    await page.waitForTimeout(50);

    // Total should update via calculate expression: price * quantity
    await expect(totalInput).toHaveValue('20');
    
    // Still hidden (20 <= 50)
    await expect(discountWrapper).toHaveCSS('display', 'none');

    // Fill in a value to trigger visibility
    await priceInput.fill('30');
    await page.waitForTimeout(50);
    
    await expect(totalInput).toHaveValue('60');

    // Total > 50, discountCode should be visible
    await expect(discountWrapper).toHaveCSS('display', 'block');

    // Test Response emission
    await discountInput.fill('SUMMER20');
    await page.waitForTimeout(50);
    
    // Evaluate response from the component
    const response = await page.evaluate(() => {
        return new Promise((resolve) => {
            document.addEventListener('formspec-submit', (e: any) => resolve(e.detail), { once: true });
            document.querySelector('button[type="button"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
    });

    expect(response).toEqual({
        data: {
            price: 30,
            quantity: 2,
            total: 60,
            discountCode: 'SUMMER20'
        }
    });
  });
});
