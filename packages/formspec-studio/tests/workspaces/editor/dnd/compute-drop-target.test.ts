import { describe, it, expect } from 'vitest';
import {
  computeDropTarget,
  isDescendantOf,
  buildSequentialMoves,
} from '../../../../src/workspaces/editor/dnd/compute-drop-target';
import type { FlatEntry } from '../../../../src/lib/field-helpers';

// Helper to build flat lists from a simple item tree
interface SimpleItem {
  key: string;
  type: string;
  children?: SimpleItem[];
}

function buildFlat(items: SimpleItem[], prefix = '', depth = 0): FlatEntry[] {
  const result: FlatEntry[] = [];
  for (const item of items) {
    const path = prefix ? `${prefix}.${item.key}` : item.key;
    const category = item.type === 'group' ? 'group' : item.type === 'display' ? 'display' : 'field';
    result.push({
      id: path,
      node: item.type === 'display' ? { component: 'Text', nodeId: item.key } : { component: category === 'group' ? 'Stack' : 'TextInput', bind: item.key },
      category,
      depth,
      hasChildren: !!(item.children?.length),
      defPath: path,
      bind: item.type === 'display' ? undefined : item.key,
      nodeId: item.type === 'display' ? item.key : undefined,
    });
    if (item.children) {
      result.push(...buildFlat(item.children, path, depth + 1));
    }
  }
  return result;
}

function expectDefinitionMove(
  result: ReturnType<typeof computeDropTarget>,
  parentPath: string | null,
  index: number,
  payload: Record<string, unknown>,
) {
  expect(result).toMatchObject({ kind: 'definition', parentPath, index });
  expect(result?.definitionMove).toEqual(payload);
}

function expectComponentMove(
  result: ReturnType<typeof computeDropTarget>,
  parentPath: string | null,
  index: number,
  payload: Record<string, unknown>,
) {
  expect(result).toMatchObject({ kind: 'component', parentPath, index });
  expect(result?.componentMove).toEqual(payload);
}

describe('isDescendantOf', () => {
  it('returns true for direct child', () => {
    expect(isDescendantOf('group.child', 'group')).toBe(true);
  });

  it('returns true for deeply nested child', () => {
    expect(isDescendantOf('a.b.c.d', 'a')).toBe(true);
    expect(isDescendantOf('a.b.c.d', 'a.b')).toBe(true);
  });

  it('returns false for sibling', () => {
    expect(isDescendantOf('groupB', 'groupA')).toBe(false);
  });

  it('returns false for same path', () => {
    expect(isDescendantOf('group', 'group')).toBe(false);
  });

  it('returns false for partial prefix match', () => {
    // "groupExtra" starts with "group" but is not a descendant
    expect(isDescendantOf('groupExtra', 'group')).toBe(false);
  });
});

