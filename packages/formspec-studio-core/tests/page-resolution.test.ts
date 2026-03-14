import { describe, it, expect } from 'vitest';
import { resolvePageStructure, type ResolvedPageStructure } from '../src/page-resolution.js';
import type { ProjectState } from '../src/types.js';

/** Minimal state factory — only the fields `resolvePageStructure` reads. */
function makeState(overrides: {
  definition?: Record<string, unknown>;
  theme?: Record<string, unknown>;
  component?: Record<string, unknown>;
} = {}): ProjectState {
  return {
    definition: {
      $formspec: '1.0',
      url: 'urn:test',
      version: '1.0.0',
      title: 'Test',
      items: [],
      ...overrides.definition,
    } as any,
    theme: { ...overrides.theme } as any,
    component: { ...overrides.component } as any,
    generatedComponent: { 'x-studio-generated': true } as any,
    mapping: {} as any,
    extensions: { registries: [] },
    versioning: { baseline: {} as any, releases: [] },
  };
}

describe('resolvePageStructure', () => {
  // Test 1: No pages anywhere → single mode, no controlling tier
  it('returns single mode with no controlling tier when nothing is configured', () => {
    const state = makeState();
    const result = resolvePageStructure(state, []);

    expect(result.mode).toBe('single');
    expect(result.controllingTier).toBe('none');
    expect(result.pages).toEqual([]);
    expect(result.diagnostics).toEqual([]);
  });

  // Test 2: Definition pageMode='wizard' + groups with layout.page → infers pages from groups
  it('infers pages from definition groups with layout.page hints', () => {
    const state = makeState({
      definition: {
        formPresentation: { pageMode: 'wizard' },
        items: [
          {
            key: 'personal', type: 'group', label: 'Personal Info',
            layout: { page: 'page1' },
            children: [{ key: 'name', type: 'field' }],
          },
          {
            key: 'contact', type: 'group', label: 'Contact Info',
            layout: { page: 'page2' },
            children: [{ key: 'email', type: 'field' }],
          },
        ],
      },
    });

    const result = resolvePageStructure(state, ['name', 'email']);

    expect(result.mode).toBe('wizard');
    expect(result.controllingTier).toBe('definition');
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0].title).toBe('Personal Info');
    expect(result.pages[1].title).toBe('Contact Info');
  });

  // Test 3: theme.pages populated → controllingTier='theme', pages from theme
  it('uses theme pages when populated', () => {
    const state = makeState({
      definition: { formPresentation: { pageMode: 'wizard' } },
      theme: {
        pages: [
          { id: 'p1', title: 'Step 1', regions: [{ key: 'name', span: 12 }] },
          { id: 'p2', title: 'Step 2', regions: [{ key: 'age', span: 6 }] },
        ],
      },
    });

    const result = resolvePageStructure(state, ['name', 'age']);

    expect(result.mode).toBe('wizard');
    expect(result.controllingTier).toBe('theme');
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0].id).toBe('p1');
    expect(result.pages[0].title).toBe('Step 1');
    expect(result.pages[0].regions).toEqual([{ key: 'name', span: 12 }]);
  });

  // Test 4: Wizard in component tree + theme.pages → component wins, SHADOWED_THEME_PAGES diagnostic
  it('reports SHADOWED_THEME_PAGES when Wizard component exists alongside theme pages', () => {
    const state = makeState({
      theme: {
        pages: [{ id: 'p1', title: 'Theme Page', regions: [] }],
      },
      component: {
        tree: { component: 'Wizard', children: [
          { component: 'WizardPage', props: { title: 'Comp Page 1' }, children: [] },
          { component: 'WizardPage', props: { title: 'Comp Page 2' }, children: [] },
        ] },
      },
    });

    const result = resolvePageStructure(state, []);

    expect(result.controllingTier).toBe('component');
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0].title).toBe('Comp Page 1');
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'SHADOWED_THEME_PAGES' }),
    );
  });

  // Test 5: Region key not in definition items → UNKNOWN_REGION_KEY diagnostic
  it('reports UNKNOWN_REGION_KEY when a theme region references a non-existent item', () => {
    const state = makeState({
      definition: { formPresentation: { pageMode: 'wizard' } },
      theme: {
        pages: [
          { id: 'p1', title: 'Page 1', regions: [{ key: 'name' }, { key: 'ghost_field' }] },
        ],
      },
    });

    const result = resolvePageStructure(state, ['name']);

    expect(result.controllingTier).toBe('theme');
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'UNKNOWN_REGION_KEY',
        message: expect.stringContaining('ghost_field'),
      }),
    );
  });

  // When user set pageMode to wizard but no theme pages yet → honor intent so Add Page is visible
  it('returns wizard mode and theme tier when pageMode is wizard and theme.pages is empty', () => {
    const state = makeState({
      definition: { formPresentation: { pageMode: 'wizard' } },
      theme: { pages: [] },
    });

    const result = resolvePageStructure(state, []);

    expect(result.mode).toBe('wizard');
    expect(result.controllingTier).toBe('theme');
    expect(result.pages).toEqual([]);
    expect(result.diagnostics).toEqual([]);
  });

  // Test 6: pageMode='single' + theme.pages → PAGEMODE_MISMATCH diagnostic
  it('reports PAGEMODE_MISMATCH when theme pages exist but pageMode is single', () => {
    const state = makeState({
      definition: { formPresentation: { pageMode: 'single' } },
      theme: {
        pages: [{ id: 'p1', title: 'Orphan Page', regions: [] }],
      },
    });

    const result = resolvePageStructure(state, []);

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'PAGEMODE_MISMATCH' }),
    );
  });

  // Additional: Wizard component without theme pages should have no shadow diagnostic
  it('returns component tier with no diagnostic when only Wizard exists (no theme pages)', () => {
    const state = makeState({
      component: {
        tree: { component: 'Wizard', children: [
          { component: 'WizardPage', props: { title: 'Only Page' }, children: [] },
        ] },
      },
    });

    const result = resolvePageStructure(state, []);

    expect(result.controllingTier).toBe('component');
    expect(result.pages).toHaveLength(1);
    expect(result.diagnostics).toEqual([]);
  });

  // wizardConfig should pass through from component tree
  it('extracts wizardConfig from Wizard component props', () => {
    const state = makeState({
      component: {
        tree: {
          component: 'Wizard',
          props: { showProgress: true, allowSkip: false },
          children: [],
        },
      },
    });

    const result = resolvePageStructure(state, []);

    expect(result.wizardConfig).toEqual({ showProgress: true, allowSkip: false });
  });
});
