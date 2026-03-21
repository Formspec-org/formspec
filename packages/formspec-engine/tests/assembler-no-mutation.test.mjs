/** @filedesc assembleDefinitionSync must not mutate the caller's definition arrays */
import test from 'node:test';
import assert from 'node:assert/strict';
import { assembleDefinitionSync } from '../dist/index.js';

const libraryDef = {
  $formspec: '1.0',
  url: 'https://example.org/lib',
  version: '1.0.0',
  title: 'Library',
  status: 'active',
  items: [
    {
      key: 'budget',
      type: 'group',
      label: 'Budget',
      children: [
        { key: 'amount', type: 'field', label: 'Amount', dataType: 'decimal' },
      ],
    },
  ],
  binds: [
    { path: 'budget.amount', constraint: '$ > 0' },
  ],
  shapes: [
    {
      id: 'min-amount',
      target: 'budget.amount',
      message: 'Amount required',
      constraint: '$budget.amount > 0',
    },
  ],
  variables: [
    { name: 'hasAmount', expression: 'present($budget.amount)' },
  ],
};

test('assembleDefinitionSync does not mutate caller binds array', () => {
  const hostDef = {
    $formspec: '1.0',
    url: 'https://example.org/host',
    version: '1.0.0',
    title: 'Host',
    status: 'draft',
    items: [
      {
        key: 'wrapper',
        type: 'group',
        label: 'Wrapper',
        $ref: 'https://example.org/lib|1.0.0#budget',
        keyPrefix: 'imp_',
      },
    ],
    binds: [
      { path: 'wrapper.existing', constraint: '$ != null' },
    ],
  };
  const originalBindsLength = hostDef.binds.length;
  const resolver = (url) => {
    if (url === 'https://example.org/lib') return JSON.parse(JSON.stringify(libraryDef));
    throw new Error('Unknown: ' + url);
  };
  const { definition } = assembleDefinitionSync(hostDef, resolver);

  // The assembled definition should have more binds (host + imported)
  assert.ok(definition.binds.length > originalBindsLength, 'assembled def should have imported binds');
  // But the caller's original array must be untouched
  assert.equal(hostDef.binds.length, originalBindsLength, 'caller binds array must not be mutated');
});

test('assembleDefinitionSync does not mutate caller shapes array', () => {
  const hostDef = {
    $formspec: '1.0',
    url: 'https://example.org/host',
    version: '1.0.0',
    title: 'Host',
    status: 'draft',
    items: [
      {
        key: 'wrapper',
        type: 'group',
        label: 'Wrapper',
        $ref: 'https://example.org/lib|1.0.0#budget',
        keyPrefix: 'imp_',
      },
    ],
    shapes: [
      { id: 'host-shape', target: '#', message: 'Host check', constraint: 'true' },
    ],
  };
  const originalShapesLength = hostDef.shapes.length;
  const resolver = (url) => {
    if (url === 'https://example.org/lib') return JSON.parse(JSON.stringify(libraryDef));
    throw new Error('Unknown: ' + url);
  };
  const { definition } = assembleDefinitionSync(hostDef, resolver);

  assert.ok(definition.shapes.length > originalShapesLength, 'assembled def should have imported shapes');
  assert.equal(hostDef.shapes.length, originalShapesLength, 'caller shapes array must not be mutated');
});

test('assembleDefinitionSync does not mutate caller variables array', () => {
  const hostDef = {
    $formspec: '1.0',
    url: 'https://example.org/host',
    version: '1.0.0',
    title: 'Host',
    status: 'draft',
    items: [
      {
        key: 'wrapper',
        type: 'group',
        label: 'Wrapper',
        $ref: 'https://example.org/lib|1.0.0#budget',
        keyPrefix: 'imp_',
      },
    ],
    variables: [
      { name: 'hostVar', expression: 'true' },
    ],
  };
  const originalVarsLength = hostDef.variables.length;
  const resolver = (url) => {
    if (url === 'https://example.org/lib') return JSON.parse(JSON.stringify(libraryDef));
    throw new Error('Unknown: ' + url);
  };
  const { definition } = assembleDefinitionSync(hostDef, resolver);

  assert.ok(definition.variables.length > originalVarsLength, 'assembled def should have imported variables');
  assert.equal(hostDef.variables.length, originalVarsLength, 'caller variables array must not be mutated');
});
