import test from 'node:test';
import assert from 'node:assert/strict';
import { FormEngine } from '../dist/index.js';

test('relevant null defaults to true in bind context', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/null-relevant',
    version: '1.0.0',
    title: 'Null Relevant',
    items: [
      { key: 'name', type: 'field', dataType: 'string', label: 'Name', initialValue: 'x' }
    ],
    binds: [
      { path: 'name', relevant: 'missing > 0' }
    ]
  });

  assert.equal(engine.relevantSignals.name.value, true);
});

test('constraint null passes in bind context', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/null-constraint',
    version: '1.0.0',
    title: 'Null Constraint',
    items: [
      { key: 'amount', type: 'field', dataType: 'integer', label: 'Amount', initialValue: 5 }
    ],
    binds: [
      { path: 'amount', constraint: 'missing > 0', constraintMessage: 'Should not fail' }
    ]
  });

  assert.equal(engine.validationResults.amount.value.length, 0);
});

test('required null defaults to false in bind context', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/null-required',
    version: '1.0.0',
    title: 'Null Required',
    items: [
      { key: 'name', type: 'field', dataType: 'string', label: 'Name', initialValue: '' }
    ],
    binds: [
      { path: 'name', required: 'missing > 0' }
    ]
  });

  assert.equal(engine.requiredSignals.name.value, false);
});

test('readonly null defaults to false in bind context', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/null-readonly',
    version: '1.0.0',
    title: 'Null Readonly',
    items: [
      { key: 'name', type: 'field', dataType: 'string', label: 'Name', initialValue: 'x' }
    ],
    binds: [
      { path: 'name', readonly: 'missing > 0' }
    ]
  });

  assert.equal(engine.readonlySignals.name.value, false);
});
