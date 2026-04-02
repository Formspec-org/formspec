import { describe, it, expect } from 'vitest';
import { resolveLayoutPageStructure } from '../src/page-structure.js';
import type { PageStructureViewInput } from '../src/page-structure.js';

function makeState(overrides: {
  definition?: Record<string, unknown>;
  component?: Record<string, unknown>;
  theme?: Record<string, unknown>;
} = {}): PageStructureViewInput {
  return {
    definition: {
      items: [],
      ...overrides.definition,
    } as any,
    component: { ...overrides.component } as any,
    theme: { ...overrides.theme } as any,
  };
}

function makeTree(pages: Array<{ id: string; title: string; description?: string; binds: string[] }>) {
  return {
    component: 'Stack',
    nodeId: 'root',
    children: pages.map((page) => ({
      component: 'Page',
      nodeId: page.id,
      title: page.title,
      ...(page.description !== undefined && { description: page.description }),
      _layout: true,
      children: page.binds.map((key) => ({ component: 'TextInput', bind: key })),
    })),
  };
}

describe('resolveLayoutPageStructure', () => {
  it('returns page view data from the component tree', () => {
    const result = resolveLayoutPageStructure(makeState({
      definition: {
        items: [
          { key: 'name', type: 'field', label: 'Full Name' },
          { key: 'email', type: 'field', label: 'Email Address' },
        ],
        formPresentation: { pageMode: 'wizard' },
      },
      component: {
        tree: makeTree([
          { id: 'p1', title: 'Step 1', description: 'Enter your info', binds: ['name'] },
          { id: 'p2', title: 'Step 2', binds: ['email'] },
        ]),
      },
    }));

    expect(result.mode).toBe('wizard');
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0]).toMatchObject({
      id: 'p1',
      title: 'Step 1',
      description: 'Enter your info',
    });
    expect(result.pages[0].items[0]).toMatchObject({
      key: 'name',
      label: 'Full Name',
      status: 'valid',
      width: 12,
      itemType: 'field',
    });
  });

  it('marks missing definition binds as broken', () => {
    const result = resolveLayoutPageStructure(makeState({
      definition: {
        items: [{ key: 'real', type: 'field', label: 'Real' }],
        formPresentation: { pageMode: 'wizard' },
      },
      component: {
        tree: makeTree([{ id: 'p1', title: 'Step 1', binds: ['real', 'missing'] }]),
      },
    }));

    expect(result.pages[0].items.map((item) => item.status)).toEqual(['valid', 'broken']);
  });

  it('returns unassigned items not placed in any page', () => {
    const result = resolveLayoutPageStructure(makeState({
      definition: {
        items: [
          { key: 'name', type: 'field', label: 'Name' },
          { key: 'email', type: 'field', label: 'Email' },
        ],
        formPresentation: { pageMode: 'wizard' },
      },
      component: {
        tree: makeTree([{ id: 'p1', title: 'Step 1', binds: ['name'] }]),
      },
    }));

    expect(result.unassigned).toEqual([{ key: 'email', label: 'Email', itemType: 'field' }]);
    expect(result.itemPageMap.name).toBe('p1');
  });

  it('translates layout breakpoints into width/offset vocabulary', () => {
    const result = resolveLayoutPageStructure(makeState({
      definition: {
        items: [{ key: 'sidebar', type: 'group', label: 'Sidebar', children: [] }],
        formPresentation: { pageMode: 'wizard' },
      },
      component: {
        tree: {
          component: 'Stack',
          nodeId: 'root',
          children: [{
            component: 'Page',
            nodeId: 'p1',
            title: 'Page 1',
            _layout: true,
            children: [{
              component: 'Stack',
              bind: 'sidebar',
              span: 3,
              start: 2,
              responsive: { sm: { hidden: true }, md: { span: 4, start: 1 } },
            }],
          }],
        },
      },
      theme: { breakpoints: { xs: 0, md: 768 } },
    }));

    expect(result.pages[0].items[0]).toMatchObject({
      width: 3,
      offset: 2,
      responsive: { sm: { hidden: true }, md: { width: 4, offset: 1 } },
    });
    expect(result.breakpointNames).toEqual(['xs', 'md']);
  });
});
