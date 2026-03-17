/** @filedesc FEL repeat navigation semantics: aggregate functions and sibling-index traversal inside repeat groups */
import test from 'node:test';
import assert from 'node:assert/strict';
import { FormEngine } from '../dist/index.js';

function makeRepeatEngine() {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/fel-repeat-nav',
    version: '1.0.0',
    title: 'FEL Repeat Navigation',
    items: [{
      key: 'rows',
      type: 'group',
      label: 'Rows',
      repeatable: true,
      minRepeat: 3,
      children: [
        { key: 'amount', type: 'field', dataType: 'integer', label: 'Amount' }
      ]
    }]
  });

  engine.setValue('rows[0].amount', 10);
  engine.setValue('rows[1].amount', 20);
  engine.setValue('rows[2].amount', 30);
  return engine;
}

function makeNestedRepeatEngine() {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/fel-repeat-parent',
    version: '1.0.0',
    title: 'FEL Repeat Parent',
    items: [{
      key: 'invoice',
      type: 'group',
      label: 'Invoice',
      children: [
        { key: 'total', type: 'field', dataType: 'integer', label: 'Total' },
        {
          key: 'rows',
          type: 'group',
          label: 'Rows',
          repeatable: true,
          minRepeat: 2,
          children: [
            { key: 'amount', type: 'field', dataType: 'integer', label: 'Amount' }
          ]
        }
      ]
    }]
  });

  engine.setValue('invoice.total', 999);
  engine.setValue('invoice.rows[0].amount', 10);
  engine.setValue('invoice.rows[1].amount', 20);
  return engine;
}

test('@index is one-based inside repeat context', () => {
  const engine = makeRepeatEngine();
  assert.equal(engine.compileExpression('@index', 'rows[0].amount')(), 1);
  assert.equal(engine.compileExpression('@index', 'rows[2].amount')(), 3);
});

test('@count returns repeat size inside repeat context', () => {
  const engine = makeRepeatEngine();
  assert.equal(engine.compileExpression('@count', 'rows[1].amount')(), 3);
});

test('@current returns current repeat row object', () => {
  const engine = makeRepeatEngine();
  assert.equal(engine.compileExpression('@current.amount', 'rows[1].shadow')(), 20);
});

test('prev() and next() navigate sibling repeat rows', () => {
  const engine = makeRepeatEngine();
  assert.equal(engine.compileExpression('prev().amount', 'rows[1].amount')(), 10);
  assert.equal(engine.compileExpression('next().amount', 'rows[1].amount')(), 30);
});

test('repeat navigation returns null at boundaries', () => {
  const engine = makeRepeatEngine();
  assert.equal(engine.compileExpression('prev()', 'rows[0].amount')(), null);
  assert.equal(engine.compileExpression('next()', 'rows[2].amount')(), null);
});

test('repeat context references are null outside repeat scope', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/fel-repeat-nav-outside',
    version: '1.0.0',
    title: 'FEL Repeat Navigation Outside',
    items: [{ key: 'summary', type: 'field', dataType: 'string', label: 'Summary' }]
  });

  assert.equal(engine.compileExpression('@current', 'summary')(), null);
  assert.equal(engine.compileExpression('@index', 'summary')(), null);
  assert.equal(engine.compileExpression('@count', 'summary')(), null);
  assert.equal(engine.compileExpression('prev()', 'summary')(), null);
  assert.equal(engine.compileExpression('next()', 'summary')(), null);
});

test('parent() returns parent row/group object for postfix access', () => {
  const engine = makeNestedRepeatEngine();
  assert.equal(engine.compileExpression('parent().total', 'invoice.rows[0].amount')(), 999);
});

test('countWhere predicate rebinds bare $ instead of leaking current repeat row', () => {
  const engine = makeRepeatEngine();
  assert.equal(engine.compileExpression('countWhere([10, 20, 30], $ > 15)', 'rows[0].amount')(), 2);
});
