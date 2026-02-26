import { test, expect } from '@playwright/test';
import {
  mountGrantApplication,
  engineSetValue,
  engineValue,
  engineVariable,
  getValidationReport,
  getResponse,
} from '../helpers/grant-app';

test.describe('Grant Application: Validation', () => {
  test.beforeEach(async ({ page }) => {
    await mountGrantApplication(page);
  });

  // ── Bind Constraints ───────────────────────────────────────────────

  test('should reject endDate before startDate with constraintMessage', async ({ page }) => {
    await engineSetValue(page, 'projectNarrative.startDate', '2027-06-01');
    await engineSetValue(page, 'projectNarrative.endDate', '2027-01-01');
    await page.waitForTimeout(50);

    const report = await getValidationReport(page, 'continuous');
    const endErr = report.results.find((r: any) => r.path === 'projectNarrative.endDate' && r.constraintKind === 'constraint');
    expect(endErr).toBeDefined();
    expect(endErr.message).toBe('End date must be after start date.');
  });

  test('should accept endDate after startDate and clear the constraint error', async ({ page }) => {
    await engineSetValue(page, 'projectNarrative.startDate', '2027-01-01');
    await engineSetValue(page, 'projectNarrative.endDate', '2027-06-01');
    await page.waitForTimeout(50);

    const report = await getValidationReport(page, 'continuous');
    const endErr = report.results.find((r: any) => r.path === 'projectNarrative.endDate' && r.constraintKind === 'constraint');
    expect(endErr).toBeUndefined();
  });

  test('should reject EIN not matching XX-XXXXXXX pattern', async ({ page }) => {
    await engineSetValue(page, 'applicantInfo.ein', 'BADINPUT');
    await page.waitForTimeout(50);

    const report = await getValidationReport(page, 'continuous');
    const einErr = report.results.find((r: any) => r.path === 'applicantInfo.ein' && r.constraintKind === 'constraint');
    expect(einErr).toBeDefined();
    expect(einErr.message).toContain('EIN must be in the format');
  });

  test('should accept a valid EIN and clear the constraint error', async ({ page }) => {
    await engineSetValue(page, 'applicantInfo.ein', '12-3456789');
    await page.waitForTimeout(50);

    const report = await getValidationReport(page, 'continuous');
    const einErr = report.results.find((r: any) => r.path === 'applicantInfo.ein' && r.constraintKind === 'constraint');
    expect(einErr).toBeUndefined();
  });

  test('should normalize whitespace from EIN input (whitespace: normalize)', async ({ page }) => {
    // Internal spaces are collapsed, leading/trailing trimmed
    await engineSetValue(page, 'applicantInfo.ein', '  12  3456789  ');
    await page.waitForTimeout(50);
    const stored = await engineValue(page, 'applicantInfo.ein');
    expect(stored).toBe('12 3456789');
  });

  test('should trim whitespace from contactEmail input (whitespace: trim)', async ({ page }) => {
    await engineSetValue(page, 'applicantInfo.contactEmail', '  jane@example.org  ');
    await page.waitForTimeout(50);
    const stored = await engineValue(page, 'applicantInfo.contactEmail');
    expect(stored).toBe('jane@example.org');
  });

  test('should apply second bind constraint on contactEmail (bind inheritance AND semantics)', async ({ page }) => {
    // Set email without @ — constraint from second bind should fire
    await engineSetValue(page, 'applicantInfo.contactEmail', 'notanemail');
    await page.waitForTimeout(50);

    const report = await getValidationReport(page, 'continuous');
    const emailErr = report.results.find((r: any) =>
      r.path === 'applicantInfo.contactEmail' && r.constraintKind === 'constraint'
    );
    expect(emailErr).toBeDefined();
    expect(emailErr.message).toBe('Contact email must contain @.');
  });

  test('should clear contactEmail constraint when email contains @', async ({ page }) => {
    await engineSetValue(page, 'applicantInfo.contactEmail', 'jane@example.org');
    await page.waitForTimeout(50);

    const report = await getValidationReport(page, 'continuous');
    const emailErr = report.results.find((r: any) =>
      r.path === 'applicantInfo.contactEmail' && r.constraintKind === 'constraint'
    );
    expect(emailErr).toBeUndefined();
  });

  // ── ValidationReport Contract ───────────────────────────────────────

  test('should return ValidationReport with valid boolean, counts, results, and timestamp', async ({ page }) => {
    const report = await getValidationReport(page, 'continuous');

    expect(typeof report.valid).toBe('boolean');
    expect(typeof report.counts.error).toBe('number');
    expect(typeof report.counts.warning).toBe('number');
    expect(typeof report.counts.info).toBe('number');
    expect(Array.isArray(report.results)).toBe(true);
    expect(report.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO 8601
  });

  test('should include definitionUrl, version, status, data in submit response', async ({ page }) => {
    // Fill minimum required fields to get a valid response
    await engineSetValue(page, 'applicantInfo.orgName', 'Test Org');
    await engineSetValue(page, 'applicantInfo.ein', '12-3456789');
    await engineSetValue(page, 'applicantInfo.orgType', 'university');
    await engineSetValue(page, 'applicantInfo.contactName', 'Jane Smith');
    await engineSetValue(page, 'applicantInfo.contactEmail', 'jane@example.org');
    await page.waitForTimeout(50);

    const response = await getResponse(page, 'continuous');
    expect(response.definitionUrl).toBe('https://example.gov/forms/grant-application');
    expect(response.definitionVersion).toBe('1.0.0');
    expect(typeof response.data).toBe('object');
  });

  // ── Shape: budgetMatch (context block) ─────────────────────────────

  test('should surface BUDGET_MISMATCH shape with full ValidationResult contract', async ({ page }) => {
    // Set a budget line item so grandTotal > 0
    await engineSetValue(page, 'budget.lineItems[0].quantity', 1);
    await engineSetValue(page, 'budget.lineItems[0].unitCost', 1000);
    // Leave requestedAmount at default (0) — mismatch
    await page.waitForTimeout(100);

    const report = await getValidationReport(page, 'continuous');
    const mismatch = report.results.find((r: any) => r.code === 'BUDGET_MISMATCH');
    expect(mismatch).toBeDefined();

    // Full ValidationResult contract
    expect(mismatch.severity).toBe('error');
    expect(mismatch.constraintKind).toBe('shape');
    expect(mismatch.source).toBe('shape');
    expect(mismatch.shapeId).toBe('budgetMatch');
    expect(typeof mismatch.constraint).toBe('string');

    // Context block
    expect(mismatch.context).toBeDefined();
    expect(typeof mismatch.context.grandTotal).toBe('string');
    expect(typeof mismatch.context.requested).toBe('string');
    expect(typeof mismatch.context.difference).toBe('string');
    expect(parseFloat(mismatch.context.grandTotal)).toBeGreaterThan(0);
  });

  test('should clear BUDGET_MISMATCH when requestedAmount matches @grandTotal', async ({ page }) => {
    await engineSetValue(page, 'budget.lineItems[0].quantity', 1);
    await engineSetValue(page, 'budget.lineItems[0].unitCost', 1000);
    await page.waitForTimeout(100);

    // Set requestedAmount to match grandTotal (1000 USD)
    await engineSetValue(page, 'budget.requestedAmount', { amount: 1000, currency: 'USD' });
    await page.waitForTimeout(100);

    const report = await getValidationReport(page, 'continuous');
    const mismatch = report.results.find((r: any) => r.code === 'BUDGET_MISMATCH');
    expect(mismatch).toBeUndefined();
  });

  // ── Shape: subcontractorCap (activeWhen) ───────────────────────────

  test('should activate subcontractorCap shape only when usesSubcontractors is true (activeWhen)', async ({ page }) => {
    // Set up budget and subcontractor amounts that would exceed 49%
    await engineSetValue(page, 'budget.lineItems[0].quantity', 1);
    await engineSetValue(page, 'budget.lineItems[0].unitCost', 1000);
    await page.waitForTimeout(50);

    // Without usesSubcontractors — shape should NOT fire
    let report = await getValidationReport(page, 'continuous');
    let cap = report.results.find((r: any) => r.code === 'SUBCONTRACTOR_CAP_EXCEEDED');
    expect(cap).toBeUndefined();

    // Enable subcontractors and add an amount exceeding 49%
    await engineSetValue(page, 'budget.usesSubcontractors', true);
    await engineSetValue(page, 'subcontractors[0].subAmount', 600); // 60% > 49%
    await page.waitForTimeout(100);

    report = await getValidationReport(page, 'continuous');
    cap = report.results.find((r: any) => r.code === 'SUBCONTRACTOR_CAP_EXCEEDED');
    expect(cap).toBeDefined();

    // Disable subcontractors — shape should deactivate
    await engineSetValue(page, 'budget.usesSubcontractors', false);
    await page.waitForTimeout(100);

    report = await getValidationReport(page, 'continuous');
    cap = report.results.find((r: any) => r.code === 'SUBCONTRACTOR_CAP_EXCEEDED');
    expect(cap).toBeUndefined();
  });

  // ── Shape: narrativeDocRequired (timing: submit) ───────────────────

  test('should not fire narrativeDocRequired in continuous mode (timing: submit)', async ({ page }) => {
    // No attachment — shape should NOT appear in continuous mode
    const report = await getValidationReport(page, 'continuous');
    const docErr = report.results.find((r: any) => r.code === 'NARRATIVE_DOC_REQUIRED');
    expect(docErr).toBeUndefined();
  });

  test('should fire narrativeDocRequired in submit mode when no attachment present', async ({ page }) => {
    const report = await getValidationReport(page, 'submit');
    const docErr = report.results.find((r: any) => r.code === 'NARRATIVE_DOC_REQUIRED');
    expect(docErr).toBeDefined();
    expect(docErr.severity).toBe('error');
    expect(docErr.shapeId).toBe('narrativeDocRequired');
  });

  test('should clear narrativeDocRequired when narrativeDoc is provided', async ({ page }) => {
    await engineSetValue(page, 'attachments.narrativeDoc', 'document.pdf');
    await page.waitForTimeout(50);

    const report = await getValidationReport(page, 'submit');
    const docErr = report.results.find((r: any) => r.code === 'NARRATIVE_DOC_REQUIRED');
    expect(docErr).toBeUndefined();
  });

  // ── Shape: contactProvided (or composition) ────────────────────────

  test('should fire contactProvided warning when both email and phone are empty (or composition)', async ({ page }) => {
    // Clear contactPhone (which starts with initialValue)
    await engineSetValue(page, 'applicantInfo.contactPhone', '');
    await engineSetValue(page, 'applicantInfo.contactEmail', '');
    await page.waitForTimeout(50);

    const report = await getValidationReport(page, 'continuous');
    const contact = report.results.find((r: any) => r.code === 'CONTACT_METHOD_MISSING');
    expect(contact).toBeDefined();
    expect(contact.severity).toBe('warning');
  });

  test('should clear contactProvided warning when only email is provided (or composition)', async ({ page }) => {
    await engineSetValue(page, 'applicantInfo.contactPhone', '');
    await engineSetValue(page, 'applicantInfo.contactEmail', 'jane@example.org');
    await page.waitForTimeout(50);

    const report = await getValidationReport(page, 'continuous');
    const contact = report.results.find((r: any) => r.code === 'CONTACT_METHOD_MISSING');
    expect(contact).toBeUndefined();
  });

  test('should clear contactProvided warning when only phone is provided (or composition)', async ({ page }) => {
    await engineSetValue(page, 'applicantInfo.contactPhone', '202-555-0100');
    await engineSetValue(page, 'applicantInfo.contactEmail', '');
    await page.waitForTimeout(50);

    const report = await getValidationReport(page, 'continuous');
    const contact = report.results.find((r: any) => r.code === 'CONTACT_METHOD_MISSING');
    expect(contact).toBeUndefined();
  });

  // ── Shape: abstractNotPlaceholder (not composition) ────────────────

  test('should fire abstractNotPlaceholder warning when abstract contains TBD (not composition)', async ({ page }) => {
    await engineSetValue(page, 'projectNarrative.abstract', 'Project scope TBD');
    await page.waitForTimeout(50);

    const report = await getValidationReport(page, 'continuous');
    const placeholder = report.results.find((r: any) => r.code === 'ABSTRACT_PLACEHOLDER');
    expect(placeholder).toBeDefined();
    expect(placeholder.severity).toBe('warning');
  });

  test('should clear abstractNotPlaceholder warning when abstract does not contain TBD', async ({ page }) => {
    await engineSetValue(page, 'projectNarrative.abstract', 'A detailed project scope.');
    await page.waitForTimeout(50);

    const report = await getValidationReport(page, 'continuous');
    const placeholder = report.results.find((r: any) => r.code === 'ABSTRACT_PLACEHOLDER');
    expect(placeholder).toBeUndefined();
  });

  // ── Shape: dateRangeXone (xone composition) ────────────────────────

  test('should fire dateRangeXone info when neither date condition is met (xone composition)', async ({ page }) => {
    // Past start date + future end date → neither condition is true → xone fails (0 truths)
    await engineSetValue(page, 'projectNarrative.startDate', '2020-01-01'); // past
    await engineSetValue(page, 'projectNarrative.endDate', '2030-12-31');   // future
    await page.waitForTimeout(50);

    const report = await getValidationReport(page, 'continuous');
    const xone = report.results.find((r: any) => r.code === 'DATE_RANGE_XONE');
    expect(xone).toBeDefined();
    expect(xone.severity).toBe('info');
  });

  test('should clear dateRangeXone when exactly one date condition is met', async ({ page }) => {
    // Future start date only → exactly one xone condition is true → passes
    await engineSetValue(page, 'projectNarrative.startDate', '2030-01-01'); // future
    await engineSetValue(page, 'projectNarrative.endDate', '2031-12-31');   // also future
    await page.waitForTimeout(50);

    const report = await getValidationReport(page, 'continuous');
    const xone = report.results.find((r: any) => r.code === 'DATE_RANGE_XONE');
    expect(xone).toBeUndefined();
  });
});
