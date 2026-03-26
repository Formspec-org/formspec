import { describe, it, expect } from 'vitest';
import { createRawProject } from '../src/index.js';

/**
 * Helper: extract all Page nodes from the component tree root's children.
 * Page nodes have `component: 'Page'` and `_layout: true`.
 */
function getPages(project: ReturnType<typeof createRawProject>): any[] {
  const tree = (project.component.tree as any);
  if (!tree?.children) return [];
  return tree.children.filter((n: any) => n.component === 'Page');
}

/**
 * Helper: find a Page node by nodeId.
 */
function findPage(project: ReturnType<typeof createRawProject>, nodeId: string): any {
  return getPages(project).find((p: any) => p.nodeId === nodeId);
}

describe('pages.addPage', () => {
  it('creates a Page node in the component tree and sets pageMode to wizard', () => {
    const project = createRawProject();

    project.dispatch({ type: 'pages.addPage', payload: { title: 'Step 1' } });

    const pages = getPages(project);
    expect(pages).toHaveLength(1);
    expect(pages[0].component).toBe('Page');
    expect(pages[0]._layout).toBe(true);
    expect(pages[0].title).toBe('Step 1');
    expect(pages[0].nodeId).toBeTruthy();
    expect(pages[0].children).toEqual([]);
    expect((project.definition as any).formPresentation?.pageMode).toBe('wizard');
  });

  it('returns rebuildComponentTree: false', () => {
    const project = createRawProject();

    const result = project.dispatch({ type: 'pages.addPage', payload: { title: 'P' } });

    expect(result.rebuildComponentTree).toBe(false);
  });

  it('accepts an explicit id as nodeId', () => {
    const project = createRawProject();

    project.dispatch({ type: 'pages.addPage', payload: { id: 'my-page', title: 'Custom' } });

    const pages = getPages(project);
    expect(pages[0].nodeId).toBe('my-page');
  });

  it('sets description on the Page node when provided', () => {
    const project = createRawProject();

    project.dispatch({ type: 'pages.addPage', payload: { title: 'P', description: 'Details here' } });

    const pages = getPages(project);
    expect(pages[0].description).toBe('Details here');
  });

  it('preserves tabs mode when adding a page (does not force wizard)', () => {
    const project = createRawProject();
    project.dispatch({ type: 'pages.setMode', payload: { mode: 'tabs' } });

    project.dispatch({ type: 'pages.addPage', payload: { title: 'Tab 1' } });

    expect((project.definition as any).formPresentation?.pageMode).toBe('tabs');
  });
});

describe('pages.deletePage', () => {
  it('removes a Page node by nodeId', () => {
    const project = createRawProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'A' } });
    project.dispatch({ type: 'pages.addPage', payload: { title: 'B' } });
    const nodeId = getPages(project)[0].nodeId;

    project.dispatch({ type: 'pages.deletePage', payload: { id: nodeId } });

    const pages = getPages(project);
    expect(pages).toHaveLength(1);
    expect(pages[0].title).toBe('B');
  });

  it('preserves pageMode when deleting the last page', () => {
    const project = createRawProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'Only' } });
    const nodeId = getPages(project)[0].nodeId;

    project.dispatch({ type: 'pages.deletePage', payload: { id: nodeId } });

    expect(getPages(project)).toHaveLength(0);
    expect((project.definition as any).formPresentation?.pageMode).toBe('wizard');
  });

  it('throws when page not found', () => {
    const project = createRawProject();

    expect(() =>
      project.dispatch({ type: 'pages.deletePage', payload: { id: 'nonexistent' } }),
    ).toThrow(/not found/i);
  });

  it('returns rebuildComponentTree: false', () => {
    const project = createRawProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'X' } });
    const nodeId = getPages(project)[0].nodeId;

    const result = project.dispatch({ type: 'pages.deletePage', payload: { id: nodeId } });

    expect(result.rebuildComponentTree).toBe(false);
  });
});

