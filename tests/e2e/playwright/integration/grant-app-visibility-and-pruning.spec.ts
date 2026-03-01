import { test, expect } from '@playwright/test';
import {
  mountGrantApplication,
  engineSetValue,
} from '../helpers/grant-app';

test.describe('Grant Application: Visibility and Response Pruning', () => {
  test.beforeEach(async ({ page }) => {
    await mountGrantApplication(page);
  });

  test('should show indirectRate field for non-government org types', async ({ page }) => {
    await engineSetValue(page, 'applicantInfo.orgType', 'nonprofit');
    await page.waitForTimeout(100);

    const rateField = page.locator('[data-name="projectNarrative.indirectRate"]');
    await expect(rateField).not.toHaveClass(/formspec-hidden/);
  });

  test('should hide indirectRate field when orgType is government', async ({ page }) => {
    await engineSetValue(page, 'applicantInfo.orgType', 'government');
    await page.waitForTimeout(100);

    const rateField = page.locator('[data-name="projectNarrative.indirectRate"]');
    await expect(rateField).toHaveClass(/formspec-hidden/);
  });
});
