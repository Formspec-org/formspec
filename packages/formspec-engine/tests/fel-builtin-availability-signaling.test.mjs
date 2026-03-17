/** @filedesc FEL builtin availability: unknown functions throw explicit errors; supported builtins are callable */
import test from 'node:test';
import assert from 'node:assert/strict';
import { FormEngine } from '../dist/index.js';

function makeEngine() {
  return new FormEngine({
    $formspec: '1.0',
    url: 'https://example.org/forms/fel-builtins',
    version: '1.0.0',
    title: 'FEL Builtins',
    items: [
      { key: 'value', type: 'field', dataType: 'integer', label: 'Value' }
    ]
  });
}

test('unknown FEL functions throw an explicit unsupported-function error', () => {
  const engine = makeEngine();

  assert.throws(
    () => engine.compileExpression('totallyUnknown(1)', 'value')(),
    /Unsupported FEL function: totallyUnknown/
  );
});
