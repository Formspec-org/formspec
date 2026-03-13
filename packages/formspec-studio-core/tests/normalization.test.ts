import { describe, it, expect } from 'vitest';
import { createProject, normalizeDefinition } from '../src/index.js';

// ── normalizeDefinition ───────────────────────────────────────────────

describe('normalizeDefinition', () => {
  it('converts instances array form to object/map form', () => {
    const definition: any = {
      $formspec: '1.0',
      url: 'urn:test:form',
      version: '1.0.0',
      title: 'Test',
      items: [],
      instances: [
        { name: 'patient', source: 'https://api.example.com/patient' },
        { name: 'config', data: { threshold: 100 } },
      ],
    };

    const normalized = normalizeDefinition(definition);

    expect(Array.isArray(normalized.instances)).toBe(false);
    expect(normalized.instances).toMatchObject({
      patient: { source: 'https://api.example.com/patient' },
      config: { data: { threshold: 100 } },
    });
    // name property should not be in the resulting object values
    expect((normalized.instances as any).patient.name).toBeUndefined();
  });

  it('leaves instances already in object form unchanged', () => {
    const definition: any = {
      $formspec: '1.0',
      url: 'urn:test:form',
      version: '1.0.0',
      title: 'Test',
      items: [],
      instances: {
        patient: { source: 'https://api.example.com/patient' },
      },
    };

    const normalized = normalizeDefinition(definition);

    expect(normalized.instances).toEqual({
      patient: { source: 'https://api.example.com/patient' },
    });
  });

  it('converts object-form binds to array form', () => {
    const definition: any = {
      $formspec: '1.0',
      url: 'urn:test:form',
      version: '1.0.0',
      title: 'Test',
      items: [],
      binds: {
        'contact.email': { required: 'true()', constraint: 'matches($email, "@")' },
        'contact.phone': { relevant: '$includePhone' },
      },
    };

    const normalized = normalizeDefinition(definition);

    expect(Array.isArray(normalized.binds)).toBe(true);
    expect(normalized.binds).toHaveLength(2);

    const emailBind = normalized.binds!.find((b: any) => b.path === 'contact.email');
    expect(emailBind).toBeDefined();
    expect(emailBind).toMatchObject({
      path: 'contact.email',
      required: 'true()',
      constraint: 'matches($email, "@")',
    });

    const phoneBind = normalized.binds!.find((b: any) => b.path === 'contact.phone');
    expect(phoneBind).toBeDefined();
    expect(phoneBind).toMatchObject({
      path: 'contact.phone',
      relevant: '$includePhone',
    });
  });

  it('leaves binds already in array form unchanged', () => {
    const definition: any = {
      $formspec: '1.0',
      url: 'urn:test:form',
      version: '1.0.0',
      title: 'Test',
      items: [],
      binds: [
        { path: 'email', required: 'true()' },
        { path: 'phone', relevant: '$show' },
      ],
    };

    const normalized = normalizeDefinition(definition);

    expect(Array.isArray(normalized.binds)).toBe(true);
    expect(normalized.binds).toEqual([
      { path: 'email', required: 'true()' },
      { path: 'phone', relevant: '$show' },
    ]);
  });

  it('is idempotent — calling twice produces the same result', () => {
    const definition: any = {
      $formspec: '1.0',
      url: 'urn:test:form',
      version: '1.0.0',
      title: 'Test',
      items: [],
      instances: [
        { name: 'src', source: 'https://api.example.com' },
      ],
      binds: {
        field1: { required: 'true()' },
      },
    };

    const once = normalizeDefinition(definition);
    const twice = normalizeDefinition(once as any);

    expect(twice.instances).toEqual(once.instances);
    expect(twice.binds).toEqual(once.binds);
  });

  it('handles missing instances and binds gracefully', () => {
    const definition: any = {
      $formspec: '1.0',
      url: 'urn:test:form',
      version: '1.0.0',
      title: 'Test',
      items: [],
    };

    const normalized = normalizeDefinition(definition);
    expect(normalized.instances).toBeUndefined();
    expect(normalized.binds).toBeUndefined();
  });
});

// ── project.import normalization boundary ────────────────────────────

