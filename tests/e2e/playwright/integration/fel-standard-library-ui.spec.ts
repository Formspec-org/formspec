/**
 * FEL Standard Library — Grant Application Coverage (ADR-0023 T-06)
 *
 * Tests FEL stdlib functions through real computed fields in the grant
 * application. Each test sets source field(s) via engineSetValue and asserts
 * the computed result via engineValue.
 *
 * Functions covered here: upper, coalesce, round, year, dateAdd, dateDiff,
 * abs, isNull, sum (money aggregate), money arithmetic, matches, contains.
 *
 * Functions with no natural home in a business grant form (floor, ceil, prev,
 * next, parent context, cast functions, timeDiff, etc.) will be covered when
 * a second real-world example application is added (ADR-0023 §7).
 */

import { test, expect } from '@playwright/test';
import {
  mountGrantApplication,
  engineSetValue,
  engineValue,
  engineVariable,
  addRepeatInstance,
  getValidationReport,
} from '../helpers/grant-app';

test.describe('FEL Standard Library: String Functions', () => {
  test.beforeEach(async ({ page }) => { await mountGrantApplication(page); });

  test('upper() — orgNameUpper computes uppercase of orgName', async ({ page }) => {
    await engineSetValue(page, 'applicantInfo.orgName', 'Community Health Foundation');
    await page.waitForTimeout(50);
    const result = await engineValue(page, 'applicantInfo.orgNameUpper');
    expect(result).toBe('COMMUNITY HEALTH FOUNDATION');
  });

  test('coalesce() — contactPhoneFallback returns primary value when set', async ({ page }) => {
    await engineSetValue(page, 'applicantInfo.contactPhone', '555-1234');
    await page.waitForTimeout(50);
    const result = await engineValue(page, 'applicantInfo.contactPhoneFallback');
    expect(result).toBe('555-1234');
  });

  test('coalesce() — contactPhoneFallback returns fallback when phone is empty', async ({ page }) => {
    await engineSetValue(page, 'applicantInfo.contactPhone', null);
    await page.waitForTimeout(50);
    const result = await engineValue(page, 'applicantInfo.contactPhoneFallback');
    expect(result === 'N/A' || result === '202-555-0100').toBe(true); // initialValue may be set
  });
});

test.describe('FEL Standard Library: Numeric Functions', () => {
  test.beforeEach(async ({ page }) => { await mountGrantApplication(page); });

  test('round() — indirectRateRounded rounds to nearest integer', async ({ page }) => {
    await engineSetValue(page, 'projectNarrative.indirectRate', 12.7);
    await page.waitForTimeout(50);
    const result = await engineValue(page, 'projectNarrative.indirectRateRounded');
    expect(result).toBe(13);
  });

  test('round() — rounds down when fractional part < 0.5', async ({ page }) => {
    await engineSetValue(page, 'projectNarrative.indirectRate', 12.3);
    await page.waitForTimeout(50);
    const result = await engineValue(page, 'projectNarrative.indirectRateRounded');
    expect(result).toBe(12);
  });

  test('abs() — budgetDeviation is absolute difference between requested and grandTotal', async ({ page }) => {
    // Set up a line item so grandTotal > 0
    await addRepeatInstance(page, 'budget.lineItems');
    await engineSetValue(page, 'budget.lineItems[0].quantity', 1);
    await engineSetValue(page, 'budget.lineItems[0].unitCost', 1000);
    // Request less than grand total → deviation = grandTotal - requested
    await engineSetValue(page, 'budget.requestedAmount', { amount: 800, currency: 'USD' });
    await page.waitForTimeout(100);

    const deviation = await engineValue(page, 'budget.budgetDeviation');
    expect(deviation).toMatchObject({ amount: 200, currency: 'USD' });
  });
});

test.describe('FEL Standard Library: Date Functions', () => {
  test.beforeEach(async ({ page }) => { await mountGrantApplication(page); });

  test('year() — projectYear extracts year from startDate', async ({ page }) => {
    await engineSetValue(page, 'projectNarrative.startDate', '2027-06-15');
    await page.waitForTimeout(50);
    const result = await engineValue(page, 'projectNarrative.projectYear');
    expect(result).toBe(2027);
  });

  test('dateDiff() — duration computes months between startDate and endDate', async ({ page }) => {
    await engineSetValue(page, 'projectNarrative.startDate', '2027-01-01');
    await engineSetValue(page, 'projectNarrative.endDate', '2027-07-01');
    await page.waitForTimeout(100);
    const duration = await engineValue(page, 'projectNarrative.duration');
    expect(duration).toBe(6);
  });

  test('dateAdd() — projectedEndDate adds duration months to startDate', async ({ page }) => {
    await engineSetValue(page, 'projectNarrative.startDate', '2027-01-01');
    await engineSetValue(page, 'projectNarrative.endDate', '2028-01-01'); // sets duration=12
    await page.waitForTimeout(100);
    const projected = await engineValue(page, 'projectNarrative.projectedEndDate');
    // startDate + 12 months = 2028-01-01
    expect(projected).toBe('2028-01-01');
  });
});

