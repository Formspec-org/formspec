import { test, expect } from '@playwright/test';
import {
  mountGrantApplication,
  goToPage,
  engineSetValue,
  engineVariable,
  addRepeatInstance,
  getResponse,
} from '../helpers/grant-app';

test.describe('Smoke: Grant Application Happy Path', () => {
  test('should execute the end-to-end happy path: data entry, repeat row, calculation, response contract', async ({ page }) => {
    // 1. Mount the grant application
    await mountGrantApplication(page);

    // 2. Verify page 1 (Applicant Info) is shown with correct fields
    const heading = page.locator('.formspec-wizard-panel:not(.formspec-hidden) h2').first();
    await expect(heading).toHaveText('Applicant Info');
    await expect(page.locator('[data-name="applicantInfo.orgName"]')).toBeVisible();
    await expect(page.locator('[data-name="applicantInfo.ein"]')).toBeVisible();

    // 3. Fill Applicant Info fields
    await engineSetValue(page, 'applicantInfo.contactName', 'Jane Smith');
    await engineSetValue(page, 'applicantInfo.orgName', 'Community Health Nonprofit');
    await engineSetValue(page, 'applicantInfo.ein', '12-3456789');

    // 4. Navigate to Budget page (page 3)
    await goToPage(page, 'Budget');
    const budgetHeading = page.locator('.formspec-wizard-panel:not(.formspec-hidden) h2').first();
    await expect(budgetHeading).toHaveText('Budget');

    // 5. Add a repeat instance for budget.lineItems
    await addRepeatInstance(page, 'budget.lineItems');
    await page.waitForTimeout(50);

    // 6. Set quantity and unitCost on lineItems[0]
    await engineSetValue(page, 'budget.lineItems[0].quantity', 4);
    await engineSetValue(page, 'budget.lineItems[0].unitCost', 250);
    await page.waitForTimeout(100);

    // 7. Verify @totalDirect variable is non-zero
    const totalDirect = await engineVariable(page, 'totalDirect');
    // totalDirect is a money object {amount, currency}
    expect(totalDirect).toBeTruthy();
    expect(totalDirect.amount).toBeGreaterThan(0);

    // 8. Get the response and assert structural contract
    const response = await getResponse(page, 'continuous');
    expect(response).toHaveProperty('data');
    expect(response.data).toHaveProperty('applicantInfo');
    expect(response.data.applicantInfo.contactName).toBe('Jane Smith');
    expect(response.data).toHaveProperty('budget');
  });
});
