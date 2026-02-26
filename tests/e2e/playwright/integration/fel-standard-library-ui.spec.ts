import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { gotoHarness, mountDefinition } from '../helpers/harness';

const fixturePath = path.resolve(__dirname, '../../fixtures/fel-functions.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

test.describe('FEL: mixed arithmetic operators', () => {
  test('should correctly evaluate multiply-then-divide: a * b / c', async ({ page }) => {
    await gotoHarness(page);
    await mountDefinition(page, fixture);

    // a=100, b=10, c=100 → 100 * 10 / 100 = 10
    await page.fill('input[name="mixA"]', '100');
    await page.fill('input[name="mixB"]', '10');
    await page.fill('input[name="mixC"]', '100');
    await expect(page.locator('input[name="mixMultiplyDivide"]')).toHaveValue('10');
  });

  test('should correctly evaluate add-then-subtract: total + bonus - tax', async ({ page }) => {
    await gotoHarness(page);
    await mountDefinition(page, fixture);

    // total=1000, bonus=100, tax=150 → 1000 + 100 - 150 = 950
    await page.fill('input[name="mixTotal"]', '1000');
    await page.fill('input[name="mixBonus"]', '100');
    await page.fill('input[name="mixTax"]', '150');
    await expect(page.locator('input[name="mixAddSubtract"]')).toHaveValue('950');
  });
});

test.describe('Integration: FEL Standard Library in UI', () => {
  test('should display expected FEL outputs when users edit source fields in the UI', async ({ page }) => {
    page.on('console', msg => console.log('Browser log:', msg.text()));
    await gotoHarness(page);
    await mountDefinition(page, fixture);

    // Test String: upper()
    await page.fill('input[name="rawText"]', 'hello world');
    await expect(page.locator('input[name="upperText"]')).toHaveValue('HELLO WORLD');

    // Test Numeric: round()
    await page.fill('input[name="rawNum"]', '12.3456');
    await expect(page.locator('input[name="roundedNum"]')).toHaveValue('12.35');

    // Test Date: year()
    await page.fill('input[name="testDate"]', '2025-05-20');
    await expect(page.locator('input[name="dateYear"]')).toHaveValue('2025');

    // Test Logical: coalesce()
    await page.fill('input[name="opt2"]', 'Fallback');
    await expect(page.locator('input[name="coalesced"]')).toHaveValue('Fallback');
    await page.fill('input[name="opt1"]', 'Primary');
    await expect(page.locator('input[name="coalesced"]')).toHaveValue('Primary');

    // Test Type: isNull()
    // Note: in our engine, empty string is the default for string fields.
    // Per spec, coalesce handles nulls.
    
    // Test Aggregate: sum()
    // Add items
    await page.fill('input[name="prices[0].val"]', '10');
    await expect(page.locator('input[name="totalSum"]')).toHaveValue('10');
    
    await page.click('button:has-text("Add prices")');
    await page.fill('input[name="prices[1].val"]', '25');
    await expect(page.locator('input[name="totalSum"]')).toHaveValue('35');
    // Test Strings: contains
    await expect(page.locator('input[name="textContains"]')).toHaveValue('true');

    // Test Math: abs & power
    await expect(page.locator('input[name="mathPower"]')).toHaveValue('8');
    await expect(page.locator('input[name="mathAbs"]')).toHaveValue('42');

    // Test Type: empty
    // JS checkbox for boolean
    await expect(page.locator('input[name="typeEmpty"]')).toBeChecked();

    // Test Dates: dateAdd & dateDiff
    await expect(page.locator('input[name="dateAddStr"]')).toHaveValue('2025-01-06');
    await expect(page.locator('input[name="dateDiffVal"]')).toHaveValue('9');

    // Test Logical: if
    await expect(page.locator('input[name="ifExpr"]')).toHaveValue('yes');

    // --- New Standard Library Functions ---

    // Aggregate functions
    await expect(page.locator('input[name="valCount"]')).toHaveValue('2');
    await expect(page.locator('input[name="valAvg"]')).toHaveValue('17.5');
    await expect(page.locator('input[name="valMin"]')).toHaveValue('10');
    await expect(page.locator('input[name="valMax"]')).toHaveValue('25');
    // String functions
    await expect(page.locator('input[name="strLength"]')).toHaveValue('11');
    await expect(page.locator('input[name="strStartsWith"]')).toBeChecked();
    await expect(page.locator('input[name="strEndsWith"]')).toBeChecked();
    await expect(page.locator('input[name="strSubstring"]')).toHaveValue('hello');
    await expect(page.locator('input[name="strReplace"]')).toHaveValue('hello there');
    await expect(page.locator('input[name="strLower"]')).toHaveValue('hello');
    await expect(page.locator('input[name="strTrim"]')).toHaveValue('trimmed');
    await expect(page.locator('input[name="strMatches"]')).toBeChecked();
    await expect(page.locator('input[name="strFormat"]')).toHaveValue('Value: 12.3456');

    // Math functions
    await expect(page.locator('input[name="numFloor"]')).toHaveValue('12');
    await expect(page.locator('input[name="numCeil"]')).toHaveValue('13');

    // Date/Time functions
    const todayStr = new Date().toISOString().split('T')[0];
    await expect(page.locator('input[name="dtToday"]')).toHaveValue(todayStr);
    await expect(page.locator('input[name="dtNow"]')).not.toHaveValue('');
    await expect(page.locator('input[name="dtMonth"]')).toHaveValue('5');
    await expect(page.locator('input[name="dtDay"]')).toHaveValue('20');
    await expect(page.locator('input[name="dtHours"]')).toHaveValue('15');
    await expect(page.locator('input[name="dtMinutes"]')).toHaveValue('30');
    await expect(page.locator('input[name="dtSeconds"]')).toHaveValue('45');
    await expect(page.locator('input[name="dtTime"]')).toHaveValue('15:30:45');
    await expect(page.locator('input[name="dtTimeDiff"]')).toHaveValue('60');

    // Type/Logical functions
    await expect(page.locator('input[name="valSelected"]')).toBeChecked();
    await expect(page.locator('input[name="valIsNumber"]')).toBeChecked();
    await expect(page.locator('input[name="valIsString"]')).toBeChecked();
    await expect(page.locator('input[name="valIsDate"]')).toBeChecked();
    await expect(page.locator('input[name="valTypeOf"]')).toHaveValue('number');
    await expect(page.locator('input[name="valToNumber"]')).toHaveValue('123.45');

    // Cast functions
    await expect(page.locator('input[name="castBoolFromString"]')).toBeChecked();
    await expect(page.locator('input[name="castBoolFromNumber"]')).not.toBeChecked();
    await expect(page.locator('input[name="castBoolFromNull"]')).not.toBeChecked();
    await expect(page.locator('input[name="castDate"]')).toHaveValue('2025-05-20');
    await expect(page.locator('input[name="castTime"]')).toHaveValue('09:05:03');

    // Money functions
    await expect(page.locator('input[name="mAmount"]')).toHaveValue('100');
    await expect(page.locator('input[name="mCurrency"]')).toHaveValue('USD');
    await expect(page.locator('input[name="mAdd"]')).toHaveValue('150');

    // Money Aggregate
    await page.fill('input[name="ledger[0].amount"]', '10');
    await page.click('button:has-text("Add ledger")');
    await page.fill('input[name="ledger[1].amount"]', '20');
    await expect(page.locator('input[name="totalLedger"]')).toHaveValue('30');

    // Context functions
    await expect(page.locator('input[name="prices[1].prevVal"]')).toHaveValue('10');
    await expect(page.locator('input[name="prices[0].nextVal"]')).toHaveValue('25');
    await expect(page.locator('input[name="parentGroup.parentVal"]')).toHaveValue('hello world');
  });
});
