/** @filedesc Response contract and pruning: getResponse() omits non-relevant fields and meets the response shape contract */
import test from 'node:test';
import assert from 'node:assert/strict';
import { FormEngine } from '../dist/index.js';

test('should prune non-relevant leaf fields when calling getResponse()', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/test',
    version: '1.0.0',
    title: 'Leaf Pruning',
    items: [
      { key: 'show', type: 'field', dataType: 'boolean', label: 'Show' },
      { key: 'hiddenField', type: 'field', dataType: 'string', label: 'Hidden', initialValue: 'Secret' }
    ],
    binds: [{ path: 'hiddenField', relevant: 'show == true' }]
  });

  let response = engine.getResponse();
  assert.equal(response.data.hiddenField, undefined);

  engine.setValue('show', true);
  response = engine.getResponse();
  assert.equal(response.data.hiddenField, 'Secret');

  engine.setValue('show', false);
  response = engine.getResponse();
  assert.equal(response.data.hiddenField, undefined);
});

test('should deep-prune hidden groups from response data when parent visibility turns false', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/test-deep-prune',
    version: '1.0.0',
    title: 'Deep Pruning',
    items: [
      { type: 'field', dataType: 'boolean', key: 'showParent', label: 'Show Parent' },
      {
        type: 'group',
        key: 'parent',
        label: 'Parent',
        visible: 'showParent == true',
        children: [{ type: 'field', dataType: 'string', key: 'child', label: 'Child' }]
      }
    ]
  });

  engine.setValue('showParent', true);
  engine.setValue('parent.child', 'Hello');
  engine.setValue('showParent', false);

  const response = engine.getResponse();
  assert.equal(response.data.parent, undefined);
});

test('should emit required top-level response fields when generating responses', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/forms/shopping-cart',
    version: '1.0.0',
    title: 'Shopping Cart',
    items: [
      { type: 'field', dataType: 'decimal', key: 'price', label: 'Price' },
      { type: 'field', dataType: 'decimal', key: 'quantity', label: 'Quantity' }
    ]
  });

  const response = engine.getResponse();

  assert.ok(Object.hasOwn(response, 'definitionUrl'));
  assert.ok(Object.hasOwn(response, 'definitionVersion'));
  assert.ok(Object.hasOwn(response, 'status'));
  assert.ok(Object.hasOwn(response, 'data'));
  assert.ok(Object.hasOwn(response, 'authored'));
  assert.ok(Object.hasOwn(response, 'validationResults'));
  assert.equal(typeof response.definitionUrl, 'string');
  assert.equal(typeof response.authored, 'string');
  assert.notEqual(new Date(response.authored).toString(), 'Invalid Date');
});
