/** @filedesc Repeat lifecycle and response metadata: add/remove instances, signal cleanup, and repeat metadata in response */
import test from 'node:test';
import assert from 'node:assert/strict';
import { FormEngine } from '../dist/index.js';

test('should shift and clean up repeat signals when removing an instance', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/repeats',
    version: '1.0.0',
    title: 'Repeats',
    items: [
      {
        key: 'items',
        type: 'group',
        label: 'Items',
        repeatable: true,
        minRepeat: 3,
        children: [{ key: 'name', type: 'field', dataType: 'string', label: 'Name' }]
      }
    ]
  });

  engine.setValue('items[0].name', 'A');
  engine.setValue('items[1].name', 'B');
  engine.setValue('items[2].name', 'C');

  const versionBefore = engine.structureVersion.value;
  engine.removeRepeatInstance('items', 1);

  assert.equal(engine.repeats.items.value, 2);
  assert.equal(engine.signals['items[0].name'].value, 'A');
  assert.equal(engine.signals['items[1].name'].value, 'C');
  assert.equal(engine.signals['items[2].name'], undefined);
  assert.equal(engine.structureVersion.value, versionBefore + 1);
});

test('should ignore out-of-range repeat removals without mutating structure', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/repeats-bounds',
    version: '1.0.0',
    title: 'Repeats Bounds',
    items: [
      {
        key: 'items',
        type: 'group',
        label: 'Items',
        repeatable: true,
        minRepeat: 2,
        children: [{ key: 'name', type: 'field', dataType: 'string', label: 'Name' }]
      }
    ]
  });

  const versionBefore = engine.structureVersion.value;
  const countBefore = engine.repeats.items.value;

  engine.removeRepeatInstance('items', -1);
  engine.removeRepeatInstance('items', 99);
  engine.removeRepeatInstance('missing', 0);

  assert.equal(engine.repeats.items.value, countBefore);
  assert.equal(engine.structureVersion.value, versionBefore);
});

test('should include response metadata and apply definition-level nonRelevantBehavior', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/response',
    version: '1.0.0',
    title: 'Response Metadata',
    nonRelevantBehavior: 'empty',
    items: [
      { key: 'show', type: 'field', dataType: 'boolean', label: 'Show', initialValue: false },
      { key: 'hiddenByDefault', type: 'field', dataType: 'string', label: 'Hidden', initialValue: 'secret' },
      { key: 'explicitKeep', type: 'field', dataType: 'string', label: 'Keep', initialValue: 'keep-me' }
    ],
    binds: [
      { path: 'hiddenByDefault', relevant: 'show == true' },
      { path: 'explicitKeep', relevant: 'show == true', nonRelevantBehavior: 'keep' }
    ]
  });

  const response = engine.getResponse({
    id: 'resp-123',
    author: { id: 'user-1', name: 'User One' },
    subject: { id: 'subject-1', type: 'patient' }
  });

  assert.equal(response.id, 'resp-123');
  assert.deepEqual(response.author, { id: 'user-1', name: 'User One' });
  assert.deepEqual(response.subject, { id: 'subject-1', type: 'patient' });
  assert.equal(response.data.hiddenByDefault, null);
  assert.equal(response.data.explicitKeep, 'keep-me');
});

test('should compact nested repeat subtree state when removing a parent repeat instance', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/nested-remove',
    version: '1.0.0',
    title: 'Nested Remove',
    items: [
      {
        key: 'rows',
        type: 'group',
        label: 'Rows',
        repeatable: true,
        minRepeat: 2,
        children: [
          {
            key: 'sub',
            type: 'group',
            label: 'Sub',
            repeatable: true,
            minRepeat: 1,
            children: [{ key: 'val', type: 'field', dataType: 'string', label: 'Val' }]
          }
        ]
      }
    ]
  });

  engine.setValue('rows[0].sub[0].val', 'A');
  engine.setValue('rows[1].sub[0].val', 'B');

  engine.removeRepeatInstance('rows', 0);

  assert.equal(engine.repeats.rows.value, 1);
  assert.equal(engine.repeats['rows[0].sub'].value, 1);
  assert.equal(engine.repeats['rows[1].sub'], undefined);
  assert.equal(engine.signals['rows[0].sub[0].val'].value, 'B');
  assert.equal(engine.signals['rows[1].sub[0].val'], undefined);
});

test('should shift remaining row values when removeRepeatInstance deletes a middle row', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/test',
    version: '1.0.0',
    title: 'Remove Instance Test',
    items: [
      {
        key: 'items',
        type: 'group',
        label: 'Items',
        repeatable: true,
        minRepeat: 3,
        children: [
          { key: 'name', type: 'field', dataType: 'string', label: 'Name' }
        ]
      }
    ]
  });

  engine.setValue('items[0].name', 'A');
  engine.setValue('items[1].name', 'B');
  engine.setValue('items[2].name', 'C');

  const before = {
    count: engine.repeats.items.value,
    v0: engine.signals['items[0].name'].value,
    v1: engine.signals['items[1].name'].value,
    v2: engine.signals['items[2].name'].value
  };

  engine.removeRepeatInstance('items', 1);

  const after = {
    count: engine.repeats.items.value,
    v0: engine.signals['items[0].name'].value,
    v1: engine.signals['items[1].name'].value
  };

  assert.equal(before.count, 3);
  assert.equal(before.v0, 'A');
  assert.equal(before.v1, 'B');
  assert.equal(before.v2, 'C');
  assert.equal(after.count, 2);
  assert.equal(after.v0, 'A');
  assert.equal(after.v1, 'C');
});
