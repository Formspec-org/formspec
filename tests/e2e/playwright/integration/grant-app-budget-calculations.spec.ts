import { test, expect } from '@playwright/test';
import {
  mountGrantApplication,
  engineSetValue,
  engineValue,
  engineVariable,
  getResponse,
  structureVersion,
  addRepeatInstance,
} from '../helpers/grant-app';

test.describe('Grant Application: Budget Calculations', () => {
  test.beforeEach(async ({ page }) => {
    await mountGrantApplication(page);
  });

  test('should calculate line item subtotal reactively as quantity and unitCost change', async ({ page }) => {
    await engineSetValue(page, 'budget.lineItems[0].quantity', 3);
    await engineSetValue(page, 'budget.lineItems[0].unitCost', 100);
    await page.waitForTimeout(100);

    const subtotal = await engineValue(page, 'budget.lineItems[0].subtotal');
    expect(subtotal).toBe(300);
  });

  test('should apply precision: 2 to unitCost on input (round to 2 decimal places)', async ({ page }) => {
    await engineSetValue(page, 'budget.lineItems[0].unitCost', 33.337);
    await page.waitForTimeout(50);

    // precision: 2 rounds to nearest cent
    const stored = await engineValue(page, 'budget.lineItems[0].unitCost');
    expect(stored).toBeCloseTo(33.34, 5);
  });

  test('should aggregate subtotals into @totalDirect variable', async ({ page }) => {
    await engineSetValue(page, 'budget.lineItems[0].quantity', 2);
    await engineSetValue(page, 'budget.lineItems[0].unitCost', 500);
    await page.waitForTimeout(100);

    const totalDirect = await engineVariable(page, 'totalDirect');
    // totalDirect is a money object {amount, currency}
    expect(totalDirect).toMatchObject({ amount: 1000, currency: 'USD' });
  });

  test('should compute @indirectCosts from indirectRate percentage of @totalDirect', async ({ page }) => {
    await engineSetValue(page, 'budget.lineItems[0].quantity', 1);
    await engineSetValue(page, 'budget.lineItems[0].unitCost', 10000);
    await engineSetValue(page, 'applicantInfo.orgType', 'nonprofit');
    await engineSetValue(page, 'projectNarrative.indirectRate', 10); // 10%
    await page.waitForTimeout(100);

    const indirect = await engineVariable(page, 'indirectCosts');
    expect(indirect).toMatchObject({ amount: 1000, currency: 'USD' });
  });

  test('should compute @grandTotal as moneyAdd(@totalDirect, @indirectCosts)', async ({ page }) => {
    await engineSetValue(page, 'budget.lineItems[0].quantity', 1);
    await engineSetValue(page, 'budget.lineItems[0].unitCost', 10000);
    await engineSetValue(page, 'applicantInfo.orgType', 'nonprofit');
    await engineSetValue(page, 'projectNarrative.indirectRate', 10); // 10%
    await page.waitForTimeout(100);

    const grand = await engineVariable(page, 'grandTotal');
    expect(grand).toMatchObject({ amount: 11000, currency: 'USD' });
  });

  test('should set @indirectCosts to money(0, USD) when orgType switches to government', async ({ page }) => {
    await engineSetValue(page, 'budget.lineItems[0].quantity', 1);
    await engineSetValue(page, 'budget.lineItems[0].unitCost', 10000);
    await engineSetValue(page, 'applicantInfo.orgType', 'nonprofit');
    await engineSetValue(page, 'projectNarrative.indirectRate', 10);
    await page.waitForTimeout(100);

    // Switch to government — indirectCosts forced to 0
    await engineSetValue(page, 'applicantInfo.orgType', 'government');
    await page.waitForTimeout(100);

    const indirect = await engineVariable(page, 'indirectCosts');
    expect(indirect).toMatchObject({ amount: 0, currency: 'USD' });

    const grand = await engineVariable(page, 'grandTotal');
    expect(grand).toMatchObject({ amount: 10000, currency: 'USD' });
  });

  test('should increment structureVersion when a line item is added', async ({ page }) => {
    const before = await structureVersion(page);
    await addRepeatInstance(page, 'budget.lineItems');
    await page.waitForTimeout(50);
    const after = await structureVersion(page);
    expect(after).toBeGreaterThan(before);
  });

  test('should preserve remaining row data after a line item is deleted (batch fix regression)', async ({ page }) => {
    // Add a second row and fill both
    await addRepeatInstance(page, 'budget.lineItems');
    await page.waitForTimeout(50);

    await engineSetValue(page, 'budget.lineItems[0].description', 'Personnel');
    await engineSetValue(page, 'budget.lineItems[0].quantity', 1);
    await engineSetValue(page, 'budget.lineItems[0].unitCost', 5000);
    await engineSetValue(page, 'budget.lineItems[1].description', 'Travel');
    await engineSetValue(page, 'budget.lineItems[1].quantity', 3);
    await engineSetValue(page, 'budget.lineItems[1].unitCost', 800);
    await page.waitForTimeout(100);

    // Remove row 0 via engine
    await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      el.getEngine().removeRepeatInstance('budget.lineItems', 0);
    });
    await page.waitForTimeout(100);

    // Row 1 data should now be at index 0
    const desc = await engineValue(page, 'budget.lineItems[0].description');
    const qty = await engineValue(page, 'budget.lineItems[0].quantity');
    const cost = await engineValue(page, 'budget.lineItems[0].unitCost');
    expect(desc).toBe('Travel');
    expect(qty).toBe(3);
    expect(cost).toBe(800);
  });

  test('should produce MAX_REPEAT validation error when lineItems exceeds maxRepeat of 20', async ({ page }) => {
    // Add instances until we hit 20 (already have 1)
    for (let i = 1; i < 20; i++) {
      await addRepeatInstance(page, 'budget.lineItems');
    }
    await page.waitForTimeout(100);

    // The engine should have 20 instances (at maxRepeat)
    const count = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      return el.getEngine().repeats['budget.lineItems']?.value;
    });
    expect(count).toBe(20);

    // Adding one more beyond maxRepeat triggers a validation error
    await addRepeatInstance(page, 'budget.lineItems');
    await page.waitForTimeout(50);

    const report = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      return el.getEngine().getValidationReport({ mode: 'continuous' });
    });
    const maxErr = report.results.find((r: any) => r.code === 'MAX_REPEAT');
    expect(maxErr).toBeDefined();
    expect(maxErr.severity).toBe('error');
  });

  test('should produce MIN_REPEAT validation error when lineItems goes below minRepeat of 1', async ({ page }) => {
    // The initial count should be exactly 1 (minRepeat: 1)
    const count = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      return el.getEngine().repeats['budget.lineItems']?.value;
    });
    expect(count).toBe(1);

    // Remove the only instance — goes below minRepeat
    await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      try { el.getEngine().removeRepeatInstance('budget.lineItems', 0); } catch {}
    });
    await page.waitForTimeout(50);

    // Validation report should include MIN_REPEAT error
    const report = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      return el.getEngine().getValidationReport({ mode: 'continuous' });
    });
    const minErr = report.results.find((r: any) => r.code === 'MIN_REPEAT');
    expect(minErr).toBeDefined();
    expect(minErr.severity).toBe('error');
  });

  test('should update @totalDirect when a second line item is added and filled', async ({ page }) => {
    await engineSetValue(page, 'budget.lineItems[0].quantity', 1);
    await engineSetValue(page, 'budget.lineItems[0].unitCost', 1000);
    await page.waitForTimeout(50);

    await addRepeatInstance(page, 'budget.lineItems');
    await page.waitForTimeout(50);

    await engineSetValue(page, 'budget.lineItems[1].quantity', 2);
    await engineSetValue(page, 'budget.lineItems[1].unitCost', 500);
    await page.waitForTimeout(100);

    const totalDirect = await engineVariable(page, 'totalDirect');
    expect(totalDirect).toMatchObject({ amount: 2000, currency: 'USD' });
  });
});
