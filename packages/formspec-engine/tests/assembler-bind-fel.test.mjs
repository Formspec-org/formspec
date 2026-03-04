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
        { key: 'total', type: 'field', label: 'Total', dataType: 'decimal' },
        { key: 'rate', type: 'field', label: 'Rate', dataType: 'decimal' },
        { key: 'showSection', type: 'field', label: 'Show', dataType: 'boolean' },
        { key: 'grandTotal', type: 'field', label: 'Grand Total', dataType: 'decimal' },
        {
          key: 'lineItems',
          type: 'group',
          label: 'Line Items',
          repeatable: true,
          children: [
            { key: 'desc', type: 'field', label: 'Description', dataType: 'string' },
            { key: 'lineAmount', type: 'field', label: 'Amount', dataType: 'decimal' }
          ]
        }
      ]
    }
  ],
  binds: []
};

function makeLib(binds) {
  const lib = JSON.parse(JSON.stringify(libraryDef));
  lib.binds = binds;
  return lib;
}

const hostDef = {
  $formspec: '1.0',
  url: 'https://example.org/host',
  version: '1.0.0',
  title: 'Host',
  status: 'draft',
  items: [
    {
      key: 'host',
      type: 'group',
      label: 'Host Budget',
      $ref: 'https://example.org/lib|1.0.0#budget',
      keyPrefix: 'proj_'
    }
  ]
};

test('2.1 — calculate expression is rewritten', () => {
  const lib = makeLib([
    { path: 'budget.total', calculate: 'sum($budget.lineItems[*].lineAmount)' }
  ]);
  const resolver = (url) => {
    if (url === 'https://example.org/lib') return lib;
    throw new Error('Unknown: ' + url);
  };
  const { definition } = assembleDefinitionSync(JSON.parse(JSON.stringify(hostDef)), resolver);
  const bind = definition.binds.find(b => b.path === 'host.proj_budget.proj_total');
  assert.ok(bind, 'bind with path "host.proj_budget.proj_total" should exist');
  assert.equal(bind.calculate, 'sum($host.proj_lineItems[*].proj_lineAmount)');
});

test('2.2 — constraint expression is rewritten', () => {
  const lib = makeLib([
    { path: 'budget.amount', constraint: '$budget.amount > 0' }
  ]);
  const resolver = (url) => {
    if (url === 'https://example.org/lib') return lib;
    throw new Error('Unknown: ' + url);
  };
  const { definition } = assembleDefinitionSync(JSON.parse(JSON.stringify(hostDef)), resolver);
  const bind = definition.binds.find(b => b.path === 'host.proj_budget.proj_amount');
  assert.ok(bind, 'bind with path "host.proj_budget.proj_amount" should exist');
  assert.equal(bind.constraint, '$host.proj_amount > 0');
});

test('2.3 — relevant expression is rewritten', () => {
  const lib = makeLib([
    { path: 'budget.amount', relevant: '$budget.showSection = true' }
  ]);
  const resolver = (url) => {
    if (url === 'https://example.org/lib') return lib;
    throw new Error('Unknown: ' + url);
  };
  const { definition } = assembleDefinitionSync(JSON.parse(JSON.stringify(hostDef)), resolver);
  const bind = definition.binds.find(b => b.path === 'host.proj_budget.proj_amount');
  assert.ok(bind, 'bind with path "host.proj_budget.proj_amount" should exist');
  assert.equal(bind.relevant, '$host.proj_showSection = true');
});

test('2.4 — readonly expression is rewritten', () => {
  const lib = makeLib([
    { path: 'budget.total', readonly: '$budget.amount > 1000' }
  ]);
  const resolver = (url) => {
    if (url === 'https://example.org/lib') return lib;
    throw new Error('Unknown: ' + url);
  };
  const { definition } = assembleDefinitionSync(JSON.parse(JSON.stringify(hostDef)), resolver);
  const bind = definition.binds.find(b => b.path === 'host.proj_budget.proj_total');
  assert.ok(bind, 'bind with path "host.proj_budget.proj_total" should exist');
  assert.equal(bind.readonly, '$host.proj_amount > 1000');
});

test('2.5 — required expression is rewritten', () => {
  const lib = makeLib([
    { path: 'budget.amount', required: '$budget.showSection = true' }
  ]);
  const resolver = (url) => {
    if (url === 'https://example.org/lib') return lib;
    throw new Error('Unknown: ' + url);
  };
  const { definition } = assembleDefinitionSync(JSON.parse(JSON.stringify(hostDef)), resolver);
  const bind = definition.binds.find(b => b.path === 'host.proj_budget.proj_amount');
  assert.ok(bind, 'bind with path "host.proj_budget.proj_amount" should exist');
  assert.equal(bind.required, '$host.proj_showSection = true');
});

test('2.6 — default with = prefix is rewritten, prefix preserved', () => {
  const lib = makeLib([
    { path: 'budget.rate', default: '=if($budget.grandTotal > 0, 10, 0)' }
  ]);
  const resolver = (url) => {
    if (url === 'https://example.org/lib') return lib;
    throw new Error('Unknown: ' + url);
  };
  const { definition } = assembleDefinitionSync(JSON.parse(JSON.stringify(hostDef)), resolver);
  const bind = definition.binds.find(b => b.path === 'host.proj_budget.proj_rate');
  assert.ok(bind, 'bind with path "host.proj_budget.proj_rate" should exist');
  assert.equal(bind.default, '=if($host.proj_grandTotal > 0, 10, 0)');
});

test('2.7 — default with literal value is untouched', () => {
  const lib = makeLib([
    { path: 'budget.rate', default: 0 }
  ]);
  const resolver = (url) => {
    if (url === 'https://example.org/lib') return lib;
    throw new Error('Unknown: ' + url);
  };
  const { definition } = assembleDefinitionSync(JSON.parse(JSON.stringify(hostDef)), resolver);
  const bind = definition.binds.find(b => b.path === 'host.proj_budget.proj_rate');
  assert.ok(bind, 'bind with path "host.proj_budget.proj_rate" should exist');
  assert.equal(bind.default, 0);
});

test('2.8 — constraint using only $ (current-node) is unchanged', () => {
  const lib = makeLib([
    { path: 'budget.rate', constraint: '$ >= 0 and $ <= 100', constraintMessage: 'Rate must be 0-100%' }
  ]);
  const resolver = (url) => {
    if (url === 'https://example.org/lib') return lib;
    throw new Error('Unknown: ' + url);
  };
  const { definition } = assembleDefinitionSync(JSON.parse(JSON.stringify(hostDef)), resolver);
  const bind = definition.binds.find(b => b.path === 'host.proj_budget.proj_rate');
  assert.ok(bind, 'bind with path "host.proj_budget.proj_rate" should exist');
  assert.equal(bind.constraint, '$ >= 0 and $ <= 100');
  assert.equal(bind.constraintMessage, 'Rate must be 0-100%');
});
