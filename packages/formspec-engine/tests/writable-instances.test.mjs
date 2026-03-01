/**
 * Writable Instances — Grant Application Coverage
 *
 * Migrated from tests/e2e/playwright/integration/writable-instances.spec.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { FormEngine } from '../dist/index.js';
import {
  createGrantEngine,
  addRepeatInstance,
} from './helpers/grant-app.mjs';

test('writable instance (scratchPad) value can be set and read', () => {
  const engine = createGrantEngine();

  engine.setInstanceValue('scratchPad', 'budgetNotes', 'Test note');

  assert.equal(engine.instanceData?.scratchPad?.budgetNotes, 'Test note');
});

test('writable instance set increments instanceVersion', () => {
  const engine = createGrantEngine();
  const before = engine.instanceVersion.value;

  engine.setInstanceValue('scratchPad', 'budgetNotes', 'Updated');

  assert.ok(engine.instanceVersion.value > before);
});

test('writable instance initial data is loaded from definition', () => {
  const engine = createGrantEngine();
  const data = engine.instanceData?.scratchPad;

  assert.ok(data);
  assert.equal(data.lastSavedTotal, 0);
  assert.equal(data.budgetNotes, '');
});

test('writable instance allows setting nested path', () => {
  const engine = createGrantEngine();

  engine.setInstanceValue('scratchPad', 'budgetNotes', 'First note');
  assert.equal(engine.instanceData?.scratchPad?.budgetNotes, 'First note');

  engine.setInstanceValue('scratchPad', 'budgetNotes', 'Updated note');
  assert.equal(engine.instanceData?.scratchPad?.budgetNotes, 'Updated note');
});

test('readonly instance (agencyData) rejects writes', () => {
  const engine = createGrantEngine();

  assert.throws(
    () => engine.setInstanceValue('agencyData', 'maxAward', 999999),
    /readonly/
  );
});

test('readonly instance data is not modified after rejected write', () => {
  const engine = createGrantEngine();

  try {
    engine.setInstanceValue('agencyData', 'maxAward', 999999);
  } catch {
    // expected
  }

  assert.equal(engine.instanceData?.agencyData?.maxAward, 500000);
});

test('writable instance rejects values that violate schema types', () => {
  const engine = createGrantEngine();

  assert.throws(
    () => engine.setInstanceValue('scratchPad', 'lastSavedTotal', 'not-a-number'),
    /schema mismatch/
  );
});

test('source instance (priorYearData) loads fallback data when fetch fails', () => {
  const engine = createGrantEngine();
  const data = engine.instanceData?.priorYearData;

  assert.ok(data);
  assert.equal(data.priorAwardAmount, 250000);
  assert.equal(data.performanceRating, 'satisfactory');
});

test('source instance with static: true is marked in definition', () => {
  const engine = createGrantEngine();
  assert.equal(engine.definition.instances.priorYearData.static, true);
});

test('calculate bind writes grand total to scratchPad.lastSavedTotal', () => {
  const engine = createGrantEngine();

  addRepeatInstance(engine, 'budget.lineItems');
  engine.setValue('budget.lineItems[0].unitCost', 100);
  engine.setValue('budget.lineItems[0].quantity', 5);

  assert.equal(engine.instanceData?.scratchPad?.lastSavedTotal, 500);
});

test('FEL instance() function reads from writable instance', () => {
  const engine = createGrantEngine();

  engine.setInstanceValue('scratchPad', 'budgetNotes', 'FEL-test-value');
  const fn = engine.compileExpression("instance('scratchPad', 'budgetNotes')");

  assert.equal(fn(), 'FEL-test-value');
});

test('writing to unknown instance throws error', () => {
  const engine = createGrantEngine();

  assert.throws(
    () => engine.setInstanceValue('nonexistent', 'foo', 'bar'),
    /Unknown instance/
  );
});

test('source instance uses static cache and fallback data', () => {
  FormEngine.instanceSourceCache.clear();

  const def = {
    $formspec: '1.0',
    url: 'https://test.example/form',
    version: '1.0.0',
    status: 'active',
    title: 'Test',
    name: 'test',
    instances: {
      cached: {
        source: 'https://api.example.gov/static-data',
        static: true,
        data: { value: 'fallback' },
      },
    },
    items: [],
    binds: [],
  };

  const engine = new FormEngine(def);

  assert.equal(engine.getInstanceData('cached', 'value'), 'fallback');
});

test('calculate bind targeting readonly instance throws at init', () => {
  const def = {
    $formspec: '1.0',
    url: 'https://test.example/form',
    version: '1.0.0',
    status: 'active',
    title: 'Test',
    name: 'test',
    instances: {
      readonlyInst: {
        readonly: true,
        data: { x: 1 },
      },
    },
    items: [
      { type: 'field', key: 'f1', dataType: 'integer' },
    ],
    binds: [
      { path: 'instances.readonlyInst.x', calculate: '$f1' },
    ],
  };

  assert.throws(() => new FormEngine(def), /readonly/);
});

test('writable instance calculate bind updates on field change', async () => {
  const def = {
    $formspec: '1.0',
    url: 'https://test.example/form',
    version: '1.0.0',
    status: 'active',
    title: 'Test',
    name: 'test',
    instances: {
      pad: {
        readonly: false,
        data: { total: 0 },
        schema: { total: 'decimal' },
      },
    },
    items: [
      { type: 'field', key: 'amount', dataType: 'decimal' },
    ],
    binds: [
      { path: 'instances.pad.total', calculate: '$amount * 2' },
    ],
  };

  const engine = new FormEngine(def);
  engine.setValue('amount', 25);

  await new Promise(resolve => setTimeout(resolve, 50));

  assert.equal(engine.getInstanceData('pad', 'total'), 50);
});
