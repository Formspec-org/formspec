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
  it('creates pages from definition groups with layout.page hints', () => {
    const project = createProject({
      seed: {
        definition: {
          $formspec: '1.0', url: 'urn:test', version: '1.0.0', title: 'Test',
          items: [
            {
              key: 'personal', type: 'group', label: 'Personal',
              layout: { page: 'page1' },
              children: [{ key: 'name', type: 'field', dataType: 'string', label: '' }],
            },
            {
              key: 'contact', type: 'group', label: 'Contact',
              layout: { page: 'page2' },
              children: [{ key: 'email', type: 'field', dataType: 'string', label: '' }],
            },
          ],
        } as any,
      },
    });

    project.dispatch({ type: 'pages.autoGenerate', payload: {} });

    const pages = project.theme.pages as any[];
    expect(pages.length).toBeGreaterThanOrEqual(2);
    expect((project.definition as any).formPresentation?.pageMode).toBe('wizard');
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
