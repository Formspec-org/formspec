import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { gotoHarness, mountDefinition, submitAndGetResponse } from '../helpers/harness';

const fixturePath = path.resolve(__dirname, '../../fixtures/edge-cases.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

test.describe('Integration: Numeric and Dependency Edge Behaviors', () => {
  test('should keep calculation behavior stable when multiplying price by an empty quantity', async ({ page }) => {
    await gotoHarness(page);
    await mountDefinition(page, fixture);

    await page.fill('input[name="price"]', '10');
    await page.fill('input[name="quantity"]', '');

    const total = page.locator('input[name="total"]');
    const totalValue = await total.inputValue();

    // We only assert stability here (not a specific coercion policy).
    expect(totalValue).not.toBe('NaN');

    const response = await submitAndGetResponse<any>(page);
    expect(response).toHaveProperty('data');
  });
});