describe('pages.setMode', () => {
  it('sets pageMode on formPresentation', () => {
    const project = createRawProject();

    project.dispatch({ type: 'pages.setMode', payload: { mode: 'wizard' } });

    expect((project.definition as any).formPresentation?.pageMode).toBe('wizard');
  });

  it('preserves existing Page nodes when switching to single mode', () => {
    const project = createRawProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'X' } });
    expect(getPages(project)).toHaveLength(1);

    project.dispatch({ type: 'pages.setMode', payload: { mode: 'single' } });

    expect((project.definition as any).formPresentation?.pageMode).toBe('single');
    expect(getPages(project)).toHaveLength(1);
  });

  it('returns rebuildComponentTree: false', () => {
    const project = createRawProject();

    const result = project.dispatch({ type: 'pages.setMode', payload: { mode: 'wizard' } });

    expect(result.rebuildComponentTree).toBe(false);
  });
});

describe('pages.setMode — round-trip', () => {
  it('round-trips wizard -> single -> wizard preserving Page nodes', () => {
    const project = createRawProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'Step 1' } });
    project.dispatch({ type: 'pages.addPage', payload: { title: 'Step 2' } });

    project.dispatch({ type: 'pages.setMode', payload: { mode: 'single' } });
    project.dispatch({ type: 'pages.setMode', payload: { mode: 'wizard' } });

    expect(getPages(project)).toHaveLength(2);
    expect((project.definition as any).formPresentation?.pageMode).toBe('wizard');
  });
});

describe('pages.reorderPages', () => {
  it('swaps adjacent Page nodes', () => {
    const project = createRawProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'First' } });
    project.dispatch({ type: 'pages.addPage', payload: { title: 'Second' } });
    const firstId = getPages(project)[0].nodeId;

    project.dispatch({ type: 'pages.reorderPages', payload: { id: firstId, direction: 'down' } });

    const pages = getPages(project);
    expect(pages[0].title).toBe('Second');
    expect(pages[1].title).toBe('First');
  });

  it('is a no-op when already at boundary', () => {
    const project = createRawProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'First' } });
    project.dispatch({ type: 'pages.addPage', payload: { title: 'Second' } });
    const firstId = getPages(project)[0].nodeId;

    project.dispatch({ type: 'pages.reorderPages', payload: { id: firstId, direction: 'up' } });

    const pages = getPages(project);
    expect(pages[0].title).toBe('First');
    expect(pages[1].title).toBe('Second');
  });

  it('returns rebuildComponentTree: false', () => {
    const project = createRawProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'A' } });
    const id = getPages(project)[0].nodeId;

    const result = project.dispatch({ type: 'pages.reorderPages', payload: { id, direction: 'down' } });

    expect(result.rebuildComponentTree).toBe(false);
  });
});

describe('pages.movePageToIndex', () => {
  it('moves a Page node to a specific index', () => {
    const project = createRawProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'A' } });
    project.dispatch({ type: 'pages.addPage', payload: { title: 'B' } });
    project.dispatch({ type: 'pages.addPage', payload: { title: 'C' } });
    const aId = getPages(project)[0].nodeId;

    project.dispatch({ type: 'pages.movePageToIndex', payload: { id: aId, targetIndex: 2 } });

    const pages = getPages(project);
    expect(pages.map((p: any) => p.title)).toEqual(['B', 'C', 'A']);
  });

  it('clamps targetIndex to valid range', () => {
    const project = createRawProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'A' } });
    project.dispatch({ type: 'pages.addPage', payload: { title: 'B' } });
    const aId = getPages(project)[0].nodeId;

    project.dispatch({ type: 'pages.movePageToIndex', payload: { id: aId, targetIndex: 99 } });

    const pages = getPages(project);
    expect(pages.map((p: any) => p.title)).toEqual(['B', 'A']);
  });

  it('returns rebuildComponentTree: false', () => {
    const project = createRawProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'A' } });
    const id = getPages(project)[0].nodeId;

    const result = project.dispatch({ type: 'pages.movePageToIndex', payload: { id, targetIndex: 0 } });

    expect(result.rebuildComponentTree).toBe(false);
  });
});

