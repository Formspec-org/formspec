import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const fixture = {
  "$formspec": "1.0",
  "url": "http://example.org/form",
  "version": "1.0.0",
  "status": "active",
  "title": "Standard Definition Test",
  "items": [
    {
      "key": "isAgreed",
      "type": "field",
      "dataType": "boolean",
      "label": "I agree to terms"
    },
    {
      "key": "color",
      "type": "field",
      "dataType": "choice",
      "label": "Favorite Color",
      "options": [
        {"label": "Red", "value": "red"},
        {"label": "Blue", "value": "blue"},
        {"label": "Green", "value": "green"}
      ]
    },
    {
      "key": "birthDate",
      "type": "field",
      "dataType": "date",
      "label": "Birth Date"
    }
  ]
};

test.describe('Formspec Data Types (Standard)', () => {
  test('rendering and binding with standard key/type/dataType', async ({ page }) => {
    await page.goto('http://127.0.0.1:8080/');
    await page.waitForSelector('formspec-render', { state: 'attached' });

    await page.evaluate((data) => {
      const renderer: any = document.querySelector('formspec-render');
      renderer.definition = data;
    }, fixture);

    // Check Boolean (Checkbox)
    const checkbox = page.locator('input[name="isAgreed"][type="checkbox"]');
    await expect(checkbox).toBeVisible();
    await checkbox.check();
    
    // Check Choice (Select)
    const select = page.locator('select[name="color"]');
    await expect(select).toBeVisible();
    await select.selectOption('blue');

    // Check Date
    const dateInput = page.locator('input[name="birthDate"][type="date"]');
    await expect(dateInput).toBeVisible();
    await dateInput.fill('1990-01-01');

    // Submit and verify data
    const response = await page.evaluate(() => {
        return new Promise((resolve) => {
            document.addEventListener('formspec-submit', (e: any) => resolve(e.detail), { once: true });
            const buttons = Array.from(document.querySelectorAll('button'));
            const submitBtn = buttons.find(b => b.textContent === 'Submit');
            submitBtn?.click();
        });
    }) as any;

    expect(response.data).toEqual({
        isAgreed: true,
        color: 'blue',
        birthDate: '1990-01-01'
    });
  });

  test('rendering and binding with multiChoice and money', async ({ page }) => {
    const multiFixture = {
      "$formspec": "1.0",
      "url": "http://example.org/form",
      "version": "1.0.0",
      "status": "active",
      "title": "Complex Types Test",
      "items": [
        {
          "key": "tags",
          "type": "field",
          "dataType": "multiChoice",
          "label": "Tags",
          "options": [
            {"label": "A", "value": "a"},
            {"label": "B", "value": "b"},
            {"label": "C", "value": "c"}
          ]
        },
        {
          "key": "price",
          "type": "field",
          "dataType": "money",
          "label": "Price"
        }
      ]
    };

    await page.goto('http://127.0.0.1:8080/');
    await page.waitForSelector('formspec-render', { state: 'attached' });

    await page.evaluate((data) => {
      const renderer: any = document.querySelector('formspec-render');
      renderer.definition = data;
    }, multiFixture);

    // Test multiChoice
    await page.locator('input[value="a"]').click();
    await page.locator('input[value="c"]').click();

    // Test money
    await page.fill('input[placeholder="Amount"]', '123.45');
    await page.fill('input[placeholder="Currency"]', 'EUR');

    // Submit and verify
    const response = await page.evaluate(() => {
        return new Promise((resolve) => {
            document.addEventListener('formspec-submit', (e: any) => resolve(e.detail), { once: true });
            const buttons = Array.from(document.querySelectorAll('button'));
            const submitBtn = buttons.find(b => b.textContent === 'Submit');
            submitBtn?.click();
        });
    }) as any;

    expect(response.data).toEqual({
        tags: ['a', 'c'],
        price: { amount: 123.45, currency: 'EUR' }
    });
  });
});