test.describe('FEL Standard Library: Type / Logical Functions', () => {
  test.beforeEach(async ({ page }) => { await mountGrantApplication(page); });

  test('isNull() — hasLineItems is false when first line item category is null', async ({ page }) => {
    // No line items added — category is null
    const result = await engineValue(page, 'budget.hasLineItems');
    // isNull(null) = true → string(!true) = "false"
    expect(result).toBe('false');
  });

  test('isNull() — hasLineItems is true after setting a line item category', async ({ page }) => {
    await addRepeatInstance(page, 'budget.lineItems');
    await engineSetValue(page, 'budget.lineItems[0].category', 'Personnel');
    await page.waitForTimeout(50);
    const result = await engineValue(page, 'budget.hasLineItems');
    // isNull('Personnel') = false → !false = true → string(true) = "true"
    expect(result).toBe('true');
  });
});

test.describe('FEL Standard Library: Aggregate Functions', () => {
  test.beforeEach(async ({ page }) => { await mountGrantApplication(page); });

  test('sum() (money) — @totalDirect aggregates line item subtotals', async ({ page }) => {
    await addRepeatInstance(page, 'budget.lineItems');
    await engineSetValue(page, 'budget.lineItems[0].quantity', 2);
    await engineSetValue(page, 'budget.lineItems[0].unitCost', 500);

    await addRepeatInstance(page, 'budget.lineItems');
    await engineSetValue(page, 'budget.lineItems[1].quantity', 3);
    await engineSetValue(page, 'budget.lineItems[1].unitCost', 200);
    await page.waitForTimeout(100);

    const total = await engineVariable(page, 'totalDirect');
    expect(total).toMatchObject({ amount: 1600, currency: 'USD' }); // 1000 + 600
  });
});

test.describe('FEL Standard Library: Arithmetic Operators', () => {
  test.beforeEach(async ({ page }) => { await mountGrantApplication(page); });

  test('multiply-then-divide precedence — subtotal = quantity × unitCost', async ({ page }) => {
    await addRepeatInstance(page, 'budget.lineItems');
    await engineSetValue(page, 'budget.lineItems[0].quantity', 4);
    await engineSetValue(page, 'budget.lineItems[0].unitCost', 250);
    await page.waitForTimeout(100);

    const subtotal = await engineValue(page, 'budget.lineItems[0].subtotal');
    expect(subtotal).toBe(1000);
  });

  test('add-then-multiply — @grandTotal = totalDirect + indirectCosts', async ({ page }) => {
    await engineSetValue(page, 'applicantInfo.orgType', 'nonprofit');
    await engineSetValue(page, 'projectNarrative.indirectRate', 10);
    await addRepeatInstance(page, 'budget.lineItems');
    await engineSetValue(page, 'budget.lineItems[0].quantity', 1);
    await engineSetValue(page, 'budget.lineItems[0].unitCost', 1000);
    await page.waitForTimeout(100);

    const indirect = await engineVariable(page, 'indirectCosts');
    const grand = await engineVariable(page, 'grandTotal');
    // indirect = 1000 * 0.10 = 100, grand = 1000 + 100 = 1100
    expect(indirect).toMatchObject({ amount: 100, currency: 'USD' });
    expect(grand).toMatchObject({ amount: 1100, currency: 'USD' });
  });
});

test.describe('FEL Standard Library: Pattern Matching', () => {
  test.beforeEach(async ({ page }) => { await mountGrantApplication(page); });

  test('matches() — EIN constraint rejects wrong format', async ({ page }) => {
    await engineSetValue(page, 'applicantInfo.ein', 'INVALID');
    await page.waitForTimeout(50);
    const report = await getValidationReport(page, 'continuous');
    const einError = report.results.find((r: any) => r.path === 'applicantInfo.ein');
    expect(einError).toBeDefined();
  });

  test('matches() — EIN constraint accepts correct format (XX-XXXXXXX)', async ({ page }) => {
    await engineSetValue(page, 'applicantInfo.ein', '12-3456789');
    await page.waitForTimeout(50);
    const report = await getValidationReport(page, 'continuous');
    const einError = report.results.find(
      (r: any) => r.path === 'applicantInfo.ein' && r.severity === 'error'
    );
    expect(einError).toBeUndefined();
  });

  test('contains() — email constraint rejects address missing @', async ({ page }) => {
    await engineSetValue(page, 'applicantInfo.contactEmail', 'notanemail');
    await page.waitForTimeout(50);
    const report = await getValidationReport(page, 'continuous');
    const emailError = report.results.find((r: any) => r.path === 'applicantInfo.contactEmail');
    expect(emailError).toBeDefined();
  });
});
