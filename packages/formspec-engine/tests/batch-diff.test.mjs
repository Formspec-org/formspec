/** @filedesc Unit tests for diffing batch evaluator snapshots into signal updates. */
import test from 'node:test';
import assert from 'node:assert/strict';

import { diffEvalResults } from '../dist/diff.js';

test('diffEvalResults emits initial state when no previous snapshot exists', () => {
  const next = {
    values: { name: 'Ada', total: 42 },
    validations: [
      { path: 'name', severity: 'error', constraintKind: 'required', code: 'REQUIRED', message: 'Required' },
      { path: 'name', severity: 'error', constraintKind: 'shape', code: 'SHAPE_FAILED', message: 'Bad', shapeId: 'shape-1' },
    ],
    nonRelevant: ['hidden'],
    variables: { '#:subtotal': 21 },
    required: { name: true },
    readonly: { total: true },
  };

  const delta = diffEvalResults(null, next);

  assert.deepEqual(delta.valueUpdates, next.values);
  assert.deepEqual(delta.removedValues, []);
  assert.deepEqual(delta.relevantUpdates, { hidden: false });
  assert.deepEqual(delta.requiredUpdates, next.required);
  assert.deepEqual(delta.readonlyUpdates, next.readonly);
  assert.deepEqual(delta.validationUpdates, {
    name: [next.validations[0]],
  });
  assert.deepEqual(delta.shapeUpdates, {
    'shape-1': [next.validations[1]],
  });
  assert.deepEqual(delta.variableUpdates, next.variables);
  assert.deepEqual(delta.removedVariables, []);
});

test('diffEvalResults ignores unchanged scalar and object values', () => {
  const previous = {
    values: {
      amount: null,
      money: { amount: '10.00', currency: 'USD' },
    },
    validations: [],
    nonRelevant: [],
    variables: { '#:rate': 1.5 },
    required: { amount: false },
    readonly: { amount: false },
  };
  const next = structuredClone(previous);

  const delta = diffEvalResults(previous, next);

  assert.deepEqual(delta.valueUpdates, {});
  assert.deepEqual(delta.removedValues, []);
  assert.deepEqual(delta.relevantUpdates, {});
  assert.deepEqual(delta.requiredUpdates, {});
  assert.deepEqual(delta.readonlyUpdates, {});
  assert.deepEqual(delta.validationUpdates, {});
  assert.deepEqual(delta.shapeUpdates, {});
  assert.deepEqual(delta.variableUpdates, {});
  assert.deepEqual(delta.removedVariables, []);
});

test('diffEvalResults reports changed and removed values', () => {
  const previous = {
    values: { a: 1, b: 2, old: 'gone' },
    validations: [],
    nonRelevant: [],
    variables: {},
    required: {},
    readonly: {},
  };
  const next = {
    ...previous,
    values: { a: 1, b: 3, c: null },
  };

  const delta = diffEvalResults(previous, next);

  assert.deepEqual(delta.valueUpdates, { b: 3, c: null });
  assert.deepEqual(delta.removedValues, ['old']);
});

test('diffEvalResults reports relevance, required, and readonly transitions', () => {
  const previous = {
    values: {},
    validations: [],
    nonRelevant: ['section.hidden', 'section.locked'],
    variables: {},
    required: { visible: false, 'section.hidden': false },
    readonly: { 'section.locked': true, editable: false },
  };
  const next = {
    ...previous,
    nonRelevant: ['section.locked', 'new.hidden'],
    required: { visible: true, 'section.hidden': false },
    readonly: { 'section.locked': false, editable: false },
  };

  const delta = diffEvalResults(previous, next);

  assert.deepEqual(delta.relevantUpdates, {
    'section.hidden': true,
    'new.hidden': false,
  });
  assert.deepEqual(delta.requiredUpdates, { visible: true });
  assert.deepEqual(delta.readonlyUpdates, { 'section.locked': false });
});

test('diffEvalResults groups validation results by path and shapeId', () => {
  const previous = {
    values: {},
    validations: [
      { path: 'age', severity: 'error', constraintKind: 'required', code: 'REQUIRED', message: 'Required' },
      { path: 'age', severity: 'error', constraintKind: 'shape', code: 'SHAPE_FAILED', message: 'Bad', shapeId: 'shape-1' },
    ],
    nonRelevant: [],
    variables: {},
    required: {},
    readonly: {},
  };
  const next = {
    ...previous,
    validations: [
      { path: 'age', severity: 'error', constraintKind: 'required', code: 'REQUIRED', message: 'Still required' },
      { path: 'name', severity: 'warning', constraintKind: 'constraint', code: 'WARN', message: 'Warn' },
      { path: 'age', severity: 'error', constraintKind: 'shape', code: 'SHAPE_FAILED', message: 'Bad', shapeId: 'shape-2' },
    ],
  };

  const delta = diffEvalResults(previous, next);

  assert.deepEqual(delta.validationUpdates, {
    age: [next.validations[0]],
    name: [next.validations[1]],
  });
  assert.deepEqual(delta.shapeUpdates, {
    'shape-2': [next.validations[2]],
  });
  assert.deepEqual(delta.removedShapeIds, ['shape-1']);
});

test('diffEvalResults reports changed and removed variables', () => {
  const previous = {
    values: {},
    validations: [],
    nonRelevant: [],
    variables: { '#:total': 10, old: 1 },
    required: {},
    readonly: {},
  };
  const next = {
    ...previous,
    variables: { '#:total': 11, added: { nested: true } },
  };

  const delta = diffEvalResults(previous, next);

  assert.deepEqual(delta.variableUpdates, {
    '#:total': 11,
    added: { nested: true },
  });
  assert.deepEqual(delta.removedVariables, ['old']);
});
