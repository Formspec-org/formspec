import test from 'node:test';
import assert from 'node:assert/strict';
import { assembleDefinitionSync } from '../dist/index.js';

// ---------------------------------------------------------------------------
// Test 5.1 — Budget template import: full bind + shape + variable rewrite
// ---------------------------------------------------------------------------

const budgetTemplate = {
  $formspec: '1.0',
  url: 'https://example.org/budget-template',
  version: '2.0.0',
  title: 'Budget Template',
  status: 'active',
  items: [
    {
      key: 'budget',
      type: 'group',
      label: 'Budget',
      children: [
        {
          key: 'lineItems',
          type: 'group',
          label: 'Line Items',
          repeatable: true, minRepeat: 1, maxRepeat: 50,
          children: [
            { key: 'description', type: 'field', label: 'Description', dataType: 'string' },
            { key: 'amount', type: 'field', label: 'Amount', dataType: 'money' }
          ]
        },
        { key: 'indirectRate', type: 'field', label: 'Indirect Rate (%)', dataType: 'decimal' },
        { key: 'totalDirect', type: 'field', label: 'Total Direct', dataType: 'money' },
        { key: 'totalIndirect', type: 'field', label: 'Total Indirect', dataType: 'money' },
        { key: 'grandTotal', type: 'field', label: 'Grand Total', dataType: 'money' }
      ]
    }
  ],
  binds: [
    { path: 'budget.totalDirect', calculate: 'sum($budget.lineItems[*].amount)' },
    { path: 'budget.totalIndirect', calculate: '$budget.totalDirect * ($budget.indirectRate / 100)' },
    { path: 'budget.grandTotal', calculate: '$budget.totalDirect + $budget.totalIndirect' },
    {
      path: 'budget.indirectRate',
      constraint: '$ >= 0 and $ <= 100',
      constraintMessage: 'Rate must be 0-100%',
      default: '=if($budget.grandTotal > 0, 10, 0)'
    }
  ],
  variables: [
    { name: 'budgetComplete', expression: 'present($budget.grandTotal) and $budget.grandTotal > 0' }
  ],
  shapes: [
    {
      id: 'budget-has-items',
      target: 'budget.lineItems',
      message: 'Budget must have at least one line item with an amount.',
      constraint: 'count($budget.lineItems[*].amount) > 0'
    },
    {
      id: 'budget-total-reasonable',
      target: 'budget',
      message: 'Grand total ({{$budget.grandTotal}}) exceeds indirect cap.',
      constraint: '$budget.grandTotal <= 1000000',
      activeWhen: 'present($budget.grandTotal)',
      context: { actualTotal: '$budget.grandTotal', directPortion: '$budget.totalDirect' },
      and: ['budget-has-items', 'present($budget.indirectRate)']
    }
  ]
};

const hostDef = {
  $formspec: '1.0',
  url: 'https://example.org/research-proposal',
  version: '1.0.0',
  title: 'Research Proposal',
  status: 'draft',
  items: [
    { key: 'piName', type: 'field', label: 'Principal Investigator', dataType: 'string' },
    {
      key: 'projectBudget',
      type: 'group',
      label: 'Project Budget',
      $ref: 'https://example.org/budget-template|2.0.0#budget',
      keyPrefix: 'proj_'
    }
  ]
};

function makeBudgetResolver() {
  return (url) => {
    if (url === 'https://example.org/budget-template') return budgetTemplate;
    throw new Error('Unknown URL: ' + url);
  };
}

// When the fragment root key ('budget') is in importedKeys, the assembler
// prefixes it along with all other imported keys. The resulting bind paths
// therefore include the prefixed fragment root segment:
//   budget.totalDirect -> projectBudget.proj_budget.proj_totalDirect

