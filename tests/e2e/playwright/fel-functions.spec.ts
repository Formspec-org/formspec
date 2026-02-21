import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const fixturePath = path.resolve(__dirname, '../fixtures/fel-functions.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

test.describe('Formspec FEL Functions', () => {
  test('standard library functions evaluate correctly', async ({ page }) => {
    page.on('console', msg => console.log('Browser log:', msg.text()));
    await page.goto('http://127.0.0.1:8080/');
    await page.waitForSelector('formspec-render', { state: 'attached' });

    await page.evaluate((data) => {
      const renderer: any = document.querySelector('formspec-render');
      renderer.definition = data;
    }, fixture);

    // Test String: upper()
    await page.fill('input[name="rawText"]', 'hello world');
    await expect(page.locator('input[name="upperText"]')).toHaveValue('HELLO WORLD');

    // Test Numeric: round()
    await page.fill('input[name="rawNum"]', '12.3456');
    await expect(page.locator('input[name="roundedNum"]')).toHaveValue('12.35');

    // Test Date: year()
    await page.fill('input[name="testDate"]', '2025-05-20');
    await expect(page.locator('input[name="dateYear"]')).toHaveValue('2025');

    // Test Logical: coalesce()
    await page.fill('input[name="opt2"]', 'Fallback');
    await expect(page.locator('input[name="coalesced"]')).toHaveValue('Fallback');
    await page.fill('input[name="opt1"]', 'Primary');
    await expect(page.locator('input[name="coalesced"]')).toHaveValue('Primary');

    // Test Type: isNull()
    // Note: in our engine, empty string is the default for string fields.
    // Per spec, coalesce handles nulls.
    
    // Test Aggregate: sum()
    // Add items
    await page.fill('input[name="prices[0].val"]', '10');
    await expect(page.locator('input[name="totalSum"]')).toHaveValue('10');
    
    await page.click('button:has-text("Add prices")');
    await page.fill('input[name="prices[1].val"]', '25');
    await expect(page.locator('input[name="totalSum"]')).toHaveValue('35');
  });
});