describe('computeDropTarget', () => {
  // Simple flat list: [fieldA, fieldB, fieldC]
  const flatRoot: FlatEntry[] = [
    { id: 'fieldA', node: { component: 'TextInput', bind: 'fieldA' }, category: 'field', depth: 0, hasChildren: false, defPath: 'fieldA', bind: 'fieldA', nodeId: undefined },
    { id: 'fieldB', node: { component: 'TextInput', bind: 'fieldB' }, category: 'field', depth: 0, hasChildren: false, defPath: 'fieldB', bind: 'fieldB', nodeId: undefined },
    { id: 'fieldC', node: { component: 'TextInput', bind: 'fieldC' }, category: 'field', depth: 0, hasChildren: false, defPath: 'fieldC', bind: 'fieldC', nodeId: undefined },
  ];

  it('returns null when dropping on itself', () => {
    const result = computeDropTarget('fieldA', 'fieldA', 'above', flatRoot);
    expect(result).toBeNull();
  });

  it('drop field above another at root', () => {
    const result = computeDropTarget('fieldC', 'fieldA', 'above', flatRoot);
    expectDefinitionMove(result, null, 0, { sourcePath: 'fieldC', targetIndex: 0 });
  });

  it('drop field below another at root', () => {
    const result = computeDropTarget('fieldA', 'fieldC', 'below', flatRoot);
    expectDefinitionMove(result, null, 2, { sourcePath: 'fieldA', targetIndex: 2 });
  });

  it('drop field above adjacent sibling (same parent, source before target)', () => {
    // Drop fieldA above fieldB → no-op? No — "above fieldB" = index 1, source was 0, so after removal target = 0
    // This means index 0, which is where fieldA already is → should return null (no-op)
    const result = computeDropTarget('fieldA', 'fieldB', 'above', flatRoot);
    expect(result).toBeNull();
  });

  it('drop field below adjacent sibling (same parent, source before target)', () => {
    const result = computeDropTarget('fieldA', 'fieldB', 'below', flatRoot);
    expectDefinitionMove(result, null, 1, { sourcePath: 'fieldA', targetIndex: 1 });
  });

  it('drop field above when source is after target (no index adjustment)', () => {
    const result = computeDropTarget('fieldC', 'fieldA', 'above', flatRoot);
    expectDefinitionMove(result, null, 0, { sourcePath: 'fieldC', targetIndex: 0 });
  });

  // Tree with groups
  const flatTree: FlatEntry[] = buildFlat([
    { key: 'fieldA', type: 'field' },
    { key: 'groupX', type: 'group', children: [
      { key: 'child1', type: 'field' },
      { key: 'child2', type: 'field' },
    ]},
    { key: 'fieldB', type: 'field' },
  ]);

  it('drop field inside a group (empty append)', () => {
    const result = computeDropTarget('fieldA', 'groupX', 'inside', flatTree);
    expectDefinitionMove(result, 'groupX', 2, { sourcePath: 'fieldA', targetParentPath: 'groupX', targetIndex: 2 });
  });

  it('drop field above first child in group', () => {
    const result = computeDropTarget('fieldB', 'groupX.child1', 'above', flatTree);
    expectDefinitionMove(result, 'groupX', 0, { sourcePath: 'fieldB', targetParentPath: 'groupX', targetIndex: 0 });
  });

  it('drop field below last child in group', () => {
    const result = computeDropTarget('fieldA', 'groupX.child2', 'below', flatTree);
    expectDefinitionMove(result, 'groupX', 2, { sourcePath: 'fieldA', targetParentPath: 'groupX', targetIndex: 2 });
  });

  it('move child out to root level above a root item', () => {
    const result = computeDropTarget('groupX.child1', 'fieldB', 'above', flatTree);
    expectDefinitionMove(result, null, 2, { sourcePath: 'groupX.child1', targetIndex: 2 });
  });

  it('reorder within group — child1 below child2', () => {
    const result = computeDropTarget('groupX.child1', 'groupX.child2', 'below', flatTree);
    expectDefinitionMove(result, 'groupX', 1, { sourcePath: 'groupX.child1', targetParentPath: 'groupX', targetIndex: 1 });
  });

  // Circular guard
  it('rejects dropping a group into its own descendant', () => {
    const result = computeDropTarget('groupX', 'groupX.child1', 'above', flatTree);
    expect(result).toBeNull();
  });

  it('rejects dropping a group inside itself', () => {
    const result = computeDropTarget('groupX', 'groupX', 'inside', flatTree);
    expect(result).toBeNull();
  });

  // Nested groups
  const deepTree: FlatEntry[] = buildFlat([
    { key: 'outer', type: 'group', children: [
      { key: 'inner', type: 'group', children: [
        { key: 'deep', type: 'field' },
      ]},
      { key: 'sibling', type: 'field' },
    ]},
    { key: 'rootField', type: 'field' },
  ]);

  it('rejects dropping outer group into deeply nested descendant', () => {
    const result = computeDropTarget('outer', 'outer.inner.deep', 'above', deepTree);
    expect(result).toBeNull();
  });

  it('allows dropping deep field to root', () => {
    const result = computeDropTarget('outer.inner.deep', 'rootField', 'above', deepTree);
    expectDefinitionMove(result, null, 1, { sourcePath: 'outer.inner.deep', targetIndex: 1 });
  });

  it('drop inside empty group', () => {
    const withEmptyGroup: FlatEntry[] = buildFlat([
      { key: 'emptyGroup', type: 'group', children: [] },
      { key: 'field1', type: 'field' },
    ]);
    const result = computeDropTarget('field1', 'emptyGroup', 'inside', withEmptyGroup);
    expectDefinitionMove(result, 'emptyGroup', 0, { sourcePath: 'field1', targetParentPath: 'emptyGroup', targetIndex: 0 });
  });

  it('returns null for inside position on non-group item', () => {
    const result = computeDropTarget('fieldA', 'fieldB', 'inside', flatRoot);
    expect(result).toBeNull();
  });

  // Multi-select: selected paths
  it('allows multi-select drag when no selected path is ancestor of target', () => {
    const result = computeDropTarget(
      'groupX.child1', 'fieldA', 'above', flatTree,
      new Set(['groupX.child1', 'fieldB']),
    );
    expect(result).not.toBeNull();
    expect(result).toMatchObject({ kind: 'definition', parentPath: null, index: 0 });
  });

  it('rejects when selected group would be dropped into its own child', () => {
    const result = computeDropTarget(
      'groupX', 'groupX.child1', 'inside', flatTree,
      new Set(['groupX']),
    );
    expect(result).toBeNull();
  });
});

