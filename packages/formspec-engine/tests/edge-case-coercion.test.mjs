/**
 * Edge-Case Numeric Coercion — Grant Application Coverage
 *
 * Migrated from tests/e2e/playwright/integration/edge-case-behaviors.spec.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGrantEngine,
  engineValue,
  addRepeatInstance,
} from './helpers/grant-app.mjs';

test('should keep calculation behavior stable when multiplying unitCost by an empty quantity', () => {
  const engine = createGrantEngine();

  addRepeatInstance(engine, 'budget.lineItems');
  engine.setValue('budget.lineItems[0].unitCost', 99.99);

  const subtotal = engineValue(engine, 'budget.lineItems[0].subtotal');

  assert.equal(subtotal === null || subtotal === 0 || subtotal === undefined, true);
  if (subtotal !== null && subtotal !== undefined) {
    assert.equal(Number.isNaN(subtotal), false);
  }
});
