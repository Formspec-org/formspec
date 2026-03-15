import { describe, it, expect } from 'vitest';
import { resolvePageStructure } from '../src/index.js';
import type { ProjectState } from '../src/index.js';

/** Minimal state factory — only the fields resolvePageStructure reads. */
function makeState(overrides: {
  definition?: Record<string, unknown>;
  theme?: Record<string, unknown>;
} = {}): ProjectState {
  return {
    definition: {
      $formspec: '1.0', url: 'urn:test', version: '1.0.0', title: 'Test',
      items: [],
      ...overrides.definition,
    } as any,
    theme: { ...overrides.theme } as any,
    component: {} as any,
    generatedComponent: { 'x-studio-generated': true } as any,
    mapping: {} as any,
    extensions: { registries: [] },
    versioning: { baseline: {} as any, releases: [] },
  };
}

describe('resolvePageStructure', () => {
  // Note: the old makeState had a `component` override for Wizard-in-component-tree
  // tests. Removed — Studio manages the component tree, so resolution never reads it.
  //
  // Note: ADR Section 6 lists "attach to preceding page" under Resolution tests,
  // but resolvePageStructure reads only from theme.pages (already structured).
  // The attach-to-preceding rule is tested in autoGenerate (Task 6).

  it('returns single mode with empty pages when nothing is configured', () => {
    const result = resolvePageStructure(makeState(), []);

    expect(result.mode).toBe('single');
    expect(result.pages).toEqual([]);
    expect(result.unassignedItems).toEqual([]);
    expect(result.itemPageMap).toEqual({});
    expect(result.diagnostics).toEqual([]);
  });

  it('builds pages from theme.pages with enriched regions', () => {
    const state = makeState({
      definition: { formPresentation: { pageMode: 'wizard' } },
      theme: {
        pages: [
          { id: 'p1', title: 'Step 1', regions: [{ key: 'name', span: 6 }] },
          { id: 'p2', title: 'Step 2', regions: [{ key: 'age', span: 12 }] },
        ],
      },
    });

    const result = resolvePageStructure(state, ['name', 'age']);

    expect(result.mode).toBe('wizard');
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0].id).toBe('p1');
    expect(result.pages[0].title).toBe('Step 1');
    expect(result.pages[0].regions).toEqual([
      { key: 'name', span: 6, exists: true },
    ]);
    expect(result.pages[1].regions).toEqual([
      { key: 'age', span: 12, exists: true },
    ]);
  });

  it('builds itemPageMap from region assignments', () => {
    const state = makeState({
      definition: { formPresentation: { pageMode: 'wizard' } },
      theme: {
        pages: [
          { id: 'p1', title: 'A', regions: [{ key: 'name' }] },
          { id: 'p2', title: 'B', regions: [{ key: 'email' }] },
        ],
      },
    });

    const result = resolvePageStructure(state, ['name', 'email']);

    expect(result.itemPageMap).toEqual({ name: 'p1', email: 'p2' });
  });

  it('reports unassigned items not in any page region', () => {
    const state = makeState({
      definition: { formPresentation: { pageMode: 'wizard' } },
      theme: {
        pages: [
          { id: 'p1', title: 'A', regions: [{ key: 'name' }] },
        ],
      },
    });

    const result = resolvePageStructure(state, ['name', 'email', 'age']);

    expect(result.unassignedItems).toEqual(['email', 'age']);
  });

  it('marks region exists=false when key is not a known definition item', () => {
    const state = makeState({
      definition: { formPresentation: { pageMode: 'wizard' } },
      theme: {
        pages: [
          { id: 'p1', title: 'A', regions: [{ key: 'name' }, { key: 'ghost' }] },
        ],
      },
    });

    const result = resolvePageStructure(state, ['name']);

    expect(result.pages[0].regions[0].exists).toBe(true);
    expect(result.pages[0].regions[1].exists).toBe(false);
  });

  it('emits UNKNOWN_REGION_KEY for non-existent region keys', () => {
    const state = makeState({
      definition: { formPresentation: { pageMode: 'wizard' } },
      theme: {
        pages: [
          { id: 'p1', title: 'Page', regions: [{ key: 'ghost' }] },
        ],
      },
    });

    const result = resolvePageStructure(state, ['name']);

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'UNKNOWN_REGION_KEY',
        message: expect.stringContaining('ghost'),
      }),
    );
  });

  it('emits PAGEMODE_MISMATCH when pages exist but pageMode is single', () => {
    const state = makeState({
      definition: { formPresentation: { pageMode: 'single' } },
      theme: {
        pages: [{ id: 'p1', title: 'Orphan', regions: [] }],
      },
    });

    const result = resolvePageStructure(state, []);

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'PAGEMODE_MISMATCH' }),
    );
  });

  it('returns wizard mode with empty pages when pageMode is wizard and no pages exist', () => {
    const state = makeState({
      definition: { formPresentation: { pageMode: 'wizard' } },
    });

    const result = resolvePageStructure(state, []);

    expect(result.mode).toBe('wizard');
    expect(result.pages).toEqual([]);
  });

  it('returns tabs mode when pageMode is tabs', () => {
    const state = makeState({
      definition: { formPresentation: { pageMode: 'tabs' } },
      theme: {
        pages: [
          { id: 't1', title: 'Tab 1', regions: [{ key: 'name' }] },
        ],
      },
    });

    const result = resolvePageStructure(state, ['name']);

    expect(result.mode).toBe('tabs');
  });

  it('defaults region span to 12 when not specified (per theme.schema.json Region.span default)', () => {
    const state = makeState({
      definition: { formPresentation: { pageMode: 'wizard' } },
      theme: {
        pages: [
          { id: 'p1', title: 'A', regions: [{ key: 'name' }] },
        ],
      },
    });

    const result = resolvePageStructure(state, ['name']);

    expect(result.pages[0].regions[0].span).toBe(12);
    expect('start' in result.pages[0].regions[0]).toBe(false);
  });

  it('preserves region start when specified', () => {
    const state = makeState({
      definition: { formPresentation: { pageMode: 'wizard' } },
      theme: {
        pages: [
          { id: 'p1', title: 'A', regions: [{ key: 'name', span: 6, start: 4 }] },
        ],
      },
    });

    const result = resolvePageStructure(state, ['name']);

    expect(result.pages[0].regions[0]).toEqual({
      key: 'name', span: 6, start: 4, exists: true,
    });
  });

  it('all items are unassigned when no pages exist', () => {
    const result = resolvePageStructure(makeState(), ['name', 'email']);

    expect(result.unassignedItems).toEqual(['name', 'email']);
  });

  it('does not include wizardConfig (component concern, not resolution)', () => {
    const result = resolvePageStructure(makeState(), []);

    expect(result).not.toHaveProperty('wizardConfig');
  });
});
