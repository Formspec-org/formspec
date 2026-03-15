import { describe, it, expect } from 'vitest';
import { createProject } from '../src/index.js';

describe('page-aware component tree rebuild', () => {
  it('generates flat Stack when no pages exist', () => {
    const project = createProject();
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'name' } });

    const tree = project.generatedComponent.tree;
    expect(tree.component).toBe('Stack');
    expect(tree.children).toHaveLength(1);
    expect(tree.children[0].bind).toBe('name');
  });

  it('generates flat Stack in single mode even when pages exist (dormant)', () => {
    const project = createProject();
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'name' } });
    project.dispatch({ type: 'pages.addPage', payload: { title: 'Step 1' } });
    const pages = project.theme.pages as any[];
    project.dispatch({ type: 'pages.assignItem', payload: { pageId: pages[0].id, key: 'name' } });

    // Switch to single — pages dormant
    project.dispatch({ type: 'pages.setMode', payload: { mode: 'single' } });

    const tree = project.generatedComponent.tree;
    expect(tree.component).toBe('Stack');
    expect(tree.children.every((c: any) => c.component !== 'Page')).toBe(true);
  });

  // component.schema.json: Wizard children MUST be Page (childConstraint: "Page only")
  it('generates Wizard root with Page children in wizard mode', () => {
    const project = createProject();
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'name' } });
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'email' } });
    project.dispatch({ type: 'pages.addPage', payload: { title: 'Step 1' } });
    project.dispatch({ type: 'pages.addPage', payload: { title: 'Step 2' } });
    const pages = project.theme.pages as any[];
    project.dispatch({ type: 'pages.assignItem', payload: { pageId: pages[0].id, key: 'name' } });
    project.dispatch({ type: 'pages.assignItem', payload: { pageId: pages[1].id, key: 'email' } });

    const tree = project.generatedComponent.tree;
    expect(tree.component).toBe('Wizard');
    expect(tree.children).toHaveLength(2);
    expect(tree.children[0].component).toBe('Page');
    expect(tree.children[0].title).toBe('Step 1');
    expect(tree.children[0].children).toHaveLength(1);
    expect(tree.children[0].children[0].bind).toBe('name');
    expect(tree.children[1].component).toBe('Page');
    expect(tree.children[1].title).toBe('Step 2');
    expect(tree.children[1].children[0].bind).toBe('email');
  });

  // component.schema.json: Tabs component — "Tab labels from child Page titles"
  it('generates Tabs root with Page children in tabs mode', () => {
    const project = createProject();
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'name' } });
    project.dispatch({ type: 'pages.setMode', payload: { mode: 'tabs' } });
    project.dispatch({ type: 'pages.addPage', payload: { title: 'Tab 1' } });
    const pages = project.theme.pages as any[];
    project.dispatch({ type: 'pages.assignItem', payload: { pageId: pages[0].id, key: 'name' } });

    const tree = project.generatedComponent.tree;
    expect(tree.component).toBe('Tabs');
    const pageNodes = tree.children.filter((c: any) => c.component === 'Page');
    expect(pageNodes).toHaveLength(1);
    expect(pageNodes[0].title).toBe('Tab 1');
    expect(pageNodes[0].children[0].bind).toBe('name');
  });

  // Wizard childConstraint: "Page only" — unassigned items must be wrapped in a Page
  it('wraps unassigned items in an auto-generated Page (Wizard child constraint)', () => {
    const project = createProject();
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'name' } });
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'extra' } });
    project.dispatch({ type: 'pages.addPage', payload: { title: 'Step 1' } });
    const pages = project.theme.pages as any[];
    project.dispatch({ type: 'pages.assignItem', payload: { pageId: pages[0].id, key: 'name' } });
    // 'extra' is unassigned

    const tree = project.generatedComponent.tree;
    expect(tree.component).toBe('Wizard');
    // All children must be Page (schema constraint)
    expect(tree.children.every((c: any) => c.component === 'Page')).toBe(true);
    // Should have 2 pages: the assigned one + an auto-generated one for unassigned items
    expect(tree.children).toHaveLength(2);
    expect(tree.children[0].title).toBe('Step 1');
    expect(tree.children[0].children[0].bind).toBe('name');
    expect(tree.children[1].children[0].bind).toBe('extra');
  });

  it('sets Page title and description from theme page', () => {
    const project = createProject();
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'name' } });
    project.dispatch({ type: 'pages.addPage', payload: { title: 'My Step', description: 'Do this' } });
    const pages = project.theme.pages as any[];
    project.dispatch({ type: 'pages.assignItem', payload: { pageId: pages[0].id, key: 'name' } });

    const tree = project.generatedComponent.tree;
    const page = tree.children.find((c: any) => c.component === 'Page');
    expect(page.title).toBe('My Step');
    expect(page.description).toBe('Do this');
  });

  it('reverts to flat Stack when switching from wizard to single', () => {
    const project = createProject();
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'name' } });
    project.dispatch({ type: 'pages.addPage', payload: { title: 'Step 1' } });
    const pages = project.theme.pages as any[];
    project.dispatch({ type: 'pages.assignItem', payload: { pageId: pages[0].id, key: 'name' } });

    let tree = project.generatedComponent.tree;
    expect(tree.component).toBe('Wizard');

    project.dispatch({ type: 'pages.setMode', payload: { mode: 'single' } });
    tree = project.generatedComponent.tree;
    expect(tree.component).toBe('Stack');
    expect(tree.children.every((c: any) => c.component !== 'Page')).toBe(true);
    expect(tree.children.some((c: any) => c.bind === 'name')).toBe(true);
  });

  it('generates empty Page when no items are assigned to it', () => {
    const project = createProject();
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'name' } });
    project.dispatch({ type: 'pages.addPage', payload: { title: 'Empty Page' } });
    project.dispatch({ type: 'pages.addPage', payload: { title: 'Full Page' } });
    const pages = project.theme.pages as any[];
    project.dispatch({ type: 'pages.assignItem', payload: { pageId: pages[1].id, key: 'name' } });

    const tree = project.generatedComponent.tree;
    const assignedPages = tree.children.filter((c: any) => c.component === 'Page');
    const emptyPage = assignedPages.find((c: any) => c.title === 'Empty Page');
    const fullPage = assignedPages.find((c: any) => c.title === 'Full Page');
    expect(emptyPage.children).toEqual([]);
    expect(fullPage.children).toHaveLength(1);
  });

  it('does not rebuild component tree when an authored tree exists', () => {
    const project = createProject({
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

  it('does not generate unassigned Page when all items are assigned', () => {
    const project = createProject();
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'name' } });
    project.dispatch({ type: 'pages.addPage', payload: { title: 'Step 1' } });
    const pages = project.theme.pages as any[];
    project.dispatch({ type: 'pages.assignItem', payload: { pageId: pages[0].id, key: 'name' } });

    const tree = project.generatedComponent.tree;
    expect(tree.children).toHaveLength(1);
    expect(tree.children[0].title).toBe('Step 1');
  });
});