describe('buildSequentialMoves', () => {
  // [a, b, c, d, e] — all root-level fields
  const flat5: FlatEntry[] = [
    { id: 'a', node: { component: 'TextInput', bind: 'a' }, category: 'field', depth: 0, hasChildren: false, defPath: 'a', bind: 'a', nodeId: undefined },
    { id: 'b', node: { component: 'TextInput', bind: 'b' }, category: 'field', depth: 0, hasChildren: false, defPath: 'b', bind: 'b', nodeId: undefined },
    { id: 'c', node: { component: 'TextInput', bind: 'c' }, category: 'field', depth: 0, hasChildren: false, defPath: 'c', bind: 'c', nodeId: undefined },
    { id: 'd', node: { component: 'TextInput', bind: 'd' }, category: 'field', depth: 0, hasChildren: false, defPath: 'd', bind: 'd', nodeId: undefined },
    { id: 'e', node: { component: 'TextInput', bind: 'e' }, category: 'field', depth: 0, hasChildren: false, defPath: 'e', bind: 'e', nodeId: undefined },
  ];

  it('multi-select drag DOWN: a+b below d', () => {
    const cmds = buildSequentialMoves(['a', 'b'], null, 4, flat5);

    expect(cmds).toHaveLength(2);
    // Simulate: move a to 3 → [b,c,d,a,e]. move b to 3 → [c,d,a,b,e]. ✓
    expect(cmds[0]).toEqual({ sourcePath: 'a', targetIndex: 3 });
    expect(cmds[1]).toEqual({ sourcePath: 'b', targetIndex: 3 });
  });

  it('multi-select drag UP: d+e above b', () => {
    const cmds = buildSequentialMoves(['d', 'e'], null, 1, flat5);

    expect(cmds).toHaveLength(2);
    // Simulate: move d to 1 → [a,d,b,c,e]. move e to 2 → [a,d,e,b,c]. ✓
    expect(cmds[0]).toEqual({ sourcePath: 'd', targetIndex: 1 });
    expect(cmds[1]).toEqual({ sourcePath: 'e', targetIndex: 2 });
  });

  it('multi-select mixed: a+d above c', () => {
    const cmds = buildSequentialMoves(['a', 'd'], null, 2, flat5);

    expect(cmds).toHaveLength(2);
    // Simulate: move a to 1 → [b,a,c,d,e]. move d to 2 → [b,a,d,c,e]. ✓
    expect(cmds[0]).toEqual({ sourcePath: 'a', targetIndex: 1 });
    expect(cmds[1]).toEqual({ sourcePath: 'd', targetIndex: 2 });
  });

  it('multi-select into group: move root items inside groupX', () => {
    const flatWithGroup: FlatEntry[] = [
      { id: 'a', node: { component: 'TextInput', bind: 'a' }, category: 'field', depth: 0, hasChildren: false, defPath: 'a', bind: 'a', nodeId: undefined },
      { id: 'b', node: { component: 'TextInput', bind: 'b' }, category: 'field', depth: 0, hasChildren: false, defPath: 'b', bind: 'b', nodeId: undefined },
      { id: 'grp', node: { component: 'Stack', bind: 'grp' }, category: 'group', depth: 0, hasChildren: true, defPath: 'grp', bind: 'grp', nodeId: undefined },
      { id: 'grp.x', node: { component: 'TextInput', bind: 'x' }, category: 'field', depth: 1, hasChildren: false, defPath: 'grp.x', bind: 'x', nodeId: undefined },
    ];

    const cmds = buildSequentialMoves(['a', 'b'], 'grp', 1, flatWithGroup);

    expect(cmds).toHaveLength(2);
    // Both are from different parent (root → grp), so sequential insert at 1, 2
    expect(cmds[0]).toEqual({ sourcePath: 'a', targetParentPath: 'grp', targetIndex: 1 });
    expect(cmds[1]).toEqual({ sourcePath: 'b', targetParentPath: 'grp', targetIndex: 2 });
  });

  it('multi-select 3 items drag DOWN: a+b+c below d', () => {
    const cmds = buildSequentialMoves(['a', 'b', 'c'], null, 4, flat5);

    expect(cmds).toHaveLength(3);
    // All 3 sources are before the target, so all use the same effective index
    // Simulate: move a to 3 → [b,c,d,a,e]. move b to 3 → [c,d,a,b,e]. move c to 3 → [d,a,b,c,e]. ✓
    expect(cmds[0]).toEqual({ sourcePath: 'a', targetIndex: 3 });
    expect(cmds[1]).toEqual({ sourcePath: 'b', targetIndex: 3 });
    expect(cmds[2]).toEqual({ sourcePath: 'c', targetIndex: 3 });
  });
});