test('5.1 — calculate: totalDirect bind is fully rewritten', () => {
  const { definition } = assembleDefinitionSync(
    JSON.parse(JSON.stringify(hostDef)),
    makeBudgetResolver()
  );
  const bind = definition.binds.find(b => b.path === 'projectBudget.proj_budget.proj_totalDirect');
  assert.ok(bind, 'bind with path "projectBudget.proj_budget.proj_totalDirect" should exist');
  assert.equal(bind.calculate, 'sum($projectBudget.proj_lineItems[*].proj_amount)');
});

test('5.1 — calculate: totalIndirect bind is fully rewritten', () => {
  const { definition } = assembleDefinitionSync(
    JSON.parse(JSON.stringify(hostDef)),
    makeBudgetResolver()
  );
  const bind = definition.binds.find(b => b.path === 'projectBudget.proj_budget.proj_totalIndirect');
  assert.ok(bind, 'bind with path "projectBudget.proj_budget.proj_totalIndirect" should exist');
  assert.equal(bind.calculate, '$projectBudget.proj_totalDirect * ($projectBudget.proj_indirectRate / 100)');
});

test('5.1 — calculate: grandTotal bind is fully rewritten', () => {
  const { definition } = assembleDefinitionSync(
    JSON.parse(JSON.stringify(hostDef)),
    makeBudgetResolver()
  );
  const bind = definition.binds.find(b => b.path === 'projectBudget.proj_budget.proj_grandTotal');
  assert.ok(bind, 'bind with path "projectBudget.proj_budget.proj_grandTotal" should exist');
  assert.equal(bind.calculate, '$projectBudget.proj_totalDirect + $projectBudget.proj_totalIndirect');
});

test('5.1 — indirectRate bind: bare $ constraint is unchanged, = prefix on default is preserved', () => {
  const { definition } = assembleDefinitionSync(
    JSON.parse(JSON.stringify(hostDef)),
    makeBudgetResolver()
  );
  const bind = definition.binds.find(b => b.path === 'projectBudget.proj_budget.proj_indirectRate');
  assert.ok(bind, 'bind with path "projectBudget.proj_budget.proj_indirectRate" should exist');
  assert.equal(bind.constraint, '$ >= 0 and $ <= 100');
  assert.equal(bind.default, '=if($projectBudget.proj_grandTotal > 0, 10, 0)');
});

test('5.1 — shape budget-has-items: constraint is rewritten', () => {
  const { definition } = assembleDefinitionSync(
    JSON.parse(JSON.stringify(hostDef)),
    makeBudgetResolver()
  );
  const shape = definition.shapes.find(s => s.id === 'budget-has-items');
  assert.ok(shape, 'shape "budget-has-items" should exist');
  assert.equal(shape.constraint, 'count($projectBudget.proj_lineItems[*].proj_amount) > 0');
});

test('5.1 — shape budget-total-reasonable: all FEL fields are rewritten', () => {
  const { definition } = assembleDefinitionSync(
    JSON.parse(JSON.stringify(hostDef)),
    makeBudgetResolver()
  );
  const shape = definition.shapes.find(s => s.id === 'budget-total-reasonable');
  assert.ok(shape, 'shape "budget-total-reasonable" should exist');
  assert.equal(shape.constraint, '$projectBudget.proj_grandTotal <= 1000000');
  assert.equal(shape.activeWhen, 'present($projectBudget.proj_grandTotal)');
  assert.deepEqual(shape.context, {
    actualTotal: '$projectBudget.proj_grandTotal',
    directPortion: '$projectBudget.proj_totalDirect'
  });
  assert.equal(shape.message, 'Grand total ({{$projectBudget.proj_grandTotal}}) exceeds indirect cap.');
  assert.deepEqual(shape.and, ['budget-has-items', 'present($projectBudget.proj_indirectRate)']);
});

test('5.1 — variable budgetComplete: expression is rewritten', () => {
  const { definition } = assembleDefinitionSync(
    JSON.parse(JSON.stringify(hostDef)),
    makeBudgetResolver()
  );
  assert.ok(definition.variables, 'definition should have variables');
  const variable = definition.variables.find(v => v.name === 'budgetComplete');
  assert.ok(variable, 'variable "budgetComplete" should exist');
  assert.equal(
    variable.expression,
    'present($projectBudget.proj_grandTotal) and $projectBudget.proj_grandTotal > 0'
  );
});

