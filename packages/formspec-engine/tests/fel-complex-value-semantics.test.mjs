/** @filedesc FEL complex value semantics: money, date, and structured-type equality and arithmetic */
import test from 'node:test';
import assert from 'node:assert/strict';
import { FormEngine } from '../dist/index.js';

function engineWithCalc(calculate, dataType = 'string') {
  return new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/fel-complex-values',
    version: '1.0.0',
    title: 'FEL Complex Values',
    items: [{ key: 'result', type: 'field', dataType, label: 'Result' }],
    binds: [{ path: 'result', calculate }]
  });
}

test('money equality compares amount and currency structurally', () => {
  const equalEngine = engineWithCalc("money(10, 'USD') = money(10, 'USD')", 'boolean');
  const unequalEngine = engineWithCalc("money(10, 'USD') = money(10, 'EUR')", 'boolean');

  assert.equal(equalEngine.signals.result.value, true);
  assert.equal(unequalEngine.signals.result.value, false);
});

test('money values are not order-comparable', () => {
  const engine = engineWithCalc("money(10, 'USD') < money(20, 'USD')", 'boolean');
  assert.equal(engine.signals.result.value, null);
});

test('membership uses value equality for money objects', () => {
  const engine = engineWithCalc("money(10, 'USD') in [money(10, 'USD'), money(20, 'USD')]", 'boolean');
  assert.equal(engine.signals.result.value, true);
});

test('array-scalar arithmetic broadcasts element-wise', () => {
  const engine = engineWithCalc('[1, 2, 3] * 10');
  assert.deepEqual(engine.signals.result.value, [10, 20, 30]);
});

test('scalar-array arithmetic broadcasts element-wise', () => {
  const engine = engineWithCalc('10 * [1, 2, 3]');
  assert.deepEqual(engine.signals.result.value, [10, 20, 30]);
});

test('array-array operations propagate nulls per element', () => {
  const engine = engineWithCalc('[1, null, 3] + [4, 5, 6]');
  assert.deepEqual(engine.signals.result.value, [5, null, 9]);
});

test('array-array comparisons apply element-wise', () => {
  const engine = engineWithCalc('[1, 2, 3] > [0, 2, 4]', 'boolean');
  assert.deepEqual(engine.signals.result.value, [true, false, false]);
});

test('array-array string concatenation applies element-wise', () => {
  const engine = engineWithCalc("['a', 'b'] & ['x', 'y']");
  assert.deepEqual(engine.signals.result.value, ['ax', 'by']);
});

test('array length mismatch returns null', () => {
  const engine = engineWithCalc('[1, 2] + [3]');
  assert.equal(engine.signals.result.value, null);
});
