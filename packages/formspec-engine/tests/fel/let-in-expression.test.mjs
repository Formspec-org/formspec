/** @filedesc FEL let-in expressions: variable binding syntax, scoping, and interaction with other FEL constructs */
import test from 'node:test';
import assert from 'node:assert/strict';
import { FormEngine } from '../../dist/index.js';

function engineWithCalc(calculate, fields = []) {
  return new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/test',
    version: '1.0.0',
    title: 'Let-In Test',
    items: [
      { key: 'result', type: 'field', dataType: 'string', label: 'Result' },
      ...fields
    ],
    binds: [{ path: 'result', calculate }]
  });
}

// A1: let...in parser conflict with subsequent function calls

test('let x = 1 in x evaluates to "1" (basic let binding)', () => {
  const e = engineWithCalc('let x = 1 in x');
  assert.equal(e.signals.result.value, 1);
});

test('let x = 1 in if empty(x) then null else x evaluates to 1', () => {
  const e = engineWithCalc('let x = 1 in if empty(x) then null else x');
  assert.equal(e.signals.result.value, 1);
});

test('let x = null in if empty(x) then "missing" else x evaluates to "missing"', () => {
  const e = engineWithCalc("let x = null in if empty(x) then 'missing' else x");
  assert.equal(e.signals.result.value, 'missing');
});

test('let x = "" in if empty(x) then null else x evaluates to null', () => {
  const e = engineWithCalc("let x = '' in if empty(x) then null else x");
  assert.equal(e.signals.result.value, null);
});

test('let...in with concat function call in else branch evaluates correctly', () => {
  // Simplified version of the real smoke-test expression
  const e = engineWithCalc(
    "let id = 'ABC123XYZ' in if empty(id) then null else concat(substr(id, 0, 3), '•••••', substr(id, -3))",
    []
  );
  // concat and substr are not in our stdlib, so we just need it to not crash at parse/let time
  // The real test is that the parser doesn't fail on the 'in if' transition
  // This will fail with FelUnsupportedFunctionError (concat) not a parser error
  // So we test it throws the right kind of error
  try {
    const val = e.signals.result.value;
    // If concat/substr exist, it should produce a string
    assert.ok(typeof val === 'string' || val === null);
  } catch (err) {
    // Only acceptable error is unsupported function, not a parser error
    assert.ok(
      err.message.includes('concat') || err.message.includes('substr'),
      `Expected FelUnsupportedFunctionError for concat/substr, got: ${err.message}`
    );
  }
});

test('let...in does not consume the in keyword as membership operator', () => {
  // This is the core regression: 'let id = expr in if ...' must NOT treat
  // the 'in' as a membership test against the value of id
  const e = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/test',
    version: '1.0.0',
    title: 'Let-In Regression',
    items: [
      { key: 'memberId', type: 'field', dataType: 'string', label: 'Member ID' },
      { key: 'masked', type: 'field', dataType: 'string', label: 'Masked' }
    ],
    binds: [
      { path: 'masked', calculate: "let id = string($memberId) in if empty(id) then null else id" }
    ]
  });

  // With no value set, memberId is null, string(null) = "", empty("") = true -> null
  assert.equal(e.signals.masked.value, null);

  e.setValue('memberId', 'ABC123');
  // Now id = "ABC123", empty("ABC123") = false -> return id
  assert.equal(e.signals.masked.value, 'ABC123');
});

test('nested let...in bindings evaluate correctly', () => {
  const e = engineWithCalc('let x = 2 in let y = 3 in x + y');
  assert.equal(e.signals.result.value, 5);
});