describe('pages.setPageProperty', () => {
  it('updates a Page node title', () => {
    const project = createRawProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'Old' } });
    const pageId = getPages(project)[0].nodeId;

    project.dispatch({ type: 'pages.setPageProperty', payload: { id: pageId, property: 'title', value: 'New' } });

    expect(findPage(project, pageId).title).toBe('New');
  });

  it('sets arbitrary properties on the Page node', () => {
    const project = createRawProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'P' } });
    const pageId = getPages(project)[0].nodeId;

    project.dispatch({ type: 'pages.setPageProperty', payload: { id: pageId, property: 'description', value: 'A page' } });

    expect(findPage(project, pageId).description).toBe('A page');
  });

  it('returns rebuildComponentTree: false', () => {
    const project = createRawProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'P' } });
    const pageId = getPages(project)[0].nodeId;

    const result = project.dispatch({ type: 'pages.setPageProperty', payload: { id: pageId, property: 'title', value: 'X' } });

    expect(result.rebuildComponentTree).toBe(false);
  });
});

describe('pages.assignItem', () => {
  it('creates a bound node inside the target Page', () => {
    const project = createRawProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'P1' } });
    const pageId = getPages(project)[0].nodeId;

    project.dispatch({
      type: 'pages.assignItem',
      payload: { pageId, key: 'name', span: 6 },
    });

    const page = findPage(project, pageId);
    expect(page.children).toHaveLength(1);
    expect(page.children[0].bind).toBe('name');
    expect(page.children[0].span).toBe(6);
  });

  it('moves an existing bound node between Pages', () => {
    const project = createRawProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'P1' } });
    project.dispatch({ type: 'pages.addPage', payload: { title: 'P2' } });
    const pages = getPages(project);
    const p1Id = pages[0].nodeId;
    const p2Id = pages[1].nodeId;

    // Assign to P1
    project.dispatch({ type: 'pages.assignItem', payload: { pageId: p1Id, key: 'email', span: 12 } });
    // Move to P2
    project.dispatch({ type: 'pages.assignItem', payload: { pageId: p2Id, key: 'email', span: 6 } });

    const updated = getPages(project);
    const p1Children = updated[0].children ?? [];
    const p2Children = updated[1].children ?? [];
    expect(p1Children.find((n: any) => n.bind === 'email')).toBeUndefined();
    expect(p2Children).toHaveLength(1);
    expect(p2Children[0].bind).toBe('email');
    expect(p2Children[0].span).toBe(6);
  });

  it('finds and moves a bound node from anywhere in the tree', () => {
    const project = createRawProject();

    // Create a bound node at root level first (simulating an existing tree node)
    project.dispatch({
      type: 'component.addNode',
      payload: { parent: { nodeId: 'root' }, component: 'TextInput', bind: 'field1' },
    });

    // Now add a page and assign that item
    project.dispatch({ type: 'pages.addPage', payload: { title: 'P1' } });
    const pageId = getPages(project)[0].nodeId;

    project.dispatch({
      type: 'pages.assignItem',
      payload: { pageId, key: 'field1' },
    });

    // The node should have moved from root into the Page
    const tree = project.component.tree as any;
    const rootDirectChildren = tree.children.filter((n: any) => n.bind === 'field1' && n.component !== 'Page');
    expect(rootDirectChildren).toHaveLength(0);

    const page = findPage(project, pageId);
    expect(page.children.some((n: any) => n.bind === 'field1')).toBe(true);
  });

  it('returns rebuildComponentTree: false', () => {
    const project = createRawProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'P' } });
    const pageId = getPages(project)[0].nodeId;

    const result = project.dispatch({
      type: 'pages.assignItem',
      payload: { pageId, key: 'name' },
    });

    expect(result.rebuildComponentTree).toBe(false);
  });
});

describe('pages.unassignItem', () => {
  it('moves a bound node out of a Page back to root', () => {
    const project = createRawProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'P' } });
    const pageId = getPages(project)[0].nodeId;
    project.dispatch({ type: 'pages.assignItem', payload: { pageId, key: 'age', span: 12 } });

    project.dispatch({ type: 'pages.unassignItem', payload: { pageId, key: 'age' } });

    const page = findPage(project, pageId);
    expect(page.children).toEqual([]);

    // Node should be back at root level
    const tree = project.component.tree as any;
    const rootBound = tree.children.filter((n: any) => n.bind === 'age');
    expect(rootBound).toHaveLength(1);
  });

  it('returns rebuildComponentTree: false', () => {
    const project = createRawProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'P' } });
    const pageId = getPages(project)[0].nodeId;
    project.dispatch({ type: 'pages.assignItem', payload: { pageId, key: 'x' } });

    const result = project.dispatch({ type: 'pages.unassignItem', payload: { pageId, key: 'x' } });

    expect(result.rebuildComponentTree).toBe(false);
  });
});

