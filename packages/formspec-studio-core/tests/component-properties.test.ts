import { describe, it, expect } from 'vitest';
import { createProject } from '../src/index.js';

function setupWithNode() {
  const project = createProject();
  const result = project.dispatch({
    type: 'component.addNode',
    payload: { parent: { nodeId: 'root' }, component: 'Card', props: { title: 'Test' } },
  }) as any;
  return { project, nodeRef: result.nodeRef };
}

describe('component.setNodeProperty', () => {
  it('sets a property on a node', () => {
    const { project, nodeRef } = setupWithNode();

    project.dispatch({
      type: 'component.setNodeProperty',
      payload: { node: nodeRef, property: 'title', value: 'Updated' },
    });

    const tree = project.component.tree as any;
    expect(tree.children[0].title).toBe('Updated');
  });
});

describe('component.setNodeType', () => {
  it('changes a node component type', () => {
    const { project, nodeRef } = setupWithNode();

    project.dispatch({
      type: 'component.setNodeType',
      payload: { node: nodeRef, component: 'Collapsible' },
    });

    const tree = project.component.tree as any;
    expect(tree.children[0].component).toBe('Collapsible');
  });
});

describe('component.setNodeStyle', () => {
  it('sets a style property', () => {
    const { project, nodeRef } = setupWithNode();

    project.dispatch({
      type: 'component.setNodeStyle',
      payload: { node: nodeRef, property: 'backgroundColor', value: '#fff' },
    });

    const tree = project.component.tree as any;
    expect(tree.children[0].style.backgroundColor).toBe('#fff');
  });

  it('removes a style property with null', () => {
    const { project, nodeRef } = setupWithNode();

    project.dispatch({
      type: 'component.setNodeStyle',
      payload: { node: nodeRef, property: 'color', value: 'red' },
    });
    project.dispatch({
      type: 'component.setNodeStyle',
      payload: { node: nodeRef, property: 'color', value: null },
    });

    const tree = project.component.tree as any;
    expect(tree.children[0].style?.color).toBeUndefined();
  });
});

describe('component.setNodeAccessibility', () => {
  it('sets an accessibility property', () => {
    const { project, nodeRef } = setupWithNode();

    project.dispatch({
      type: 'component.setNodeAccessibility',
      payload: { node: nodeRef, property: 'role', value: 'region' },
    });

    const tree = project.component.tree as any;
    expect(tree.children[0].accessibility?.role).toBe('region');
  });
});

describe('component.spliceArrayProp', () => {
  it('inserts elements into an array prop', () => {
    const { project, nodeRef } = setupWithNode();

    // Set initial array
    project.dispatch({
      type: 'component.setNodeProperty',
      payload: { node: nodeRef, property: 'items', value: ['a', 'c'] },
    });

    project.dispatch({
      type: 'component.spliceArrayProp',
      payload: { node: nodeRef, property: 'items', index: 1, deleteCount: 0, insert: ['b'] },
    });

    const tree = project.component.tree as any;
    expect(tree.children[0].items).toEqual(['a', 'b', 'c']);
  });
});

describe('component.setFieldWidget', () => {
  it('sets widget on a bound field', () => {
    const project = createProject();
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'name' } });
    project.dispatch({
      type: 'component.addNode',
      payload: { parent: { nodeId: 'root' }, component: 'TextInput', bind: 'name' },
    });

    project.dispatch({
      type: 'component.setFieldWidget',
      payload: { fieldKey: 'name', widget: 'TextArea' },
    });

    const tree = project.component.tree as any;
    expect(tree.children[0].component).toBe('TextArea');
  });
});

describe('component.setResponsiveOverride', () => {
  it('sets a responsive override for a breakpoint', () => {
    const { project, nodeRef } = setupWithNode();

    project.dispatch({
      type: 'component.setResponsiveOverride',
      payload: { node: nodeRef, breakpoint: 'sm', patch: { columns: 1 } },
    });

    const tree = project.component.tree as any;
    expect(tree.children[0].responsive?.sm).toEqual({ columns: 1 });
  });

  it('removes an override with null patch', () => {
    const { project, nodeRef } = setupWithNode();

    project.dispatch({
      type: 'component.setResponsiveOverride',
      payload: { node: nodeRef, breakpoint: 'sm', patch: { columns: 1 } },
    });
    project.dispatch({
      type: 'component.setResponsiveOverride',
      payload: { node: nodeRef, breakpoint: 'sm', patch: null },
    });

    const tree = project.component.tree as any;
    expect(tree.children[0].responsive?.sm).toBeUndefined();
  });
});

describe('component.setWizardProperty', () => {
  it('sets showProgress directly on the generated Wizard node', () => {
    const project = createProject();
    // Need a wizard-mode tree to have a Wizard node
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'name' } });
    project.dispatch({ type: 'pages.addPage', payload: { title: 'Step 1' } });
    const pages = project.theme.pages as any[];
    project.dispatch({ type: 'pages.assignItem', payload: { pageId: pages[0].id, key: 'name' } });

    project.dispatch({
      type: 'component.setWizardProperty',
      payload: { property: 'showProgress', value: true },
    });

    const tree = (project as any)._state.generatedComponent.tree;
    expect(tree.component).toBe('Wizard');
    expect(tree.showProgress).toBe(true);
  });

  it('sets allowSkip directly on an authored Wizard node', () => {
    const project = createProject({
      seed: {
        component: {
          $formspecComponent: '1.0',
          tree: { component: 'Wizard', nodeId: 'w', children: [] },
        },
      },
    });

    project.dispatch({
      type: 'component.setWizardProperty',
      payload: { property: 'allowSkip', value: true },
    });

    const tree = (project as any)._state.component.tree;
    expect(tree.allowSkip).toBe(true);
  });

  it('no-ops gracefully when no Wizard node exists in generated tree', () => {
    const project = createProject();
    // Add an item so a generated tree exists, but stay in single mode (Stack, no Wizard)
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'name' } });

    project.dispatch({
      type: 'component.setWizardProperty',
      payload: { property: 'showProgress', value: true },
    });

    const tree = (project as any)._state.generatedComponent.tree;
    expect(tree.component).toBe('Stack');
    expect(tree.showProgress).toBeUndefined();
  });
});

