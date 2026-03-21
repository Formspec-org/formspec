/** @filedesc Shape with mixed $-prefixed and bare-identifier refs evaluates correctly */
import test from 'node:test';
import assert from 'node:assert/strict';
import { FormEngine } from '../dist/index.js';

// A shape whose constraint uses BOTH $-prefixed refs AND bare identifiers.
// The TS supplement must evaluate these correctly regardless of whether WASM
// produced results for them. Previously, a heuristic incorrectly marked shapes
// as WASM-handled if they contained any $-prefixed ref, even when they also
// contained bare identifiers that WASM batch evaluation might not resolve.

test('shape with mixed $ref and bare identifiers fires when constraint fails', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/test',
    version: '1.0.0',
    title: 'Mixed Ref Shape',
    items: [
      { key: 'budget', type: 'field', dataType: 'decimal', label: 'Budget', initialValue: 50 },
      { key: 'grandTotal', type: 'field', dataType: 'decimal', label: 'Grand Total', initialValue: 200 },
    ],
    shapes: [
      {
        id: 'budgetCheck',
        target: '#',
        severity: 'error',
        constraint: '$budget > grandTotal',
        message: 'Budget must exceed grand total',
      },
    ],
  });

  // budget=50, grandTotal=200 → 50 > 200 is false → shape should fire
  const report = engine.getValidationReport();
  const err = report.results.find(r => r.shapeId === 'budgetCheck');
  assert.ok(err, 'Shape should fire when constraint evaluates to false');
  assert.equal(err.severity, 'error');
  assert.equal(err.message, 'Budget must exceed grand total');
});

test('shape with mixed $ref and bare identifiers passes when constraint is true', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/test',
    version: '1.0.0',
    title: 'Mixed Ref Shape',
    items: [
      { key: 'budget', type: 'field', dataType: 'decimal', label: 'Budget', initialValue: 500 },
      { key: 'grandTotal', type: 'field', dataType: 'decimal', label: 'Grand Total', initialValue: 200 },
    ],
    shapes: [
      {
        id: 'budgetCheck',
        target: '#',
        severity: 'error',
        constraint: '$budget > grandTotal',
        message: 'Budget must exceed grand total',
      },
    ],
  });

  // budget=500, grandTotal=200 → 500 > 200 is true → shape should NOT fire
  const report = engine.getValidationReport();
  const err = report.results.find(r => r.shapeId === 'budgetCheck');
  assert.equal(err, undefined, 'Shape should not fire when constraint evaluates to true');
});

test('shape with only bare identifiers fires correctly', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/test',
    version: '1.0.0',
    title: 'Bare Ref Shape',
    items: [
      { key: 'budget', type: 'field', dataType: 'decimal', label: 'Budget', initialValue: 50 },
      { key: 'grandTotal', type: 'field', dataType: 'decimal', label: 'Grand Total', initialValue: 200 },
    ],
    shapes: [
      {
        id: 'bareCheck',
        target: '#',
        severity: 'error',
        constraint: 'budget > grandTotal + 100',
        message: 'Budget must exceed grand total + 100',
      },
    ],
  });

  // budget=50, grandTotal=200 → 50 > 300 is false → shape should fire
  const report = engine.getValidationReport();
  const err = report.results.find(r => r.shapeId === 'bareCheck');
  assert.ok(err, 'Shape with bare identifiers should fire when constraint fails');
});
