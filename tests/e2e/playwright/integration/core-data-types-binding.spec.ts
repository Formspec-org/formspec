import { test, expect } from '@playwright/test';
import { gotoHarness, mountDefinition, submitAndGetResponse } from '../helpers/harness';

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

test.describe('Integration: Core Data Types Bind and Submit', () => {
  test('should capture boolean choice and date values when submitting standard data-type fields', async ({ page }) => {
    await gotoHarness(page);
    await mountDefinition(page, fixture);

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
    const response = await submitAndGetResponse<any>(page);

    expect(response.data).toEqual({
        isAgreed: true,
        color: 'blue',
        birthDate: '1990-01-01'
    });
  });

  test('should capture multiChoice arrays and money objects when submitting complex data-type fields', async ({ page }) => {
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

    await gotoHarness(page);
    await mountDefinition(page, multiFixture);

    // Test multiChoice
    await page.locator('input[value="a"]').click();
    await page.locator('input[value="c"]').click();

    // Test money
    await page.fill('input[placeholder="Amount"]', '123.45');
    await page.fill('input[placeholder="Currency"]', 'EUR');

    // Submit and verify
    const response = await submitAndGetResponse<any>(page);

    expect(response.data).toEqual({
        tags: ['a', 'c'],
        price: { amount: 123.45, currency: 'EUR' }
    });
  });
});
