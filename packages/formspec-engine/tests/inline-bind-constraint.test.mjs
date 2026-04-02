/**
 * Inline Bind Constraints — extractInlineBind
 *
 * Validates that constraint, required, relevant, and constraintMessage
 * work when declared as top-level properties on the item (inline bind)
 * rather than in the top-level `binds` array.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { FormEngine } from '../dist/index.js';

function makeEngine(items, binds) {
  return new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/inline-bind',
    version: '1.0.0',
    title: 'Inline Bind Test',
    items,
    binds: binds ?? [],
  });
}

function fieldErrors(engine, path, kind) {
  return engine.validationResults[path].value.filter(
    r => r.severity === 'error' && (!kind || r.constraintKind === kind)
  );
}

// ── Inline required ──────────────────────────────────────────────────

test('inline required: should produce required error when field is empty', () => {
  const engine = makeEngine([
    { key: 'name', type: 'field', dataType: 'string', label: 'Name', required: true },
  ]);

  const errors = fieldErrors(engine, 'name', 'required');
  assert.equal(errors.length, 1, 'expected one required error');
});

test('inline required: should clear required error when value is set', () => {
  const engine = makeEngine([
    { key: 'name', type: 'field', dataType: 'string', label: 'Name', required: true },
  ]);

  engine.setValue('name', 'Alice');
  const errors = fieldErrors(engine, 'name', 'required');
  assert.equal(errors.length, 0, 'required error should clear after setting value');
});

// ── Inline constraint ────────────────────────────────────────────────

test('inline constraint: should fire when value violates constraint', () => {
  const engine = makeEngine([
    {
      key: 'email',
      type: 'field',
      dataType: 'string',
      label: 'Email',
      constraint: "matches($email, '.*@.*')",
      constraintMessage: 'Must contain @',
    },
  ]);

  engine.setValue('email', 'notanemail');
  const errors = fieldErrors(engine, 'email', 'constraint');
  assert.equal(errors.length, 1, 'expected one constraint error');
  assert.equal(errors[0].message, 'Must contain @');
});

test('inline constraint: should clear when value satisfies constraint', () => {
  const engine = makeEngine([
    {
      key: 'email',
      type: 'field',
      dataType: 'string',
      label: 'Email',
      constraint: "matches($email, '.*@.*')",
      constraintMessage: 'Must contain @',
    },
  ]);

  engine.setValue('email', 'user@example.com');
  const errors = fieldErrors(engine, 'email', 'constraint');
  assert.equal(errors.length, 0, 'constraint should pass for valid email');
});

test('inline constraint: should skip when field value is null (null propagation)', () => {
  const engine = makeEngine([
    {
      key: 'email',
      type: 'field',
      dataType: 'string',
      label: 'Email',
      constraint: "matches($email, '.*@.*')",
    },
  ]);

  // Value defaults to null — constraint should not fire
  const errors = fieldErrors(engine, 'email', 'constraint');
  assert.equal(errors.length, 0, 'constraint must not fire on null value');
});

// ── Inline required + constraint together ────────────────────────────

test('inline required + constraint: both should fire independently', () => {
  const engine = makeEngine([
    {
      key: 'email',
      type: 'field',
      dataType: 'string',
      label: 'Email',
      required: true,
      constraint: "matches($email, '.*@.*')",
      constraintMessage: 'Must contain @',
    },
  ]);

  // Empty: required fires, constraint skipped (null propagation)
  const emptyErrors = fieldErrors(engine, 'email');
  assert.equal(emptyErrors.length, 1, 'only required should fire when empty');
  assert.equal(emptyErrors[0].constraintKind, 'required');

  // Invalid value: required clears, constraint fires
  engine.setValue('email', 'notanemail');
  const invalidErrors = fieldErrors(engine, 'email');
  assert.equal(invalidErrors.length, 1, 'only constraint should fire for invalid value');
  assert.equal(invalidErrors[0].constraintKind, 'constraint');
  assert.equal(invalidErrors[0].message, 'Must contain @');

  // Valid value: both clear
  engine.setValue('email', 'user@example.com');
  const validErrors = fieldErrors(engine, 'email');
  assert.equal(validErrors.length, 0, 'no errors for valid email');
});

// ── Inline relevant ──────────────────────────────────────────────────

test('inline relevant: field should be hidden when condition is false', () => {
  const engine = makeEngine([
    { key: 'toggle', type: 'field', dataType: 'boolean', label: 'Show detail' },
    {
      key: 'detail',
      type: 'field',
      dataType: 'string',
      label: 'Detail',
      relevant: '$toggle = true',
    },
  ]);

  // toggle is null/false by default — detail should be non-relevant
  assert.equal(engine.relevantSignals.detail.value, false, 'detail should be hidden');

  engine.setValue('toggle', true);
  assert.equal(engine.relevantSignals.detail.value, true, 'detail should be visible');
});

// ── Inline matches the storybook definition pattern ──────────────────

// ── Parse error in constraint: must NOT silently pass ─────────────────

test('constraint with FEL parse error should produce a validation error, not silently pass', () => {
  const engine = makeEngine([
    {
      key: 'email',
      type: 'field',
      dataType: 'string',
      label: 'Email',
      // \. is an invalid FEL escape — this expression cannot parse
      constraint: "matches($email, '^test\\.com$')",
      constraintMessage: 'Must match',
    },
  ]);

  engine.setValue('email', 'anything');
  const errors = fieldErrors(engine, 'email');
  // A broken constraint should NOT silently pass — it should produce an error
  assert.ok(errors.length > 0, 'parse error in constraint must produce a validation error, not silently pass');
});

// ── Working constraint pattern ───────────────────────────────────────

test('storybook email constraint pattern: matches() with full regex', () => {
  const engine = makeEngine([
    {
      key: 'email',
      type: 'field',
      dataType: 'string',
      label: 'Email',
      required: true,
      constraint: "matches($email, '^[^@]+@[^@]+[.][^@]+$')",
      constraintMessage: 'Must be a valid email',
    },
  ]);

  // Valid email — should pass
  engine.setValue('email', 'user@example.com');
  const validErrors = fieldErrors(engine, 'email');
  assert.equal(validErrors.length, 0, 'valid email should have no errors');

  // Invalid — no @
  engine.setValue('email', 'notanemail');
  const noAtErrors = fieldErrors(engine, 'email', 'constraint');
  assert.equal(noAtErrors.length, 1, 'missing @ should trigger constraint');
  assert.equal(noAtErrors[0].message, 'Must be a valid email');

  // Invalid — no domain dot
  engine.setValue('email', 'user@example');
  const noDotErrors = fieldErrors(engine, 'email', 'constraint');
  assert.equal(noDotErrors.length, 1, 'missing domain dot should trigger constraint');
});