describe('computeDropTarget with layout entries', () => {
  function entry(overrides: Partial<FlatEntry>): FlatEntry {
    return {
      id: '', node: { component: 'TextInput' }, depth: 0, hasChildren: false,
      defPath: null, category: 'field', nodeId: undefined, bind: undefined,
      ...overrides,
    };
  }

  const flatWithLayout: FlatEntry[] = [
    entry({ id: 'name', defPath: 'name', category: 'field', bind: 'name', depth: 0 }),
    entry({ id: '__node:card_1', defPath: null, category: 'layout', nodeId: 'card_1', depth: 0, hasChildren: true }),
    entry({ id: 'age', defPath: 'age', category: 'field', bind: 'age', depth: 1 }),
    entry({ id: 'email', defPath: 'email', category: 'field', bind: 'email', depth: 0 }),
  ];

  it('returns component-only move for drag into layout container', () => {
    const result = computeDropTarget('name', '__node:card_1', 'inside', flatWithLayout);
    expectComponentMove(result, '__node:card_1', 1, {
      sourceNodeId: 'name',
      targetParentNodeId: 'card_1',
      targetIndex: 1,
    });
  });

  it('returns definition move when dragging between different groups', () => {
    const flatWithGroups: FlatEntry[] = [
      entry({ id: 'grpA', defPath: 'grpA', category: 'group', bind: 'grpA', depth: 0, hasChildren: true }),
      entry({ id: 'grpA.f1', defPath: 'grpA.f1', category: 'field', bind: 'f1', depth: 1 }),
      entry({ id: 'grpB', defPath: 'grpB', category: 'group', bind: 'grpB', depth: 0, hasChildren: true }),
      entry({ id: 'grpB.f2', defPath: 'grpB.f2', category: 'field', bind: 'f2', depth: 1 }),
    ];
    const result = computeDropTarget('grpA.f1', 'grpB', 'inside', flatWithGroups);
    expectDefinitionMove(result, 'grpB', 1, {
      sourcePath: 'grpA.f1',
      targetParentPath: 'grpB',
      targetIndex: 1,
    });
  });

  it('returns component-only move for layout node drag', () => {
    const result = computeDropTarget('__node:card_1', 'email', 'above', flatWithLayout);
    expect(result).toBeNull();
  });

  it('circular guard works with __node: ids', () => {
    const result = computeDropTarget('__node:card_1', 'age', 'above', flatWithLayout);
    expect(result).toBeNull();
  });

  it('"inside" zone activates for layout nodes', () => {
    const result = computeDropTarget('email', '__node:card_1', 'inside', flatWithLayout);
    expect(result).toMatchObject({ kind: 'component', parentPath: '__node:card_1' });
  });

  it('returns null for self-drop', () => {
    const result = computeDropTarget('name', 'name', 'above', flatWithLayout);
    expect(result).toBeNull();
  });

  // Layout containers are definition-transparent — dragging into any layout
  // container produces component.moveNode only, never a definition move.
  it('returns component-only move for drag from page group into root-level Card', () => {
    const wizardFlat: FlatEntry[] = [
      entry({ id: 'page1', defPath: 'page1', category: 'group', bind: 'page1', depth: 0, hasChildren: true }),
      entry({ id: 'page1.name', defPath: 'page1.name', category: 'field', bind: 'name', depth: 1 }),
      entry({ id: 'page1.email', defPath: 'page1.email', category: 'field', bind: 'email', depth: 1 }),
      entry({ id: '__node:card_1', defPath: null, category: 'layout', nodeId: 'card_1', depth: 0, hasChildren: false }),
    ];

    const result = computeDropTarget('page1.name', '__node:card_1', 'inside', wizardFlat);
    expect(result).toMatchObject({ kind: 'component', parentPath: '__node:card_1' });
  });

  it('returns component-only move for drag into Card nested inside a group', () => {
    const groupCardFlat: FlatEntry[] = [
      entry({ id: 'page1', defPath: 'page1', category: 'group', bind: 'page1', depth: 0, hasChildren: true }),
      entry({ id: 'page1.name', defPath: 'page1.name', category: 'field', bind: 'name', depth: 1 }),
      entry({ id: '__node:card_1', defPath: null, category: 'layout', nodeId: 'card_1', depth: 1, hasChildren: false }),
      entry({ id: 'page1.email', defPath: 'page1.email', category: 'field', bind: 'email', depth: 1 }),
    ];

    const result = computeDropTarget('page1.name', '__node:card_1', 'inside', groupCardFlat);
    expect(result).toMatchObject({ kind: 'component', parentPath: '__node:card_1' });
  });
});
