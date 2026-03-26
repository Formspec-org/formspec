/** @filedesc Tests for search-index query module. */
import { describe, it, expect } from 'vitest';
import { buildSearchIndex } from '../src/queries/search-index.js';
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
    generatedComponent: { 'x-studio-generated': true } as any,
    mappings: {},
    extensions: { registries: [] },
    versioning: { baseline: {} as any, releases: [] },
  };
}

describe('buildSearchIndex', () => {
  it('returns empty array for empty definition', () => {
    const state = makeState();
    expect(buildSearchIndex(state)).toEqual([]);
  });

  it('indexes root-level items', () => {
    const state = makeState({
      definition: {
        items: [
          { key: 'name', type: 'field', label: 'Full Name', dataType: 'string' },
          { key: 'age', type: 'field', label: 'Age', dataType: 'integer' },
        ],
      },
    });

    const index = buildSearchIndex(state);
    expect(index).toHaveLength(2);
    expect(index[0]).toMatchObject({
      key: 'name',
      path: 'name',
      label: 'Full Name',
      type: 'field',
      dataType: 'string',
    });
    expect(index[1]).toMatchObject({
      key: 'age',
      path: 'age',
      label: 'Age',
      type: 'field',
      dataType: 'integer',
    });
  });

  it('indexes nested items with full paths', () => {
    const state = makeState({
      definition: {
        items: [
          {
            key: 'contact', type: 'group', label: 'Contact Info',
            children: [
              { key: 'email', type: 'field', label: 'Email', dataType: 'string' },
            ],
          },
        ],
      },
    });

    const index = buildSearchIndex(state);
    expect(index).toHaveLength(2);
    expect(index[0]).toMatchObject({ key: 'contact', path: 'contact', type: 'group' });
    expect(index[1]).toMatchObject({ key: 'email', path: 'contact.email', type: 'field' });
  });

  it('uses key as label fallback', () => {
    const state = makeState({
      definition: {
        items: [
          { key: 'unlabeled', type: 'field' },
        ],
      },
    });

    const index = buildSearchIndex(state);
    expect(index[0].label).toBe('unlabeled');
  });

  it('includes display items', () => {
    const state = makeState({
      definition: {
        items: [
          { key: 'heading', type: 'display', label: 'Welcome' },
        ],
      },
    });

    const index = buildSearchIndex(state);
    expect(index).toHaveLength(1);
    expect(index[0].type).toBe('display');
  });

  it('handles dataType being undefined for groups', () => {
    const state = makeState({
      definition: {
        items: [
          { key: 'g', type: 'group', label: 'Group' },
        ],
      },
    });

    const index = buildSearchIndex(state);
    expect(index[0].dataType).toBeUndefined();
  });
});
