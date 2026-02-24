import { test, expect } from '@playwright/test';
import { gotoHarness, mountDefinition, submitAndGetResponse } from '../helpers/harness';

test.describe('Integration: Response Pruning Behaviors', () => {
  test('should omit hidden conditional fields and include them when they become relevant', async ({ page }) => {
    await gotoHarness(page);

    await mountDefinition(page, {
      "$formspec": "1.0",
      "url": "http://example.org/forms/shopping-cart",
      "version": "1.0.0",
      "status": "draft",
      "title": "Shopping Cart",
      "items": [
        { "type": "field", "dataType": "decimal", "key": "price", "label": "Price" },
        { "type": "field", "dataType": "decimal", "key": "quantity", "label": "Quantity" },
        { "type": "field", "dataType": "decimal", "key": "total", "label": "Total" },
        { "type": "field", "dataType": "string", "key": "discountCode", "label": "Discount Code" }
      ],
      "binds": [
        { "path": "total", "calculate": "price * quantity", "readonly": true },
        { "path": "discountCode", "relevant": "total > 50" }
      ]
    });

    await page.fill('input[name="price"]', '10');
    await page.fill('input[name="quantity"]', '2');

    const hiddenResponse = await submitAndGetResponse<any>(page);
    expect(hiddenResponse.data).not.toHaveProperty('discountCode');

    await page.fill('input[name="price"]', '30');
    await page.fill('input[name="discountCode"]', 'SUMMER20');

    const visibleResponse = await submitAndGetResponse<any>(page);
    expect(visibleResponse.data.discountCode).toBe('SUMMER20');
  });
});
