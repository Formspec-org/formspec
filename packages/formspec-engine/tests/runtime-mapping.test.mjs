import test from 'node:test';
import assert from 'node:assert/strict';
import { RuntimeMappingEngine } from '../dist/index.js';

const mappingDocument = {
  defaults: {
    'meta.source': 'formspec'
  },
  rules: [
    {
      sourcePath: 'fullName',
      targetPath: 'subject.name',
      transform: 'preserve',
      priority: 20
    },
    {
      sourcePath: 'profileMode',
      targetPath: 'subject.mode',
      transform: 'valueMap',
      valueMap: { advanced: 'ADV', basic: 'BSC' },
      reverse: {
        transform: 'valueMap',
        valueMap: { ADV: 'advanced', BSC: 'basic' }
      },
      priority: 15,
      reversePriority: 15
    },
    {
      sourcePath: 'budget',
      targetPath: 'finance.budget',
      transform: 'coerce',
      coerce: 'number',
      priority: 10
    },
    {
      targetPath: 'meta.version',
      transform: 'constant',
      expression: '"1"',
      priority: 10
    },
    {
      sourcePath: 'vipCode',
      targetPath: 'subject.vip',
      transform: 'preserve',
      condition: 'source.vipEnabled = true',
      priority: 5
    },
    {
      sourcePath: 'hiddenMirror',
      targetPath: null,
      transform: 'drop',
      priority: 1
    }
  ]
};

test('should map forward with defaults transforms and conditions', () => {
  const mapper = new RuntimeMappingEngine(mappingDocument);
  const result = mapper.forward({
    fullName: 'Alice',
    profileMode: 'advanced',
    budget: '99.5',
    vipEnabled: true,
    vipCode: 'VIP-1',
    hiddenMirror: 'drop-me'
  });

  assert.equal(result.direction, 'forward');
  assert.equal(result.appliedRules, 5);
  assert.equal(result.output.subject.name, 'Alice');
  assert.equal(result.output.subject.mode, 'ADV');
  assert.equal(result.output.subject.vip, 'VIP-1');
  assert.equal(result.output.finance.budget, 99.5);
  assert.equal(result.output.meta.source, 'formspec');
  assert.equal(result.output.meta.version, '1');
  assert.equal(result.diagnostics.length, 0);
});

test('should map reverse with reverse overrides', () => {
  const mapper = new RuntimeMappingEngine(mappingDocument);
  const result = mapper.reverse({
    subject: { name: 'Bob', mode: 'BSC', vip: 'VIP-2' },
    finance: { budget: 150 }
  });

  assert.equal(result.direction, 'reverse');
  assert.equal(result.output.fullName, 'Bob');
  assert.equal(result.output.profileMode, 'basic');
  assert.equal(result.output.budget, 150);
});

test('should collect diagnostics for unsupported transforms/coercions', () => {
  const mapper = new RuntimeMappingEngine({
    rules: [
      { sourcePath: 'x', targetPath: 'y', transform: 'unknown-transform' },
      { sourcePath: 'x', targetPath: 'z', transform: 'coerce', coerce: 'uuid' }
    ]
  });

  const result = mapper.forward({ x: 'value' });

  assert.equal(result.appliedRules, 1);
  assert.equal(result.output.z, 'value');
  assert.equal(result.diagnostics.length, 2);
  assert.ok(result.diagnostics.some((d) => d.includes('Unsupported transform')));
  assert.ok(result.diagnostics.some((d) => d.includes('Unsupported coerce type')));
});
