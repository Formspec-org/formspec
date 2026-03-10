import { test, expect } from '@playwright/test';

const TOOLS_URL = 'http://localhost:8082/tools.html';

test.describe('Download & Export Tab', () => {
  test.beforeEach(async ({ page }) => {
    // Mock export endpoints (include ** suffix to match query params)
    await page.route('**/export/json**', (route) =>
      route.fulfill({ contentType: 'application/json', body: '{"org_name":"Community Health Partners"}' })
    );
    await page.route('**/export/csv**', (route) =>
      route.fulfill({ contentType: 'text/csv', body: 'org_name\n"Community Health Partners"' })
    );
    await page.route('**/export/xml**', (route) =>
      route.fulfill({ contentType: 'application/xml', body: '<GrantApplication><Applicant><OrganizationName>Community Health Partners</OrganizationName></Applicant></GrantApplication>' })
    );
    await page.goto(TOOLS_URL);
    // Switch to Export tab
    await page.locator('.tools-tab[data-tab="export"]').click();
    // Fill in valid JSON so export handlers don't bail on parse
    await page.locator('#export-input-data').fill('{"orgName":"Community Health Partners"}');
  });

  test('shows three export format cards', async ({ page }) => {
    await expect(page.locator('.export-card')).toHaveCount(3);
    await expect(page.locator('.export-card h4').nth(0)).toHaveText('JSON');
    await expect(page.locator('.export-card h4').nth(1)).toHaveText('CSV');
    await expect(page.locator('.export-card h4').nth(2)).toHaveText('XML');
  });

  test('clicking JSON download shows JSON output', async ({ page }) => {
    await page.locator('button[data-format="json"]').click();
    await expect(page.locator('#export-result')).toBeVisible();
    await expect(page.locator('#export-result-content')).toContainText('Community Health Partners');
    await expect(page.locator('#export-result-format')).toContainText('JSON');
  });

  test('clicking CSV download shows CSV output', async ({ page }) => {
    await page.locator('button[data-format="csv"]').click();
    await expect(page.locator('#export-result')).toBeVisible();
    await expect(page.locator('#export-result-content')).toContainText('org_name');
  });

  test('clicking XML download shows XML output', async ({ page }) => {
    await page.locator('button[data-format="xml"]').click();
    await expect(page.locator('#export-result')).toBeVisible();
    await expect(page.locator('#export-result-content')).toContainText('GrantApplication');
  });
});
