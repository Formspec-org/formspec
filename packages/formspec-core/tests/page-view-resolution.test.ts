/** @filedesc Tests for resolvePageView behavioral query. */
import { describe, it, expect } from 'vitest';
import { resolvePageView } from '../src/index.js';
import type { ProjectState, PageStructureView } from '../src/index.js';

/** Minimal state factory matching the page-resolution.test.ts pattern. */
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

describe('resolvePageView', () => {
  it('returns PageStructureView with correct shape from valid state', () => {
    const state = makeState({
      definition: {
        items: [
          { key: 'name', type: 'field', label: 'Full Name' },
          { key: 'email', type: 'field', label: 'Email Address' },
        ],
        formPresentation: { pageMode: 'wizard' },
      },
      theme: {
        pages: [
          { id: 'p1', title: 'Step 1', description: 'Enter your info', regions: [{ key: 'name', span: 6 }] },
          { id: 'p2', title: 'Step 2', regions: [{ key: 'email', span: 12 }] },
        ],
      },
    });

    const result = resolvePageView(state);

    expect(result.mode).toBe('wizard');
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0].id).toBe('p1');
    expect(result.pages[0].title).toBe('Step 1');
    expect(result.pages[0].description).toBe('Enter your info');
    expect(result.pages[1].description).toBeUndefined();
  });

  it('resolves labels from item tree, not raw keys', () => {
    const state = makeState({
      definition: {
        items: [
          { key: 'name', type: 'field', label: 'Full Name' },
        ],
        formPresentation: { pageMode: 'wizard' },
      },
      theme: {
        pages: [
          { id: 'p1', title: 'Page', regions: [{ key: 'name', span: 6 }] },
        ],
      },
    });

    const result = resolvePageView(state);

    expect(result.pages[0].items[0].label).toBe('Full Name');
    expect(result.pages[0].items[0].key).toBe('name');
  });

  it('maps span to width and start to offset', () => {
    const state = makeState({
      definition: {
        items: [{ key: 'name', type: 'field', label: 'Name' }],
        formPresentation: { pageMode: 'wizard' },
      },
      theme: {
        pages: [
          { id: 'p1', title: 'A', regions: [{ key: 'name', span: 8, start: 3 }] },
        ],
      },
    });

    const result = resolvePageView(state);

    expect(result.pages[0].items[0].width).toBe(8);
    expect(result.pages[0].items[0].offset).toBe(3);
  });

  it('maps exists to status valid/broken', () => {
    const state = makeState({
      definition: {
        items: [{ key: 'name', type: 'field', label: 'Name' }],
        formPresentation: { pageMode: 'wizard' },
      },
      theme: {
        pages: [
          { id: 'p1', title: 'A', regions: [{ key: 'name' }, { key: 'ghost' }] },
        ],
      },
    });

    const result = resolvePageView(state);

    expect(result.pages[0].items[0].status).toBe('valid');
    expect(result.pages[0].items[1].status).toBe('broken');
  });

  it('provides breakpointNames from theme.breakpoints', () => {
    const state = makeState({
      theme: {
        breakpoints: { xs: 320, sm: 576, md: 768 },
      },
    });

    const result = resolvePageView(state);

    expect(result.breakpointNames).toEqual(['xs', 'sm', 'md']);
  });

  it('defaults breakpointNames when theme.breakpoints is absent', () => {
    const result = resolvePageView(makeState());

    expect(result.breakpointNames).toEqual(['sm', 'md', 'lg']);
  });

  it('responsive is always a Record, never undefined', () => {
    const state = makeState({
      definition: {
        items: [{ key: 'name', type: 'field', label: 'Name' }],
        formPresentation: { pageMode: 'wizard' },
      },
      theme: {
        pages: [
          { id: 'p1', title: 'A', regions: [{ key: 'name', span: 12 }] },
        ],
      },
    });

    const result = resolvePageView(state);

    expect(result.pages[0].items[0].responsive).toEqual({});
  });

  it('maps responsive overrides from regions', () => {
    const state = makeState({
      definition: {
        items: [{ key: 'sidebar', type: 'field', label: 'Sidebar' }],
        formPresentation: { pageMode: 'wizard' },
      },
      theme: {
        pages: [
          {
            id: 'p1', title: 'A', regions: [{
              key: 'sidebar', span: 3,
              responsive: { sm: { hidden: true }, md: { span: 4 } },
            }],
          },
        ],
      },
    });

    const result = resolvePageView(state);

    expect(result.pages[0].items[0].responsive).toEqual({
      sm: { hidden: true },
      md: { width: 4 },
    });
  });

  it('unassigned items have resolved labels', () => {
    const state = makeState({
      definition: {
        items: [
          { key: 'name', type: 'field', label: 'Full Name' },
          { key: 'age', type: 'field', label: 'Your Age' },
        ],
        formPresentation: { pageMode: 'wizard' },
      },
      theme: {
        pages: [
          { id: 'p1', title: 'A', regions: [{ key: 'name' }] },
        ],
      },
    });

    const result = resolvePageView(state);

    expect(result.unassigned).toEqual([
      { key: 'age', label: 'Your Age', itemType: 'field' },
    ]);
  });

  it('diagnostics have severity and message only, no code', () => {
    const state = makeState({
      definition: {
        items: [{ key: 'name', type: 'field' }],
        formPresentation: { pageMode: 'wizard' },
      },
      theme: {
        pages: [
          { id: 'p1', title: 'Page', regions: [{ key: 'ghost' }] },
        ],
      },
    });

    const result = resolvePageView(state);

    expect(result.diagnostics.length).toBeGreaterThan(0);
    for (const d of result.diagnostics) {
      expect(d).toHaveProperty('severity');
      expect(d).toHaveProperty('message');
      expect(d).not.toHaveProperty('code');
    }
  });

  // ── Edge cases ──────────────────────────────────────────────────

  it('empty pages produce empty items arrays', () => {
    const state = makeState({
      definition: {
        items: [{ key: 'name', type: 'field' }],
        formPresentation: { pageMode: 'wizard' },
      },
      theme: {
        pages: [
          { id: 'p1', title: 'Empty Page', regions: [] },
        ],
      },
    });

    const result = resolvePageView(state);

    expect(result.pages[0].items).toEqual([]);
    expect(result.unassigned).toHaveLength(1);
  });

  it('all items unassigned when no pages exist', () => {
    const state = makeState({
      definition: {
        items: [
          { key: 'name', type: 'field', label: 'Name' },
          { key: 'email', type: 'field', label: 'Email' },
        ],
      },
    });

    const result = resolvePageView(state);

    expect(result.pages).toEqual([]);
    expect(result.unassigned).toEqual([
      { key: 'name', label: 'Name', itemType: 'field' },
      { key: 'email', label: 'Email', itemType: 'field' },
    ]);
  });

  it('mixed valid and broken regions on same page', () => {
    const state = makeState({
      definition: {
        items: [{ key: 'real', type: 'field', label: 'Real Field' }],
        formPresentation: { pageMode: 'wizard' },
      },
      theme: {
        pages: [
          { id: 'p1', title: 'Mix', regions: [
            { key: 'real', span: 6 },
            { key: 'deleted', span: 6 },
            { key: 'also_gone', span: 12 },
          ]},
        ],
      },
    });

    const result = resolvePageView(state);

    expect(result.pages[0].items[0].status).toBe('valid');
    expect(result.pages[0].items[1].status).toBe('broken');
    expect(result.pages[0].items[2].status).toBe('broken');
  });

  it('single mode with dormant pages emits PAGEMODE_MISMATCH diagnostic', () => {
    const state = makeState({
      definition: {
        items: [{ key: 'name', type: 'field' }],
        formPresentation: { pageMode: 'single' },
      },
      theme: {
        pages: [
          { id: 'p1', title: 'Dormant', regions: [{ key: 'name' }] },
        ],
      },
    });

    const result = resolvePageView(state);

    expect(result.mode).toBe('single');
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        severity: 'warning',
        message: expect.stringContaining('single'),
      }),
    );
  });

  it('items with no label fall back to key', () => {
    const state = makeState({
      definition: {
        items: [
          { key: 'unlabeled_field', type: 'field' },
        ],
        formPresentation: { pageMode: 'wizard' },
      },
      theme: {
        pages: [
          { id: 'p1', title: 'A', regions: [{ key: 'unlabeled_field' }] },
        ],
      },
    });

    const result = resolvePageView(state);

    expect(result.pages[0].items[0].label).toBe('unlabeled_field');
  });

  it('deeply nested items resolve labels through tree walk', () => {
    const state = makeState({
      definition: {
        items: [
          {
            key: 'group', type: 'group', label: 'Contact Group',
            children: [
              {
                key: 'inner', type: 'group', label: 'Inner Group',
                children: [
                  { key: 'deep_field', type: 'field', label: 'Deep Label' },
                ],
              },
            ],
          },
        ],
        formPresentation: { pageMode: 'wizard' },
      },
      theme: {
        pages: [
          { id: 'p1', title: 'A', regions: [{ key: 'deep_field', span: 12 }] },
        ],
      },
    });

    const result = resolvePageView(state);

    expect(result.pages[0].items[0].label).toBe('Deep Label');
  });

  it('unassigned items for unlabeled fields fall back to key', () => {
    const state = makeState({
      definition: {
        items: [
          { key: 'no_label', type: 'field' },
        ],
      },
    });

    const result = resolvePageView(state);

    expect(result.unassigned).toEqual([
      { key: 'no_label', label: 'no_label', itemType: 'field' },
    ]);
  });

  it('responsive with start override translates to offset', () => {
    const state = makeState({
      definition: {
        items: [{ key: 'f', type: 'field' }],
        formPresentation: { pageMode: 'wizard' },
      },
      theme: {
        pages: [
          {
            id: 'p1', title: 'A', regions: [{
              key: 'f', span: 6,
              responsive: { lg: { span: 8, start: 3, hidden: false } },
            }],
          },
        ],
      },
    });

    const result = resolvePageView(state);

    expect(result.pages[0].items[0].responsive).toEqual({
      lg: { width: 8, offset: 3, hidden: false },
    });
  });

  it('offset is absent when region has no start', () => {
    const state = makeState({
      definition: {
        items: [{ key: 'f', type: 'field' }],
        formPresentation: { pageMode: 'wizard' },
      },
      theme: {
        pages: [
          { id: 'p1', title: 'A', regions: [{ key: 'f', span: 6 }] },
        ],
      },
    });

    const result = resolvePageView(state);

    expect(result.pages[0].items[0].offset).toBeUndefined();
  });

  it('broken items use key as label since they are not in definition', () => {
    const state = makeState({
      definition: {
        items: [],
        formPresentation: { pageMode: 'wizard' },
      },
      theme: {
        pages: [
          { id: 'p1', title: 'A', regions: [{ key: 'missing_item' }] },
        ],
      },
    });

    const result = resolvePageView(state);

    expect(result.pages[0].items[0].label).toBe('missing_item');
    expect(result.pages[0].items[0].status).toBe('broken');
  });

  // ── itemType, childCount, repeatable ─────────────────────────────

  it('returns itemType "field" for field regions', () => {
    const state = makeState({
      definition: {
        items: [{ key: 'name', type: 'field', label: 'Name' }],
        formPresentation: { pageMode: 'wizard' },
      },
      theme: {
        pages: [{ id: 'p1', title: 'A', regions: [{ key: 'name', span: 12 }] }],
      },
    });

    const result = resolvePageView(state);

    expect(result.pages[0].items[0].itemType).toBe('field');
  });

  it('returns itemType "group" for group regions', () => {
    const state = makeState({
      definition: {
        items: [{
          key: 'contact', type: 'group', label: 'Contact',
          children: [{ key: 'phone', type: 'field', label: 'Phone' }],
        }],
        formPresentation: { pageMode: 'wizard' },
      },
      theme: {
        pages: [{ id: 'p1', title: 'A', regions: [{ key: 'contact', span: 12 }] }],
      },
    });

    const result = resolvePageView(state);

    expect(result.pages[0].items[0].itemType).toBe('group');
  });

  it('returns itemType "display" for display regions', () => {
    const state = makeState({
      definition: {
        items: [{ key: 'intro', type: 'display', label: 'Introduction' }],
        formPresentation: { pageMode: 'wizard' },
      },
      theme: {
        pages: [{ id: 'p1', title: 'A', regions: [{ key: 'intro', span: 12 }] }],
      },
    });

    const result = resolvePageView(state);

    expect(result.pages[0].items[0].itemType).toBe('display');
  });

  it('returns childCount for groups', () => {
    const state = makeState({
      definition: {
        items: [{
          key: 'contact', type: 'group', label: 'Contact',
          children: [
            { key: 'first', type: 'field', label: 'First' },
            { key: 'last', type: 'field', label: 'Last' },
            { key: 'email', type: 'field', label: 'Email' },
          ],
        }],
        formPresentation: { pageMode: 'wizard' },
      },
      theme: {
        pages: [{ id: 'p1', title: 'A', regions: [{ key: 'contact', span: 12 }] }],
      },
    });

    const result = resolvePageView(state);

    expect(result.pages[0].items[0].childCount).toBe(3);
  });

  it('returns repeatable true for repeatable groups', () => {
    const state = makeState({
      definition: {
        items: [{
          key: 'entries', type: 'group', label: 'Entries',
          repeatable: true,
          children: [{ key: 'val', type: 'field', label: 'Value' }],
        }],
        formPresentation: { pageMode: 'wizard' },
      },
      theme: {
        pages: [{ id: 'p1', title: 'A', regions: [{ key: 'entries', span: 12 }] }],
      },
    });

    const result = resolvePageView(state);

    expect(result.pages[0].items[0].repeatable).toBe(true);
  });

  it('omits childCount and repeatable for non-group items', () => {
    const state = makeState({
      definition: {
        items: [{ key: 'name', type: 'field', label: 'Name' }],
        formPresentation: { pageMode: 'wizard' },
      },
      theme: {
        pages: [{ id: 'p1', title: 'A', regions: [{ key: 'name', span: 12 }] }],
      },
    });

    const result = resolvePageView(state);

    expect(result.pages[0].items[0].childCount).toBeUndefined();
    expect(result.pages[0].items[0].repeatable).toBeUndefined();
  });

  it('defaults itemType to "field" for broken regions', () => {
    const state = makeState({
      definition: {
        items: [],
        formPresentation: { pageMode: 'wizard' },
      },
      theme: {
        pages: [{ id: 'p1', title: 'A', regions: [{ key: 'ghost' }] }],
      },
    });

    const result = resolvePageView(state);

    expect(result.pages[0].items[0].itemType).toBe('field');
    expect(result.pages[0].items[0].status).toBe('broken');
  });

  // ── breakpointValues ─────────────────────────────────────────────

  it('returns breakpointValues from theme.breakpoints when present', () => {
    const state = makeState({
      theme: {
        breakpoints: { sm: 576, md: 768, lg: 1024 },
      },
    });

    const result = resolvePageView(state);

    expect(result.breakpointValues).toEqual({ sm: 576, md: 768, lg: 1024 });
  });

  it('returns breakpointValues undefined when theme has no breakpoints', () => {
    const result = resolvePageView(makeState());

    expect(result.breakpointValues).toBeUndefined();
  });

  // ── itemPageMap ─────────────────────────────────────────────────

  it('returns itemPageMap mapping each placed item key to its page ID', () => {
    const state = makeState({
      definition: {
        items: [
          { key: 'name', type: 'field', label: 'Name' },
          { key: 'email', type: 'field', label: 'Email' },
          { key: 'phone', type: 'field', label: 'Phone' },
        ],
        formPresentation: { pageMode: 'wizard' },
      },
      theme: {
        pages: [
          { id: 'p1', title: 'Step 1', regions: [{ key: 'name', span: 12 }] },
          { id: 'p2', title: 'Step 2', regions: [{ key: 'email', span: 6 }, { key: 'phone', span: 6 }] },
        ],
      },
    });

    const result = resolvePageView(state);

    expect(result.itemPageMap).toEqual({
      name: 'p1',
      email: 'p2',
      phone: 'p2',
    });
  });

  it('itemPageMap is empty when no pages exist', () => {
    const result = resolvePageView(makeState());

    expect(result.itemPageMap).toEqual({});
  });

  it('itemPageMap does not include broken regions', () => {
    const state = makeState({
      definition: {
        items: [{ key: 'name', type: 'field', label: 'Name' }],
        formPresentation: { pageMode: 'wizard' },
      },
      theme: {
        pages: [
          { id: 'p1', title: 'A', regions: [{ key: 'name', span: 12 }, { key: 'ghost', span: 6 }] },
        ],
      },
    });

    const result = resolvePageView(state);

    // 'name' is valid and mapped; 'ghost' is broken but still mapped (it occupies a region slot)
    expect(result.itemPageMap).toHaveProperty('name', 'p1');
    // broken regions are still mapped — they occupy space on the page
    expect(result.itemPageMap).toHaveProperty('ghost', 'p1');
  });
});
