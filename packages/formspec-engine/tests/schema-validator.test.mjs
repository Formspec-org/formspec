/** @filedesc Schema validator: createSchemaValidator detects unknown document types and validates against JSON schemas */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSchemaValidator } from '../dist/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const schemasDir = path.join(repoRoot, 'schemas');

function loadSchema(name) {
  const p = path.join(schemasDir, `${name}.schema.json`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

test('detects unknown document type and returns E100-style error', () => {
  const validator = createSchemaValidator({});
  const result = validator.validate({ foo: 1 });
  assert.equal(result.documentType, null);
  assert.equal(result.errors.length, 1);
  assert.ok(result.errors[0].message.includes('detect'));
  assert.equal(result.errors[0].path, '$');
});

test('definition: valid minimal definition passes', () => {
  const defSchema = loadSchema('definition');
  const validator = createSchemaValidator({ definition: defSchema });
  const doc = {
    $formspec: '1.0',
    url: 'https://example.com/form',
    version: '1.0.0',
    status: 'draft',
    title: 'Test',
    items: [{ key: 'x', type: 'field', label: 'X', dataType: 'string' }],
  };
  const result = validator.validate(doc);
  assert.equal(result.documentType, 'definition');
  assert.equal(result.errors.length, 0);
});

test('definition: invalid document returns schema errors', () => {
  const defSchema = loadSchema('definition');
  const validator = createSchemaValidator({ definition: defSchema });
  const result = validator.validate({ $formspec: '1.0' });
  assert.equal(result.documentType, 'definition');
  assert.ok(result.errors.length > 0);
  assert.ok(result.errors.some((e) => e.path === '$' || e.message.includes('required')));
});

test('component: valid minimal component document passes', () => {
  const compSchema = loadSchema('component');
  const validator = createSchemaValidator({ component: compSchema });
  const doc = {
    $formspecComponent: '1.0',
    version: '1.0.0',
    targetDefinition: { url: 'https://example.com/def' },
    tree: { component: 'Stack', children: [{ component: 'TextInput', bind: 'name' }] },
  };
  const result = validator.validate(doc);
  assert.equal(result.documentType, 'component');
  assert.equal(result.errors.length, 0);
});

test('component: invalid node produces per-node error with path', () => {
  const compSchema = loadSchema('component');
  const validator = createSchemaValidator({ component: compSchema });
  const doc = {
    $formspecComponent: '1.0',
    version: '1.0.0',
    targetDefinition: { url: 'https://example.com/def' },
    tree: {
      component: 'Stack',
      children: [
        { component: 'TextInput', bind: 'name' },
        { component: 'TextInput', bind: 123 }, // bind must be string
      ],
    },
  };
  const result = validator.validate(doc);
  assert.equal(result.documentType, 'component');
  assert.ok(result.errors.length > 0);
  const bindError = result.errors.find((e) => e.message.includes('string') || e.path.includes('children'));
  assert.ok(bindError, 'expected an error on the invalid bind');
});

test('component: shallow + per-node completes quickly on large tree (no hang)', () => {
  const compSchema = loadSchema('component');
  const validator = createSchemaValidator({ component: compSchema });
  const children = [];
  for (let i = 0; i < 200; i++) {
    children.push({ component: 'TextInput', bind: `field_${i}` });
  }
  const doc = {
    $formspecComponent: '1.0',
    version: '1.0.0',
    targetDefinition: { url: 'https://example.com/def' },
    tree: { component: 'Stack', children },
  };
  const start = Date.now();
  const result = validator.validate(doc);
  const elapsed = Date.now() - start;
  assert.equal(result.documentType, 'component');
  assert.equal(result.errors.length, 0);
  assert.ok(elapsed < 5000, `validation should complete in under 5s (took ${elapsed}ms)`);
});

test('component: custom component template tree is validated', () => {
  const compSchema = loadSchema('component');
  const validator = createSchemaValidator({ component: compSchema });
  const doc = {
    $formspecComponent: '1.0',
    version: '1.0.0',
    targetDefinition: { url: 'https://example.com/def' },
    tree: { component: 'Page', title: 'Root', children: [] },
    components: {
      BadCustom: {
        tree: { component: 'TextInput', bind: 999 },
      },
    },
  };
  const result = validator.validate(doc);
  assert.equal(result.documentType, 'component');
  assert.ok(result.errors.length > 0);
  assert.ok(
    result.errors.some((e) => e.path.includes('components') && e.path.includes('BadCustom')),
    'expected error under components.BadCustom'
  );
});

test('explicit documentType is used when provided', () => {
  const defSchema = loadSchema('definition');
  const validator = createSchemaValidator({ definition: defSchema });
  const doc = { $formspec: '1.0', url: 'https://x.com', version: '1.0', status: 'draft', title: 'T', items: [] };
  const result = validator.validate(doc, 'definition');
  assert.equal(result.documentType, 'definition');
  assert.equal(result.errors.length, 0);
});

test('component: circular tree reference does not hang', () => {
  const compSchema = loadSchema('component');
  const validator = createSchemaValidator({ component: compSchema });
  // Build a component tree with a circular reference
  const child = { component: 'Stack', children: [] };
  const parent = { component: 'Card', children: [child] };
  child.children.push(parent); // cycle: child -> parent -> child -> ...
  const doc = {
    $formspecComponent: '1.0',
    version: '1.0.0',
    targetDefinition: { url: 'https://example.com/def' },
    tree: parent,
  };
  const start = Date.now();
  const result = validator.validate(doc);
  const elapsed = Date.now() - start;
  assert.ok(elapsed < 2000, `should complete quickly even with cycles (took ${elapsed}ms)`);
  assert.equal(result.documentType, 'component');
});
