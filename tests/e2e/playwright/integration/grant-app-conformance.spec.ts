/**
 * Grant Application Conformance Suite (ADR-0023 T-09)
 *
 * Exercises the spec contracts that can be verified through the real-world
 * grant application: engine identity, initial value hydration, mixed field
 * data entry, validation report shape, non-relevant behaviour modes, response
 * contract, and component `when` vs definition `relevant` distinction.
 *
 * TypeScript ↔ Python parity, screener routing, and form assembly remain in
 * kitchen-sink-holistic-conformance.spec.ts (ADR-0023 exception — those
 * require a synthetic fixture with a deterministic event trace and known
 * Python evaluator output snapshots).
 */

import { test, expect } from '@playwright/test';
import {
  mountGrantApplication,
  goToPage,
  engineValue,
  engineSetValue,
  engineVariable,
  getValidationReport,
  getResponse,
  addRepeatInstance,
} from '../helpers/grant-app';

test.describe('Integration: Grant App Conformance', () => {
  test.beforeEach(async ({ page }) => {
    await mountGrantApplication(page);
  });

  // ── Engine identity ──────────────────────────────────────────────────────

  test('should expose pinned definition url and version from loaded definition', async ({ page }) => {
    const identity = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      const def = el.getEngine().definition;
      return { url: def.url, version: def.version, versionAlgorithm: def.versionAlgorithm };
    });
    expect(identity.url).toBe('https://example.gov/forms/grant-application');
    expect(identity.version).toBe('1.0.0');
    expect(identity.versionAlgorithm).toBe('semver');
  });

  // ── Initial value hydration ──────────────────────────────────────────────

  test('should hydrate initialValue fields before any user interaction', async ({ page }) => {
    // contactPhone has initialValue: "202-555-0100" in definition.json
    const phone = await engineValue(page, 'applicantInfo.contactPhone');
    expect(phone).toBe('202-555-0100');
  });

  // ── Mixed field type data entry ──────────────────────────────────────────

  test('should accept mixed field types and reflect them in engine signals', async ({ page }) => {
    await engineSetValue(page, 'applicantInfo.orgName', 'Health Foundation');
    await engineSetValue(page, 'applicantInfo.orgType', 'nonprofit');
    await engineSetValue(page, 'projectNarrative.startDate', '2027-01-01');
    await engineSetValue(page, 'projectNarrative.endDate', '2028-01-01');
    await engineSetValue(page, 'projectNarrative.focusAreas', ['health', 'education']);
    await engineSetValue(page, 'budget.requestedAmount', { amount: 50000, currency: 'USD' });
    await page.waitForTimeout(100);

    expect(await engineValue(page, 'applicantInfo.orgName')).toBe('Health Foundation');
    expect(await engineValue(page, 'applicantInfo.orgType')).toBe('nonprofit');
    expect(await engineValue(page, 'projectNarrative.startDate')).toBe('2027-01-01');
    expect(await engineValue(page, 'projectNarrative.focusAreas')).toContain('health');
    const amount = await engineValue(page, 'budget.requestedAmount');
    expect(amount).toMatchObject({ amount: 50000, currency: 'USD' });
  });

  // ── Validation report shape contract ────────────────────────────────────

  test('should return validation report with required shape (valid, counts, results, timestamp)', async ({ page }) => {
    const report = await getValidationReport(page, 'continuous');
    expect(typeof report.valid).toBe('boolean');
    expect(report.counts).toBeDefined();
    expect(typeof report.counts.error).toBe('number');
    expect(typeof report.counts.warning).toBe('number');
    expect(typeof report.counts.info).toBe('number');
    expect(Array.isArray(report.results)).toBe(true);
    expect(typeof report.timestamp).toBe('string');
  });

  test('should include field-level bind constraint results in validation report', async ({ page }) => {
    // EIN with wrong format triggers a constraint violation
    await engineSetValue(page, 'applicantInfo.ein', 'INVALID-FORMAT');
    await page.waitForTimeout(50);

    const report = await getValidationReport(page, 'continuous');
    const einError = report.results.find(
      (r: any) => r.path === 'applicantInfo.ein' && r.severity === 'error'
    );
    expect(einError).toBeDefined();
    expect(einError.constraintKind).toBeDefined();
  });

  test('should report endDate-before-startDate as a shape-level error', async ({ page }) => {
    await engineSetValue(page, 'projectNarrative.startDate', '2028-01-01');
    await engineSetValue(page, 'projectNarrative.endDate', '2027-01-01');
    await page.waitForTimeout(50);

    const report = await getValidationReport(page, 'continuous');
    const dateError = report.results.find(
      (r: any) => (r.path === 'projectNarrative.endDate' || r.path === '') && r.severity === 'error'
    );
    expect(dateError).toBeDefined();
  });

  // ── Non-relevant behaviour ───────────────────────────────────────────────

  test('should prune non-relevant fields from response with nonRelevantBehavior: remove', async ({ page }) => {
    // When orgType is government, indirectRate is irrelevant (hidden by relevant condition)
    await engineSetValue(page, 'applicantInfo.orgType', 'government');
    await engineSetValue(page, 'projectNarrative.indirectRate', 15);
    await page.waitForTimeout(50);

    const response = await getResponse(page, 'continuous');
    // indirectRate should be absent or null in response when org is government
    const indirectRate = response.data?.projectNarrative?.indirectRate;
    expect(indirectRate === undefined || indirectRate === null).toBe(true);
  });

  test('should include relevant fields in response', async ({ page }) => {
    await engineSetValue(page, 'applicantInfo.orgName', 'Tech Nonprofit');
    await engineSetValue(page, 'applicantInfo.orgType', 'nonprofit');
    await engineSetValue(page, 'projectNarrative.indirectRate', 12);
    await page.waitForTimeout(50);

    const response = await getResponse(page, 'continuous');
    expect(response.data?.applicantInfo?.orgName).toBe('Tech Nonprofit');
    // nonprofit orgs CAN have indirectRate — it should appear
    expect(response.data?.projectNarrative?.indirectRate).toBe(12);
  });

  // ── Response contract ────────────────────────────────────────────────────

  test('should return response with required top-level fields', async ({ page }) => {
    const response = await getResponse(page, 'continuous');
    expect(response.definitionUrl).toBe('https://example.gov/forms/grant-application');
    expect(response.definitionVersion).toBe('1.0.0');
    expect(typeof response.status).toBe('string');
    expect(response.data).toBeDefined();
    expect(Array.isArray(response.validationResults)).toBe(true);
  });

  test('should include repeat group arrays in response data', async ({ page }) => {
    await addRepeatInstance(page, 'budget.lineItems');
    await engineSetValue(page, 'budget.lineItems[0].category', 'Personnel');
    await page.waitForTimeout(50);

    const response = await getResponse(page, 'continuous');
    expect(Array.isArray(response.data?.budget?.lineItems)).toBe(true);
    expect(response.data.budget.lineItems[0].category).toBe('Personnel');
  });

  // ── Component `when` vs definition `relevant` ────────────────────────────

  test('should hide component via definition relevant when orgType is not nonprofit', async ({ page }) => {
    // nonprofitPhoneHint is a display item with relevant: "$applicantInfo.orgType = 'nonprofit'"
    await engineSetValue(page, 'applicantInfo.orgType', 'university');
    await page.waitForTimeout(50);

    const isRelevant = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      return el.getEngine().relevantSignals['applicantInfo.nonprofitPhoneHint']?.value;
    });
    expect(isRelevant).toBe(false);
  });

  test('should show component via definition relevant when orgType is nonprofit', async ({ page }) => {
    await engineSetValue(page, 'applicantInfo.orgType', 'nonprofit');
    await page.waitForTimeout(50);

    const isRelevant = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      return el.getEngine().relevantSignals['applicantInfo.nonprofitPhoneHint']?.value;
    });
    expect(isRelevant).toBe(true);
  });
});
