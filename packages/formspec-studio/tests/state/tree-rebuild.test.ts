/**
 * Tests that layout wrappers in the component tree survive definition-triggered
 * rebuilds (_rebuildComponentTree). This is the critical mechanism that makes
 * layout containers a stable editing feature.
 */
import { describe, it, expect } from 'vitest';
import { createProject } from '@formspec-org/studio-core';

type TreeNode = {
  component: string;
  bind?: string;
  nodeId?: string;
  _layout?: boolean;
  children?: TreeNode[];
  [key: string]: unknown;
};

/** Helper: get the component tree root from a project. */
function getTree(project: any): TreeNode {
  return (project.component as any).tree as TreeNode;
}

/** Helper: find a node by nodeId (BFS). */
function findByNodeId(root: TreeNode, nodeId: string): TreeNode | undefined {
  const stack = [root];
  while (stack.length) {
    const n = stack.pop()!;
    if (n.nodeId === nodeId) return n;
    if (n.children) stack.push(...n.children);
  }
  return undefined;
}

/** Helper: find a node by bind key (BFS). */
function findByBind(root: TreeNode, bind: string): TreeNode | undefined {
  const stack = [root];
  while (stack.length) {
    const n = stack.pop()!;
    if (n.bind === bind) return n;
    if (n.children) stack.push(...n.children);
  }
  return undefined;
}

/** Helper: collect all _layout nodes from the tree. */
function collectLayoutNodes(root: TreeNode): TreeNode[] {
  const result: TreeNode[] = [];
  const stack = [root];
  while (stack.length) {
    const n = stack.pop()!;
    if (n._layout) result.push(n);
    if (n.children) stack.push(...n.children);
  }
  return result;
}

/**
 * Helper: access the internal core dispatch for operations not exposed by the
 * public Project API (e.g. wrapping a layout node by nodeId, setting wrapper props).
 */
function coreDispatch(project: any, command: Record<string, unknown>) {
  return project.core.dispatch(command);
}

const baseDef = {
  $formspec: '1.0',
  url: 'urn:test',
  version: '1.0.0',
  items: [
    { key: 'name', type: 'field', dataType: 'string' },
    { key: 'age', type: 'field', dataType: 'integer' },
    { key: 'email', type: 'field', dataType: 'string' },
  ],
};

