/** @filedesc Tests for drop-targets query module. */
import { describe, it, expect } from 'vitest';
import { computeDropTargets } from '../src/queries/drop-targets.js';
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

describe('computeDropTargets', () => {
  it('returns empty array for empty definition', () => {
    const state = makeState();
    expect(computeDropTargets(state, ['anything'])).toEqual([]);
  });

  it('returns drop targets for items not being dragged', () => {
    const state = makeState({
      definition: {
        items: [
          { key: 'a', type: 'field' },
          { key: 'b', type: 'field' },
          { key: 'c', type: 'field' },
        ],
      },
    });

    const targets = computeDropTargets(state, ['b']);
    // Should have targets for items not being dragged
    const targetPaths = targets.map(t => t.targetPath);
    expect(targetPaths).toContain('a');
    expect(targetPaths).toContain('c');
  });

  it('excludes dragged items as targets', () => {
    const state = makeState({
      definition: {
        items: [
          { key: 'a', type: 'field' },
          { key: 'b', type: 'field' },
        ],
      },
    });

    const targets = computeDropTargets(state, ['a']);
    const targetPaths = targets.map(t => t.targetPath);
    expect(targetPaths).not.toContain('a');
  });

  it('allows dropping inside a group', () => {
    const state = makeState({
      definition: {
        items: [
          { key: 'f1', type: 'field' },
          {
            key: 'g1', type: 'group',
            children: [
              { key: 'nested', type: 'field' },
            ],
          },
        ],
      },
    });

    const targets = computeDropTargets(state, ['f1']);
    const insideTargets = targets.filter(t => t.position === 'inside');
    const insidePaths = insideTargets.map(t => t.targetPath);
    expect(insidePaths).toContain('g1');
  });

  it('excludes descendants of dragged group', () => {
    const state = makeState({
      definition: {
        items: [
          {
            key: 'g1', type: 'group',
            children: [
              { key: 'child', type: 'field' },
            ],
          },
          { key: 'other', type: 'field' },
        ],
      },
    });

    const targets = computeDropTargets(state, ['g1']);
    const targetPaths = targets.map(t => t.targetPath);
    expect(targetPaths).not.toContain('g1');
    expect(targetPaths).not.toContain('g1.child');
  });

  it('returns before/after positions for sibling items', () => {
    const state = makeState({
      definition: {
        items: [
          { key: 'a', type: 'field' },
          { key: 'b', type: 'field' },
          { key: 'c', type: 'field' },
        ],
      },
    });

    const targets = computeDropTargets(state, ['b']);
    const aTargets = targets.filter(t => t.targetPath === 'a');
    const positions = aTargets.map(t => t.position);
    expect(positions).toContain('before');
    expect(positions).toContain('after');
  });

  it('each target has valid property', () => {
    const state = makeState({
      definition: {
        items: [
          { key: 'a', type: 'field' },
          { key: 'b', type: 'field' },
        ],
      },
    });

    const targets = computeDropTargets(state, ['a']);
    for (const t of targets) {
      expect(typeof t.valid).toBe('boolean');
    }
  });
});
