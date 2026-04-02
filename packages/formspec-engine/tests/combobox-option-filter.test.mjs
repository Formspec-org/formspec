/** @filedesc Tests for combobox type-ahead matching (label, value, keywords). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { optionMatchesComboboxQuery } from '../dist/index.js';

const us = {
    value: 'us',
    label: 'United States',
    keywords: ['US', 'USA', 'America'],
};

test('matches empty query', () => {
    assert.equal(optionMatchesComboboxQuery(us, ''), true);
    assert.equal(optionMatchesComboboxQuery(us, '   '), true);
});

test('matches label substring', () => {
    assert.equal(optionMatchesComboboxQuery(us, 'united'), true);
    assert.equal(optionMatchesComboboxQuery(us, 'states'), true);
});

test('matches value substring', () => {
    assert.equal(optionMatchesComboboxQuery(us, 'us'), true);
});

test('matches keywords case-insensitively', () => {
    assert.equal(optionMatchesComboboxQuery(us, 'USA'), true);
    assert.equal(optionMatchesComboboxQuery(us, 'america'), true);
});

test('returns false when nothing matches', () => {
    assert.equal(optionMatchesComboboxQuery(us, 'xyz'), false);
});

test('works without keywords', () => {
    const plain = { value: 'x', label: 'Alpha' };
    assert.equal(optionMatchesComboboxQuery(plain, 'alp'), true);
    assert.equal(optionMatchesComboboxQuery(plain, 'x'), true);
});
