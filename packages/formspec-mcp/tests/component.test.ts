/** @filedesc Tests for formspec_component MCP tool: node listing, property setting, add/remove. */
import { describe, it, expect } from 'vitest';
import { registryWithProject, registryInBootstrap } from './helpers.js';
import { handleComponent } from '../src/tools/component.js';
import { handleField } from '../src/tools/structure.js';

function parseResult(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

// ── list_nodes ──────────────────────────────────────────────────────

describe('handleComponent — list_nodes', () => {
  it('returns the root node for a fresh project', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleComponent(registry, projectId, { action: 'list_nodes' });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data).toHaveProperty('tree');
  });

  it('shows field nodes after adding fields', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, { path: 'q1', label: 'Q1', type: 'text' });

    const result = handleComponent(registry, projectId, { action: 'list_nodes' });
    const data = parseResult(result);

    expect(data).toHaveProperty('tree');
    // The tree should contain a node bound to 'q1'
    const json = JSON.stringify(data.tree);
    expect(json).toContain('q1');
  });
});

// ── add_node ────────────────────────────────────────────────────────

describe('handleComponent — add_node', () => {
  it('adds a node to the root', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleComponent(registry, projectId, {
      action: 'add_node',
      parent: { nodeId: 'root' },
      component: 'Card',
    });

    expect(result.isError).toBeUndefined();
    const data = parseResult(result);
    expect(data).toHaveProperty('summary');
  });

  it('adds a bound node', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, { path: 'q1', label: 'Q1', type: 'text' });

    const result = handleComponent(registry, projectId, {
      action: 'add_node',
      parent: { nodeId: 'root' },
      component: 'TextInput',
      bind: 'q1',
    });

    expect(result.isError).toBeUndefined();
  });

  it('returns error when parent not found', () => {
    const { registry, projectId } = registryWithProject();

    const result = handleComponent(registry, projectId, {
      action: 'add_node',
      parent: { nodeId: 'nonexistent' },
      component: 'Card',
    });
    const data = parseResult(result);

    expect(result.isError).toBe(true);
    expect(data.code).toBeTruthy();
  });
});

// ── set_node_property ───────────────────────────────────────────────

describe('handleComponent — set_node_property', () => {
  it('sets a property on a node by nodeId', () => {
    const { registry, projectId } = registryWithProject();
    // Add a layout node first
    handleComponent(registry, projectId, {
      action: 'add_node',
      parent: { nodeId: 'root' },
      component: 'Card',
    });

    // Get the tree to find the added node's nodeId
    const listResult = handleComponent(registry, projectId, { action: 'list_nodes' });
    const tree = parseResult(listResult).tree;
    const cardNode = tree.children?.find((n: any) => n.component === 'Card');
    expect(cardNode).toBeDefined();

    const result = handleComponent(registry, projectId, {
      action: 'set_node_property',
      node: { nodeId: cardNode.nodeId },
      property: 'title',
      value: 'My Card',
    });

    expect(result.isError).toBeUndefined();
  });

  it('sets a property on a node by bind', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, { path: 'q1', label: 'Q1', type: 'text' });

    const result = handleComponent(registry, projectId, {
      action: 'set_node_property',
      node: { bind: 'q1' },
      property: 'placeholder',
      value: 'Enter text...',
    });

    expect(result.isError).toBeUndefined();
  });

  it('returns error when node not found', () => {
    const { registry, projectId } = registryWithProject();

    const result = handleComponent(registry, projectId, {
      action: 'set_node_property',
      node: { nodeId: 'nonexistent' },
      property: 'title',
      value: 'test',
    });
    const data = parseResult(result);

    expect(result.isError).toBe(true);
    expect(data.code).toBeTruthy();
  });
});

// ── remove_node ─────────────────────────────────────────────────────

describe('handleComponent — remove_node', () => {
  it('removes a node by nodeId', () => {
    const { registry, projectId } = registryWithProject();
    // Add then remove
    handleComponent(registry, projectId, {
      action: 'add_node',
      parent: { nodeId: 'root' },
      component: 'Card',
    });

    const listResult = handleComponent(registry, projectId, { action: 'list_nodes' });
    const tree = parseResult(listResult).tree;
    const cardNode = tree.children?.find((n: any) => n.component === 'Card');

    const result = handleComponent(registry, projectId, {
      action: 'remove_node',
      node: { nodeId: cardNode.nodeId },
    });

    expect(result.isError).toBeUndefined();

    // Verify removed
    const afterList = handleComponent(registry, projectId, { action: 'list_nodes' });
    const afterTree = parseResult(afterList).tree;
    const remaining = afterTree.children?.filter((n: any) => n.component === 'Card') ?? [];
    expect(remaining).toHaveLength(0);
  });

  it('returns error when removing root node', () => {
    const { registry, projectId } = registryWithProject();

    const result = handleComponent(registry, projectId, {
      action: 'remove_node',
      node: { nodeId: 'root' },
    });
    const data = parseResult(result);

    expect(result.isError).toBe(true);
  });

  it('returns error when node not found', () => {
    const { registry, projectId } = registryWithProject();

    const result = handleComponent(registry, projectId, {
      action: 'remove_node',
      node: { nodeId: 'nonexistent' },
    });
    const data = parseResult(result);

    expect(result.isError).toBe(true);
  });
});

// ── WRONG_PHASE ─────────────────────────────────────────────────────

describe('handleComponent — errors', () => {
  it('returns WRONG_PHASE during bootstrap', () => {
    const { registry, projectId } = registryInBootstrap();

    const result = handleComponent(registry, projectId, { action: 'list_nodes' });
    const data = parseResult(result);

    expect(result.isError).toBe(true);
    expect(data.code).toBe('WRONG_PHASE');
  });
});
