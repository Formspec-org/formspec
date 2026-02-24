import test from 'node:test';
import assert from 'node:assert/strict';
import { FormEngine } from '../dist/index.js';

function engineWithCalc(calculate, dataType = 'string') {
    return new FormEngine({
        $formspec: '1.0',
        url: 'http://example.org/test',
        version: '1.0.0',
        title: 'Cast Test',
        items: [{ key: 'result', type: 'field', dataType, label: 'Result' }],
        binds: [{ path: 'result', calculate }]
    });
}

// boolean()
test('boolean("true") returns true', () => {
    const e = engineWithCalc("boolean('true')", 'boolean');
    assert.equal(e.signals.result.value, true);
});

test('boolean("false") returns false', () => {
    const e = engineWithCalc("boolean('false')", 'boolean');
    assert.equal(e.signals.result.value, false);
});

test('boolean(0) returns false', () => {
    const e = engineWithCalc('boolean(0)', 'boolean');
    assert.equal(e.signals.result.value, false);
});

test('boolean(1) returns true', () => {
    const e = engineWithCalc('boolean(1)', 'boolean');
    assert.equal(e.signals.result.value, true);
});

test('boolean(null) returns false', () => {
    const e = engineWithCalc('boolean(null)', 'boolean');
    assert.equal(e.signals.result.value, false);
});

// date()
test('date("2025-05-20") returns the date string', () => {
    const e = engineWithCalc("date('2025-05-20')", 'date');
    assert.equal(e.signals.result.value, '2025-05-20');
});

test('date(null) returns null', () => {
    const e = engineWithCalc('date(null)', 'date');
    assert.equal(e.signals.result.value, null);
});

// time(h, m, s)
test('time(14, 30, 0) returns "14:30:00"', () => {
    const e = engineWithCalc('time(14, 30, 0)');
    assert.equal(e.signals.result.value, '14:30:00');
});

test('time(9, 5, 3) returns "09:05:03" with zero-padding', () => {
    const e = engineWithCalc('time(9, 5, 3)');
    assert.equal(e.signals.result.value, '09:05:03');
});

test('time(0, 0, 0) returns "00:00:00"', () => {
    const e = engineWithCalc('time(0, 0, 0)');
    assert.equal(e.signals.result.value, '00:00:00');
});
