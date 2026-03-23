import { describe, it, expect } from 'vitest';
import { createRawProject } from '../src/index.js';

describe('project.import', () => {
  it('replaces the entire project state', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.setFormTitle', payload: { title: 'Before' } });

    project.dispatch({
      type: 'project.import',
      payload: {
        definition: {
          $formspec: '1.0',
          url: 'urn:formspec:imported',
          version: '1.0.0',
          title: 'Imported',
          items: [],
        },
      },
    });

    expect(project.definition.title).toBe('Imported');
    expect(project.definition.url).toBe('urn:formspec:imported');
    expect(project.canUndo).toBe(true);
  });

  it('keeps valid pages when only some have stale regions', () => {
    const project = createRawProject();
    project.dispatch({
      type: 'project.import',
      payload: {
        definition: {
          $formspec: '1.0', url: 'urn:test', version: '1.0.0', title: 'Test',
          items: [
            { key: 'name', type: 'text' },
            { key: 'age', type: 'number' },
            { key: 'deleted_field', type: 'text' },
          ],
        },
        theme: {
          pages: [
            { title: 'Valid', regions: [{ key: 'name' }, { key: 'age' }] },
            { title: 'Stale', regions: [{ key: 'deleted_field' }] },
          ],
        },
      },
    });
    project.dispatch({
      type: 'project.import',
      payload: {
        definition: {
          $formspec: '1.0', url: 'urn:test', version: '2.0.0', title: 'Updated',
          items: [
            { key: 'name', type: 'text' },
            { key: 'age', type: 'number' },
          ],
        },
      },
    });
    const pages = (project.state.theme as any).pages;
    expect(pages).toHaveLength(1);
    expect(pages[0].title).toBe('Valid');
  });

  it('drops all pages when all have stale regions', () => {
    const project = createRawProject();
    project.dispatch({
      type: 'project.import',
      payload: {
        definition: {
          $formspec: '1.0', url: 'urn:test', version: '1.0.0', title: 'Test',
          items: [{ key: 'old_field', type: 'text' }],
        },
        theme: {
          pages: [{ title: 'Page1', regions: [{ key: 'old_field' }] }],
        },
      },
    });
    project.dispatch({
      type: 'project.import',
      payload: {
        definition: {
          $formspec: '1.0', url: 'urn:test', version: '2.0.0', title: 'New',
          items: [{ key: 'new_field', type: 'text' }],
        },
      },
    });
    const pages = (project.state.theme as any).pages;
    expect(pages).toHaveLength(0);
  });
});

describe('project.importSubform', () => {
  it('merges a definition fragment as a nested group', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.addItem', payload: { type: 'group', key: 'address' } });

    project.dispatch({
      type: 'project.importSubform',
      payload: {
        definition: {
          $formspec: '1.0',
          url: 'urn:formspec:address-fragment',
          version: '0.1.0',
          title: 'Address',
          items: [
            { type: 'field', key: 'street', label: 'Street' },
            { type: 'field', key: 'city', label: 'City' },
          ],
        },
        targetGroupPath: 'address',
      },
    });

    const group = project.itemAt('address')!;
    expect(group.children).toHaveLength(2);
    expect(group.children![0].key).toBe('street');
    expect(group.children![1].key).toBe('city');
  });
});

describe('project.loadRegistry', () => {
  it('loads a registry and indexes entries', () => {
    const project = createRawProject();

    project.dispatch({
      type: 'project.loadRegistry',
      payload: {
        registry: {
          url: 'https://registry.example.com/common',
          entries: [
            { name: 'x-validation-pattern', category: 'constraint' },
            { name: 'x-mask', category: 'presentation' },
          ],
        },
      },
    });

    expect(project.state.extensions.registries).toHaveLength(1);
    expect(project.state.extensions.registries[0].url).toBe('https://registry.example.com/common');
    expect(Object.keys(project.state.extensions.registries[0].entries)).toHaveLength(2);
  });
});

describe('project.removeRegistry', () => {
  it('removes a registry by URL', () => {
    const project = createRawProject();
    project.dispatch({
      type: 'project.loadRegistry',
      payload: {
        registry: { url: 'https://example.com/reg', entries: [] },
      },
    });

    project.dispatch({
      type: 'project.removeRegistry',
      payload: { url: 'https://example.com/reg' },
    });

    expect(project.state.extensions.registries).toHaveLength(0);
  });
});

describe('project.publish', () => {
  it('creates a versioned release', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.setFormTitle', payload: { title: 'Published Form' } });

    project.dispatch({
      type: 'project.publish',
      payload: { version: '1.0.0', summary: 'First release' },
    });

    expect(project.state.versioning.releases).toHaveLength(1);
    expect(project.state.versioning.releases[0].version).toBe('1.0.0');
    expect(project.definition.version).toBe('1.0.0');
  });
});
