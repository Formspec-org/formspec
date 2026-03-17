import test from 'node:test';
import assert from 'node:assert/strict';
import { FormEngine } from '../dist/index.js';

test('display item with calculate bind produces a computed signal', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/test',
    version: '1.0.0',
    title: 'Display Calculate',
    items: [
      { key: 'qty', type: 'field', dataType: 'integer', label: 'Quantity' },
      { key: 'summary', type: 'display', label: 'Summary' },
    ],
    binds: [
      { path: 'summary', calculate: "format('Count: %s', $qty)" },
    ],
  });

  engine.setValue('qty', 5);
  assert.equal(engine.signals.summary.value, 'Count: 5');
});

test('display signal is excluded from getResponse', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/test',
    version: '1.0.0',
    title: 'Display Calculate',
    items: [
      { key: 'qty', type: 'field', dataType: 'integer', label: 'Quantity' },
      { key: 'summary', type: 'display', label: 'Summary' },
    ],
    binds: [
      { path: 'summary', calculate: "format('Count: %s', $qty)" },
    ],
  });

  engine.setValue('qty', 5);
  const response = engine.getResponse();

  assert.equal(response.data.qty, 5);
  assert.equal(response.data.summary, undefined, 'display item should not appear in response data');
});

test('display item without calculate bind has no signal (unchanged behavior)', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/test',
    version: '1.0.0',
    title: 'Static Display',
    items: [
      { key: 'heading1', type: 'display', label: 'Just a heading' },
    ],
  });

  assert.equal(engine.signals.heading1, undefined, 'static display item should have no signal');
});

test('display calculate in repeat group computes per-instance', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/test',
    version: '1.0.0',
    title: 'Display Repeat',
    items: [
      {
        key: 'items',
        type: 'group',
        label: 'Items',
        repeatable: true,
        minRepeat: 2,
        children: [
          { key: 'price', type: 'field', dataType: 'decimal', label: 'Price' },
          { key: 'label', type: 'display', label: 'Price Label' },
        ],
      },
    ],
    binds: [
      { path: 'items.label', calculate: "format('$%s', $price)" },
    ],
  });

  engine.setValue('items[0].price', 9.99);
  engine.setValue('items[1].price', 24.50);

  assert.equal(engine.signals['items[0].label'].value, '$9.99');
  assert.equal(engine.signals['items[1].label'].value, '$24.5');

  // Verify display signals are excluded from response
  const response = engine.getResponse();
  assert.equal(response.data.items[0].label, undefined);
  assert.equal(response.data.items[1].label, undefined);
});

test('display calculate updates reactively when dependencies change', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/test',
    version: '1.0.0',
    title: 'Reactive Display',
    items: [
      { key: 'count', type: 'field', dataType: 'integer', label: 'Count' },
      { key: 'summary', type: 'display', label: 'Summary' },
    ],
    binds: [
      { path: 'summary', calculate: "format('Total: %s', $count)" },
    ],
  });

  engine.setValue('count', 10);
  assert.equal(engine.signals.summary.value, 'Total: 10');

  engine.setValue('count', 42);
  assert.equal(engine.signals.summary.value, 'Total: 42');
});

test('display item with both relevancy and calculate bind', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/test',
    version: '1.0.0',
    title: 'Relevant Display',
    items: [
      { key: 'show', type: 'field', dataType: 'boolean', label: 'Show' },
      { key: 'count', type: 'field', dataType: 'integer', label: 'Count' },
      { key: 'info', type: 'display', label: 'Info' },
    ],
    binds: [
      { path: 'info', relevant: '$show = true', calculate: "format('Items: %s', $count)" },
    ],
  });

  engine.setValue('show', false);
  engine.setValue('count', 42);

  // Signal exists and computes even when hidden
  assert.equal(engine.signals.info.value, 'Items: 42');
  // But relevancy is false
  assert.equal(engine.relevantSignals.info.value, false);
});
