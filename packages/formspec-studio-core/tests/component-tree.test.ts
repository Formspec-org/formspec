import { describe, it, expect } from 'vitest';
import { createProject } from '../src/index.js';

describe('component.addNode', () => {
  it('adds a node to the root', () => {
    const project = createProject();

    const result = project.dispatch({
      type: 'component.addNode',
      payload: { parent: { nodeId: 'root' }, component: 'Stack' },
    });

    const tree = project.component.tree as any;
    expect(tree).toBeDefined();
    expect(tree.children).toHaveLength(1);
    expect(tree.children[0].component).toBe('Stack');
    expect(result).toHaveProperty('nodeRef');
  });

  it('adds a bound input node', () => {
    const project = createProject();
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'name' } });

    project.dispatch({
      type: 'component.addNode',
      payload: { parent: { nodeId: 'root' }, component: 'TextInput', bind: 'name' },
    });

    const tree = project.component.tree as any;
    expect(tree.children[0].component).toBe('TextInput');
    expect(tree.children[0].bind).toBe('name');
  });

  it('generates nodeId for unbound nodes', () => {
    const project = createProject();

    const result = project.dispatch({
      type: 'component.addNode',
      payload: { parent: { nodeId: 'root' }, component: 'Card' },
    }) as any;

    expect(result.nodeRef.nodeId).toBeTypeOf('string');
    const tree = project.component.tree as any;
    expect(tree.children[0].nodeId).toBe(result.nodeRef.nodeId);
  });

  it('respects insertIndex', () => {
    const project = createProject();

    project.dispatch({
      type: 'component.addNode',
      payload: { parent: { nodeId: 'root' }, component: 'Card' },
    });
    project.dispatch({
      type: 'component.addNode',
      payload: { parent: { nodeId: 'root' }, component: 'Card' },
    });

    project.dispatch({
      type: 'component.addNode',
      payload: { parent: { nodeId: 'root' }, component: 'Stack', insertIndex: 1 },
    });

    const tree = project.component.tree as any;
    expect(tree.children[1].component).toBe('Stack');
  });

  it('adds nested children to a referenced node', () => {
    const project = createProject();

    const result = project.dispatch({
      type: 'component.addNode',
      payload: { parent: { nodeId: 'root' }, component: 'Card' },
    }) as any;

    project.dispatch({
      type: 'component.addNode',
      payload: { parent: result.nodeRef, component: 'Stack' },
    });

    const tree = project.component.tree as any;
    expect(tree.children[0].children).toHaveLength(1);
    expect(tree.children[0].children[0].component).toBe('Stack');
  });
});

describe('component.deleteNode', () => {
  it('removes a node by nodeRef', () => {
    const project = createProject();

    const result = project.dispatch({
      type: 'component.addNode',
      payload: { parent: { nodeId: 'root' }, component: 'Card' },
    }) as any;

    project.dispatch({
      type: 'component.deleteNode',
      payload: { node: result.nodeRef },
    });

    const tree = project.component.tree as any;
    expect(tree.children).toHaveLength(0);
  });

  it('removes a bound node by bind ref', () => {
    const project = createProject();
    // addItem auto-creates a bound node via tree sync
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'email' } });
    expect(project.componentFor('email')).toBeDefined();

    project.dispatch({
      type: 'component.deleteNode',
      payload: { node: { bind: 'email' } },
    });

    expect(project.componentFor('email')).toBeUndefined();
  });
});

describe('component.moveNode', () => {
  it('moves a node to a new parent', () => {
    const project = createProject();

    const card1 = (project.dispatch({
      type: 'component.addNode',
      payload: { parent: { nodeId: 'root' }, component: 'Card' },
    }) as any).nodeRef;

    const card2 = (project.dispatch({
      type: 'component.addNode',
      payload: { parent: { nodeId: 'root' }, component: 'Card' },
    }) as any).nodeRef;

    const inner = (project.dispatch({
      type: 'component.addNode',
      payload: { parent: card1, component: 'Stack' },
    }) as any).nodeRef;

    // Move inner from card1 to card2
    project.dispatch({
      type: 'component.moveNode',
      payload: { source: inner, targetParent: card2 },
    });

    const tree = project.component.tree as any;
    expect(tree.children[0].children ?? []).toHaveLength(0);
    expect(tree.children[1].children).toHaveLength(1);
    expect(tree.children[1].children[0].component).toBe('Stack');
  });
});

