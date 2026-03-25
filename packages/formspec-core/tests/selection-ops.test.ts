/** @filedesc Tests for selection-ops query module. */
import { describe, it, expect } from 'vitest';
import { commonAncestor, pathsOverlap, expandSelection } from '../src/queries/selection-ops.js';
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

describe('commonAncestor', () => {
  it('returns undefined for empty array', () => {
    expect(commonAncestor([])).toBeUndefined();
  });

  it('returns the path itself for a single path', () => {
    expect(commonAncestor(['a.b.c'])).toBe('a.b.c');
  });

  it('finds the common prefix of sibling paths', () => {
    expect(commonAncestor(['contact.phone', 'contact.email'])).toBe('contact');
  });

  it('finds common prefix for deeply nested paths', () => {
    expect(commonAncestor(['a.b.c.d', 'a.b.e.f'])).toBe('a.b');
  });

  it('returns undefined when paths share no common ancestor', () => {
    expect(commonAncestor(['foo.bar', 'baz.qux'])).toBeUndefined();
  });

  it('handles root-level paths with no common prefix', () => {
    expect(commonAncestor(['name', 'email'])).toBeUndefined();
  });

  it('handles three paths', () => {
    expect(commonAncestor(['a.b.c', 'a.b.d', 'a.b.e'])).toBe('a.b');
  });

  it('returns the shorter path when one is prefix of another', () => {
    expect(commonAncestor(['a.b', 'a.b.c'])).toBe('a.b');
  });
});

describe('pathsOverlap', () => {
  it('returns true when a is ancestor of b', () => {
    expect(pathsOverlap('contact', 'contact.email')).toBe(true);
  });

  it('returns true when b is ancestor of a', () => {
    expect(pathsOverlap('contact.email', 'contact')).toBe(true);
  });

  it('returns true when paths are identical', () => {
    expect(pathsOverlap('contact.email', 'contact.email')).toBe(true);
  });

  it('returns false for sibling paths', () => {
    expect(pathsOverlap('contact.phone', 'contact.email')).toBe(false);
  });

  it('returns false for unrelated paths', () => {
    expect(pathsOverlap('billing.address', 'shipping.address')).toBe(false);
  });

  it('does not match partial segment names', () => {
    // 'con' is not an ancestor of 'contact'
    expect(pathsOverlap('con', 'contact')).toBe(false);
  });
});

describe('expandSelection', () => {
  it('returns empty for empty selection', () => {
    const state = makeState();
    expect(expandSelection([], state)).toEqual([]);
  });

  it('includes descendants of a selected group', () => {
    const state = makeState({
      definition: {
        items: [
          {
            key: 'contact', type: 'group',
            children: [
              { key: 'phone', type: 'field' },
              { key: 'email', type: 'field' },
            ],
          },
        ],
      },
    });

    const result = expandSelection(['contact'], state);
    expect(result).toContain('contact');
    expect(result).toContain('contact.phone');
    expect(result).toContain('contact.email');
  });

  it('does not duplicate paths already in selection', () => {
    const state = makeState({
      definition: {
        items: [
          {
            key: 'g', type: 'group',
            children: [
              { key: 'f', type: 'field' },
            ],
          },
        ],
      },
    });

    const result = expandSelection(['g', 'g.f'], state);
    // g.f should appear only once
    expect(result.filter(p => p === 'g.f')).toHaveLength(1);
  });

  it('leaves leaf fields as-is', () => {
    const state = makeState({
      definition: {
        items: [
          { key: 'name', type: 'field' },
          { key: 'email', type: 'field' },
        ],
      },
    });

    const result = expandSelection(['name'], state);
    expect(result).toEqual(['name']);
  });

  it('handles nested groups recursively', () => {
    const state = makeState({
      definition: {
        items: [
          {
            key: 'a', type: 'group',
            children: [
              {
                key: 'b', type: 'group',
                children: [
                  { key: 'c', type: 'field' },
                ],
              },
            ],
          },
        ],
      },
    });

    const result = expandSelection(['a'], state);
    expect(result).toContain('a');
    expect(result).toContain('a.b');
    expect(result).toContain('a.b.c');
  });
});
