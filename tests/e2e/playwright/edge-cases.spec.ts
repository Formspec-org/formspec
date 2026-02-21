import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const fixturePath = path.resolve(__dirname, '../fixtures/edge-cases.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

test.describe('Formspec Edge Cases', () => {
  test('Deep Pruning: hidden group hides children in response', async ({ page }) => {
    await page.goto('http://127.0.0.1:8080/');
    await page.waitForSelector('formspec-render', { state: 'attached' });

    await page.evaluate((data) => {
      const renderer: any = document.querySelector('formspec-render');
      renderer.definition = data;
    }, fixture);

    const showParent = page.locator('input[name="showParent"]');
    const childInput = page.locator('input[name="parent.child"]');

    // Show it, fill it
    await showParent.check();
    await childInput.fill('Hello');
    
    // Hide it
    await showParent.uncheck();

    // Submit and verify 'parent' is missing or child is missing
    const response = await page.evaluate(() => {
        return new Promise((resolve) => {
            document.addEventListener('formspec-submit', (e: any) => resolve(e.detail), { once: true });
            const buttons = Array.from(document.querySelectorAll('button'));
            const submitBtn = buttons.find(b => b.textContent === 'Submit');
            submitBtn?.click();
        });
    }) as any;

    expect(response.data.parent).toBeUndefined();
  });

  test('Null Propagation: price * quantity where quantity is empty', async ({ page }) => {
    await page.goto('http://127.0.0.1:8080/');
    await page.waitForSelector('formspec-render', { state: 'attached' });

    await page.evaluate((data) => {
      const renderer: any = document.querySelector('formspec-render');
      renderer.definition = data;
    }, fixture);

    await page.fill('input[name="price"]', '10');
    // quantity is empty (default 0 in our current engine, but let's see)
    // Actually our engine defaults numbers to 0. 
    // Let's test what happens if it's NaN or similar.
  });
});