describe('component.reorderNode', () => {
  it('swaps with adjacent sibling', () => {
    const project = createProject();

    const first = (project.dispatch({
      type: 'component.addNode',
      payload: { parent: { nodeId: 'root' }, component: 'Card', props: { title: 'First' } },
    }) as any).nodeRef;

    project.dispatch({
      type: 'component.addNode',
      payload: { parent: { nodeId: 'root' }, component: 'Stack' },
    });

    project.dispatch({
      type: 'component.reorderNode',
      payload: { node: first, direction: 'down' },
    });

    const tree = project.component.tree as any;
    expect(tree.children[0].component).toBe('Stack');
    expect(tree.children[1].component).toBe('Card');
  });
});

describe('component.duplicateNode', () => {
  it('deep clones a node with new nodeIds', () => {
    const project = createProject();

    const original = (project.dispatch({
      type: 'component.addNode',
      payload: { parent: { nodeId: 'root' }, component: 'Card' },
    }) as any).nodeRef;

    const result = project.dispatch({
      type: 'component.duplicateNode',
      payload: { node: original },
    }) as any;

    const tree = project.component.tree as any;
    expect(tree.children).toHaveLength(2);
    expect(tree.children[1].component).toBe('Card');
    expect(tree.children[1].nodeId).not.toBe(tree.children[0].nodeId);
    expect(result.nodeRef.nodeId).toBe(tree.children[1].nodeId);
  });
});

describe('component.wrapNode', () => {
  it('wraps a node in a new container', () => {
    const project = createProject();

    const node = (project.dispatch({
      type: 'component.addNode',
      payload: { parent: { nodeId: 'root' }, component: 'TextInput', bind: 'f1' },
    }) as any).nodeRef;

    project.dispatch({
      type: 'component.wrapNode',
      payload: { node, wrapper: { component: 'Card' } },
    });

    const tree = project.component.tree as any;
    expect(tree.children).toHaveLength(1);
    expect(tree.children[0].component).toBe('Card');
    expect(tree.children[0].children).toHaveLength(1);
    expect(tree.children[0].children[0].bind).toBe('f1');
  });
});

describe('component.unwrapNode', () => {
  it('promotes children to parent and removes wrapper', () => {
    const project = createProject();

    const wrapper = (project.dispatch({
      type: 'component.addNode',
      payload: { parent: { nodeId: 'root' }, component: 'Card' },
    }) as any).nodeRef;

    project.dispatch({
      type: 'component.addNode',
      payload: { parent: wrapper, component: 'TextInput', bind: 'a' },
    });
    project.dispatch({
      type: 'component.addNode',
      payload: { parent: wrapper, component: 'TextInput', bind: 'b' },
    });

    project.dispatch({
      type: 'component.unwrapNode',
      payload: { node: wrapper },
    });

    const tree = project.component.tree as any;
    expect(tree.children).toHaveLength(2);
    expect(tree.children[0].bind).toBe('a');
    expect(tree.children[1].bind).toBe('b');
  });
});

describe('component tree rebuild — orphaned display nodes', () => {
  it('drops display nodes whose definition items no longer exist', () => {
    const project = createProject();

    project.dispatch({
      type: 'definition.addItem',
      payload: { key: 'notice', type: 'display', label: 'Important notice' },
    });

    const treeBefore = project.component.tree as any;
    expect(treeBefore.children?.some((node: any) => node.nodeId === 'notice')).toBe(true);

    project.dispatch({
      type: 'definition.deleteItem',
      payload: { path: 'notice' },
    });

    const treeAfter = project.component.tree as any;
    expect(treeAfter.children?.some((node: any) => node.nodeId === 'notice')).toBe(false);
  });
});
