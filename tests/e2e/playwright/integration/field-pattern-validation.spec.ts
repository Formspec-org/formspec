import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { gotoHarness, mountDefinition } from '../helpers/harness';

const fixturePath = path.resolve(__dirname, '../../fixtures/static-validation.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

test.describe('Integration: Field Pattern Validation', () => {
  test('should show pattern mismatch errors when zip code input does not match the regex', async ({ page }) => {
    await gotoHarness(page);
    await mountDefinition(page, fixture);

    const zipInput = page.locator('input[name="zipCode"]');
    const zipWrapper = page.locator('.formspec-field[data-name="zipCode"]');
    const errorDisplay = zipWrapper.locator('.formspec-error');

    // Initial state: empty string doesn't match ^[0-9]{5}$
    await expect(errorDisplay).toHaveText('Pattern mismatch');

    await zipInput.fill('123');
    await expect(errorDisplay).toHaveText('Pattern mismatch');

    await zipInput.fill('12345');
    await expect(errorDisplay).toHaveText('');

    await zipInput.fill('123456');
    await expect(errorDisplay).toHaveText('Pattern mismatch');

    await zipInput.fill('abcde');
    await expect(errorDisplay).toHaveText('Pattern mismatch');
  });
});
