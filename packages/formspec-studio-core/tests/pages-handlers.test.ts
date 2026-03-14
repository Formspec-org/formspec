import { describe, it, expect } from 'vitest';
import { createProject } from '../src/index.js';

describe('pages.addPage', () => {
  it('creates a theme page and sets pageMode to wizard', () => {
    const project = createProject();

    project.dispatch({ type: 'pages.addPage', payload: { title: 'Step 1' } });

    const pages = project.theme.pages as any[];
    expect(pages).toHaveLength(1);
    expect(pages[0].title).toBe('Step 1');
    expect(pages[0].id).toBeTruthy();
    expect((project.definition as any).formPresentation?.pageMode).toBe('wizard');
  });
});

describe('pages.deletePage', () => {
  it('removes a page by id', () => {
    const project = createProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'A' } });
    project.dispatch({ type: 'pages.addPage', payload: { title: 'B' } });
    const pages = project.theme.pages as any[];
    const idToDelete = pages[0].id;

    project.dispatch({ type: 'pages.deletePage', payload: { id: idToDelete } });

    const remaining = project.theme.pages as any[];
    expect(remaining).toHaveLength(1);
    expect(remaining[0].title).toBe('B');
    expect((project.definition as any).formPresentation?.pageMode).toBe('wizard');
  });

  it('preserves pageMode when deleting the last page', () => {
    const project = createProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'Only' } });
    const pages = project.theme.pages as any[];
    const id = pages[0].id;

    project.dispatch({ type: 'pages.deletePage', payload: { id } });

    expect(project.theme.pages as any[]).toHaveLength(0);
    expect((project.definition as any).formPresentation?.pageMode).toBe('wizard'); // preserved
  });
});

describe('pages.setMode', () => {
  it('initializes empty theme.pages when setting wizard mode', () => {
    const project = createProject();

    project.dispatch({ type: 'pages.setMode', payload: { mode: 'wizard' } });

    expect((project.definition as any).formPresentation?.pageMode).toBe('wizard');
    expect(project.theme.pages).toBeDefined();
  });

  it('preserves theme.pages when setting single mode', () => {
    const project = createProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'X' } });
    expect(project.theme.pages as any[]).toHaveLength(1);

    project.dispatch({ type: 'pages.setMode', payload: { mode: 'single' } });

    expect((project.definition as any).formPresentation?.pageMode).toBe('single');
    expect(project.theme.pages as any[]).toHaveLength(1); // preserved, not cleared
  });
});

describe('pages.addPage — mode preservation', () => {
  it('preserves tabs mode when adding a page (does not force wizard)', () => {
    const project = createProject();
    project.dispatch({ type: 'pages.setMode', payload: { mode: 'tabs' } });

    project.dispatch({ type: 'pages.addPage', payload: { title: 'Tab 1' } });

    expect((project.definition as any).formPresentation?.pageMode).toBe('tabs');
  });
});

describe('pages.setMode — round-trip', () => {
  it('round-trips wizard → single → wizard preserving pages', () => {
    const project = createProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'Step 1' } });
    project.dispatch({ type: 'pages.addPage', payload: { title: 'Step 2' } });

    project.dispatch({ type: 'pages.setMode', payload: { mode: 'single' } });
    project.dispatch({ type: 'pages.setMode', payload: { mode: 'wizard' } });

    expect(project.theme.pages as any[]).toHaveLength(2);
    expect((project.definition as any).formPresentation?.pageMode).toBe('wizard');
  });
});

describe('pages.assignItem', () => {
  it('adds a region to the correct page', () => {
    const project = createProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'P1' } });
    const pageId = (project.theme.pages as any[])[0].id;

    project.dispatch({
      type: 'pages.assignItem',
      payload: { pageId, key: 'name', span: 6 },
    });

    const page = (project.theme.pages as any[])[0];
    expect(page.regions).toContainEqual({ key: 'name', span: 6 });
  });

  it('moves item if already on a different page', () => {
    const project = createProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'P1' } });
    project.dispatch({ type: 'pages.addPage', payload: { title: 'P2' } });
    const pages = project.theme.pages as any[];
    const p1Id = pages[0].id;
    const p2Id = pages[1].id;

    // Assign to P1 first
    project.dispatch({ type: 'pages.assignItem', payload: { pageId: p1Id, key: 'email', span: 12 } });
    // Move to P2
    project.dispatch({ type: 'pages.assignItem', payload: { pageId: p2Id, key: 'email', span: 6 } });

    const updated = project.theme.pages as any[];
    expect(updated[0].regions.find((r: any) => r.key === 'email')).toBeUndefined();
    expect(updated[1].regions).toContainEqual({ key: 'email', span: 6 });
  });
});

describe('pages.unassignItem', () => {
  it('removes a region by key from a page', () => {
    const project = createProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'P' } });
    const pageId = (project.theme.pages as any[])[0].id;
    project.dispatch({ type: 'pages.assignItem', payload: { pageId, key: 'age', span: 12 } });

    project.dispatch({ type: 'pages.unassignItem', payload: { pageId, key: 'age' } });

    const page = (project.theme.pages as any[])[0];
    expect(page.regions).toEqual([]);
  });
});