describe('pages.autoGenerate', () => {
  it('creates Page nodes from definition groups with presentation.layout.page hints', () => {
    const project = createRawProject({
      seed: {
        definition: {
          $formspec: '1.0', url: 'urn:test', version: '1.0.0', title: 'Test',
          items: [
            {
              key: 'personal', type: 'group', label: 'Personal',
              presentation: { layout: { page: 'page1' } },
              children: [{ key: 'name', type: 'field', dataType: 'string', label: '' }],
            },
            {
              key: 'contact', type: 'group', label: 'Contact',
              presentation: { layout: { page: 'page2' } },
              children: [{ key: 'email', type: 'field', dataType: 'string', label: '' }],
            },
          ],
        } as any,
      },
    });

    project.dispatch({ type: 'pages.autoGenerate', payload: {} });

    const pages = getPages(project);
    expect(pages).toHaveLength(2);
    expect(pages[0].title).toBe('Personal');
    expect(pages[0].children.map((n: any) => n.bind)).toEqual(['name']);
    expect(pages[1].title).toBe('Contact');
    expect(pages[1].children.map((n: any) => n.bind)).toEqual(['email']);
    expect((project.definition as any).formPresentation?.pageMode).toBe('wizard');
  });

  it('attaches groups without page hint to the preceding page', () => {
    const project = createRawProject({
      seed: {
        definition: {
          $formspec: '1.0', url: 'urn:test', version: '1.0.0', title: 'Test',
          items: [
            {
              key: 'basic', type: 'group', label: 'Basic',
              presentation: { layout: { page: 'page1' } },
              children: [{ key: 'name', type: 'field', dataType: 'string', label: '' }],
            },
            {
              key: 'extra', type: 'group', label: 'Extra',
              children: [{ key: 'notes', type: 'field', dataType: 'string', label: '' }],
            },
            {
              key: 'contact', type: 'group', label: 'Contact',
              presentation: { layout: { page: 'page2' } },
              children: [{ key: 'email', type: 'field', dataType: 'string', label: '' }],
            },
          ],
        } as any,
      },
    });

    project.dispatch({ type: 'pages.autoGenerate', payload: {} });

    const pages = getPages(project);
    expect(pages).toHaveLength(2);
    expect(pages[0].children.map((n: any) => n.bind)).toEqual(['name', 'notes']);
    expect(pages[1].children.map((n: any) => n.bind)).toEqual(['email']);
  });

  it('preserves tabs mode when auto-generating pages', () => {
    const project = createRawProject({
      seed: {
        definition: {
          $formspec: '1.0', url: 'urn:test', version: '1.0.0', title: 'Test',
          formPresentation: { pageMode: 'tabs' },
          items: [
            { key: 'f1', type: 'field', dataType: 'string', label: '' },
          ],
        } as any,
      },
    });

    project.dispatch({ type: 'pages.autoGenerate', payload: {} });

    expect((project.definition as any).formPresentation?.pageMode).toBe('tabs');
  });

  it('creates a single-page fallback when no groups have page hints', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'f1' } });
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'f2' } });

    project.dispatch({ type: 'pages.autoGenerate', payload: {} });

    const pages = getPages(project);
    expect(pages).toHaveLength(1);
    expect(pages[0].children).toBeDefined();
    expect(pages[0].children.length).toBeGreaterThan(0);
    expect((project.definition as any).formPresentation?.pageMode).toBe('wizard');
  });

  it('clears existing Page nodes before generating new ones', () => {
    const project = createRawProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'Old Page' } });
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'f1' } });

    project.dispatch({ type: 'pages.autoGenerate', payload: {} });

    const pages = getPages(project);
    // Should not include the old 'Old Page'
    expect(pages.every((p: any) => p.title !== 'Old Page')).toBe(true);
  });

  it('returns rebuildComponentTree: false', () => {
    const project = createRawProject();

    const result = project.dispatch({ type: 'pages.autoGenerate', payload: {} });

    expect(result.rebuildComponentTree).toBe(false);
  });
});

