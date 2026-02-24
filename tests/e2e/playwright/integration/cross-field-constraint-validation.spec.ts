import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { gotoHarness, mountDefinition } from '../helpers/harness';

const fixturePath = path.resolve(__dirname, '../../fixtures/validation.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

test.describe('Integration: Cross-Field Constraint Validation', () => {
  test('should show and clear cross-field errors when startDate and endDate values change', async ({ page }) => {
    page.on('console', msg => console.log('Browser log:', msg.text()));
    page.on('pageerror', err => console.log('Browser err:', err));

    await gotoHarness(page);
    await mountDefinition(page, fixture);

    const startDateInput = page.locator('input[name="startDate"]');
    const endDateInput = page.locator('input[name="endDate"]');
    const endDateWrapper = page.locator('.formspec-field[data-name="endDate"]');
    const errorDisplay = endDateWrapper.locator('.formspec-error');

    // Initial state: 0 >= 0 is true, so no error
    await expect(errorDisplay).toHaveText('');

    // Set startDate to 10, endDate is 0. 0 >= 10 is false -> Error
    await startDateInput.fill('10');
    await page.waitForTimeout(50);
    await expect(errorDisplay).toHaveText('End date must be >= start date');

    // Set endDate to 15. 15 >= 10 is true -> Error gone
    await endDateInput.fill('15');
    await page.waitForTimeout(50);
    await expect(errorDisplay).toHaveText('');

    // Set endDate to 5. 5 >= 10 is false -> Error back
    await endDateInput.fill('5');
    await page.waitForTimeout(50);
    await expect(errorDisplay).toHaveText('End date must be >= start date');
  });
});