describe('component.setGroupRepeatable', () => {
  it('sets repeatable flag on a group component', () => {
    const project = createProject();
    // addItem auto-creates a Stack node via tree sync
    project.dispatch({ type: 'definition.addItem', payload: { type: 'group', key: 'items' } });

    project.dispatch({
      type: 'component.setGroupRepeatable',
      payload: { groupKey: 'items', repeatable: true },
    });

    const node = project.componentFor('items') as any;
    expect(node.repeatable).toBe(true);
  });
});

describe('component.setGroupDisplayMode', () => {
  it('sets display mode on a group', () => {
    const project = createProject();
    project.dispatch({ type: 'definition.addItem', payload: { type: 'group', key: 'items' } });
    project.dispatch({
      type: 'component.addNode',
      payload: { parent: { nodeId: 'root' }, component: 'Stack', bind: 'items' },
    });

    project.dispatch({
      type: 'component.setGroupDisplayMode',
      payload: { groupKey: 'items', mode: 'dataTable' },
    });

    const tree = project.component.tree as any;
    expect(tree.children[0].displayMode).toBe('dataTable');
  });
});

describe('component.setGroupDataTable', () => {
  it('sets data table config', () => {
    const project = createProject();
    project.dispatch({ type: 'definition.addItem', payload: { type: 'group', key: 'items' } });
    project.dispatch({
      type: 'component.addNode',
      payload: { parent: { nodeId: 'root' }, component: 'Stack', bind: 'items' },
    });

    project.dispatch({
      type: 'component.setGroupDataTable',
      payload: { groupKey: 'items', config: { columns: ['name', 'amount'] } },
    });

    const tree = project.component.tree as any;
    expect(tree.children[0].dataTableConfig).toEqual({ columns: ['name', 'amount'] });
  });
});

// --- Custom Components ---

describe('component.registerCustom', () => {
  it('registers a custom component', () => {
    const project = createProject();

    project.dispatch({
      type: 'component.registerCustom',
      payload: {
        name: 'AddressBlock',
        params: { showZip: { type: 'boolean', default: true } },
        tree: { component: 'Stack', children: [] },
      },
    });

    expect((project.component as any).customComponents?.AddressBlock).toBeDefined();
  });
});

describe('component.updateCustom', () => {
  it('updates an existing custom component', () => {
    const project = createProject();
    project.dispatch({
      type: 'component.registerCustom',
      payload: { name: 'MyComp', params: {}, tree: { component: 'Stack' } },
    });

    project.dispatch({
      type: 'component.updateCustom',
      payload: { name: 'MyComp', params: { color: { type: 'string' } } },
    });

    expect((project.component as any).customComponents?.MyComp.params).toHaveProperty('color');
  });
});

describe('component.deleteCustom', () => {
  it('removes a custom component', () => {
    const project = createProject();
    project.dispatch({
      type: 'component.registerCustom',
      payload: { name: 'Temp', params: {}, tree: { component: 'Stack' } },
    });

    project.dispatch({
      type: 'component.deleteCustom',
      payload: { name: 'Temp' },
    });

    expect((project.component as any).customComponents?.Temp).toBeUndefined();
  });
});

describe('component.renameCustom', () => {
  it('renames a custom component and rewrites tree references', () => {
    const project = createProject();
    project.dispatch({
      type: 'component.registerCustom',
      payload: { name: 'OldName', params: {}, tree: { component: 'Stack' } },
    });

    // Use it in the tree
    project.dispatch({
      type: 'component.addNode',
      payload: { parent: { nodeId: 'root' }, component: 'OldName' },
    });

    project.dispatch({
      type: 'component.renameCustom',
      payload: { name: 'OldName', newName: 'NewName' },
    });

    expect((project.component as any).customComponents?.OldName).toBeUndefined();
    expect((project.component as any).customComponents?.NewName).toBeDefined();

    const tree = project.component.tree as any;
    expect(tree.children[0].component).toBe('NewName');
  });
});

// --- Document-Level ---

describe('component.setToken', () => {
  it('sets a Tier 3 design token', () => {
    const project = createProject();

    project.dispatch({
      type: 'component.setToken',
      payload: { key: 'color.primary', value: '#007bff' },
    });

    expect((project.component as any).tokens?.['color.primary']).toBe('#007bff');
  });

  it('removes a token with null', () => {
    const project = createProject();
    project.dispatch({
      type: 'component.setToken',
      payload: { key: 'color.primary', value: '#007bff' },
    });
    project.dispatch({
      type: 'component.setToken',
      payload: { key: 'color.primary', value: null },
    });

    expect((project.component as any).tokens?.['color.primary']).toBeUndefined();
  });
});

describe('component.setBreakpoint', () => {
  it('sets a breakpoint', () => {
    const project = createProject();

    project.dispatch({
      type: 'component.setBreakpoint',
      payload: { name: 'sm', minWidth: 640 },
    });

    expect((project.component as any).breakpoints?.sm).toBe(640);
  });
});

describe('component.setDocumentProperty', () => {
  it('sets a document-level property', () => {
    const project = createProject();

    project.dispatch({
      type: 'component.setDocumentProperty',
      payload: { property: 'title', value: 'My Component Doc' },
    });

    expect((project.component as any).title).toBe('My Component Doc');
  });
});
