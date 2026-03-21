/** @filedesc Baseline repeat lifecycle tests for the batch engine rewrite. */
import test from 'node:test';
import assert from 'node:assert/strict';

import { FormEngine } from '../dist/index.js';

function createRepeatEngine() {
  return new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/batch-repeat',
    version: '1.0.0',
    title: 'Batch Repeat',
    items: [
      {
        key: 'rows',
        type: 'group',
        label: 'Rows',
        repeatable: true,
        minRepeat: 1,
        children: [
          { key: 'qty', type: 'field', dataType: 'integer', label: 'Qty' },
          { key: 'price', type: 'field', dataType: 'decimal', label: 'Price' },
          { key: 'total', type: 'field', dataType: 'decimal', label: 'Total' },
        ],
      },
    ],
    binds: [
      { path: 'rows.total', calculate: '$qty * $price' },
    ],
  });
}

test('addRepeatInstance creates row signals and calculates per-instance totals', () => {
  const engine = createRepeatEngine();

  const newIndex = engine.addRepeatInstance('rows');
  assert.equal(newIndex, 1);
  assert.equal(engine.repeats.rows.value, 2);

  engine.setValue('rows[0].qty', 2);
  engine.setValue('rows[0].price', 5);
  engine.setValue('rows[1].qty', 3);
  engine.setValue('rows[1].price', 7);

  assert.equal(engine.signals['rows[0].total'].value, 10);
  assert.equal(engine.signals['rows[1].total'].value, 21);
});

test('removeRepeatInstance compacts rows and preserves shifted calculated state', () => {
  const engine = createRepeatEngine();

  engine.addRepeatInstance('rows');
  engine.addRepeatInstance('rows');

  engine.setValue('rows[0].qty', 1);
  engine.setValue('rows[0].price', 10);
  engine.setValue('rows[1].qty', 2);
  engine.setValue('rows[1].price', 20);
  engine.setValue('rows[2].qty', 3);
  engine.setValue('rows[2].price', 30);

  const versionBefore = engine.structureVersion.value;
  engine.removeRepeatInstance('rows', 1);

  assert.equal(engine.repeats.rows.value, 2);
  assert.equal(engine.structureVersion.value, versionBefore + 1);
  assert.equal(engine.signals['rows[0].qty'].value, 1);
  assert.equal(engine.signals['rows[0].total'].value, 10);
  assert.equal(engine.signals['rows[1].qty'].value, 3);
  assert.equal(engine.signals['rows[1].price'].value, 30);
  assert.equal(engine.signals['rows[1].total'].value, 90);
  assert.equal(engine.signals['rows[2].qty'], undefined);
  assert.equal(engine.signals['rows[2].total'], undefined);
});