describe('pages.setPages', () => {
  it('replaces all Page nodes with provided page data', () => {
    const project = createRawProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'Old' } });

    project.dispatch({
      type: 'pages.setPages',
      payload: {
        pages: [
          { id: 'p1', title: 'New A', regions: [{ key: 'x', span: 12 }] },
          { id: 'p2', title: 'New B', regions: [] },
        ],
      },
    });

    const pages = getPages(project);
    expect(pages).toHaveLength(2);
    expect(pages[0].title).toBe('New A');
    expect(pages[0].nodeId).toBe('p1');
    expect(pages[0].children.map((n: any) => n.bind)).toEqual(['x']);
    expect(pages[0].children[0].span).toBe(12);
    expect(pages[1].title).toBe('New B');
    expect(pages[1].children).toEqual([]);
  });

  it('promotes pageMode to wizard when pages are added and mode is single/unset', () => {
    const project = createRawProject();

    project.dispatch({
      type: 'pages.setPages',
      payload: { pages: [{ id: 'p1', title: 'P', regions: [] }] },
    });

    expect((project.definition as any).formPresentation?.pageMode).toBe('wizard');
  });

  it('returns rebuildComponentTree: false', () => {
    const project = createRawProject();

    const result = project.dispatch({
      type: 'pages.setPages',
      payload: { pages: [] },
    });

    expect(result.rebuildComponentTree).toBe(false);
  });
});

describe('pages.reorderRegion', () => {
  it('moves a bound child to a target index within a Page', () => {
    const project = createRawProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'P' } });
    const pageId = getPages(project)[0].nodeId;
    project.dispatch({ type: 'pages.assignItem', payload: { pageId, key: 'a' } });
    project.dispatch({ type: 'pages.assignItem', payload: { pageId, key: 'b' } });
    project.dispatch({ type: 'pages.assignItem', payload: { pageId, key: 'c' } });

    project.dispatch({
      type: 'pages.reorderRegion',
      payload: { pageId, key: 'c', targetIndex: 0 },
    });

    const page = findPage(project, pageId);
    expect(page.children.map((n: any) => n.bind)).toEqual(['c', 'a', 'b']);
  });

  it('clamps targetIndex to valid range', () => {
    const project = createRawProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'P' } });
    const pageId = getPages(project)[0].nodeId;
    project.dispatch({ type: 'pages.assignItem', payload: { pageId, key: 'a' } });
    project.dispatch({ type: 'pages.assignItem', payload: { pageId, key: 'b' } });

    project.dispatch({
      type: 'pages.reorderRegion',
      payload: { pageId, key: 'a', targetIndex: 99 },
    });

    const page = findPage(project, pageId);
    expect(page.children.map((n: any) => n.bind)).toEqual(['b', 'a']);
  });

  it('returns rebuildComponentTree: false', () => {
    const project = createRawProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'P' } });
    const pageId = getPages(project)[0].nodeId;
    project.dispatch({ type: 'pages.assignItem', payload: { pageId, key: 'a' } });

    const result = project.dispatch({
      type: 'pages.reorderRegion',
      payload: { pageId, key: 'a', targetIndex: 0 },
    });

    expect(result.rebuildComponentTree).toBe(false);
  });
});

describe('pages.renamePage', () => {
  it('changes the title of a Page node (not the nodeId)', () => {
    const project = createRawProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'Old Name' } });
    const pageId = getPages(project)[0].nodeId;

    project.dispatch({ type: 'pages.renamePage', payload: { id: pageId, newId: 'New Name' } });

    const page = findPage(project, pageId);
    expect(page.title).toBe('New Name');
    // nodeId must NOT change
    expect(page.nodeId).toBe(pageId);
  });

  it('returns rebuildComponentTree: false', () => {
    const project = createRawProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'P' } });
    const pageId = getPages(project)[0].nodeId;

    const result = project.dispatch({ type: 'pages.renamePage', payload: { id: pageId, newId: 'X' } });

    expect(result.rebuildComponentTree).toBe(false);
  });
});

