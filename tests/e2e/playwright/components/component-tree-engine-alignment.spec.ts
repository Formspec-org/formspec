import { test, expect } from '@playwright/test';
import {
  mountGrantApplication,
  engineSetValue,
  engineValue,
} from '../helpers/grant-app';

test.describe('Components: Component Tree and Engine Alignment', () => {
  test.beforeEach(async ({ page }) => {
    await mountGrantApplication(page);
  });

  test('should render applicantInfo.orgName field in the DOM on page 1', async ({ page }) => {
    // Page 1 (Applicant Info) is shown by default
    const orgNameField = page.locator('[data-name="applicantInfo.orgName"]');
    await expect(orgNameField).toBeVisible();
  });

  test('should reflect engine setValue in the DOM input for applicantInfo.orgName', async ({ page }) => {
    await engineSetValue(page, 'applicantInfo.orgName', 'Test Organization');
    await page.waitForTimeout(100);

    // Verify engine has the value
    const engineVal = await engineValue(page, 'applicantInfo.orgName');
    expect(engineVal).toBe('Test Organization');

    // Verify DOM input reflects the value
    const input = page.locator('[data-name="applicantInfo.orgName"] input, input[name="applicantInfo.orgName"]').first();
    await expect(input).toHaveValue('Test Organization');
  });
});
