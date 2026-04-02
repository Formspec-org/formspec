/** @filedesc Tests for tree-flattening query module. */
import { describe, it, expect } from 'vitest';
import { flattenDefinitionTree } from '../src/queries/tree-flattening.js';
import type { ProjectState } from '../src/types.js';

/** Minimal state factory. */
function makeState(overrides: {
  definition?: Record<string, unknown>;
} = {}): ProjectState {
  return {
    definition: {
      $formspec: '1.0', url: 'urn:test', version: '1.0.0', title: 'Test',
      items: [],
      ...overrides.definition,
    } as any,
    theme: {} as any,
    component: {} as any,
    mappings: {},
    extensions: { registries: [] },
    versioning: { baseline: {} as any, releases: [] },
  };
}

describe('flattenDefinitionTree', () => {
  it('returns empty array for empty definition', () => {
    const state = makeState();
    expect(flattenDefinitionTree(state)).toEqual([]);
  });

  it('flattens root-level fields', () => {
    const state = makeState({
      definition: {
        items: [
          { key: 'name', type: 'field', label: 'Full Name' },
          { key: 'email', type: 'field', label: 'Email' },
        ],
      },
    });

    const flat = flattenDefinitionTree(state);
    expect(flat).toHaveLength(2);
    expect(flat[0]).toMatchObject({
      path: 'name',
      depth: 0,
      type: 'field',
      label: 'Full Name',
      parentPath: undefined,
    });
    expect(flat[1]).toMatchObject({
      path: 'email',
      depth: 0,
      type: 'field',
      label: 'Email',
      parentPath: undefined,
    });
  });

  it('flattens nested groups depth-first', () => {
    const state = makeState({
      definition: {
        items: [
          {
            key: 'contact', type: 'group', label: 'Contact',
            children: [
              { key: 'phone', type: 'field', label: 'Phone' },
              { key: 'email', type: 'field', label: 'Email' },
            ],
          },
          { key: 'notes', type: 'field', label: 'Notes' },
        ],
      },
    });

    const flat = flattenDefinitionTree(state);
    expect(flat).toHaveLength(4);
    expect(flat[0]).toMatchObject({ path: 'contact', depth: 0, type: 'group', parentPath: undefined });
    expect(flat[1]).toMatchObject({ path: 'contact.phone', depth: 1, type: 'field', parentPath: 'contact' });
    expect(flat[2]).toMatchObject({ path: 'contact.email', depth: 1, type: 'field', parentPath: 'contact' });
    expect(flat[3]).toMatchObject({ path: 'notes', depth: 0, type: 'field', parentPath: undefined });
  });

  it('handles deeply nested groups', () => {
    const state = makeState({
      definition: {
        items: [
          {
            key: 'a', type: 'group', label: 'A',
            children: [
              {
                key: 'b', type: 'group', label: 'B',
                children: [
                  { key: 'c', type: 'field', label: 'C' },
                ],
              },
            ],
          },
        ],
      },
    });

    const flat = flattenDefinitionTree(state);
    expect(flat).toHaveLength(3);
    expect(flat[0]).toMatchObject({ path: 'a', depth: 0 });
    expect(flat[1]).toMatchObject({ path: 'a.b', depth: 1 });
    expect(flat[2]).toMatchObject({ path: 'a.b.c', depth: 2, parentPath: 'a.b' });
  });

  it('includes display items', () => {
    const state = makeState({
      definition: {
        items: [
          { key: 'heading1', type: 'display', label: 'Welcome' },
          { key: 'name', type: 'field', label: 'Name' },
        ],
      },
    });

    const flat = flattenDefinitionTree(state);
    expect(flat).toHaveLength(2);
    expect(flat[0]).toMatchObject({ type: 'display', label: 'Welcome' });
  });

  it('uses key as label fallback when label is missing', () => {
    const state = makeState({
      definition: {
        items: [
          { key: 'age', type: 'field' },
        ],
      },
    });

    const flat = flattenDefinitionTree(state);
    expect(flat[0].label).toBe('age');
  });
});
