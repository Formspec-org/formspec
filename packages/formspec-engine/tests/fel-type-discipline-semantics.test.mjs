import test from 'node:test';
import assert from 'node:assert/strict';
import { FormEngine } from '../dist/index.js';

function engineWithCalc(calculate, dataType = 'string') {
  return new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/fel-type-discipline',
    version: '1.0.0',
    title: 'FEL Type Discipline',
    items: [{ key: 'result', type: 'field', dataType, label: 'Result' }],
    binds: [{ path: 'result', calculate }]
  });
}

test('cross-type equality returns null', () => {
  const engine = engineWithCalc("1 = 'hello'", 'boolean');
  assert.equal(engine.signals.result.value, null);
});

test('cross-type comparison returns null', () => {
  const engine = engineWithCalc("1 < 'hello'", 'boolean');
  assert.equal(engine.signals.result.value, null);
});

test('string concatenation rejects non-string operands', () => {
  const engine = engineWithCalc("'x' & 5");
  assert.equal(engine.signals.result.value, null);
});

test('arithmetic rejects non-numeric operands', () => {
  const engine = engineWithCalc("'hello' + 5", 'decimal');
  assert.equal(engine.signals.result.value, null);
});

test('unary not rejects non-boolean operands', () => {
  const engine = engineWithCalc('not 1', 'boolean');
  assert.equal(engine.signals.result.value, null);
});

test('unary minus rejects non-numeric operands', () => {
  const engine = engineWithCalc("-'x'", 'decimal');
  assert.equal(engine.signals.result.value, null);
});
