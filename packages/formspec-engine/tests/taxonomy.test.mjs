/** @filedesc Tests for data type taxonomy predicates per Core spec S4.2.3. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isNumericType, isDateType, isChoiceType, isTextType, isBinaryType, isBooleanType,
  isMoneyType, isUriType,
} from '../dist/index.js';

// ── Spec-correct data types (Core spec §4.2.3) ──────────────────

test('isNumericType — integer and decimal only (money is an object type)', () => {
  assert.equal(isNumericType('integer'), true);
  assert.equal(isNumericType('decimal'), true);
  assert.equal(isNumericType('money'), false, 'money is not numeric — it is an object {amount,currency}');
  assert.equal(isNumericType('string'), false);
  assert.equal(isNumericType('date'), false);
});

test('isDateType', () => {
  assert.equal(isDateType('date'), true);
  assert.equal(isDateType('time'), true);
  assert.equal(isDateType('dateTime'), true);
  assert.equal(isDateType('string'), false);
});

test('isChoiceType — choice and multiChoice (not select/selectMany)', () => {
  assert.equal(isChoiceType('choice'), true, 'spec uses "choice", not "select"');
  assert.equal(isChoiceType('multiChoice'), true, 'spec uses "multiChoice", not "selectMany"');
  assert.equal(isChoiceType('select'), false, '"select" is not a spec data type');
  assert.equal(isChoiceType('selectMany'), false, '"selectMany" is not a spec data type');
  assert.equal(isChoiceType('string'), false);
});

test('isTextType', () => {
  assert.equal(isTextType('string'), true);
  assert.equal(isTextType('text'), true);
  assert.equal(isTextType('integer'), false);
});

test('isBinaryType — attachment only (not file/image/signature/barcode)', () => {
  assert.equal(isBinaryType('attachment'), true, 'spec binary type is "attachment"');
  assert.equal(isBinaryType('file'), false, '"file" is not a spec data type');
  assert.equal(isBinaryType('image'), false, '"image" is not a spec data type');
  assert.equal(isBinaryType('signature'), false, '"signature" is not a spec data type');
  assert.equal(isBinaryType('barcode'), false, '"barcode" is not a spec data type');
  assert.equal(isBinaryType('string'), false);
});

test('isBooleanType', () => {
  assert.equal(isBooleanType('boolean'), true);
  assert.equal(isBooleanType('string'), false);
});

test('isMoneyType — money is its own category (object: {amount, currency})', () => {
  assert.equal(isMoneyType('money'), true);
  assert.equal(isMoneyType('decimal'), false);
  assert.equal(isMoneyType('string'), false);
});

test('isUriType — uri is its own category', () => {
  assert.equal(isUriType('uri'), true);
  assert.equal(isUriType('string'), false);
  assert.equal(isUriType('url'), false, '"url" is not a spec data type');
});

test('every canonical spec data type matches exactly one predicate', () => {
  // The 13 canonical data types per Core spec §4.2.3
  const allTypes = [
    'string', 'text',
    'integer', 'decimal',
    'boolean',
    'date', 'time', 'dateTime',
    'choice', 'multiChoice',
    'uri',
    'attachment',
    'money',
  ];
  const predicates = [
    isNumericType, isDateType, isChoiceType, isTextType,
    isBinaryType, isBooleanType, isMoneyType, isUriType,
  ];
  for (const t of allTypes) {
    const matchCount = predicates.filter(p => p(t)).length;
    assert.equal(matchCount, 1, `type "${t}" should match exactly one predicate`);
  }
});

test('non-spec type names match no predicate', () => {
  const nonSpecTypes = ['select', 'selectMany', 'file', 'image', 'signature', 'barcode', 'url', 'number'];
  const predicates = [
    isNumericType, isDateType, isChoiceType, isTextType,
    isBinaryType, isBooleanType, isMoneyType, isUriType,
  ];
  for (const t of nonSpecTypes) {
    const matchCount = predicates.filter(p => p(t)).length;
    assert.equal(matchCount, 0, `non-spec type "${t}" should match no predicate`);
  }
});
