/** @filedesc assembleDefinition with async resolver: referenced groups are resolved asynchronously */
import test from 'node:test';
import assert from 'node:assert/strict';
import { assembleDefinition, FormEngine } from '../dist/index.js';

test('should assemble referenced groups when resolver is asynchronous', async () => {
  const addressDef = {
    $formspec: '1.0',
    url: 'https://example.org/common/address',
    version: '1.0.0',
    title: 'Address',
    items: [
      { key: 'street', type: 'field', dataType: 'string', label: 'Street' },
      { key: 'zip', type: 'field', dataType: 'string', label: 'ZIP' }
    ],
    binds: [{ path: 'zip', required: true }]
  };

  const hostDef = {
    $formspec: '1.0',
    url: 'https://example.org/forms/profile',
    version: '1.0.0',
    title: 'Profile',
    items: [
      {
        key: 'home',
        type: 'group',
        label: 'Home',
        $ref: 'https://example.org/common/address|1.0.0',
        keyPrefix: 'home_'
      }
    ]
  };

  const { definition, assembledFrom } = await assembleDefinition(hostDef, async (url) => {
    if (url === 'https://example.org/common/address') return addressDef;
    throw new Error(`Unknown definition: ${url}`);
  });

  assert.equal(definition.items.length, 1);
  assert.deepEqual(definition.items[0].children.map((child) => child.key), ['home_street', 'home_zip']);
  assert.deepEqual(definition.binds.map((bind) => bind.path), ['home.home_zip']);
  assert.equal(assembledFrom.length, 1);

  const engine = new FormEngine(definition);
  assert.equal(engine.requiredSignals['home.home_zip'].value, true);
});

test('should reject async assembly when resolver cannot load a referenced definition', async () => {
  const hostDef = {
    $formspec: '1.0',
    url: 'https://example.org/forms/missing',
    version: '1.0.0',
    title: 'Missing Ref',
    items: [
      {
        key: 'external',
        type: 'group',
        label: 'External',
        $ref: 'https://example.org/common/missing|1.0.0'
      }
    ]
  };

  await assert.rejects(
    () =>
      assembleDefinition(hostDef, async () => {
        throw new Error('Unknown definition');
      }),
    /Unknown definition/
  );
});
