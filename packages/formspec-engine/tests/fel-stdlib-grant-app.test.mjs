/**
 * FEL Standard Library — Grant Application Coverage
 *
 * Migrated from tests/e2e/playwright/integration/fel-standard-library-ui.spec.ts
 *
 * Tests FEL stdlib functions through real computed fields in the grant
 * application. Each test sets source field(s) and asserts the computed result.
 *
 * Functions covered: upper, coalesce, round, year, dateAdd, dateDiff,
 * abs, isNull, sum (money aggregate), money arithmetic, matches, contains.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGrantEngine,
  engineValue,
  engineVariable,
  addRepeatInstance,
  getValidationReport,
} from './helpers/grant-app.mjs';

// ── String Functions ─────────────────────────────────────────────────

test('upper() — orgNameUpper computes uppercase of orgName', () => {
  const engine = createGrantEngine();
  engine.setValue('applicantInfo.orgName', 'Community Health Foundation');
  assert.equal(engineValue(engine, 'applicantInfo.orgNameUpper'), 'COMMUNITY HEALTH FOUNDATION');
});

test('coalesce() — contactPhoneFallback returns primary value when set', () => {
  const engine = createGrantEngine();
  engine.setValue('applicantInfo.contactPhone', '555-1234');
  assert.equal(engineValue(engine, 'applicantInfo.contactPhoneFallback'), '555-1234');
});

test('coalesce() — contactPhoneFallback returns fallback when phone is empty', () => {
  const engine = createGrantEngine();
  engine.setValue('applicantInfo.contactPhone', null);
  const result = engineValue(engine, 'applicantInfo.contactPhoneFallback');
  assert.ok(result === 'N/A' || result === '202-555-0100'); // initialValue may be set
});

// ── Numeric Functions ────────────────────────────────────────────────

test('round() — indirectRateRounded rounds to nearest integer', () => {
  const engine = createGrantEngine();
  engine.setValue('projectNarrative.indirectRate', 12.7);
  assert.equal(engineValue(engine, 'projectNarrative.indirectRateRounded'), 13);
});

test('round() — rounds down when fractional part < 0.5', () => {
  const engine = createGrantEngine();
  engine.setValue('projectNarrative.indirectRate', 12.3);
  assert.equal(engineValue(engine, 'projectNarrative.indirectRateRounded'), 12);
});

test('abs() — budgetDeviation is absolute difference between requested and grandTotal', () => {
  const engine = createGrantEngine();
  addRepeatInstance(engine, 'budget.lineItems');
  engine.setValue('budget.lineItems[0].quantity', 1);
  engine.setValue('budget.lineItems[0].unitCost', 1000);
  engine.setValue('budget.requestedAmount', { amount: 800, currency: 'USD' });

  const deviation = engineValue(engine, 'budget.budgetDeviation');
  assert.deepEqual(deviation, { amount: 200, currency: 'USD' });
});

// ── Date Functions ───────────────────────────────────────────────────

test('year() — projectYear extracts year from startDate', () => {
  const engine = createGrantEngine();
  engine.setValue('projectNarrative.startDate', '2027-06-15');
  assert.equal(engineValue(engine, 'projectNarrative.projectYear'), 2027);
});

test('dateDiff() — duration computes months between startDate and endDate', () => {
  const engine = createGrantEngine();
  engine.setValue('projectNarrative.startDate', '2027-01-01');
  engine.setValue('projectNarrative.endDate', '2027-07-01');
  assert.equal(engineValue(engine, 'projectNarrative.duration'), 6);
});

test('dateAdd() — projectedEndDate adds duration months to startDate', () => {
  const engine = createGrantEngine();
  engine.setValue('projectNarrative.startDate', '2027-01-01');
  engine.setValue('projectNarrative.endDate', '2028-01-01'); // sets duration=12
  assert.equal(engineValue(engine, 'projectNarrative.projectedEndDate'), '2028-01-01');
});

// ── Type / Logical Functions ─────────────────────────────────────────

test('isNull() — hasLineItems is false when first line item category is null', () => {
  const engine = createGrantEngine();
  assert.equal(engineValue(engine, 'budget.hasLineItems'), 'false');
});

test('isNull() — hasLineItems is true after setting a line item category', () => {
  const engine = createGrantEngine();
  addRepeatInstance(engine, 'budget.lineItems');
  engine.setValue('budget.lineItems[0].category', 'Personnel');
  assert.equal(engineValue(engine, 'budget.hasLineItems'), 'true');
});

// ── Aggregate Functions ──────────────────────────────────────────────

test('sum() (money) — @totalDirect aggregates line item subtotals', () => {
  const engine = createGrantEngine();
  addRepeatInstance(engine, 'budget.lineItems');
  engine.setValue('budget.lineItems[0].quantity', 2);
  engine.setValue('budget.lineItems[0].unitCost', 500);

  addRepeatInstance(engine, 'budget.lineItems');
  engine.setValue('budget.lineItems[1].quantity', 3);
  engine.setValue('budget.lineItems[1].unitCost', 200);

  const total = engineVariable(engine, 'totalDirect');
  assert.deepEqual(total, { amount: 1600, currency: 'USD' }); // 1000 + 600
});

// ── Arithmetic Operators ─────────────────────────────────────────────

test('multiply-then-divide precedence — subtotal = quantity × unitCost', () => {
  const engine = createGrantEngine();
  addRepeatInstance(engine, 'budget.lineItems');
  engine.setValue('budget.lineItems[0].quantity', 4);
  engine.setValue('budget.lineItems[0].unitCost', 250);

  assert.equal(engineValue(engine, 'budget.lineItems[0].subtotal'), 1000);
});

test('add-then-multiply — @grandTotal = totalDirect + indirectCosts', () => {
  const engine = createGrantEngine();
  engine.setValue('applicantInfo.orgType', 'nonprofit');
  engine.setValue('projectNarrative.indirectRate', 10);
  addRepeatInstance(engine, 'budget.lineItems');
  engine.setValue('budget.lineItems[0].quantity', 1);
  engine.setValue('budget.lineItems[0].unitCost', 1000);

  const indirect = engineVariable(engine, 'indirectCosts');
  const grand = engineVariable(engine, 'grandTotal');
  assert.deepEqual(indirect, { amount: 100, currency: 'USD' });
  assert.deepEqual(grand, { amount: 1100, currency: 'USD' });
});

// ── Pattern Matching ─────────────────────────────────────────────────

test('matches() — EIN constraint rejects wrong format', () => {
  const engine = createGrantEngine();
  engine.setValue('applicantInfo.ein', 'INVALID');
  const report = getValidationReport(engine, 'continuous');
  const einError = report.results.find(r => r.path === 'applicantInfo.ein');
  assert.ok(einError, 'Expected EIN validation error');
});

test('matches() — EIN constraint accepts correct format (XX-XXXXXXX)', () => {
  const engine = createGrantEngine();
  engine.setValue('applicantInfo.ein', '12-3456789');
  const report = getValidationReport(engine, 'continuous');
  const einError = report.results.find(
    r => r.path === 'applicantInfo.ein' && r.severity === 'error'
  );
  assert.equal(einError, undefined);
});

test('contains() — email constraint rejects address missing @', () => {
  const engine = createGrantEngine();
  engine.setValue('applicantInfo.contactEmail', 'notanemail');
  const report = getValidationReport(engine, 'continuous');
  const emailError = report.results.find(r => r.path === 'applicantInfo.contactEmail');
  assert.ok(emailError, 'Expected email validation error');
});
