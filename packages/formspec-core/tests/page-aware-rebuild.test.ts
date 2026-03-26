import { describe, it, expect } from 'vitest';
import { createRawProject } from '../src/index.js';

/** Get Page nodes from the generated component tree. */
function getPageNodes(project: ReturnType<typeof createRawProject>): any[] {
  const tree = project.generatedComponent.tree;
  return (tree?.children ?? []).filter((c: any) => c.component === 'Page');
}

/** Get the first page's nodeId from the component tree. */
function getPageId(project: ReturnType<typeof createRawProject>, index = 0): string {
  const pages = getPageNodes(project);
  if (!pages[index]) throw new Error(`No page at index ${index}`);
  return pages[index].nodeId;
}

describe('page-aware component tree rebuild', () => {
  it('generates flat Stack when no pages exist', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'name' } });

    const tree = project.generatedComponent.tree;
    expect(tree.component).toBe('Stack');
    expect(tree.children).toHaveLength(1);
    expect(tree.children[0].bind).toBe('name');
  });

  it('generates flat Stack in single mode even when pages exist (dormant)', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'name' } });
    project.dispatch({ type: 'pages.addPage', payload: { title: 'Step 1' } });
    const pageId = getPageId(project);
    project.dispatch({ type: 'pages.assignItem', payload: { pageId, key: 'name' } });

    // Switch to single — pages are dormant but still in tree
    project.dispatch({ type: 'pages.setMode', payload: { mode: 'single' } });

    const tree = project.generatedComponent.tree;
    expect(tree.component).toBe('Stack');
    // Page nodes are still present (dormant), but root is Stack not Wizard
    // The renderer ignores Page nodes when pageMode is 'single'
  });

  it('creates Page children in component tree when pages are added', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'name' } });
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'email' } });
    project.dispatch({ type: 'pages.addPage', payload: { title: 'Step 1' } });
    project.dispatch({ type: 'pages.addPage', payload: { title: 'Step 2' } });
    const pageId1 = getPageId(project, 0);
    const pageId2 = getPageId(project, 1);
    project.dispatch({ type: 'pages.assignItem', payload: { pageId: pageId1, key: 'name' } });
    project.dispatch({ type: 'pages.assignItem', payload: { pageId: pageId2, key: 'email' } });

    const tree = project.generatedComponent.tree;
    expect(tree.component).toBe('Stack');
    const pages = getPageNodes(project);
    expect(pages).toHaveLength(2);
    expect(pages[0].title).toBe('Step 1');
    expect(pages[0].children.some((c: any) => c.bind === 'name')).toBe(true);
    expect(pages[1].title).toBe('Step 2');
    expect(pages[1].children.some((c: any) => c.bind === 'email')).toBe(true);
  });

  it('sets Page title and description from handler payload', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'name' } });
    project.dispatch({ type: 'pages.addPage', payload: { title: 'My Step', description: 'Do this' } });
    const pageId = getPageId(project);
    project.dispatch({ type: 'pages.assignItem', payload: { pageId, key: 'name' } });

    const pages = getPageNodes(project);
    expect(pages[0].title).toBe('My Step');
    expect(pages[0].description).toBe('Do this');
  });

  it('preserves Page structure after definition item changes trigger reconcile', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'name' } });
    project.dispatch({ type: 'pages.addPage', payload: { title: 'Step 1' } });
    const pageId = getPageId(project);
    project.dispatch({ type: 'pages.assignItem', payload: { pageId, key: 'name' } });

    // Adding another item triggers a reconcile
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'email' } });

    const tree = project.generatedComponent.tree;
    expect(tree.component).toBe('Stack');
    const pages = getPageNodes(project);
    // Page should survive the reconcile (_layout: true preserves it)
    expect(pages).toHaveLength(1);
    expect(pages[0].title).toBe('Step 1');
    // 'email' should be at root level (unassigned)
    expect(tree.children.some((c: any) => c.bind === 'email')).toBe(true);
  });

  it('generates empty Page when no items are assigned to it', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'name' } });
    project.dispatch({ type: 'pages.addPage', payload: { title: 'Empty Page' } });
    project.dispatch({ type: 'pages.addPage', payload: { title: 'Full Page' } });
    const fullPageId = getPageId(project, 1);
    project.dispatch({ type: 'pages.assignItem', payload: { pageId: fullPageId, key: 'name' } });

    const pages = getPageNodes(project);
    const emptyPage = pages.find((c: any) => c.title === 'Empty Page');
    const fullPage = pages.find((c: any) => c.title === 'Full Page');
    expect(emptyPage.children).toEqual([]);
    expect(fullPage.children).toHaveLength(1);
  });

  it('does not rebuild component tree when an authored tree exists', () => {
    const project = createRawProject({
      seed: {
        component: {
          $formspecComponent: '1.0',
          tree: { component: 'Stack', nodeId: 'custom-root', children: [] },
        },
      },
    });
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'name' } });
    project.dispatch({ type: 'pages.addPage', payload: { title: 'Step 1' } });

    // Authored tree is preserved — rebuild skipped
    const tree = project.component.tree;
    expect(tree.nodeId).toBe('custom-root');
  });

  it('addPage promotes pageMode to wizard', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'name' } });

    // No pageMode set initially
    expect((project.definition as any).formPresentation?.pageMode).toBeUndefined();

    project.dispatch({ type: 'pages.addPage', payload: { title: 'Step 1' } });

    // addPage should set pageMode to wizard
    expect((project.definition as any).formPresentation?.pageMode).toBe('wizard');
  });

  it('does not generate unassigned Page when all items are assigned', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'name' } });
    project.dispatch({ type: 'pages.addPage', payload: { title: 'Step 1' } });
    const pageId = getPageId(project);
    project.dispatch({ type: 'pages.assignItem', payload: { pageId, key: 'name' } });

    const pages = getPageNodes(project);
    expect(pages).toHaveLength(1);
    expect(pages[0].title).toBe('Step 1');
  });
});
