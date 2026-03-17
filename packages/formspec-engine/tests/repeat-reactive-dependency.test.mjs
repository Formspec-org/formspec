/**
 * Repeat Group Reactive Dependency Tracking
 *
 * Verifies that computed fields inside repeat groups reactively update
 * when their sibling field dependencies change. This targets the
 * parentPath construction in compileFEL which resolves relative
 * field references for signal subscription.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { effect } from '@preact/signals-core';
import { FormEngine } from '../dist/index.js';

/**
 * Minimal repeat group definition with a calculated field that depends
 * on a sibling field via relative reference.
 */
function makeDefinition() {
  return {
    $formspec: '1.0',
    url: 'http://example.org/repeat-reactive',
    version: '1.0.0',
    title: 'Repeat Reactive',
    items: [
      {
        key: 'line_items',
        type: 'group',
        label: 'Line Items',
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
      {
        path: 'line_items[*].total',
        calculate: '$qty * $price',
        readonly: 'true',
      },
    ],
  };
}

test('computed field in repeat group reactively updates when sibling dependency changes', () => {
  const engine = new FormEngine(makeDefinition());

  engine.setValue('line_items[0].qty', 2);
  engine.setValue('line_items[0].price', 10);

  const total1 = engine.signals['line_items[0].total'].value;
  assert.equal(total1, 20, 'initial total should be 2 * 10 = 20');

  engine.setValue('line_items[0].qty', 5);

  const total2 = engine.signals['line_items[0].total'].value;
  assert.equal(total2, 50, 'total should reactively update to 5 * 10 = 50');
});

test('computed field reactively updates across multiple repeat instances', () => {
  const engine = new FormEngine(makeDefinition());

  engine.setValue('line_items[0].qty', 3);
  engine.setValue('line_items[0].price', 7);

  engine.addRepeatInstance('line_items');
  engine.setValue('line_items[1].qty', 4);
  engine.setValue('line_items[1].price', 8);

  assert.equal(engine.signals['line_items[0].total'].value, 21);
  assert.equal(engine.signals['line_items[1].total'].value, 32);

  engine.setValue('line_items[1].price', 10);

  assert.equal(engine.signals['line_items[0].total'].value, 21, 'instance 0 total unchanged');
  assert.equal(engine.signals['line_items[1].total'].value, 40, 'instance 1 total reactively updated');
});

test('nested repeat group computed field reactively tracks sibling dependency', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/nested-reactive',
    version: '1.0.0',
    title: 'Nested Reactive',
    items: [
      {
        key: 'orders',
        type: 'group',
        label: 'Orders',
        repeatable: true,
        minRepeat: 1,
        children: [
          {
            key: 'items',
            type: 'group',
            label: 'Items',
            repeatable: true,
            minRepeat: 1,
            children: [
              { key: 'qty', type: 'field', dataType: 'integer', label: 'Qty' },
              { key: 'unit_price', type: 'field', dataType: 'decimal', label: 'Unit Price' },
              { key: 'line_total', type: 'field', dataType: 'decimal', label: 'Line Total' },
            ],
          },
        ],
      },
    ],
    binds: [
      {
        path: 'orders[*].items[*].line_total',
        calculate: '$qty * $unit_price',
        readonly: 'true',
      },
    ],
  });

  engine.setValue('orders[0].items[0].qty', 2);
  engine.setValue('orders[0].items[0].unit_price', 15);

  const lt1 = engine.signals['orders[0].items[0].line_total'].value;
  assert.equal(lt1, 30, 'initial nested line_total = 2 * 15 = 30');

  engine.setValue('orders[0].items[0].qty', 6);

  const lt2 = engine.signals['orders[0].items[0].line_total'].value;
  assert.equal(lt2, 90, 'nested line_total should reactively update to 6 * 15 = 90');
});

/**
 * Tests that effect-based observation (like a UI render loop) picks up
 * reactive changes to computed fields inside repeat groups.
 *
 * This is stronger than polling .value — it proves the signal graph
 * actually fires notifications to subscribers.
 */
