import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { gotoHarness, mountDefinition, submitAndGetResponse } from '../helpers/harness';

const fixturePath = path.resolve(__dirname, '../../fixtures/shopping-cart.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

test.describe('Integration: Response Schema Contract', () => {
  test('should emit required top-level response fields when submitting the form', async ({ page }) => {
    await gotoHarness(page);
    await mountDefinition(page, fixture);

    const response = await submitAndGetResponse<any>(page);

    expect(response).toHaveProperty('definitionUrl');
    expect(response).toHaveProperty('definitionVersion');
    expect(response).toHaveProperty('status');
    expect(response).toHaveProperty('data');
    expect(response).toHaveProperty('authored');

    expect(typeof response.definitionUrl).toBe('string');
    expect(typeof response.authored).toBe('string');
    expect(new Date(response.authored).toString()).not.toBe('Invalid Date');
  });
});
