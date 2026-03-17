/** @filedesc Extended engine features: formPresentation metadata, screener routing, and miscellaneous engine surface */
import test from 'node:test';
import assert from 'node:assert/strict';
import { FormEngine } from '../dist/index.js';

test('should return formPresentation metadata when the definition includes formPresentation', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/test',
    version: '1.0.0',
    title: 'Presentation Test',
    items: [],
    formPresentation: {
      layout: 'wizard',
      theme: 'dark'
    }
  });

  assert.deepEqual(engine.formPresentation, { layout: 'wizard', theme: 'dark' });
  assert.equal(engine.formPresentation.layout, 'wizard');
});

test('should return null formPresentation when the definition omits formPresentation', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/test',
    version: '1.0.0',
    title: 'No Presentation',
    items: []
  });

  assert.equal(engine.formPresentation, null);
});

test('should return the first matching screener route when multiple conditions are evaluated', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/test',
    version: '1.0.0',
    title: 'Screener Test',
    items: [],
    screener: {
      items: [
        { key: 'age', type: 'field', dataType: 'integer', label: 'Age' },
        { key: 'income', type: 'field', dataType: 'integer', label: 'Income' }
      ],
      routes: [
        { condition: '$age < 18', target: '/forms/minor', label: 'Minor Form' },
        { condition: '$income > 50000', target: '/forms/premium', label: 'Premium Form' },
        { condition: 'true', target: '/forms/standard', label: 'Standard Form' }
      ]
    }
  });

  const routeWhenAdult = engine.evaluateScreener({ age: 25, income: 60000 });
  const routeWhenMinor = engine.evaluateScreener({ age: 15, income: 60000 });

  assert.deepEqual(routeWhenAdult, { target: '/forms/premium', label: 'Premium Form' });
  assert.deepEqual(routeWhenMinor, { target: '/forms/minor', label: 'Minor Form' });
});

test('should return null screener route when the definition has no routes', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/test',
    version: '1.0.0',
    title: 'No Screener',
    items: []
  });

  assert.equal(engine.evaluateScreener({}), null);
});

test('should resolve pdf and csv labels when those contexts are active', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/test',
    version: '1.0.0',
    title: 'Label Context Test',
    items: [
      {
        key: 'name',
        type: 'field',
        dataType: 'string',
        label: 'Name',
        labels: {
          pdf: 'Applicant Name',
          csv: 'applicant_name',
          short: 'Name'
        }
      },
      {
        key: 'email',
        type: 'field',
        dataType: 'string',
        label: 'Email'
      }
    ]
  });

  const items = engine.getDefinition().items;

  const defaultLabel = engine.getLabel(items[0]);
  engine.setLabelContext('pdf');
  const pdfLabel = engine.getLabel(items[0]);
  engine.setLabelContext('csv');
  const csvLabel = engine.getLabel(items[0]);
  engine.setLabelContext(null);
  const clearedLabel = engine.getLabel(items[0]);

  assert.equal(defaultLabel, 'Name');
  assert.equal(pdfLabel, 'Applicant Name');
  assert.equal(csvLabel, 'applicant_name');
  assert.equal(clearedLabel, 'Name');
});

test('should fall back to default labels when context-specific label is missing', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/test',
    version: '1.0.0',
    title: 'Label Fallback Test',
    items: [
      {
        key: 'email',
        type: 'field',
        dataType: 'string',
        label: 'Email Address',
        labels: {
          pdf: 'Email (PDF)'
        }
      },
      {
        key: 'phone',
        type: 'field',
        dataType: 'string',
        label: 'Phone Number'
      }
    ]
  });

  const [emailItem, phoneItem] = engine.getDefinition().items;
  engine.setLabelContext('csv');

  assert.equal(engine.getLabel(emailItem), 'Email Address');
  assert.equal(engine.getLabel(phoneItem), 'Phone Number');
});

test('should apply rename remove and add migration steps when migrating response data', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/test',
    version: '2.0.0',
    title: 'Migration Test',
    items: [
      { key: 'fullName', type: 'field', dataType: 'string', label: 'Full Name' },
      { key: 'consent', type: 'field', dataType: 'boolean', label: 'Consent' }
    ],
    migrations: [
      {
        fromVersion: '1.0.0',
        changes: [
          { type: 'rename', from: 'name', to: 'fullName' },
          { type: 'remove', path: 'legacy_field' },
          { type: 'add', path: 'consent', default: false }
        ]
      }
    ]
  });

  const result = engine.migrateResponse(
    {
      name: 'John Doe',
      legacy_field: 'old_value',
      email: 'john@example.com'
    },
    '1.0.0'
  );

  assert.equal(result.fullName, 'John Doe');
  assert.equal(result.name, undefined);
  assert.equal(result.legacy_field, undefined);
  assert.equal(result.consent, false);
  assert.equal(result.email, 'john@example.com');
});

test('should skip migrations earlier than fromVersion when migrating response data', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/test',
    version: '3.0.0',
    title: 'Migration Version Test',
    items: [{ key: 'x', type: 'field', dataType: 'string', label: 'X' }],
    migrations: [
      {
        fromVersion: '1.0.0',
        changes: [{ type: 'rename', from: 'a', to: 'b' }]
      },
      {
        fromVersion: '2.0.0',
        changes: [{ type: 'rename', from: 'b', to: 'c' }]
      }
    ]
  });

  const result = engine.migrateResponse({ b: 'value' }, '2.0.0');

  assert.equal(result.c, 'value');
  assert.equal(result.b, undefined);
});

test('should evaluate migration transform expressions against the migrating response payload', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/test',
    version: '3.0.0',
    title: 'Migration Transform Context',
    items: [
      { key: 'name', type: 'field', dataType: 'string', label: 'Name', initialValue: '' },
      { key: 'nickname', type: 'field', dataType: 'string', label: 'Nickname', initialValue: '' }
    ],
    migrations: [
      {
        fromVersion: '1.0.0',
        changes: [
          { type: 'rename', from: 'givenName', to: 'name' },
          { type: 'transform', path: 'nickname', expression: 'upper(name)' }
        ]
      }
    ]
  });

  const result = engine.migrateResponse(
    { givenName: 'alice', nickname: 'legacy' },
    '1.0.0'
  );

  assert.equal(result.name, 'alice');
  assert.equal(result.nickname, 'ALICE');
});
