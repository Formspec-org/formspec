/** @filedesc Bridge tests for wasmEvaluateDefinition context threading. */
import test from 'node:test';
import assert from 'node:assert/strict';

import { wasmEvaluateDefinition, wasmTokenizeFEL } from '../dist/wasm-bridge.js';

test('wasmEvaluateDefinition forwards previousValidations to the batch evaluator', () => {
  const definition = {
    $formspec: '1.0',
    url: 'http://example.org/wasm-eval',
    version: '1.0.0',
    title: 'WASM Eval',
    items: [
      { key: 'age', type: 'field', dataType: 'decimal', label: 'Age' },
      { key: 'ageStatus', type: 'field', dataType: 'string', label: 'Status' },
    ],
    binds: [
      { path: 'age', constraint: '$age >= 0', required: 'true' },
      { path: 'ageStatus', calculate: "if(valid($age), 'ok', 'invalid')" },
    ],
  };

  const first = wasmEvaluateDefinition(definition, {});
  const second = wasmEvaluateDefinition(definition, {}, {
    previousValidations: first.validations,
  });

  assert.equal(second.values.ageStatus, 'invalid');
});

test('wasmEvaluateDefinition returns shapeId and context for failing shape validations', () => {
  const definition = {
    $formspec: '1.0',
    url: 'http://example.org/wasm-shape-context',
    version: '1.0.0',
    title: 'WASM Shape Context',
    items: [
      { key: 'budget', type: 'field', dataType: 'decimal', label: 'Budget' },
      { key: 'spent', type: 'field', dataType: 'decimal', label: 'Spent' },
    ],
    shapes: [{
      id: 'budget-check',
      targets: ['spent'],
      constraint: '$spent <= $budget',
      constraintMessage: 'Over budget',
      context: {
        remaining: '$budget - $spent',
        overBy: '$spent - $budget',
      },
    }],
  };

  const result = wasmEvaluateDefinition(definition, {
    budget: 100,
    spent: 150,
  });
  const validation = result.validations.find((entry) => entry.shapeId === 'budget-check');

  assert.ok(validation);
  assert.deepEqual(validation.context, {
    remaining: -50,
    overBy: 50,
  });
});

test('wasmTokenizeFEL returns positioned tokens through the JS bridge', () => {
  const tokens = wasmTokenizeFEL('if($qty >= 1, $price, 0)');

  assert.ok(tokens.length > 0);
  assert.equal(tokens[0].tokenType, 'If');
  assert.equal(tokens[0].text, 'if');
  assert.equal(typeof tokens[0].start, 'number');
  assert.equal(typeof tokens[0].end, 'number');
});
