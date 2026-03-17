/** @filedesc Definition assembly: group references are inlined with prefixed keys and rewritten binds */
import test from 'node:test';
import assert from 'node:assert/strict';
import { FormEngine, assembleDefinitionSync } from '../dist/index.js';

test('should assemble referenced group definitions with prefixed keys when keyPrefix is provided', () => {
  const commonDef = {
    $formspec: '1.0',
    url: 'https://example.org/common/address',
    version: '1.0.0',
    title: 'Address',
    items: [
      { key: 'street', type: 'field', dataType: 'string', label: 'Street' },
      { key: 'city', type: 'field', dataType: 'string', label: 'City' },
      { key: 'zip', type: 'field', dataType: 'string', label: 'ZIP' }
    ],
    binds: [{ path: 'zip', required: true }]
  };

  const hostDef = {
    $formspec: '1.0',
    url: 'https://example.org/forms/registration',
    version: '1.0.0',
    title: 'Registration',
    items: [
      { key: 'name', type: 'field', dataType: 'string', label: 'Name' },
      {
        key: 'homeAddress',
        type: 'group',
        label: 'Home Address',
        $ref: 'https://example.org/common/address|1.0.0',
        keyPrefix: 'home_'
      },
      {
        key: 'workAddress',
        type: 'group',
        label: 'Work Address',
        $ref: 'https://example.org/common/address|1.0.0',
        keyPrefix: 'work_'
      }
    ]
  };

  const registry = {
    'https://example.org/common/address': commonDef
  };

  const resolver = (url) => {
    const def = registry[url];
    if (!def) throw new Error(`Unknown definition: ${url}`);
    return def;
  };

  const { definition, assembledFrom } = assembleDefinitionSync(hostDef, resolver);
  const engine = new FormEngine(definition);

  assert.equal(definition.items.length, 3);
  assert.deepEqual(definition.items[1].children.map((child) => child.key), ['home_street', 'home_city', 'home_zip']);
  assert.deepEqual(definition.items[2].children.map((child) => child.key), ['work_street', 'work_city', 'work_zip']);
  assert.equal(definition.binds.length, 2);
  assert.ok(definition.binds.some((bind) => bind.path === 'homeAddress.home_zip'));
  assert.ok(definition.binds.some((bind) => bind.path === 'workAddress.work_zip'));
  assert.equal(assembledFrom.length, 2);
  assert.ok(engine.signals['homeAddress.home_zip']);
  assert.ok(engine.signals['workAddress.work_zip']);
  assert.equal(engine.requiredSignals['homeAddress.home_zip'].value, true);
  assert.equal(engine.requiredSignals['workAddress.work_zip'].value, true);
});

test('should import only the selected fragment when ref includes an item selector', () => {
  const commonDef = {
    $formspec: '1.0',
    url: 'https://example.org/common/fields',
    version: '1.0.0',
    title: 'Common Fields',
    items: [
      { key: 'email', type: 'field', dataType: 'string', label: 'Email' },
      { key: 'phone', type: 'field', dataType: 'string', label: 'Phone' },
      { key: 'fax', type: 'field', dataType: 'string', label: 'Fax' }
    ],
    binds: [
      { path: 'email', required: true },
      { path: 'phone', required: true }
    ]
  };

  const hostDef = {
    $formspec: '1.0',
    url: 'https://example.org/forms/contact',
    version: '1.0.0',
    title: 'Contact',
    items: [
      {
        key: 'contactInfo',
        type: 'group',
        label: 'Contact Info',
        $ref: 'https://example.org/common/fields|1.0.0#email'
      }
    ]
  };

  const { definition } = assembleDefinitionSync(hostDef, (url) => {
    if (url === 'https://example.org/common/fields') return commonDef;
    throw new Error(`Unknown: ${url}`);
  });

  assert.deepEqual(definition.items[0].children.map((child) => child.key), ['email']);
  assert.deepEqual(definition.binds.map((bind) => bind.path), ['contactInfo.email']);
});

test('should throw an assembly error when definitions contain a circular $ref chain', () => {
  const defA = {
    $formspec: '1.0',
    url: 'https://example.org/a',
    version: '1.0.0',
    title: 'A',
    items: [
      {
        key: 'refB',
        type: 'group',
        label: 'B Ref',
        $ref: 'https://example.org/b|1.0.0'
      }
    ]
  };

  const defB = {
    $formspec: '1.0',
    url: 'https://example.org/b',
    version: '1.0.0',
    title: 'B',
    items: [
      {
        key: 'refA',
        type: 'group',
        label: 'A Ref',
        $ref: 'https://example.org/a|1.0.0'
      }
    ]
  };

  const registry = {
    'https://example.org/a': defA,
    'https://example.org/b': defB
  };

  assert.throws(
    () => assembleDefinitionSync(defA, (url) => registry[url]),
    /Circular \$ref detected/
  );
});

test('should throw an assembly error when prefixed keys collide with existing keys', () => {
  const commonDef = {
    $formspec: '1.0',
    url: 'https://example.org/common',
    version: '1.0.0',
    title: 'Common',
    items: [{ key: 'name', type: 'field', dataType: 'string', label: 'Name' }]
  };

  const hostDef = {
    $formspec: '1.0',
    url: 'https://example.org/host',
    version: '1.0.0',
    title: 'Host',
    items: [
      {
        key: 'myGroup',
        type: 'group',
        label: 'My Group',
        children: [{ key: 'name', type: 'field', dataType: 'string', label: 'Existing Name' }]
      },
      {
        key: 'myGroup',
        type: 'group',
        label: 'Imported Group',
        $ref: 'https://example.org/common|1.0.0'
      }
    ]
  };

  assert.throws(
    () => assembleDefinitionSync(hostDef, () => commonDef),
    /collision/i
  );
});
