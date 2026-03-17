/** @filedesc assembleDefinitionSync: shape FEL expressions are rewritten when library groups are assembled */
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
        { key: 'email', type: 'field', label: 'Email', dataType: 'string' },
        { key: 'phone', type: 'field', label: 'Phone', dataType: 'string' },
        { key: 'grandTotal', type: 'field', label: 'Grand Total', dataType: 'decimal' },
        { key: 'totalDirect', type: 'field', label: 'Total Direct', dataType: 'decimal' },
        { key: 'indirectRate', type: 'field', label: 'Rate', dataType: 'decimal' },
        { key: 'conflictField', type: 'field', label: 'Conflict', dataType: 'string' },
        {
          key: 'lineItems',
          type: 'group',
          label: 'Line Items',
          repeatable: true,
          children: [
            { key: 'amount', type: 'field', label: 'Amount', dataType: 'decimal' }
          ]
        }
      ]
    }
  ],
  binds: [],
  shapes: []
};

function makeHost(extraShapes) {
  return {
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
    ],
    shapes: extraShapes || []
  };
}

function makeLib(shapes) {
  const lib = JSON.parse(JSON.stringify(libraryDef));
  lib.shapes = shapes;
  return lib;
}

test('3.1 — Shape constraint is rewritten', () => {
  const lib = makeLib([
    { id: 's1', target: 'budget', message: 'Invalid', constraint: '$budget.grandTotal <= 1000000' }
  ]);
  const hostDef = makeHost();
  const { definition } = assembleDefinitionSync(hostDef, (url) => {
    if (url === 'https://example.org/lib') return lib;
    throw new Error('Unknown: ' + url);
  });
  const shape = definition.shapes.find(s => s.id === 's1');
  assert.ok(shape, 'shape s1 should exist');
  assert.equal(shape.constraint, '$host.proj_grandTotal <= 1000000');
});

test('3.2 — Shape activeWhen is rewritten', () => {
  const lib = makeLib([
    { id: 's2', target: 'budget', message: 'Msg', activeWhen: 'present($budget.grandTotal)' }
  ]);
  const hostDef = makeHost();
  const { definition } = assembleDefinitionSync(hostDef, (url) => {
    if (url === 'https://example.org/lib') return lib;
    throw new Error('Unknown: ' + url);
  });
  const shape = definition.shapes.find(s => s.id === 's2');
  assert.ok(shape, 'shape s2 should exist');
  assert.equal(shape.activeWhen, 'present($host.proj_grandTotal)');
});

test('3.3 — Shape context values are rewritten', () => {
  const lib = makeLib([
    {
      id: 's3',
      target: 'budget',
      message: 'Msg',
      context: { actualTotal: '$budget.grandTotal', directPortion: '$budget.totalDirect' }
    }
  ]);
  const hostDef = makeHost();
  const { definition } = assembleDefinitionSync(hostDef, (url) => {
    if (url === 'https://example.org/lib') return lib;
    throw new Error('Unknown: ' + url);
  });
  const shape = definition.shapes.find(s => s.id === 's3');
  assert.ok(shape, 'shape s3 should exist');
  assert.equal(shape.context.actualTotal, '$host.proj_grandTotal');
  assert.equal(shape.context.directPortion, '$host.proj_totalDirect');
  assert.ok('actualTotal' in shape.context, 'context key actualTotal should be unchanged');
  assert.ok('directPortion' in shape.context, 'context key directPortion should be unchanged');
});

test('3.4 — Shape message with {{expression}} is rewritten', () => {
  const lib = makeLib([
    { id: 's4', target: 'budget', message: 'Total ({{$budget.grandTotal}}) exceeds cap.' }
  ]);
  const hostDef = makeHost();
  const { definition } = assembleDefinitionSync(hostDef, (url) => {
    if (url === 'https://example.org/lib') return lib;
    throw new Error('Unknown: ' + url);
  });
  const shape = definition.shapes.find(s => s.id === 's4');
  assert.ok(shape, 'shape s4 should exist');
  assert.equal(shape.message, 'Total ({{$host.proj_grandTotal}}) exceeds cap.');
});

test('3.5 — Shape message without {{...}} is untouched', () => {
  const lib = makeLib([
    { id: 's5', target: 'budget', message: 'Budget must have at least one line item.' }
  ]);
  const hostDef = makeHost();
  const { definition } = assembleDefinitionSync(hostDef, (url) => {
    if (url === 'https://example.org/lib') return lib;
    throw new Error('Unknown: ' + url);
  });
  const shape = definition.shapes.find(s => s.id === 's5');
  assert.ok(shape, 'shape s5 should exist');
  assert.equal(shape.message, 'Budget must have at least one line item.');
});

