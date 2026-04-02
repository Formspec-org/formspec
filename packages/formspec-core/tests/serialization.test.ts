/** @filedesc Tests for serialization query module. */
import { describe, it, expect } from 'vitest';
import { serializeToJSON } from '../src/queries/serialization.js';
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

describe('serializeToJSON', () => {
  it('returns the definition as a plain object', () => {
    const state = makeState();
    const result = serializeToJSON(state);
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });

  it('includes definition envelope metadata', () => {
    const state = makeState({
      definition: {
        $formspec: '1.0',
        url: 'urn:test:form',
        version: '2.0.0',
        title: 'My Form',
        items: [],
      },
    });

    const result = serializeToJSON(state) as any;
    expect(result.$formspec).toBe('1.0');
    expect(result.url).toBe('urn:test:form');
    expect(result.version).toBe('2.0.0');
    expect(result.title).toBe('My Form');
  });

  it('includes items in the output', () => {
    const state = makeState({
      definition: {
        items: [
          { key: 'name', type: 'field', label: 'Name' },
        ],
      },
    });

    const result = serializeToJSON(state) as any;
    expect(result.items).toHaveLength(1);
    expect(result.items[0].key).toBe('name');
  });

  it('produces a deep copy (not a reference)', () => {
    const state = makeState({
      definition: {
        items: [
          { key: 'a', type: 'field' },
        ],
      },
    });

    const result = serializeToJSON(state) as any;
    // Mutating the result should not affect the original state
    result.items.push({ key: 'injected' });
    expect(state.definition.items).toHaveLength(1);
  });

  it('output is JSON-serializable (round-trips through JSON.stringify)', () => {
    const state = makeState({
      definition: {
        items: [
          { key: 'f1', type: 'field', dataType: 'string' },
          {
            key: 'g1', type: 'group',
            children: [{ key: 'f2', type: 'field' }],
          },
        ],
        binds: [{ path: 'f1', required: 'true' }],
      },
    });

    const result = serializeToJSON(state);
    const json = JSON.stringify(result);
    const parsed = JSON.parse(json);
    expect(parsed).toEqual(result);
  });
});
