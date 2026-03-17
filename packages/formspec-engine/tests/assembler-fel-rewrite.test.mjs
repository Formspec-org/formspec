/** @filedesc rewriteFEL: path and root-segment substitution rules for imported fragment key remapping */
import test from 'node:test';
import assert from 'node:assert/strict';
import { rewriteFEL } from '../dist/index.js';

const commonMap = {
  fragmentRootKey: 'budget',
  hostGroupKey: 'projectBudget',
  importedKeys: new Set(['budget', 'amount']),
  keyPrefix: 'proj_'
};

test('1.1 — Single-segment path', () => {
  const result = rewriteFEL('$amount', commonMap);
  assert.equal(result, '$proj_amount');
});

test('1.2 — Dotted path with fragment root replacement', () => {
  const result = rewriteFEL('$budget.amount', commonMap);
  assert.equal(result, '$projectBudget.proj_amount');
});

test('1.3 — Deep path with wildcards', () => {
  const map = {
    fragmentRootKey: 'budget',
    hostGroupKey: 'projectBudget',
    importedKeys: new Set(['budget', 'lineItems', 'amount']),
    keyPrefix: 'proj_'
  };
  const result = rewriteFEL('$budget.lineItems[*].amount', map);
  assert.equal(result, '$projectBudget.proj_lineItems[*].proj_amount');
});

test('1.4 — Bare $ (current-node) is untouched', () => {
  const result = rewriteFEL('$ >= 0 and $ <= 100', commonMap);
  assert.equal(result, '$ >= 0 and $ <= 100');
});

test('1.5 — Path not in imported keys is untouched', () => {
  const result = rewriteFEL('$externalField + $budget.amount', commonMap);
  assert.equal(result, '$externalField + $projectBudget.proj_amount');
});

test('1.6 — Multiple references in one expression', () => {
  const map = {
    fragmentRootKey: 'budget',
    hostGroupKey: 'projectBudget',
    importedKeys: new Set(['budget', 'totalDirect', 'indirectRate']),
    keyPrefix: 'proj_'
  };
  const result = rewriteFEL('$budget.totalDirect * ($budget.indirectRate / 100)', map);
  assert.equal(result, '$projectBudget.proj_totalDirect * ($projectBudget.proj_indirectRate / 100)');
});

test('1.7 — Context variables', () => {
  const map = {
    fragmentRootKey: 'budget',
    hostGroupKey: 'projectBudget',
    importedKeys: new Set(['budget', 'amount']),
    keyPrefix: 'proj_'
  };
  const result = rewriteFEL('@index > 0 and @count < 10 and @current.amount > 0', map);
  assert.equal(result, '@index > 0 and @count < 10 and @current.proj_amount > 0');
});

test('1.8 — @instance is untouched', () => {
  const result = rewriteFEL("@instance('priorYear').totalExpenditure", commonMap);
  assert.equal(result, "@instance('priorYear').totalExpenditure");
});

test('1.10 — Indexed repeat references', () => {
  const map = {
    fragmentRootKey: 'budget',
    hostGroupKey: 'projectBudget',
    importedKeys: new Set(['budget', 'lineItems', 'amount']),
    keyPrefix: 'proj_'
  };
  const result = rewriteFEL('$budget.lineItems[1].amount', map);
  assert.equal(result, '$projectBudget.proj_lineItems[1].proj_amount');
});

test('1.11 — Expressions with no rewritable references', () => {
  assert.equal(rewriteFEL('true', commonMap), 'true');
  assert.equal(rewriteFEL('42', commonMap), '42');
  assert.equal(rewriteFEL("'hello'", commonMap), "'hello'");
});

test('1.12 — prev/next/parent string arguments are prefixed', () => {
  const runningTotalMap = {
    fragmentRootKey: 'budget',
    hostGroupKey: 'projectBudget',
    importedKeys: new Set(['budget', 'runningTotal']),
    keyPrefix: 'proj_'
  };
  assert.equal(rewriteFEL("prev('runningTotal')", runningTotalMap), "prev('proj_runningTotal')");

  const amountMap = {
    fragmentRootKey: 'budget',
    hostGroupKey: 'projectBudget',
    importedKeys: new Set(['budget', 'amount']),
    keyPrefix: 'proj_'
  };
  assert.equal(rewriteFEL("next('amount') + prev('amount')", amountMap), "next('proj_amount') + prev('proj_amount')");

  const projectNameMap = {
    fragmentRootKey: 'budget',
    hostGroupKey: 'projectBudget',
    importedKeys: new Set(['budget', 'projectName']),
    keyPrefix: 'proj_'
  };
  assert.equal(rewriteFEL("parent('projectName')", projectNameMap), "parent('proj_projectName')");
});

test('1.13 — prev/next/parent with non-imported field name are untouched', () => {
  const result = rewriteFEL("prev('externalField')", commonMap);
  assert.equal(result, "prev('externalField')");
});
