import test from 'node:test';
import assert from 'node:assert/strict';
import { FormEngine } from '../dist/index.js';

function baseDefinition() {
  return {
    $formspec: '1.0',
    url: 'https://example.org/extensions',
    version: '1.0.0',
    status: 'active',
    title: 'Extensions',
    items: [
      { type: 'field', key: 'name', dataType: 'string', label: 'Name' },
    ],
    binds: [
      { path: 'name', required: 'true' },
    ],
    shapes: [
      {
        id: 'name-shape',
        target: '#',
        severity: 'warning',
        message: 'Short names need review',
        constraint: 'length($name) >= 3',
      },
    ],
  };
}

function definitionWithExtensions() {
  const definition = structuredClone(baseDefinition());
  definition.extensions = { 'x-root': { source: 'unit-test' } };
  definition.items[0].extensions = { 'x-item': { widgetHint: 'ignore-me' } };
  definition.binds[0].extensions = { 'x-bind': { requiredPolicy: 'do-not-care' } };
  definition.shapes[0].extensions = { 'x-shape': { reviewQueue: 'manual' } };
  return definition;
}

test('unknown extensions do not change core engine behavior', () => {
  const plain = new FormEngine(baseDefinition());
  const extended = new FormEngine(definitionWithExtensions());

  const plainMissing = plain.getValidationReport({ mode: 'submit' });
  const extendedMissing = extended.getValidationReport({ mode: 'submit' });

  plain.setValue('name', 'Al');
  extended.setValue('name', 'Al');

  const plainPresent = plain.getValidationReport({ mode: 'submit' });
  const extendedPresent = extended.getValidationReport({ mode: 'submit' });

  assert.deepEqual(extendedMissing.results, plainMissing.results);
  assert.equal(extendedMissing.valid, plainMissing.valid);
  assert.deepEqual(extendedPresent.results, plainPresent.results);
  assert.equal(extendedPresent.valid, plainPresent.valid);
});

test('unknown extensions are preserved on the loaded definition object', () => {
  const engine = new FormEngine(definitionWithExtensions());

  assert.deepEqual(engine.definition.extensions, { 'x-root': { source: 'unit-test' } });
  assert.deepEqual(engine.definition.items[0].extensions, { 'x-item': { widgetHint: 'ignore-me' } });
  assert.deepEqual(engine.definition.binds[0].extensions, { 'x-bind': { requiredPolicy: 'do-not-care' } });
  assert.deepEqual(engine.definition.shapes[0].extensions, { 'x-shape': { reviewQueue: 'manual' } });
});