test('3.6 — Composition and[] with inline FEL entries', () => {
  const lib = makeLib([
    { id: 's6', target: 'budget', message: 'Msg', and: ['present($budget.email)', 'present($budget.phone)'] }
  ]);
  const hostDef = makeHost();
  const { definition } = assembleDefinitionSync(hostDef, (url) => {
    if (url === 'https://example.org/lib') return lib;
    throw new Error('Unknown: ' + url);
  });
  const shape = definition.shapes.find(s => s.id === 's6');
  assert.ok(shape, 'shape s6 should exist');
  assert.deepEqual(shape.and, ['present($host.proj_email)', 'present($host.proj_phone)']);
});

test('3.7 — Composition and[] with shape ID entries (no collision)', () => {
  const lib = makeLib([
    { id: 's7-helper1', target: 'budget', message: 'H1' },
    { id: 's7-helper2', target: 'budget', message: 'H2' },
    { id: 's7', target: 'budget', message: 'Msg', and: ['s7-helper1', 's7-helper2'] }
  ]);
  const hostDef = makeHost();
  const { definition } = assembleDefinitionSync(hostDef, (url) => {
    if (url === 'https://example.org/lib') return lib;
    throw new Error('Unknown: ' + url);
  });
  const shape = definition.shapes.find(s => s.id === 's7');
  assert.ok(shape, 'shape s7 should exist');
  assert.deepEqual(shape.and, ['s7-helper1', 's7-helper2']);
});

test('3.8 — Composition and[] with shape ID entries after collision rename', () => {
  const lib = makeLib([
    { id: 'existing-shape', target: 'budget', message: 'Imported' },
    { id: 'ref-shape', target: 'budget', message: 'Refs', and: ['existing-shape'] }
  ]);
  const hostDef = makeHost([
    { id: 'existing-shape', target: '#', message: 'Existing' }
  ]);
  const { definition } = assembleDefinitionSync(hostDef, (url) => {
    if (url === 'https://example.org/lib') return lib;
    throw new Error('Unknown: ' + url);
  });
  const refShape = definition.shapes.find(s => s.id === 'ref-shape');
  assert.ok(refShape, 'ref-shape should exist');
  assert.deepEqual(refShape.and, ['host_existing-shape']);
});

test('3.9 — Composition and[] with mixed entries', () => {
  const lib = makeLib([
    { id: 'budget-check', target: 'budget', message: 'Check' },
    { id: 'main', target: 'budget', message: 'Main', and: ['budget-check', 'present($budget.indirectRate)'] }
  ]);
  const hostDef = makeHost();
  const { definition } = assembleDefinitionSync(hostDef, (url) => {
    if (url === 'https://example.org/lib') return lib;
    throw new Error('Unknown: ' + url);
  });
  const shape = definition.shapes.find(s => s.id === 'main');
  assert.ok(shape, 'main shape should exist');
  assert.deepEqual(shape.and, ['budget-check', 'present($host.proj_indirectRate)']);
});

test('3.10 — not (single string) with inline FEL', () => {
  const lib = makeLib([
    { id: 's10', target: 'budget', message: 'Msg', not: 'present($budget.conflictField)' }
  ]);
  const hostDef = makeHost();
  const { definition } = assembleDefinitionSync(hostDef, (url) => {
    if (url === 'https://example.org/lib') return lib;
    throw new Error('Unknown: ' + url);
  });
  const shape = definition.shapes.find(s => s.id === 's10');
  assert.ok(shape, 'shape s10 should exist');
  assert.equal(shape.not, 'present($host.proj_conflictField)');
});

test('3.11 — or[] and xone[] follow same rules as and[]', () => {
  const lib = makeLib([
    {
      id: 's11',
      target: 'budget',
      message: 'Msg',
      or: ['present($budget.email)'],
      xone: ['present($budget.phone)']
    }
  ]);
  const hostDef = makeHost();
  const { definition } = assembleDefinitionSync(hostDef, (url) => {
    if (url === 'https://example.org/lib') return lib;
    throw new Error('Unknown: ' + url);
  });
  const shape = definition.shapes.find(s => s.id === 's11');
  assert.ok(shape, 'shape s11 should exist');
  assert.deepEqual(shape.or, ['present($host.proj_email)']);
  assert.deepEqual(shape.xone, ['present($host.proj_phone)']);
});