// ---------------------------------------------------------------------------
// Test 5.2 — Double import with different prefixes
// ---------------------------------------------------------------------------

const addressLib = {
  $formspec: '1.0',
  url: 'https://example.org/address',
  version: '1.0.0',
  title: 'Address',
  status: 'active',
  items: [
    {
      key: 'address',
      type: 'group',
      label: 'Address',
      children: [
        { key: 'street', type: 'field', label: 'Street', dataType: 'string' },
        { key: 'zip', type: 'field', label: 'ZIP', dataType: 'string' }
      ]
    }
  ],
  binds: [
    { path: 'address.zip', constraint: "matches($, '^\\d{5}$')", constraintMessage: 'Enter valid ZIP' },
    { path: 'address.street', required: 'true' }
  ]
};

const hostDef2 = {
  $formspec: '1.0',
  url: 'https://example.org/form',
  version: '1.0.0',
  title: 'Form',
  status: 'draft',
  items: [
    {
      key: 'homeAddr',
      type: 'group',
      label: 'Home',
      $ref: 'https://example.org/address|1.0.0#address',
      keyPrefix: 'home_'
    },
    {
      key: 'workAddr',
      type: 'group',
      label: 'Work',
      $ref: 'https://example.org/address|1.0.0#address',
      keyPrefix: 'work_'
    }
  ]
};

function makeAddressResolver() {
  return (url) => {
    if (url === 'https://example.org/address') return addressLib;
    throw new Error('Unknown URL: ' + url);
  };
}

test('5.2 — double import assembles without error', () => {
  assert.doesNotThrow(() => {
    assembleDefinitionSync(
      JSON.parse(JSON.stringify(hostDef2)),
      makeAddressResolver()
    );
  });
});

test('5.2 — double import produces exactly 4 binds', () => {
  const { definition } = assembleDefinitionSync(
    JSON.parse(JSON.stringify(hostDef2)),
    makeAddressResolver()
  );
  assert.equal(definition.binds.length, 4);
});

// When the fragment root key ('address') is in importedKeys, the assembler
// prefixes it. Resulting bind paths include the prefixed fragment root:
//   address.zip -> homeAddr.home_address.home_zip

test('5.2 — home binds target homeAddr.home_address.home_zip and homeAddr.home_address.home_street', () => {
  const { definition } = assembleDefinitionSync(
    JSON.parse(JSON.stringify(hostDef2)),
    makeAddressResolver()
  );
  const zipBind = definition.binds.find(b => b.path === 'homeAddr.home_address.home_zip');
  assert.ok(zipBind, 'bind with path "homeAddr.home_address.home_zip" should exist');
  const streetBind = definition.binds.find(b => b.path === 'homeAddr.home_address.home_street');
  assert.ok(streetBind, 'bind with path "homeAddr.home_address.home_street" should exist');
});

test('5.2 — work binds target workAddr.work_address.work_zip and workAddr.work_address.work_street', () => {
  const { definition } = assembleDefinitionSync(
    JSON.parse(JSON.stringify(hostDef2)),
    makeAddressResolver()
  );
  const zipBind = definition.binds.find(b => b.path === 'workAddr.work_address.work_zip');
  assert.ok(zipBind, 'bind with path "workAddr.work_address.work_zip" should exist');
  const streetBind = definition.binds.find(b => b.path === 'workAddr.work_address.work_street');
  assert.ok(streetBind, 'bind with path "workAddr.work_address.work_street" should exist');
});

test('5.2 — zip constraint uses only bare $ and is unchanged in both binds', () => {
  const { definition } = assembleDefinitionSync(
    JSON.parse(JSON.stringify(hostDef2)),
    makeAddressResolver()
  );
  const homeZip = definition.binds.find(b => b.path === 'homeAddr.home_address.home_zip');
  assert.ok(homeZip, 'homeAddr.home_address.home_zip bind should exist');
  assert.equal(homeZip.constraint, addressLib.binds[0].constraint);

  const workZip = definition.binds.find(b => b.path === 'workAddr.work_address.work_zip');
  assert.ok(workZip, 'workAddr.work_address.work_zip bind should exist');
  assert.equal(workZip.constraint, addressLib.binds[0].constraint);
});

