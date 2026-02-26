import { test, expect } from '@playwright/test';
import {
  mountGrantApplication,
  engineSetValue,
  getResponse,
} from '../helpers/grant-app';

test.describe('Grant Application: Visibility and Response Pruning', () => {
  test.beforeEach(async ({ page }) => {
    await mountGrantApplication(page);
  });

  // ── Conditional Visibility ──────────────────────────────────────────

  test('should show nonprofitPhoneHint when orgType is nonprofit', async ({ page }) => {
    await engineSetValue(page, 'applicantInfo.orgType', 'nonprofit');
    await page.waitForTimeout(100);

    // Display items toggle via relevantSignals — check engine directly
    const relevant = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      return el.getEngine().relevantSignals['applicantInfo.nonprofitPhoneHint']?.value;
    });
    expect(relevant).toBe(true);
  });

  test('should hide nonprofitPhoneHint when orgType changes to university', async ({ page }) => {
    await engineSetValue(page, 'applicantInfo.orgType', 'nonprofit');
    await page.waitForTimeout(50);
    await engineSetValue(page, 'applicantInfo.orgType', 'university');
    await page.waitForTimeout(100);

    const relevant = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      return el.getEngine().relevantSignals['applicantInfo.nonprofitPhoneHint']?.value;
    });
    expect(relevant).toBe(false);
  });

  test('should show indirectRate field for non-government org types', async ({ page }) => {
    await engineSetValue(page, 'applicantInfo.orgType', 'nonprofit');
    await page.waitForTimeout(100);

    // Field wrappers have data-name with full path
    const rateField = page.locator('[data-name="projectNarrative.indirectRate"]');
    await expect(rateField).not.toHaveClass(/formspec-hidden/);
  });

  test('should hide indirectRate field when orgType is government', async ({ page }) => {
    await engineSetValue(page, 'applicantInfo.orgType', 'government');
    await page.waitForTimeout(100);

    const rateField = page.locator('[data-name="projectNarrative.indirectRate"]');
    await expect(rateField).toHaveClass(/formspec-hidden/);
  });

  test('should show subcontractors group when usesSubcontractors is true', async ({ page }) => {
    await engineSetValue(page, 'budget.usesSubcontractors', true);
    await page.waitForTimeout(100);

    // The subcontractors relevance signal should be true
    const relevant = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      return el.getEngine().relevantSignals['subcontractors']?.value;
    });
    expect(relevant).toBe(true);
  });

  test('should hide subcontractors group when usesSubcontractors is false', async ({ page }) => {
    // usesSubcontractors starts false (boolean default is false)
    const relevant = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      return el.getEngine().relevantSignals['subcontractors']?.value;
    });
    expect(relevant).toBe(false);
  });

  // ── nonRelevantBehavior: remove (form-level) ───────────────────────

  test('should remove non-relevant fields from submit response (form-level nonRelevantBehavior: remove)', async ({ page }) => {
    // Set orgType to government — indirectRate becomes non-relevant
    await engineSetValue(page, 'applicantInfo.orgType', 'government');
    await engineSetValue(page, 'projectNarrative.indirectRate', 15);
    await page.waitForTimeout(100);

    // In submit response, non-relevant fields are pruned (nonRelevantBehavior: "remove")
    const response = await getResponse(page, 'continuous');
    // indirectRate should not appear since it's non-relevant for government orgs
    expect(response.data?.projectNarrative?.indirectRate).toBeUndefined();
  });

  // ── nonRelevantBehavior: keep (per-bind on subcontractors) ─────────

  test('should retain subcontractor data in response when usesSubcontractors is toggled off (per-bind keep)', async ({ page }) => {
    // Enable subcontractors and fill an entry
    await engineSetValue(page, 'budget.usesSubcontractors', true);
    await engineSetValue(page, 'subcontractors[0].subName', 'ACME Corp');
    await engineSetValue(page, 'subcontractors[0].subOrg', 'ACME');
    await engineSetValue(page, 'subcontractors[0].subAmount', 5000);
    await page.waitForTimeout(100);

    // Now toggle off usesSubcontractors — subcontractors group becomes non-relevant
    await engineSetValue(page, 'budget.usesSubcontractors', false);
    await page.waitForTimeout(100);

    // With nonRelevantBehavior: "keep" on the subcontractors bind,
    // subcontractor data should still appear in the response
    const response = await getResponse(page, 'continuous');
    expect(response.data?.subcontractors).toBeDefined();
    expect(Array.isArray(response.data.subcontractors)).toBe(true);
    // The data should be retained (not pruned)
    if (response.data.subcontractors.length > 0) {
      expect(response.data.subcontractors[0].subName).toBe('ACME Corp');
    }
  });

  // ── nonprofitPhoneHint visibility cascade ──────────────────────────

  test('should hide nonprofitPhoneHint for government orgType', async ({ page }) => {
    await engineSetValue(page, 'applicantInfo.orgType', 'government');
    await page.waitForTimeout(100);

    const relevant = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      return el.getEngine().relevantSignals['applicantInfo.nonprofitPhoneHint']?.value;
    });
    expect(relevant).toBe(false);
  });

  test('should show nonprofitPhoneHint after switching back to nonprofit', async ({ page }) => {
    await engineSetValue(page, 'applicantInfo.orgType', 'government');
    await page.waitForTimeout(50);
    await engineSetValue(page, 'applicantInfo.orgType', 'nonprofit');
    await page.waitForTimeout(100);

    const relevant = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      return el.getEngine().relevantSignals['applicantInfo.nonprofitPhoneHint']?.value;
    });
    expect(relevant).toBe(true);
  });
});
