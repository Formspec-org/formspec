/** @filedesc Bind defaults: default values apply when a field becomes relevant, and FEL expression context */
import test from 'node:test';
import assert from 'node:assert/strict';
import { FormEngine } from '../dist/index.js';

test('should apply bind default only when field becomes relevant and value is empty', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/defaults',
    version: '1.0.0',
    title: 'Defaults',
    items: [
      { key: 'show', type: 'field', dataType: 'boolean', label: 'Show', initialValue: false },
      { key: 'coupon', type: 'field', dataType: 'string', label: 'Coupon', initialValue: '' }
    ],
    binds: [
      { path: 'coupon', relevant: 'show == true', default: 'AUTO10' }
    ]
  });

  assert.equal(engine.signals.coupon.value, '');

  engine.setValue('show', true);
  assert.equal(engine.signals.coupon.value, 'AUTO10');

  engine.setValue('coupon', 'MANUAL');
  engine.setValue('show', false);
  engine.setValue('show', true);

  // Default should not overwrite non-empty user value.
  assert.equal(engine.signals.coupon.value, 'MANUAL');
});

test('should return null for non-relevant values in FEL when excludedValue is null', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/excluded',
    version: '1.0.0',
    title: 'Excluded Value',
    items: [
      { key: 'show', type: 'field', dataType: 'boolean', label: 'Show', initialValue: false },
      { key: 'secret', type: 'field', dataType: 'string', label: 'Secret', initialValue: 'hidden' },
      { key: 'display', type: 'field', dataType: 'string', label: 'Display' }
    ],
    binds: [
      { path: 'secret', relevant: 'show == true', excludedValue: 'null' },
      { path: 'display', calculate: "if isNull(secret) then 'NULL' else secret" }
    ]
  });

  assert.equal(engine.signals.display.value, 'NULL');

  engine.setValue('show', true);
  assert.equal(engine.signals.display.value, 'hidden');

  engine.setValue('secret', 'visible');
  assert.equal(engine.signals.display.value, 'visible');
});

test('should expose compileExpression and lexical variable lookup helpers', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/helpers',
    version: '1.0.0',
    title: 'Helpers',
    items: [
      { key: 'rate', type: 'field', dataType: 'decimal', label: 'Rate', initialValue: 0.1 },
      {
        key: 'order',
        type: 'group',
        label: 'Order',
        children: [
          { key: 'amount', type: 'field', dataType: 'decimal', label: 'Amount', initialValue: 200 }
        ]
      }
    ],
    variables: [
      { name: 'globalRate', expression: 'rate' },
      { name: 'localTax', expression: 'amount * @globalRate', scope: 'order' }
    ]
  });

  const expr = engine.compileExpression('rate * 100');
  assert.equal(expr(), 10);

  assert.equal(engine.getVariableValue('localTax', 'order'), 20);
  assert.equal(engine.getVariableValue('localTax', 'order.line'), 20);
  assert.equal(engine.getVariableValue('globalRate', 'order.line'), 0.1);
  assert.equal(engine.getVariableValue('missingVar', 'order'), undefined);
});
