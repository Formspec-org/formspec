import test from 'node:test';
import assert from 'node:assert/strict';
import { FormEngine } from '../dist/index.js';

function engineWithCalc(calculate, dataType = 'string') {
  return new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/fel-null-logic',
    version: '1.0.0',
    title: 'FEL Null Logic',
    items: [{ key: 'result', type: 'field', dataType, label: 'Result' }],
    binds: [{ path: 'result', calculate }]
  });
}

test('arithmetic null propagates', () => {
  const engine = engineWithCalc('null + 5', 'decimal');
  assert.equal(engine.signals.result.value, null);
});

test('string concatenation null propagates', () => {
  const engine = engineWithCalc("'hello' & null");
  assert.equal(engine.signals.result.value, null);
});

test('comparison null propagates', () => {
  const engine = engineWithCalc('null < 5', 'boolean');
  assert.equal(engine.signals.result.value, null);
});

test('false and null short-circuits to false', () => {
  const engine = engineWithCalc('false and null', 'boolean');
  assert.equal(engine.signals.result.value, false);
});

test('true or null short-circuits to true', () => {
  const engine = engineWithCalc('true or null', 'boolean');
  assert.equal(engine.signals.result.value, true);
});

test('logical operators reject non-boolean operands', () => {
  const andEngine = engineWithCalc('1 and true', 'boolean');
  const orEngine = engineWithCalc("'x' or false", 'boolean');

  assert.equal(andEngine.signals.result.value, null);
  assert.equal(orEngine.signals.result.value, null);
});

test('ternary null condition returns null', () => {
  const engine = engineWithCalc("null ? 'yes' : 'no'");
  assert.equal(engine.signals.result.value, null);
});

test('if() null condition returns null', () => {
  const engine = engineWithCalc("if(null, 'yes', 'no')");
  assert.equal(engine.signals.result.value, null);
});

test('conditional operators reject non-boolean conditions', () => {
  const ternaryEngine = engineWithCalc("1 ? 'yes' : 'no'");
  const ifEngine = engineWithCalc("if(1, 'yes', 'no')");

  assert.equal(ternaryEngine.signals.result.value, null);
  assert.equal(ifEngine.signals.result.value, null);
});
