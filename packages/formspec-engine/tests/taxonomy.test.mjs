/** @filedesc Tests for data type taxonomy predicates. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isNumericType, isDateType, isChoiceType, isTextType, isBinaryType, isBooleanType,
} from '../dist/index.js';

test('isNumericType', () => {
  assert.equal(isNumericType('integer'), true);
  assert.equal(isNumericType('decimal'), true);
  assert.equal(isNumericType('money'), true);
  assert.equal(isNumericType('string'), false);
  assert.equal(isNumericType('date'), false);
});

test('isDateType', () => {
  assert.equal(isDateType('date'), true);
  assert.equal(isDateType('time'), true);
  assert.equal(isDateType('dateTime'), true);
  assert.equal(isDateType('string'), false);
});

test('isChoiceType', () => {
  assert.equal(isChoiceType('select'), true);
  assert.equal(isChoiceType('selectMany'), true);
  assert.equal(isChoiceType('string'), false);
});

test('isTextType', () => {
  assert.equal(isTextType('string'), true);
  assert.equal(isTextType('text'), true);
  assert.equal(isTextType('integer'), false);
});

test('isBinaryType', () => {
  assert.equal(isBinaryType('file'), true);
  assert.equal(isBinaryType('image'), true);
  assert.equal(isBinaryType('signature'), true);
  assert.equal(isBinaryType('barcode'), true);
  assert.equal(isBinaryType('string'), false);
});

test('isBooleanType', () => {
  assert.equal(isBooleanType('boolean'), true);
  assert.equal(isBooleanType('string'), false);
});

test('every canonical type matches exactly one predicate', () => {
  const allTypes = [
    'integer', 'decimal', 'money',
    'date', 'time', 'dateTime',
    'select', 'selectMany',
    'string', 'text',
    'file', 'image', 'signature', 'barcode',
    'boolean',
  ];
  const predicates = [isNumericType, isDateType, isChoiceType, isTextType, isBinaryType, isBooleanType];
  for (const t of allTypes) {
    const matchCount = predicates.filter(p => p(t)).length;
    assert.equal(matchCount, 1, `type "${t}" should match exactly one predicate`);
  }
});