describe('_rebuildComponentTree wrapper preservation', () => {
  it('preserves a layout wrapper around bound nodes after adding another field', () => {
    const project = createProject({ seed: { definition: baseDef as any } });

    // Wrap 'name' in a Card
    project.wrapInLayoutComponent('name', 'Card');

    const tree1 = getTree(project);
    const wrappers1 = collectLayoutNodes(tree1);
    expect(wrappers1).toHaveLength(1);
    expect(wrappers1[0].component).toBe('Card');

    // Now add a new field — triggers rebuildComponentTree
    project.addField('phone', 'Phone', 'string');

    const tree2 = getTree(project);
    const wrappers2 = collectLayoutNodes(tree2);

    // Card wrapper should still exist with 'name' inside
    expect(wrappers2).toHaveLength(1);
    expect(wrappers2[0].component).toBe('Card');
    expect(wrappers2[0].children).toHaveLength(1);
    expect(wrappers2[0].children![0].bind).toBe('name');
  });

  it('preserves nested layout wrappers after rebuild', () => {
    const project = createProject({ seed: { definition: baseDef as any } });

    // Wrap 'name' in a Card
    const wrapResult = project.wrapInLayoutComponent('name', 'Card');
    const cardNodeId = wrapResult.createdId!;

    // Move 'age' into the Card (use core dispatch — moveLayoutNode only accepts nodeId,
    // but generated bound nodes may not have nodeIds assigned)
    coreDispatch(project, {
      type: 'component.moveNode',
      payload: { source: { bind: 'age' }, targetParent: { nodeId: cardNodeId }, targetIndex: 1 },
    });

    // Now wrap the Card itself in a Stack (requires core dispatch — not exposed via public API)
    coreDispatch(project, {
      type: 'component.wrapNode',
      payload: { node: { nodeId: cardNodeId }, wrapper: { component: 'Stack' } },
    });

    const tree1 = getTree(project);
    const layouts1 = collectLayoutNodes(tree1);
    expect(layouts1).toHaveLength(2); // Stack + Card

    // Trigger rebuild by adding a field
    project.addField('phone', 'Phone', 'string');

    const tree2 = getTree(project);
    const layouts2 = collectLayoutNodes(tree2);
    // Both wrappers should survive
    expect(layouts2).toHaveLength(2);
    expect(layouts2.map(l => l.component).sort()).toEqual(['Card', 'Stack']);
  });

  it('preserves wrapper when some of its children are deleted', () => {
    const project = createProject({ seed: { definition: baseDef as any } });

    // Wrap 'name' in a Card
    const wrapResult = project.wrapInLayoutComponent('name', 'Card');
    const cardNodeId = wrapResult.createdId!;

    // Move 'age' into the Card (use core dispatch — bound nodes may lack nodeIds)
    coreDispatch(project, {
      type: 'component.moveNode',
      payload: { source: { bind: 'age' }, targetParent: { nodeId: cardNodeId } },
    });

    // Delete 'age' from definition — triggers rebuild
    project.removeItem('age');

    const tree2 = getTree(project);
    const wrappers = collectLayoutNodes(tree2);
    expect(wrappers).toHaveLength(1);
    expect(wrappers[0].component).toBe('Card');
    // Only 'name' should remain in the Card
    expect(wrappers[0].children).toHaveLength(1);
    expect(wrappers[0].children![0].bind).toBe('name');
  });

  it('preserves empty wrapper (all children deleted)', () => {
    const project = createProject({ seed: { definition: baseDef as any } });

    // Wrap 'name' in a Card
    project.wrapInLayoutComponent('name', 'Card');

    // Delete 'name' from definition — triggers rebuild
    project.removeItem('name');

    const tree = getTree(project);
    const wrappers = collectLayoutNodes(tree);
    // Empty Card should still exist
    expect(wrappers).toHaveLength(1);
    expect(wrappers[0].component).toBe('Card');
    expect(wrappers[0].children ?? []).toHaveLength(0);
  });

  it('preserves wrapper props (title, style) across rebuild', () => {
    const project = createProject({ seed: { definition: baseDef as any } });

    // Wrap 'name' in a Card with props (requires core dispatch — public API does not support props in wrap)
    coreDispatch(project, {
      type: 'component.wrapNode',
      payload: {
        node: { bind: 'name' },
        wrapper: { component: 'Card', props: { title: 'Personal Info', collapsible: true } },
      },
    });

    // Trigger rebuild
    project.addField('phone', 'Phone', 'string');

    const tree = getTree(project);
    const wrappers = collectLayoutNodes(tree);
    expect(wrappers).toHaveLength(1);
    expect(wrappers[0].title).toBe('Personal Info');
    expect(wrappers[0].collapsible).toBe(true);
  });

  it('preserves wrapper position relative to siblings', () => {
    const project = createProject({ seed: { definition: baseDef as any } });

    // Wrap 'age' (the second item) in a Card
    project.wrapInLayoutComponent('age', 'Card');

    // Root should be: [name, Card(age), email]
    const tree1 = getTree(project);
    expect(tree1.children![0].bind).toBe('name');
    expect(tree1.children![1]._layout).toBe(true);
    expect(tree1.children![2].bind).toBe('email');

    // Trigger rebuild
    project.addField('phone', 'Phone', 'string');

    // After rebuild: Card should still be between name and email
    // (phone appended at root)
    const tree2 = getTree(project);
    const rootChildren = tree2.children!;
    const cardIdx = rootChildren.findIndex(n => n._layout);
    const nameIdx = rootChildren.findIndex(n => n.bind === 'name');
    const emailIdx = rootChildren.findIndex(n => n.bind === 'email');

    expect(cardIdx).toBeGreaterThan(nameIdx);
    expect(cardIdx).toBeLessThan(emailIdx);
  });
});