describe('pages.reorderPages', () => {
  it('swaps adjacent pages', () => {
    const project = createProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'First' } });
    project.dispatch({ type: 'pages.addPage', payload: { title: 'Second' } });
    const firstId = (project.theme.pages as any[])[0].id;

    project.dispatch({ type: 'pages.reorderPages', payload: { id: firstId, direction: 'down' } });

    const pages = project.theme.pages as any[];
    expect(pages[0].title).toBe('Second');
    expect(pages[1].title).toBe('First');
  });
});

describe('pages.setPageProperty', () => {
  it('updates a page title', () => {
    const project = createProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'Old' } });
    const pageId = (project.theme.pages as any[])[0].id;

    project.dispatch({ type: 'pages.setPageProperty', payload: { id: pageId, property: 'title', value: 'New' } });

    expect((project.theme.pages as any[])[0].title).toBe('New');
  });
});

describe('pages.autoGenerate', () => {
  it('creates pages from definition groups with presentation.layout.page hints', () => {
    const project = createProject({
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

    const pages = project.theme.pages as any[];
    expect(pages).toHaveLength(2);
    expect(pages[0].title).toBe('Personal');
    expect(pages[1].title).toBe('Contact');
    expect((project.definition as any).formPresentation?.pageMode).toBe('wizard');
  });

  it('attaches groups without page hint to the preceding page', () => {
    const project = createProject({
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
              // No page hint — should attach to page1 (preceding)
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

    const pages = project.theme.pages as any[];
    expect(pages).toHaveLength(2);
    expect(pages[0].regions.map((r: any) => r.key)).toEqual(['name', 'notes']);
    expect(pages[1].regions.map((r: any) => r.key)).toEqual(['email']);
  });

  it('preserves tabs mode when auto-generating pages', () => {
    const project = createProject({
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
    const project = createProject();
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'f1' } });
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'f2' } });

    project.dispatch({ type: 'pages.autoGenerate', payload: {} });

    const pages = project.theme.pages as any[];
    expect(pages).toHaveLength(1);
    expect(pages[0].regions).toBeDefined();
    expect((project.definition as any).formPresentation?.pageMode).toBe('wizard');
  });
});

describe('pages.reorderRegion', () => {
  it('moves a region to a target index within a page', () => {
    const project = createProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'P' } });
    const pageId = (project.theme.pages as any[])[0].id;
    project.dispatch({ type: 'pages.assignItem', payload: { pageId, key: 'a' } });
    project.dispatch({ type: 'pages.assignItem', payload: { pageId, key: 'b' } });
    project.dispatch({ type: 'pages.assignItem', payload: { pageId, key: 'c' } });

    project.dispatch({
      type: 'pages.reorderRegion',
      payload: { pageId, key: 'c', targetIndex: 0 },
    });

    const regions = (project.theme.pages as any[])[0].regions;
    expect(regions.map((r: any) => r.key)).toEqual(['c', 'a', 'b']);
  });

  it('clamps targetIndex to valid range', () => {
    const project = createProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'P' } });
    const pageId = (project.theme.pages as any[])[0].id;
    project.dispatch({ type: 'pages.assignItem', payload: { pageId, key: 'a' } });
    project.dispatch({ type: 'pages.assignItem', payload: { pageId, key: 'b' } });

    project.dispatch({
      type: 'pages.reorderRegion',
      payload: { pageId, key: 'a', targetIndex: 99 },
    });

    const regions = (project.theme.pages as any[])[0].regions;
    expect(regions.map((r: any) => r.key)).toEqual(['b', 'a']);
  });
});

describe('pages.setRegionProperty', () => {
  it('sets span on a region', () => {
    const project = createProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'P' } });
    const pageId = (project.theme.pages as any[])[0].id;
    project.dispatch({ type: 'pages.assignItem', payload: { pageId, key: 'name' } });

    project.dispatch({
      type: 'pages.setRegionProperty',
      payload: { pageId, key: 'name', property: 'span', value: 6 },
    });

    const region = (project.theme.pages as any[])[0].regions[0];
    expect(region.span).toBe(6);
  });

  it('removes property when value is undefined', () => {
    const project = createProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'P' } });
    const pageId = (project.theme.pages as any[])[0].id;
    project.dispatch({ type: 'pages.assignItem', payload: { pageId, key: 'name', span: 6 } });

    project.dispatch({
      type: 'pages.setRegionProperty',
      payload: { pageId, key: 'name', property: 'span', value: undefined },
    });

    const region = (project.theme.pages as any[])[0].regions[0];
    expect('span' in region).toBe(false);
  });

  it('sets start on a region', () => {
    const project = createProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'P' } });
    const pageId = (project.theme.pages as any[])[0].id;
    project.dispatch({ type: 'pages.assignItem', payload: { pageId, key: 'name' } });

    project.dispatch({
      type: 'pages.setRegionProperty',
      payload: { pageId, key: 'name', property: 'start', value: 4 },
    });

    const region = (project.theme.pages as any[])[0].regions[0];
    expect(region.start).toBe(4);
  });
});