describe('pages.setRegionProperty', () => {
  it('sets span on a bound node within a Page', () => {
    const project = createRawProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'P' } });
    const pageId = getPages(project)[0].nodeId;
    project.dispatch({ type: 'pages.assignItem', payload: { pageId, key: 'name' } });

    project.dispatch({
      type: 'pages.setRegionProperty',
      payload: { pageId, key: 'name', property: 'span', value: 6 },
    });

    const page = findPage(project, pageId);
    const node = page.children.find((n: any) => n.bind === 'name');
    expect(node.span).toBe(6);
  });

  it('removes property when value is undefined', () => {
    const project = createRawProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'P' } });
    const pageId = getPages(project)[0].nodeId;
    project.dispatch({ type: 'pages.assignItem', payload: { pageId, key: 'name', span: 6 } });

    project.dispatch({
      type: 'pages.setRegionProperty',
      payload: { pageId, key: 'name', property: 'span', value: undefined },
    });

    const page = findPage(project, pageId);
    const node = page.children.find((n: any) => n.bind === 'name');
    expect('span' in node).toBe(false);
  });

  it('sets start on a bound node', () => {
    const project = createRawProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'P' } });
    const pageId = getPages(project)[0].nodeId;
    project.dispatch({ type: 'pages.assignItem', payload: { pageId, key: 'name' } });

    project.dispatch({
      type: 'pages.setRegionProperty',
      payload: { pageId, key: 'name', property: 'start', value: 4 },
    });

    const page = findPage(project, pageId);
    const node = page.children.find((n: any) => n.bind === 'name');
    expect(node.start).toBe(4);
  });

  it('sets responsive overrides on a bound node', () => {
    const project = createRawProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'P' } });
    const pageId = getPages(project)[0].nodeId;
    project.dispatch({ type: 'pages.assignItem', payload: { pageId, key: 'name', span: 12 } });

    project.dispatch({
      type: 'pages.setRegionProperty',
      payload: {
        pageId,
        key: 'name',
        property: 'responsive',
        value: { sm: { span: 12 }, lg: { span: 6 } },
      },
    });

    const page = findPage(project, pageId);
    const node = page.children.find((n: any) => n.bind === 'name');
    expect(node.responsive).toEqual({ sm: { span: 12 }, lg: { span: 6 } });
  });

  it('removes responsive overrides when value is undefined', () => {
    const project = createRawProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'P' } });
    const pageId = getPages(project)[0].nodeId;
    project.dispatch({ type: 'pages.assignItem', payload: { pageId, key: 'name' } });
    project.dispatch({
      type: 'pages.setRegionProperty',
      payload: { pageId, key: 'name', property: 'responsive', value: { sm: { hidden: true } } },
    });

    project.dispatch({
      type: 'pages.setRegionProperty',
      payload: { pageId, key: 'name', property: 'responsive', value: undefined },
    });

    const page = findPage(project, pageId);
    const node = page.children.find((n: any) => n.bind === 'name');
    expect('responsive' in node).toBe(false);
  });

  it('supports hidden breakpoint override', () => {
    const project = createRawProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'P' } });
    const pageId = getPages(project)[0].nodeId;
    project.dispatch({ type: 'pages.assignItem', payload: { pageId, key: 'sidebar', span: 3 } });

    project.dispatch({
      type: 'pages.setRegionProperty',
      payload: {
        pageId,
        key: 'sidebar',
        property: 'responsive',
        value: { sm: { hidden: true }, md: { span: 4 } },
      },
    });

    const page = findPage(project, pageId);
    const node = page.children.find((n: any) => n.bind === 'sidebar');
    expect(node.responsive?.sm?.hidden).toBe(true);
    expect(node.responsive?.md?.span).toBe(4);
  });

  it('returns rebuildComponentTree: false', () => {
    const project = createRawProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'P' } });
    const pageId = getPages(project)[0].nodeId;
    project.dispatch({ type: 'pages.assignItem', payload: { pageId, key: 'x' } });

    const result = project.dispatch({
      type: 'pages.setRegionProperty',
      payload: { pageId, key: 'x', property: 'span', value: 6 },
    });

    expect(result.rebuildComponentTree).toBe(false);
  });
});