test('effect observing repeat group computed field fires on sibling dependency change', () => {
  const engine = new FormEngine(makeDefinition());

  engine.setValue('line_items[0].qty', 2);
  engine.setValue('line_items[0].price', 10);

  const observed = [];
  const dispose = effect(() => {
    observed.push(engine.signals['line_items[0].total'].value);
  });

  // After effect setup, should have captured the initial value
  assert.equal(observed.length, 1);
  assert.equal(observed[0], 20);

  // Change dependency
  engine.setValue('line_items[0].qty', 7);

  // Effect should have fired with new value
  assert.equal(observed.length, 2);
  assert.equal(observed[1], 70, 'effect fires with updated total = 7 * 10');

  // Another change
  engine.setValue('line_items[0].price', 3);
  assert.equal(observed.length, 3);
  assert.equal(observed[2], 21, 'effect fires with updated total = 7 * 3');

  dispose();
});

/**
 * Verify the dependency graph stored in engine.dependencies has correct
 * entries for repeat group binds. This tests that the static dependency
 * map (used for analysis, not reactivity) is correctly built even when
 * the dynamic parentPath is wrong.
 */
test('engine.dependencies records correct dependency paths for repeat group binds', () => {
  const engine = new FormEngine(makeDefinition());

  // The bind path "line_items[*].total" gets base key "line_items.total"
  const deps = engine.dependencies['line_items.total'];
  assert.ok(deps, 'dependency entry should exist for line_items.total');
  // Should reference line_items.qty and line_items.price (base paths without indices)
  assert.ok(deps.includes('line_items.qty'), `deps should include line_items.qty, got: ${JSON.stringify(deps)}`);
  assert.ok(deps.includes('line_items.price'), `deps should include line_items.price, got: ${JSON.stringify(deps)}`);
});

test('engine.dependencies records correct paths for nested repeat group binds', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/nested-deps',
    version: '1.0.0',
    title: 'Nested Deps',
    items: [
      {
        key: 'orders',
        type: 'group',
        label: 'Orders',
        repeatable: true,
        minRepeat: 1,
        children: [
          {
            key: 'items',
            type: 'group',
            label: 'Items',
            repeatable: true,
            minRepeat: 1,
            children: [
              { key: 'qty', type: 'field', dataType: 'integer', label: 'Qty' },
              { key: 'unit_price', type: 'field', dataType: 'decimal', label: 'Unit Price' },
              { key: 'line_total', type: 'field', dataType: 'decimal', label: 'Line Total' },
            ],
          },
        ],
      },
    ],
    binds: [
      {
        path: 'orders[*].items[*].line_total',
        calculate: '$qty * $unit_price',
        readonly: 'true',
      },
    ],
  });

  const deps = engine.dependencies['orders.items.line_total'];
  assert.ok(deps, 'dependency entry should exist for orders.items.line_total');
  assert.ok(
    deps.includes('orders.items.qty'),
    `deps should include orders.items.qty, got: ${JSON.stringify(deps)}`
  );
  assert.ok(
    deps.includes('orders.items.unit_price'),
    `deps should include orders.items.unit_price, got: ${JSON.stringify(deps)}`
  );
});

test('cycle detection works through repeat group dependencies', () => {
  // A -> B -> A cycle within a repeat group should be detected
  assert.throws(
    () => new FormEngine({
      $formspec: '1.0',
      url: 'http://example.org/cycle',
      version: '1.0.0',
      title: 'Cycle',
      items: [
        {
          key: 'rows',
          type: 'group',
          label: 'Rows',
          repeatable: true,
          minRepeat: 1,
          children: [
            { key: 'a', type: 'field', dataType: 'decimal', label: 'A' },
            { key: 'b', type: 'field', dataType: 'decimal', label: 'B' },
          ],
        },
      ],
      binds: [
        { path: 'rows[*].a', calculate: '$b + 1' },
        { path: 'rows[*].b', calculate: '$a + 1' },
      ],
    }),
    /[Cc]yclic dependency/,
    'should detect cycle between repeat group fields'
  );
});
