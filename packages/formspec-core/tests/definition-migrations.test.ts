import { describe, it, expect } from 'vitest';
import { createRawProject } from '../src/index.js';

describe('definition.addMigration', () => {
  it('creates a migration descriptor keyed by fromVersion', () => {
    const project = createRawProject();

    project.dispatch({
      type: 'definition.addMigration',
      payload: { fromVersion: '0.1.0', description: 'Initial migration' },
    });

    const descriptor = project.definition.migrations!.from!['0.1.0'];
    expect(descriptor).toBeDefined();
    expect(descriptor.description).toBe('Initial migration');
    expect(descriptor.fieldMap).toEqual([]);
  });

  it('initialises migrations.from if absent', () => {
    const project = createRawProject();
    expect(project.definition.migrations).toBeUndefined();

    project.dispatch({
      type: 'definition.addMigration',
      payload: { fromVersion: '0.1.0' },
    });

    expect(project.definition.migrations!.from).toBeDefined();
    expect(Object.keys(project.definition.migrations!.from!)).toEqual(['0.1.0']);
  });
});

describe('definition.deleteMigration', () => {
  it('removes a migration by fromVersion key', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.addMigration', payload: { fromVersion: '0.1.0' } });
    project.dispatch({ type: 'definition.addMigration', payload: { fromVersion: '0.2.0' } });

    project.dispatch({ type: 'definition.deleteMigration', payload: { fromVersion: '0.1.0' } });

    expect(project.definition.migrations!.from!['0.1.0']).toBeUndefined();
    expect(project.definition.migrations!.from!['0.2.0']).toBeDefined();
  });

  it('is a no-op if migrations do not exist', () => {
    const project = createRawProject();
    expect(() => {
      project.dispatch({ type: 'definition.deleteMigration', payload: { fromVersion: '0.1.0' } });
    }).not.toThrow();
  });
});

describe('definition.setMigrationProperty', () => {
  it('updates a migration property', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.addMigration', payload: { fromVersion: '0.1.0' } });

    project.dispatch({
      type: 'definition.setMigrationProperty',
      payload: { fromVersion: '0.1.0', property: 'description', value: 'Updated desc' },
    });

    expect(project.definition.migrations!.from!['0.1.0'].description).toBe('Updated desc');
  });
});

describe('definition.addFieldMapRule', () => {
  it('appends a field map rule to a migration', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.addMigration', payload: { fromVersion: '0.1.0' } });

    project.dispatch({
      type: 'definition.addFieldMapRule',
      payload: {
        fromVersion: '0.1.0',
        source: 'old_name',
        target: 'new_name',
        transform: 'preserve',
      },
    });

    const fieldMap = project.definition.migrations!.from!['0.1.0'].fieldMap!;
    expect(fieldMap).toHaveLength(1);
    expect(fieldMap[0].source).toBe('old_name');
    expect(fieldMap[0].target).toBe('new_name');
    expect(fieldMap[0].transform).toBe('preserve');
  });

  it('inserts at a specific index', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.addMigration', payload: { fromVersion: '0.1.0' } });
    project.dispatch({
      type: 'definition.addFieldMapRule',
      payload: { fromVersion: '0.1.0', source: 'a', target: 'a', transform: 'preserve' },
    });
    project.dispatch({
      type: 'definition.addFieldMapRule',
      payload: { fromVersion: '0.1.0', source: 'c', target: 'c', transform: 'preserve' },
    });

    project.dispatch({
      type: 'definition.addFieldMapRule',
      payload: { fromVersion: '0.1.0', source: 'b', target: 'b', transform: 'preserve', insertIndex: 1 },
    });

    expect(project.definition.migrations!.from!['0.1.0'].fieldMap![1].source).toBe('b');
  });
});

describe('definition.setFieldMapRule', () => {
  it('updates a field map rule property', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.addMigration', payload: { fromVersion: '0.1.0' } });
    project.dispatch({
      type: 'definition.addFieldMapRule',
      payload: { fromVersion: '0.1.0', source: 'a', target: 'a', transform: 'preserve' },
    });

    project.dispatch({
      type: 'definition.setFieldMapRule',
      payload: { fromVersion: '0.1.0', index: 0, property: 'transform', value: 'drop' },
    });

    expect(project.definition.migrations!.from!['0.1.0'].fieldMap![0].transform).toBe('drop');
  });
});

describe('definition.deleteFieldMapRule', () => {
  it('removes a field map rule by index', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.addMigration', payload: { fromVersion: '0.1.0' } });
    project.dispatch({
      type: 'definition.addFieldMapRule',
      payload: { fromVersion: '0.1.0', source: 'a', target: 'a', transform: 'preserve' },
    });
    project.dispatch({
      type: 'definition.addFieldMapRule',
      payload: { fromVersion: '0.1.0', source: 'b', target: 'b', transform: 'preserve' },
    });

    project.dispatch({
      type: 'definition.deleteFieldMapRule',
      payload: { fromVersion: '0.1.0', index: 0 },
    });

    const fieldMap = project.definition.migrations!.from!['0.1.0'].fieldMap!;
    expect(fieldMap).toHaveLength(1);
    expect(fieldMap[0].source).toBe('b');
  });
});

describe('definition.setMigrationDefaults', () => {
  it('sets default values for new fields', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.addMigration', payload: { fromVersion: '0.1.0' } });

    project.dispatch({
      type: 'definition.setMigrationDefaults',
      payload: { fromVersion: '0.1.0', defaults: { 'new_field': 'default_value' } },
    });

    expect((project.definition.migrations!.from!['0.1.0'] as any).defaults).toEqual({ new_field: 'default_value' });
  });
});
