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
        { key: 'grandTotal', type: 'field', label: 'Grand Total', dataType: 'decimal' },
        { key: 'totalDirect', type: 'field', label: 'Total Direct', dataType: 'decimal' },
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
    },
    {
      key: 'contactInfo',
      type: 'group',
      label: 'Contact',
      children: [
        { key: 'email', type: 'field', label: 'Email', dataType: 'string' }
      ]
    }
  ],
  binds: [],
  shapes: [],
  variables: []
};

function makeHost(extraVars) {
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
    variables: extraVars || []
  };
}

function makeLib(variables) {
  const lib = JSON.parse(JSON.stringify(libraryDef));
  lib.variables = variables;
  return lib;
}

test('4.1 — Variables are imported into host', () => {
  const lib = makeLib([
    { name: 'budgetComplete', expression: 'present($budget.grandTotal)', scope: '#' }
  ]);
  const resolver = (url) => {
    if (url === 'https://example.org/lib') return lib;
    throw new Error('Unknown: ' + url);
  };
  const { definition } = assembleDefinitionSync(makeHost(), resolver);
  const variable = definition.variables.find(v => v.name === 'budgetComplete');
  assert.ok(variable, 'variable "budgetComplete" should be present in host variables');
});

test('4.2 — Variable expression is rewritten', () => {
  const lib = makeLib([
    { name: 'budgetComplete', expression: 'present($budget.grandTotal)', scope: '#' }
  ]);
  const resolver = (url) => {
    if (url === 'https://example.org/lib') return lib;
    throw new Error('Unknown: ' + url);
  };
  const { definition } = assembleDefinitionSync(makeHost(), resolver);
  const variable = definition.variables.find(v => v.name === 'budgetComplete');
  assert.ok(variable, 'variable "budgetComplete" should be present in host variables');
  assert.equal(variable.expression, 'present($host.proj_grandTotal)');
});

test('4.3 — Variable scope referencing imported key is rewritten', () => {
  const lib = makeLib([
    { name: 'scopedToFragment', expression: 'true', scope: 'budget' },
    { name: 'scopedToLineItems', expression: 'true', scope: 'lineItems' }
  ]);
  const resolver = (url) => {
    if (url === 'https://example.org/lib') return lib;
    throw new Error('Unknown: ' + url);
  };
  const { definition } = assembleDefinitionSync(makeHost(), resolver);
  const fragmentVar = definition.variables.find(v => v.name === 'scopedToFragment');
  assert.ok(fragmentVar, 'variable "scopedToFragment" should be present in host variables');
  assert.equal(fragmentVar.scope, 'host');

  const lineItemsVar = definition.variables.find(v => v.name === 'scopedToLineItems');
  assert.ok(lineItemsVar, 'variable "scopedToLineItems" should be present in host variables');
  assert.equal(lineItemsVar.scope, 'proj_lineItems');
});

test('4.4 — Variable scope "#" is untouched', () => {
  const lib = makeLib([
    { name: 'globalVar', expression: 'true', scope: '#' }
  ]);
  const resolver = (url) => {
    if (url === 'https://example.org/lib') return lib;
    throw new Error('Unknown: ' + url);
  };
  const { definition } = assembleDefinitionSync(makeHost(), resolver);
  const variable = definition.variables.find(v => v.name === 'globalVar');
  assert.ok(variable, 'variable "globalVar" should be present in host variables');
  assert.equal(variable.scope, '#');
});

test('4.5 — Variable name collision throws error', () => {
  const lib = makeLib([
    { name: 'budgetComplete', expression: 'present($budget.grandTotal)', scope: '#' }
  ]);
  const resolver = (url) => {
    if (url === 'https://example.org/lib') return lib;
    throw new Error('Unknown: ' + url);
  };
  const hostWithCollision = makeHost([
    { name: 'budgetComplete', expression: 'true' }
  ]);
  assert.throws(
    () => assembleDefinitionSync(hostWithCollision, resolver),
    (err) => {
      assert.ok(err.message.includes('Variable name collision'), 'error message should mention "Variable name collision"');
      assert.ok(err.message.includes('budgetComplete'), 'error message should mention "budgetComplete"');
      return true;
    }
  );
});

test('4.6 — Fragment filter applies to variables', () => {
  const lib = makeLib([
    { name: 'budgetScopedVar', expression: 'true', scope: 'budget' },
    { name: 'contactScopedVar', expression: 'true', scope: 'contactInfo' },
    { name: 'globalVar', expression: 'true', scope: '#' }
  ]);
  const resolver = (url) => {
    if (url === 'https://example.org/lib') return lib;
    throw new Error('Unknown: ' + url);
  };
  const { definition } = assembleDefinitionSync(makeHost(), resolver);

  const budgetVar = definition.variables.find(v => v.name === 'budgetScopedVar');
  assert.ok(budgetVar, 'variable "budgetScopedVar" scoped to the fragment root should be imported');

  const contactVar = definition.variables.find(v => v.name === 'contactScopedVar');
  assert.equal(contactVar, undefined, 'variable "contactScopedVar" scoped outside the fragment should NOT be imported');

  const globalVar = definition.variables.find(v => v.name === 'globalVar');
  assert.ok(globalVar, 'variable "globalVar" with scope "#" should be imported even with fragment selection');
});
