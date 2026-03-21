/** @filedesc Baseline public-behavior tests for the batch engine rewrite. */
import test from 'node:test';
import assert from 'node:assert/strict';

import { FormEngine } from '../dist/index.js';

function createCoreEngine() {
  return new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/batch-core',
    version: '1.0.0',
    title: 'Batch Core',
    items: [
      { key: 'showDetails', type: 'field', dataType: 'boolean', label: 'Show Details', initialValue: false },
      { key: 'qty', type: 'field', dataType: 'integer', label: 'Qty' },
      { key: 'price', type: 'field', dataType: 'decimal', label: 'Price' },
      { key: 'total', type: 'field', dataType: 'decimal', label: 'Total' },
      { key: 'details', type: 'field', dataType: 'string', label: 'Details' },
      { key: 'approval', type: 'field', dataType: 'string', label: 'Approval' },
    ],
    binds: [
      { path: 'total', calculate: '$qty * $price' },
      { path: 'details', relevant: 'showDetails == true', required: 'showDetails == true' },
      { path: 'approval', readonly: '$total > 100' },
      { path: 'details', constraint: "$ == 'ready'", constraintMessage: 'Details too short' },
    ],
    variables: [
      { name: 'grandTotal', expression: 'total' },
    ],
  });
}

test('constructor creates signals for fields and initializes calculated state', () => {
  const engine = createCoreEngine();

  assert.ok(engine.signals.qty);
  assert.ok(engine.signals.total);
  assert.ok(engine.relevantSignals.details);
  assert.ok(engine.requiredSignals.details);
  assert.ok(engine.readonlySignals.approval);
  assert.ok(engine.variableSignals['#:grandTotal']);
  assert.equal(engine.signals.total.value, null);
  assert.equal(engine.variableSignals['#:grandTotal'].value, null);
});

test('setValue updates source signals and recalculates dependent fields and variables', () => {
  const engine = createCoreEngine();

  engine.setValue('qty', 4);
  engine.setValue('price', 12.5);

  assert.equal(engine.signals.qty.value, 4);
  assert.equal(engine.signals.price.value, 12.5);
  assert.equal(engine.signals.total.value, 50);
  assert.equal(engine.variableSignals['#:grandTotal'].value, 50);
});

test('setValue on calculated fields is ignored', () => {
  const engine = createCoreEngine();

  engine.setValue('qty', 2);
  engine.setValue('price', 30);
  assert.equal(engine.signals.total.value, 60);

  engine.setValue('total', 999);
  assert.equal(engine.signals.total.value, 60);
});

test('relevant required and readonly signals track batch-visible state', () => {
  const engine = createCoreEngine();

  assert.equal(engine.relevantSignals.details.value, false);
  assert.equal(engine.requiredSignals.details.value, false);
  assert.equal(engine.readonlySignals.approval.value, false);

  engine.setValue('showDetails', true);
  assert.equal(engine.relevantSignals.details.value, true);
  assert.equal(engine.requiredSignals.details.value, true);

  engine.setValue('qty', 5);
  engine.setValue('price', 25);
  assert.equal(engine.readonlySignals.approval.value, true);
});

test('validation results and compileExpression reflect current engine state', () => {
  const engine = createCoreEngine();

  engine.setValue('showDetails', true);
  engine.setValue('details', 'x');

  const detailsResults = engine.validationResults.details.value;
  assert.equal(detailsResults.length, 1);
  assert.equal(detailsResults[0].message, 'Details too short');

  const compiled = engine.compileExpression('qty + price + total');
  engine.setValue('qty', 3);
  engine.setValue('price', 7);
  assert.equal(compiled(), 31);
});