describe('project.import applies normalization', () => {
  it('normalizes array-form instances on import', () => {
    const project = createProject();

    project.dispatch({
      type: 'project.import',
      payload: {
        definition: {
          $formspec: '1.0',
          url: 'urn:test:imported',
          version: '1.0.0',
          title: 'Imported',
          items: [],
          instances: [
            { name: 'patient', source: 'https://api.example.com/patient' },
          ],
        },
      },
    });

    expect(Array.isArray(project.definition.instances)).toBe(false);
    expect((project.definition.instances as any)?.patient).toBeDefined();
  });

  it('normalizes object-form binds on import', () => {
    const project = createProject();

    project.dispatch({
      type: 'project.import',
      payload: {
        definition: {
          $formspec: '1.0',
          url: 'urn:test:imported',
          version: '1.0.0',
          title: 'Imported',
          items: [{ type: 'field', key: 'age', dataType: 'integer' }],
          binds: {
            age: { required: 'true()' },
          },
        },
      },
    });

    expect(Array.isArray(project.definition.binds)).toBe(true);
    expect(project.definition.binds![0]).toMatchObject({ path: 'age', required: 'true()' });
  });
});

// ── createProject seed normalization ────────────────────────────────

describe('createProject seed normalization', () => {
  it('normalizes array-form instances in seed', () => {
    const project = createProject({
      seed: {
        definition: {
          $formspec: '1.0',
          url: 'urn:test:seeded',
          version: '1.0.0',
          title: 'Seeded',
          items: [],
          instances: [
            { name: 'patient', source: 'https://api.example.com/patient' },
          ] as any,
        },
      },
    });

    expect(Array.isArray(project.definition.instances)).toBe(false);
    expect((project.definition.instances as any)?.patient).toBeDefined();
  });

  it('normalizes object-form binds in seed', () => {
    const project = createProject({
      seed: {
        definition: {
          $formspec: '1.0',
          url: 'urn:test:seeded',
          version: '1.0.0',
          title: 'Seeded',
          items: [{ type: 'field', key: 'age', dataType: 'integer' }],
          binds: {
            age: { required: 'true()' },
          } as any,
        },
      },
    });

    expect(Array.isArray(project.definition.binds)).toBe(true);
    expect(project.definition.binds![0]).toMatchObject({ path: 'age', required: 'true()' });
  });
});

// ── responseSchemaRows ───────────────────────────────────────────────

