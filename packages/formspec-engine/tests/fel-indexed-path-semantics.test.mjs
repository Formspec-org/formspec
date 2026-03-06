import test from 'node:test';
import assert from 'node:assert/strict';
import { FormEngine } from '../dist/index.js';

function makeIndexedEngine() {
  return new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/indexed-paths',
    version: '1.0.0',
    title: 'Indexed Paths',
    items: [
      {
        key: 'rows',
        type: 'group',
        label: 'Rows',
        repeatable: true,
        minRepeat: 2,
        children: [
          { key: 'amount', type: 'field', dataType: 'integer', label: 'Amount' },
          { key: 'note', type: 'field', dataType: 'string', label: 'Note' },
          { key: 'extra', type: 'field', dataType: 'string', label: 'Extra' }
        ]
      },
      { key: 'summary', type: 'field', dataType: 'integer', label: 'Summary' },
      { key: 'status', type: 'field', dataType: 'string', label: 'Status' }
    ],
    binds: [
      { path: 'rows[*].amount', required: true },
      { path: 'rows[*].extra', relevant: "note = 'show'" }
    ]
  });
}

test('explicit FEL repeat indices are 1-based for field references', () => {
  const engine = makeIndexedEngine();

  engine.setValue('rows[0].amount', 10);
  engine.setValue('rows[1].amount', 20);

  assert.equal(engine.compileExpression('$rows[1].amount', 'summary')(), 10);
  assert.equal(engine.compileExpression('$rows[2].amount', 'summary')(), 20);
});

test('explicit FEL repeat indices are 1-based for MIP queries', () => {
  const engine = makeIndexedEngine();

  engine.setValue('rows[0].amount', 10);
  engine.setValue('rows[0].note', 'hide');
  engine.setValue('rows[1].note', 'show');

  assert.equal(engine.compileExpression('valid($rows[1].amount)', 'status')(), true);
  assert.equal(engine.compileExpression('valid($rows[2].amount)', 'status')(), false);
  assert.equal(engine.compileExpression('relevant($rows[1].extra)', 'status')(), false);
  assert.equal(engine.compileExpression('relevant($rows[2].extra)', 'status')(), true);
});
