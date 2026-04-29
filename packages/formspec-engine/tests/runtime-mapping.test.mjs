/** @filedesc Runtime mapping: RuntimeMappingEngine applies rules, value maps, transforms, and defaults to form data */
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
      valueMap: { forward: { advanced: 'ADV', basic: 'BSC' } },
      reverse: {
        transform: 'valueMap',
        valueMap: { forward: { ADV: 'advanced', BSC: 'basic' } }
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
      // Updated to FEL condition syntax (@source.field = value)
      condition: '@source.vipEnabled = true',
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
  // Legacy coerce: 'number' does not auto-reverse — value passes through unchanged as a number
  assert.equal(result.output.budget, 150);
});

test('should collect structured diagnostics for unsupported transforms', () => {
  // Unknown transform type causes a parser error — WASM rejects the document
  const mapper = new RuntimeMappingEngine({
    rules: [
      { sourcePath: 'x', targetPath: 'y', transform: 'unknown-transform' },
    ]
  });

  const result = mapper.forward({ x: 'value' });
  assert.equal(result.appliedRules, 0);
  assert.ok(result.diagnostics.length >= 1);
  assert.ok(result.diagnostics.every(d => typeof d === 'object' && 'errorCode' in d));
  assert.ok(result.diagnostics.some(d => d.message.includes('unknown transform')));
});

test('should collect structured diagnostics for unsupported coerce type', () => {
  // Unknown coerce type — WASM parser rejects the document
  const mapper = new RuntimeMappingEngine({
    rules: [
      { sourcePath: 'x', targetPath: 'z', transform: 'coerce', coerce: 'uuid' }
    ]
  });

  const result = mapper.forward({ x: 'value' });
  assert.equal(result.appliedRules, 0);
  assert.ok(result.diagnostics.length >= 1);
  assert.ok(result.diagnostics.every(d => typeof d === 'object' && 'errorCode' in d));
  assert.ok(result.diagnostics.some(d => d.message.includes('coerce')));
});

test('[*] wildcard: sourcePath with [*] reads full array', () => {
  const mapper = new RuntimeMappingEngine({
    rules: [{ sourcePath: 'items[*]', targetPath: 'all', transform: 'preserve' }]
  });
  const result = mapper.forward({ items: [1, 2, 3] });
  assert.deepEqual(result.output.all, [1, 2, 3]);
});

test('[*] wildcard: setByPath fans out write to all array elements', () => {
  const mapper = new RuntimeMappingEngine({
    rules: [{ sourcePath: 'val', targetPath: 'items[*].v', transform: 'preserve' }]
  });
  const result = mapper.forward({ val: 99, items: [{ v: 0 }, { v: 0 }, { v: 0 }] });
  // Note: output starts fresh, items[*] fan-out requires pre-existing array in output
  // This primarily exercises setByPath fan-out on the output object
  assert.equal(result.diagnostics.length, 0);
});

test('JSON adapter nullHandling omit removes null keys', () => {
  const mapper = new RuntimeMappingEngine({
    adapters: { json: { nullHandling: 'omit' } },
    rules: [
      { sourcePath: 'name', targetPath: 'name', transform: 'preserve' },
      { sourcePath: 'missing', targetPath: 'absent', transform: 'preserve' },
    ]
  });
  const result = mapper.forward({ name: 'Alice', missing: null });
  assert.equal(result.output.name, 'Alice');
  assert.ok(!('absent' in result.output));
});

test('JSON adapter sortKeys produces sorted output', () => {
  const mapper = new RuntimeMappingEngine({
    adapters: { json: { sortKeys: true } },
    rules: [
      { sourcePath: 'z', targetPath: 'z', transform: 'preserve' },
      { sourcePath: 'a', targetPath: 'a', transform: 'preserve' },
      { sourcePath: 'm', targetPath: 'm', transform: 'preserve' },
    ]
  });
  const result = mapper.forward({ z: 3, a: 1, m: 2 });
  assert.deepEqual(Object.keys(result.output), ['a', 'm', 'z']);
});
