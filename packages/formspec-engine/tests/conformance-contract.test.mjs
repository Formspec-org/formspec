/**
 * Conformance Contract — Grant Application Coverage
 *
 * Migrated from tests/e2e/playwright/integration/grant-app-conformance.spec.ts
 *
 * Tests engine identity, initial value hydration, mixed field types,
 * non-relevant behaviour, response contract, and component relevant signals.
 *
 * Deduplicates: endDate constraint, ValidationReport shape, and Response
 * contract tests are already covered in validation-shapes-and-binds.test.mjs.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGrantEngine,
  engineValue,
  engineVariable,
  getValidationReport,
  getResponse,
  addRepeatInstance,
} from './helpers/grant-app.mjs';

// ── Engine identity ──────────────────────────────────────────────────

test('should expose pinned definition url and version from loaded definition', () => {
  const engine = createGrantEngine();
  const def = engine.definition;
  assert.equal(def.url, 'https://example.gov/forms/grant-application');
  assert.equal(def.version, '1.0.0');
  assert.equal(def.versionAlgorithm, 'semver');
});

// ── Initial value hydration ──────────────────────────────────────────

test('should hydrate initialValue fields before any user interaction', () => {
  const engine = createGrantEngine();
  assert.equal(engineValue(engine, 'applicantInfo.contactPhone'), '202-555-0100');
});

// ── Mixed field type data entry ──────────────────────────────────────

test('should accept mixed field types and reflect them in engine signals', () => {
  const engine = createGrantEngine();
  engine.setValue('applicantInfo.orgName', 'Health Foundation');
  engine.setValue('applicantInfo.orgType', 'nonprofit');
  engine.setValue('projectNarrative.startDate', '2027-01-01');
  engine.setValue('projectNarrative.endDate', '2028-01-01');
  engine.setValue('projectNarrative.focusAreas', ['health', 'education']);
  engine.setValue('budget.requestedAmount', { amount: 50000, currency: 'USD' });

  assert.equal(engineValue(engine, 'applicantInfo.orgName'), 'Health Foundation');
  assert.equal(engineValue(engine, 'applicantInfo.orgType'), 'nonprofit');
  assert.equal(engineValue(engine, 'projectNarrative.startDate'), '2027-01-01');
  const focusAreas = engineValue(engine, 'projectNarrative.focusAreas');
  assert.ok(focusAreas.includes('health'));
  const amount = engineValue(engine, 'budget.requestedAmount');
  assert.deepEqual(amount, { amount: 50000, currency: 'USD' });
});

// ── Non-relevant behaviour ───────────────────────────────────────────

test('should prune non-relevant fields from response with nonRelevantBehavior: remove', () => {
  const engine = createGrantEngine();
  engine.setValue('applicantInfo.orgType', 'government');
  engine.setValue('projectNarrative.indirectRate', 15);

  const response = getResponse(engine);
  const indirectRate = response.data?.projectNarrative?.indirectRate;
  assert.ok(indirectRate === undefined || indirectRate === null,
    `Expected indirectRate to be pruned, got ${indirectRate}`);
});

test('should include relevant fields in response', () => {
  const engine = createGrantEngine();
  engine.setValue('applicantInfo.orgName', 'Tech Nonprofit');
  engine.setValue('applicantInfo.orgType', 'nonprofit');
  engine.setValue('projectNarrative.indirectRate', 12);

  const response = getResponse(engine);
  assert.equal(response.data?.applicantInfo?.orgName, 'Tech Nonprofit');
  assert.equal(response.data?.projectNarrative?.indirectRate, 12);
});

// ── Response contract ────────────────────────────────────────────────

test('should return response with required top-level fields', () => {
  const engine = createGrantEngine();
  const response = getResponse(engine);
  assert.equal(response.definitionUrl, 'https://example.gov/forms/grant-application');
  assert.equal(response.definitionVersion, '1.0.0');
  assert.equal(typeof response.status, 'string');
  assert.ok(response.data);
  assert.ok(Array.isArray(response.validationResults));
});

test('should include repeat group arrays in response data', () => {
  const engine = createGrantEngine();
  addRepeatInstance(engine, 'budget.lineItems');
  engine.setValue('budget.lineItems[0].category', 'Personnel');

  const response = getResponse(engine);
  assert.ok(Array.isArray(response.data?.budget?.lineItems));
  assert.equal(response.data.budget.lineItems[0].category, 'Personnel');
});

// ── Component `when` vs definition `relevant` ────────────────────────

test('should hide component via definition relevant when orgType is not nonprofit', () => {
  const engine = createGrantEngine();
  engine.setValue('applicantInfo.orgType', 'university');
  assert.equal(engine.relevantSignals['applicantInfo.nonprofitPhoneHint']?.value, false);
});

test('should show component via definition relevant when orgType is nonprofit', () => {
  const engine = createGrantEngine();
  engine.setValue('applicantInfo.orgType', 'nonprofit');
  assert.equal(engine.relevantSignals['applicantInfo.nonprofitPhoneHint']?.value, true);
});