describe('Project.responseSchemaRows', () => {
  it('returns flat field rows with correct path, key, label, depth, and jsonType', () => {
    const project = createProject();
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'name', dataType: 'string' } });
    project.dispatch({ type: 'definition.setItemProperty', payload: { path: 'name', property: 'label', value: 'Full Name' } });
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'age', dataType: 'integer' } });
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'active', dataType: 'boolean' } });
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'score', dataType: 'decimal' } });

    const rows = project.responseSchemaRows();

    expect(rows).toHaveLength(4);

    const nameRow = rows.find(r => r.key === 'name');
    expect(nameRow).toMatchObject({ path: 'name', key: 'name', label: 'Full Name', depth: 0, jsonType: 'string' });

    const ageRow = rows.find(r => r.key === 'age');
    expect(ageRow).toMatchObject({ path: 'age', key: 'age', label: 'age', depth: 0, jsonType: 'number' });

    const activeRow = rows.find(r => r.key === 'active');
    expect(activeRow).toMatchObject({ path: 'active', key: 'active', depth: 0, jsonType: 'boolean' });

    const scoreRow = rows.find(r => r.key === 'score');
    expect(scoreRow).toMatchObject({ path: 'score', key: 'score', depth: 0, jsonType: 'number' });
  });

  it('returns nested group and child rows with correct depth and paths', () => {
    const project = createProject();
    project.dispatch({ type: 'definition.addItem', payload: { type: 'group', key: 'contact' } });
    project.dispatch({ type: 'definition.setItemProperty', payload: { path: 'contact', property: 'label', value: 'Contact Info' } });
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'email', dataType: 'string', parentPath: 'contact' } });
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'phone', dataType: 'string', parentPath: 'contact' } });

    const rows = project.responseSchemaRows();

    const groupRow = rows.find(r => r.key === 'contact');
    expect(groupRow).toMatchObject({ path: 'contact', key: 'contact', label: 'Contact Info', depth: 0, jsonType: 'object' });

    const emailRow = rows.find(r => r.key === 'email');
    expect(emailRow).toMatchObject({ path: 'contact.email', key: 'email', depth: 1, jsonType: 'string' });

    const phoneRow = rows.find(r => r.key === 'phone');
    expect(phoneRow).toMatchObject({ path: 'contact.phone', key: 'phone', depth: 1, jsonType: 'string' });
  });

  it('reports repeatable groups as array<object>', () => {
    const project = createProject();
    project.dispatch({ type: 'definition.addItem', payload: { type: 'group', key: 'items' } });
    project.dispatch({ type: 'definition.setItemProperty', payload: { path: 'items', property: 'repeatable', value: true } });
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'amount', dataType: 'decimal', parentPath: 'items' } });

    const rows = project.responseSchemaRows();

    const groupRow = rows.find(r => r.key === 'items');
    expect(groupRow).toMatchObject({ path: 'items', jsonType: 'array<object>' });

    const amountRow = rows.find(r => r.key === 'amount');
    expect(amountRow).toMatchObject({ path: 'items.amount', depth: 1, jsonType: 'number' });
  });

  it('shows required, calculated, and conditional flags from binds', () => {
    const project = createProject();
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'email' } });
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'score' } });
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'notes' } });
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'plain' } });

    project.dispatch({
      type: 'definition.setBind',
      payload: { path: 'email', properties: { required: 'true()' } },
    });
    project.dispatch({
      type: 'definition.setBind',
      payload: { path: 'score', properties: { calculate: '$a + $b' } },
    });
    project.dispatch({
      type: 'definition.setBind',
      payload: { path: 'notes', properties: { relevant: '$showNotes', readonly: 'true()' } },
    });

    const rows = project.responseSchemaRows();

    const emailRow = rows.find(r => r.key === 'email')!;
    expect(emailRow.required).toBe(true);
    expect(emailRow.calculated).toBe(false);
    expect(emailRow.conditional).toBe(false);

    const scoreRow = rows.find(r => r.key === 'score')!;
    expect(scoreRow.required).toBe(false);
    expect(scoreRow.calculated).toBe(true);
    expect(scoreRow.conditional).toBe(false);

    const notesRow = rows.find(r => r.key === 'notes')!;
    expect(notesRow.required).toBe(false);
    expect(notesRow.calculated).toBe(false);
    expect(notesRow.conditional).toBe(true);

    const plainRow = rows.find(r => r.key === 'plain')!;
    expect(plainRow.required).toBe(false);
    expect(plainRow.calculated).toBe(false);
    expect(plainRow.conditional).toBe(false);
  });

  it('uses key as label fallback when no label is set', () => {
    const project = createProject();
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'myField' } });

    const rows = project.responseSchemaRows();
    const row = rows.find(r => r.key === 'myField')!;
    expect(row.label).toBe('myField');
  });

  it('returns empty array for a definition with no items', () => {
    const project = createProject();
    const rows = project.responseSchemaRows();
    expect(rows).toEqual([]);
  });

  it('handles deeply nested groups with correct depth tracking', () => {
    const project = createProject();
    project.dispatch({ type: 'definition.addItem', payload: { type: 'group', key: 'level1' } });
    project.dispatch({ type: 'definition.addItem', payload: { type: 'group', key: 'level2', parentPath: 'level1' } });
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'deep', dataType: 'string', parentPath: 'level1.level2' } });

    const rows = project.responseSchemaRows();

    const l1 = rows.find(r => r.key === 'level1')!;
    expect(l1.depth).toBe(0);
    expect(l1.path).toBe('level1');

    const l2 = rows.find(r => r.key === 'level2')!;
    expect(l2.depth).toBe(1);
    expect(l2.path).toBe('level1.level2');

    const deep = rows.find(r => r.key === 'deep')!;
    expect(deep.depth).toBe(2);
    expect(deep.path).toBe('level1.level2.deep');
  });

  it('generates component tree on seed with items but no authored tree', () => {
    const project = createProject({
      seed: {
        definition: {
          $formspec: '1.0',
          url: 'urn:test:seeded',
          version: '1.0.0',
          title: 'Seeded',
          items: [
            { type: 'field', key: 'name', dataType: 'string', label: 'Full Name' },
            { type: 'field', key: 'age', dataType: 'integer', label: 'Age' },
          ],
        },
      },
    });

    // Seeded definitions without authored tree should auto-generate tree
    const rows = project.responseSchemaRows();
    expect(rows).toHaveLength(2);
    expect(rows[0].key).toBe('name');
    expect(rows[1].key).toBe('age');
  });
});

// ── responseSchemaRow type contract ─────────────────────────────────

describe('ResponseSchemaRow type shape', () => {
  it('each row has exactly the required fields', () => {
    const project = createProject();
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'f', dataType: 'string' } });
    project.dispatch({ type: 'definition.setItemProperty', payload: { path: 'f', property: 'label', value: 'F' } });

    const rows = project.responseSchemaRows();
    const row = rows[0];

    expect(typeof row.path).toBe('string');
    expect(typeof row.key).toBe('string');
    expect(typeof row.label).toBe('string');
    expect(typeof row.depth).toBe('number');
    expect(typeof row.jsonType).toBe('string');
    expect(typeof row.required).toBe('boolean');
    expect(typeof row.calculated).toBe('boolean');
    expect(typeof row.conditional).toBe('boolean');
  });
});
