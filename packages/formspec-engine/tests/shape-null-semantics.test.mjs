/**
 * Shape constraint null semantics — spec §3.8.1
 *
 * In constraint context, null → true (passes).
 * FEL comparisons with null operands propagate null (e.g. null <= 500 → null).
 * Shape constraints must treat null results the same as bind constraints do:
 * null/undefined means "no opinion" → constraint passes.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { FormEngine } from '../dist/index.js';

// ── Primary constraint null semantics ────────────────────────────────

test('shape constraint: null comparison result should pass (not fire)', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/test',
    version: '1.0.0',
    title: 'Shape Null Test',
    items: [
      { key: 'amount', type: 'field', dataType: 'integer', label: 'Amount' }
    ],
    shapes: [
      {
        id: 'amountLimit',
        target: '#',
        message: 'Amount must be <= 500',
        constraint: '$amount <= 500'
      }
    ]
  });

  // amount is null → $amount <= 500 evaluates to null → should pass
  const report = engine.getValidationReport();
  const shapeErr = report.results.find(r => r.shapeId === 'amountLimit');
  assert.equal(shapeErr, undefined, 'Shape should not fire when constraint evaluates to null');
});

test('shape constraint: not($amount > 25) when amount is null should pass', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/test',
    version: '1.0.0',
    title: 'Shape Not-Null Test',
    items: [
      { key: 'amount', type: 'field', dataType: 'integer', label: 'Amount' }
    ],
    shapes: [
      {
        id: 'notOverLimit',
        target: '#',
        message: 'Amount must not exceed 25',
        constraint: '!($amount > 25)'
      }
    ]
  });

  // amount is null → $amount > 25 is null → !null is null → should pass
  const report = engine.getValidationReport();
  const shapeErr = report.results.find(r => r.shapeId === 'notOverLimit');
  assert.equal(shapeErr, undefined, 'Shape should not fire when negated null comparison evaluates to null');
});

test('shape constraint: genuinely false result still fires', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/test',
    version: '1.0.0',
    title: 'Shape False Test',
    items: [
      { key: 'amount', type: 'field', dataType: 'integer', label: 'Amount', initialValue: 1000 }
    ],
    shapes: [
      {
        id: 'amountLimit',
        target: '#',
        message: 'Amount must be <= 500',
        constraint: '$amount <= 500'
      }
    ]
  });

  // amount is 1000 → 1000 <= 500 → false → shape fires
  const report = engine.getValidationReport();
  const shapeErr = report.results.find(r => r.shapeId === 'amountLimit');
  assert.ok(shapeErr, 'Shape must fire when constraint is genuinely false');
  assert.equal(shapeErr.message, 'Amount must be <= 500');
});

// ── Composition element null semantics ───────────────────────────────

test('and-composed shape: null expression result should pass (not block)', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/test',
    version: '1.0.0',
    title: 'And-Null Test',
    items: [
      { key: 'amount', type: 'field', dataType: 'integer', label: 'Amount' },
      { key: 'name', type: 'field', dataType: 'string', label: 'Name', initialValue: 'Alice' }
    ],
    shapes: [
      {
        id: 'combo',
        target: '#',
        message: 'Validation failed',
        and: ['$amount <= 500', 'present($name)']
      }
    ]
  });

  // amount null → first and-clause evaluates to null → should pass (no opinion)
  // name present → second and-clause passes
  // overall: should pass
  const report = engine.getValidationReport();
  const shapeErr = report.results.find(r => r.shapeId === 'combo');
  assert.equal(shapeErr, undefined, 'And-composition should treat null element as passing');
});

test('or-composed shape: all-null expressions should pass', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/test',
    version: '1.0.0',
    title: 'Or-Null Test',
    items: [
      { key: 'amount', type: 'field', dataType: 'integer', label: 'Amount' },
      { key: 'price', type: 'field', dataType: 'integer', label: 'Price' }
    ],
    shapes: [
      {
        id: 'orCombo',
        target: '#',
        message: 'Need a valid value',
        or: ['$amount <= 500', '$price > 0']
      }
    ]
  });

  // Both fields null → both expressions evaluate to null → both pass (no opinion)
  const report = engine.getValidationReport();
  const shapeErr = report.results.find(r => r.shapeId === 'orCombo');
  assert.equal(shapeErr, undefined, 'Or-composition should treat null elements as passing');
});

test('not-composed shape: null expression should not trigger failure', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/test',
    version: '1.0.0',
    title: 'Not-Null Composition Test',
    items: [
      { key: 'amount', type: 'field', dataType: 'integer', label: 'Amount' }
    ],
    shapes: [
      {
        id: 'notExcessive',
        target: '#',
        message: 'Amount is excessive',
        not: '$amount > 100'
      }
    ]
  });

  // amount null → $amount > 100 is null → "no opinion"
  // not-composition checks "is this condition definitely true?" — null is not definitely true
  // → shape should pass
  const report = engine.getValidationReport();
  const shapeErr = report.results.find(r => r.shapeId === 'notExcessive');
  assert.equal(shapeErr, undefined, 'Not-composition should pass when inner expression is null (indeterminate)');
});

test('xone-composed shape: null expressions among one true should pass', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/test',
    version: '1.0.0',
    title: 'Xone-Null Test',
    items: [
      { key: 'a', type: 'field', dataType: 'integer', label: 'A' },
      { key: 'b', type: 'field', dataType: 'boolean', label: 'B', initialValue: true },
      { key: 'c', type: 'field', dataType: 'integer', label: 'C' }
    ],
    shapes: [
      {
        id: 'xoneCombo',
        target: '#',
        message: 'Exactly one must be true',
        xone: ['$a > 10', '$b', '$c > 5']
      }
    ]
  });

  // a null → null, b true → true, c null → null
  // Only one is definitively true → xone should pass
  const report = engine.getValidationReport();
  const shapeErr = report.results.find(r => r.shapeId === 'xoneCombo');
  assert.equal(shapeErr, undefined, 'Xone should pass with one true and rest null');
});

// ── Bind constraint null regression guard ────────────────────────────

test('bind constraint: null comparison result still passes (regression guard)', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/test',
    version: '1.0.0',
    title: 'Bind Null Guard',
    items: [
      { key: 'amount', type: 'field', dataType: 'integer', label: 'Amount' }
    ],
    binds: [
      {
        path: 'amount',
        constraint: '$amount <= 500',
        constraintMessage: 'Amount must be <= 500'
      }
    ]
  });

  // amount null → bind constraint skipped entirely (value is empty)
  const report = engine.getValidationReport();
  const constraintErr = report.results.find(r => r.path === 'amount' && r.constraintKind === 'constraint');
  assert.equal(constraintErr, undefined, 'Bind constraint should not fire when value is null');
});
