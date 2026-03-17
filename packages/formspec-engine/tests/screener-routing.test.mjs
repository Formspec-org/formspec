/** @filedesc Screener routing: screener FEL conditions determine eligible/ineligible routing outcomes */
import test from 'node:test';
import assert from 'node:assert/strict';
import { FormEngine } from '../dist/index.js';

// Minimal definition factory for screener tests
function screenerDef(screener) {
  return {
    $formspec: '1.0',
    url: 'http://example.org/screener-test',
    version: '1.0.0',
    title: 'Screener Test',
    items: [
      { key: 'name', type: 'field', dataType: 'string', label: 'Name' }
    ],
    screener
  };
}

// --- RED: Core screener evaluation ---

test('evaluateScreener returns null when definition has no screener', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/test',
    version: '1.0.0',
    title: 'No Screener',
    items: []
  });

  assert.equal(engine.evaluateScreener({}), null);
});

test('evaluateScreener returns first matching route based on answers', () => {
  const engine = new FormEngine(screenerDef({
    items: [
      { key: 'orgType', type: 'field', dataType: 'choice', label: 'Organization Type' },
      { key: 'isReturning', type: 'field', dataType: 'boolean', label: 'Returning Applicant?' }
    ],
    routes: [
      {
        condition: "$orgType = 'nonprofit' and $isReturning = true",
        target: 'https://example.gov/forms/returning-nonprofit/1.0.0',
        label: 'Returning Nonprofit Application'
      },
      {
        condition: "$orgType = 'nonprofit'",
        target: 'https://example.gov/forms/new-nonprofit/1.0.0',
        label: 'New Nonprofit Application'
      },
      {
        condition: 'true',
        target: 'https://example.gov/forms/general/1.0.0',
        label: 'General Application'
      }
    ]
  }));

  // Returning nonprofit matches first route
  const result1 = engine.evaluateScreener({ orgType: 'nonprofit', isReturning: true });
  assert.deepEqual(result1, {
    target: 'https://example.gov/forms/returning-nonprofit/1.0.0',
    label: 'Returning Nonprofit Application'
  });

  // New nonprofit matches second route
  const result2 = engine.evaluateScreener({ orgType: 'nonprofit', isReturning: false });
  assert.deepEqual(result2, {
    target: 'https://example.gov/forms/new-nonprofit/1.0.0',
    label: 'New Nonprofit Application'
  });

  // For-profit matches fallback route
  const result3 = engine.evaluateScreener({ orgType: 'forprofit', isReturning: false });
  assert.deepEqual(result3, {
    target: 'https://example.gov/forms/general/1.0.0',
    label: 'General Application'
  });
});

test('evaluateScreener returns null when no routes match', () => {
  const engine = new FormEngine(screenerDef({
    items: [
      { key: 'age', type: 'field', dataType: 'integer', label: 'Age' }
    ],
    routes: [
      { condition: '$age < 18', target: 'https://example.gov/minor/1.0.0', label: 'Minor' },
      { condition: '$age >= 65', target: 'https://example.gov/senior/1.0.0', label: 'Senior' }
    ]
  }));

  // Age 30 matches neither route
  const result = engine.evaluateScreener({ age: 30 });
  assert.equal(result, null);
});

test('evaluateScreener uses declaration order (first match wins)', () => {
  const engine = new FormEngine(screenerDef({
    items: [
      { key: 'score', type: 'field', dataType: 'integer', label: 'Score' }
    ],
    routes: [
      { condition: '$score > 50', target: '/first', label: 'First' },
      { condition: '$score > 30', target: '/second', label: 'Second' },
      { condition: 'true', target: '/default', label: 'Default' }
    ]
  }));

  // Score 60 matches both first and second, but first-match-wins
  const result = engine.evaluateScreener({ score: 60 });
  assert.deepEqual(result, { target: '/first', label: 'First' });
});

test('evaluateScreener with FEL functions in conditions', () => {
  const engine = new FormEngine(screenerDef({
    items: [
      { key: 'awardAmount', type: 'field', dataType: 'money', label: 'Award Amount' }
    ],
    routes: [
      {
        condition: 'moneyAmount($awardAmount) < 250000',
        target: 'https://grants.gov/forms/sf-425-short/1.0.0',
        label: 'SF-425 Short Form'
      },
      {
        condition: 'true',
        target: 'https://grants.gov/forms/sf-425|2.1.0',
        label: 'Full Progress Report'
      }
    ]
  }));

  const smallAward = engine.evaluateScreener({ awardAmount: { amount: 100000, currency: 'USD' } });
  assert.deepEqual(smallAward, {
    target: 'https://grants.gov/forms/sf-425-short/1.0.0',
    label: 'SF-425 Short Form'
  });

  const largeAward = engine.evaluateScreener({ awardAmount: { amount: 500000, currency: 'USD' } });
  assert.deepEqual(largeAward, {
    target: 'https://grants.gov/forms/sf-425|2.1.0',
    label: 'Full Progress Report'
  });
});

test('evaluateScreener does not pollute form signals with screener answers', () => {
  const engine = new FormEngine(screenerDef({
    items: [
      { key: 'orgType', type: 'field', dataType: 'choice', label: 'Organization Type' }
    ],
    routes: [
      { condition: 'true', target: '/default', label: 'Default' }
    ]
  }));

  engine.evaluateScreener({ orgType: 'nonprofit' });

  // The screener answer should NOT appear in the form's signals
  // 'name' is in the main form items, 'orgType' is screener-only
  assert.equal(engine.signals.orgType, undefined);
  // Main form field should be unaffected
  assert.notEqual(engine.signals.name, undefined);
});

test('evaluateScreener includes route extensions when present', () => {
  const engine = new FormEngine(screenerDef({
    items: [
      { key: 'q', type: 'field', dataType: 'string', label: 'Q' }
    ],
    routes: [
      {
        condition: 'true',
        target: '/forms/a',
        label: 'Route A',
        extensions: { 'x-priority': 'high' }
      }
    ]
  }));

  const result = engine.evaluateScreener({ q: 'anything' });
  assert.deepEqual(result, {
    target: '/forms/a',
    label: 'Route A',
    extensions: { 'x-priority': 'high' }
  });
});

test('evaluateScreener with empty answers uses null values for screener fields', () => {
  const engine = new FormEngine(screenerDef({
    items: [
      { key: 'choice', type: 'field', dataType: 'string', label: 'Choice' }
    ],
    routes: [
      { condition: "empty($choice)", target: '/empty', label: 'Empty Choice' },
      { condition: 'true', target: '/default', label: 'Default' }
    ]
  }));

  // Empty answers object means all screener values are null/undefined
  const result = engine.evaluateScreener({});
  assert.deepEqual(result, { target: '/empty', label: 'Empty Choice' });
});
