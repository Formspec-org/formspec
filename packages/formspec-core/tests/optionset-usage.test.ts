/** @filedesc Tests for optionset-usage query module. */
import { describe, it, expect } from 'vitest';
import { optionSetUsageCount } from '../src/queries/optionset-usage.js';
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

describe('optionSetUsageCount', () => {
  it('returns 0 for empty definition', () => {
    const state = makeState();
    expect(optionSetUsageCount(state, 'colors')).toBe(0);
  });

  it('counts fields referencing the named option set', () => {
    const state = makeState({
      definition: {
        items: [
          { key: 'fav', type: 'field', dataType: 'choice', optionSet: 'colors' },
          { key: 'alt', type: 'field', dataType: 'choice', optionSet: 'colors' },
          { key: 'other', type: 'field', dataType: 'string' },
        ],
      },
    });

    expect(optionSetUsageCount(state, 'colors')).toBe(2);
  });

  it('returns 0 when no fields reference the set', () => {
    const state = makeState({
      definition: {
        items: [
          { key: 'f1', type: 'field', dataType: 'choice', optionSet: 'sizes' },
        ],
      },
    });

    expect(optionSetUsageCount(state, 'colors')).toBe(0);
  });

  it('counts nested fields', () => {
    const state = makeState({
      definition: {
        items: [
          {
            key: 'g', type: 'group',
            children: [
              { key: 'inner', type: 'field', optionSet: 'countries' },
            ],
          },
          { key: 'outer', type: 'field', optionSet: 'countries' },
        ],
      },
    });

    expect(optionSetUsageCount(state, 'countries')).toBe(2);
  });
});