// ---------------------------------------------------------------------------
// Test 5.3 — Nested $ref with FEL (recursive resolution)
// ---------------------------------------------------------------------------

const defC = {
  $formspec: '1.0',
  url: 'https://example.org/c',
  version: '1.0.0',
  title: 'C',
  status: 'active',
  items: [
    {
      key: 'inner',
      type: 'group',
      label: 'Inner',
      children: [
        { key: 'value', type: 'field', label: 'Value', dataType: 'decimal' }
      ]
    }
  ],
  binds: [
    { path: 'inner.value', calculate: '$inner.value * 2' }
  ]
};

const defB = {
  $formspec: '1.0',
  url: 'https://example.org/b',
  version: '1.0.0',
  title: 'B',
  status: 'active',
  items: [
    {
      key: 'middle',
      type: 'group',
      label: 'Middle',
      $ref: 'https://example.org/c|1.0.0#inner',
      keyPrefix: 'c_'
    }
  ]
};

const defA = {
  $formspec: '1.0',
  url: 'https://example.org/a',
  version: '1.0.0',
  title: 'A',
  status: 'draft',
  items: [
    {
      key: 'outer',
      type: 'group',
      label: 'Outer',
      $ref: 'https://example.org/b|1.0.0',
      keyPrefix: 'b_'
    }
  ]
};

function makeNestedResolver() {
  const registry = {
    'https://example.org/b': defB,
    'https://example.org/c': defC
  };
  return (url) => {
    if (registry[url]) return registry[url];
    throw new Error('Unknown URL: ' + url);
  };
}

test('5.3 — nested $ref assembles without error', () => {
  assert.doesNotThrow(() => {
    assembleDefinitionSync(
      JSON.parse(JSON.stringify(defA)),
      makeNestedResolver()
    );
  });
});

test('5.3 — nested $ref produces binds in the assembled output', () => {
  const { definition } = assembleDefinitionSync(
    JSON.parse(JSON.stringify(defA)),
    makeNestedResolver()
  );
  assert.ok(definition.binds, 'assembled definition should have binds');
  assert.ok(definition.binds.length > 0, 'assembled definition should have at least one bind');
});

test('5.3 — nested $ref: FEL expression is rewritten through both levels of assembly', () => {
  const { definition } = assembleDefinitionSync(
    JSON.parse(JSON.stringify(defA)),
    makeNestedResolver()
  );
  // Assembly of defA imports defB (no fragment) with keyPrefix 'b_':
  //   defB.items[0] = { key: 'middle', $ref: defC#inner, keyPrefix: 'c_' }
  //   After prefixItems with 'b_': { key: 'b_middle', $ref: defC#inner, keyPrefix: 'c_' }
  //   resolveItemsSync then processes the $ref on b_middle:
  //     groupItem.key = 'b_middle', fragmentRootKey = 'inner', keyPrefix = 'c_'
  //     importedKeys from defC#inner = { 'inner', 'value' }
  //     bind path 'inner.value' -> prefixPath = 'c_inner.c_value'
  //     groupPath = 'outer.b_middle'
  //     final bind path: 'outer.b_middle.c_inner.c_value'
  //     FEL '$inner.value * 2':
  //       fragmentRootKey 'inner' -> hostGroupKey 'b_middle': '$b_middle.value * 2'
  //       'value' in importedKeys -> '$b_middle.c_value * 2'
  const bind = definition.binds.find(b => b.path === 'outer.b_middle.c_inner.c_value');
  assert.ok(bind, 'bind with path "outer.b_middle.c_inner.c_value" should exist after double rewrite');
  assert.equal(bind.calculate, '$b_middle.c_value * 2');
});
