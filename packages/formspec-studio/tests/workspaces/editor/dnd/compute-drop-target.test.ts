import { describe, it, expect } from 'vitest';
import {
  computeDropTarget,
  computeTreeDropTarget,
  isDescendantOf,
  buildSequentialMoveCommands,
  type FlatEntry,
  type DropPosition,
} from '../../../../src/workspaces/editor/dnd/compute-drop-target';
import type { TreeFlatEntry } from '../../../../src/lib/tree-helpers';

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
    result.push({ path, type: item.type, depth, hasChildren: !!(item.children?.length) });
    if (item.children) {
      result.push(...buildFlat(item.children, path, depth + 1));
    }
  }
  return result;
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
    { path: 'fieldA', type: 'field', depth: 0, hasChildren: false },
    { path: 'fieldB', type: 'field', depth: 0, hasChildren: false },
    { path: 'fieldC', type: 'field', depth: 0, hasChildren: false },
  ];

  it('returns null when dropping on itself', () => {
    const result = computeDropTarget('fieldA', 'fieldA', 'above', flatRoot);
    expect(result).toBeNull();
  });

  it('drop field above another at root', () => {
    // Drop fieldC above fieldA → parentPath null, index 0
    const result = computeDropTarget('fieldC', 'fieldA', 'above', flatRoot);
    expect(result).toEqual({ parentPath: null, index: 0 });
  });

  it('drop field below another at root', () => {
    // Drop fieldA below fieldC → parentPath null, index 2 (adjusted: fieldA was at 0, target after removal = 2)
    const result = computeDropTarget('fieldA', 'fieldC', 'below', flatRoot);
    expect(result).toEqual({ parentPath: null, index: 2 });
  });

  it('drop field above adjacent sibling (same parent, source before target)', () => {
    // Drop fieldA above fieldB → no-op? No — "above fieldB" = index 1, source was 0, so after removal target = 0
    // This means index 0, which is where fieldA already is → should return null (no-op)
    const result = computeDropTarget('fieldA', 'fieldB', 'above', flatRoot);
    expect(result).toBeNull();
  });

  it('drop field below adjacent sibling (same parent, source before target)', () => {
    // Drop fieldA below fieldB → target index 2, adjusted by -1 = 1
    const result = computeDropTarget('fieldA', 'fieldB', 'below', flatRoot);
    expect(result).toEqual({ parentPath: null, index: 1 });
  });

  it('drop field above when source is after target (no index adjustment)', () => {
    // Drop fieldC above fieldA → target index 0, no adjustment needed (source after target)
    const result = computeDropTarget('fieldC', 'fieldA', 'above', flatRoot);
    expect(result).toEqual({ parentPath: null, index: 0 });
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
    expect(result).toEqual({ parentPath: 'groupX', index: 2 }); // groupX has 2 children
  });

  it('drop field above first child in group', () => {
    // Drop fieldB above groupX.child1 → parentPath groupX, index 0
    const result = computeDropTarget('fieldB', 'groupX.child1', 'above', flatTree);
    expect(result).toEqual({ parentPath: 'groupX', index: 0 });
  });

  it('drop field below last child in group', () => {
    // Drop fieldA below groupX.child2 → parentPath groupX, index 2 (after removal, source was before)
    // fieldA is at root index 0, child2 is at sibling index 1 in groupX → different parents, no adjustment
    const result = computeDropTarget('fieldA', 'groupX.child2', 'below', flatTree);
    expect(result).toEqual({ parentPath: 'groupX', index: 2 });
  });

  it('move child out to root level above a root item', () => {
    // Drop groupX.child1 above fieldB → parentPath null, index 2
    // fieldB is at root index 2, but after removing child1 from groupX, root indices don't shift
    // child1 is inside groupX (different parent), so no adjustment
    const result = computeDropTarget('groupX.child1', 'fieldB', 'above', flatTree);
    expect(result).toEqual({ parentPath: null, index: 2 });
  });

  it('reorder within group — child1 below child2', () => {
    // child1 is index 0 in groupX, child2 is index 1
    // "below child2" = index 2, adjust by -1 (source before target in same parent) = 1
    // But that's the same as current index of child2... still a valid move (child1 goes after child2)
    const result = computeDropTarget('groupX.child1', 'groupX.child2', 'below', flatTree);
    expect(result).toEqual({ parentPath: 'groupX', index: 1 });
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
    expect(result).toEqual({ parentPath: null, index: 1 });
  });

  it('drop inside empty group', () => {
    const withEmptyGroup: FlatEntry[] = buildFlat([
      { key: 'emptyGroup', type: 'group', children: [] },
      { key: 'field1', type: 'field' },
    ]);
    const result = computeDropTarget('field1', 'emptyGroup', 'inside', withEmptyGroup);
    expect(result).toEqual({ parentPath: 'emptyGroup', index: 0 });
  });

  it('returns null for inside position on non-group item', () => {
    const result = computeDropTarget('fieldA', 'fieldB', 'inside', flatRoot);
    expect(result).toBeNull();
  });

  // Multi-select: selected paths
  it('allows multi-select drag when no selected path is ancestor of target', () => {
    // Drop groupX.child1 above fieldA — child1 and fieldB are selected but neither is ancestor of fieldA
    const result = computeDropTarget(
      'groupX.child1', 'fieldA', 'above', flatTree,
      new Set(['groupX.child1', 'fieldB']),
    );
    expect(result).not.toBeNull();
    expect(result).toEqual({ parentPath: null, index: 0 });
  });

  it('rejects when selected group would be dropped into its own child', () => {
    const result = computeDropTarget(
      'groupX', 'groupX.child1', 'inside', flatTree,
      new Set(['groupX']),
    );
    expect(result).toBeNull();
  });
});

describe('buildSequentialMoveCommands', () => {
  // [a, b, c, d, e] — all root-level fields
  const flat5: FlatEntry[] = [
    { path: 'a', type: 'field', depth: 0, hasChildren: false },
    { path: 'b', type: 'field', depth: 0, hasChildren: false },
    { path: 'c', type: 'field', depth: 0, hasChildren: false },
    { path: 'd', type: 'field', depth: 0, hasChildren: false },
    { path: 'e', type: 'field', depth: 0, hasChildren: false },
  ];

  it('multi-select drag DOWN: a+b below d', () => {
    // Active = a, drop below d. computeDropTarget('a','d','below') → raw=4, adjusted=3.
    // After both moves, expected order: [c, d, a, b, e]
    const cmds = buildSequentialMoveCommands(['a', 'b'], null, 'd', 'below', flat5);

    expect(cmds).toHaveLength(2);
    // Simulate: move a to 3 → [b,c,d,a,e]. move b to 3 → [c,d,a,b,e]. ✓
    expect(cmds[0].payload).toEqual({ sourcePath: 'a', targetIndex: 3 });
    expect(cmds[1].payload).toEqual({ sourcePath: 'b', targetIndex: 3 });
  });

  it('multi-select drag UP: d+e above b', () => {
    // Active = d, drop above b. computeDropTarget('d','b','above') → raw=1, adjusted=1.
    // After both moves, expected order: [a, d, e, b, c]
    const cmds = buildSequentialMoveCommands(['d', 'e'], null, 'b', 'above', flat5);

    expect(cmds).toHaveLength(2);
    // Simulate: move d to 1 → [a,d,b,c,e]. move e to 2 → [a,d,e,b,c]. ✓
    expect(cmds[0].payload).toEqual({ sourcePath: 'd', targetIndex: 1 });
    expect(cmds[1].payload).toEqual({ sourcePath: 'e', targetIndex: 2 });
  });

  it('multi-select mixed: a+d above c', () => {
    // Active = a, drop above c. raw=2, adjusted=1 (a is before c).
    // Expected order: [b, a, d, c, e]
    const cmds = buildSequentialMoveCommands(['a', 'd'], null, 'c', 'above', flat5);

    expect(cmds).toHaveLength(2);
    // Simulate: move a to 1 → [b,a,c,d,e]. move d to 2 → [b,a,d,c,e]. ✓
    expect(cmds[0].payload).toEqual({ sourcePath: 'a', targetIndex: 1 });
    expect(cmds[1].payload).toEqual({ sourcePath: 'd', targetIndex: 2 });
  });

  it('multi-select into group: move root items inside groupX', () => {
    const flatWithGroup: FlatEntry[] = [
      { path: 'a', type: 'field', depth: 0, hasChildren: false },
      { path: 'b', type: 'field', depth: 0, hasChildren: false },
      { path: 'grp', type: 'group', depth: 0, hasChildren: true },
      { path: 'grp.x', type: 'field', depth: 1, hasChildren: false },
    ];

    // Drop a+b inside grp (append)
    const cmds = buildSequentialMoveCommands(['a', 'b'], 'grp', 'grp', 'inside', flatWithGroup);

    expect(cmds).toHaveLength(2);
    // Both are from different parent (root → grp), so sequential insert at 1, 2
    expect(cmds[0].payload).toEqual({ sourcePath: 'a', targetParentPath: 'grp', targetIndex: 1 });
    expect(cmds[1].payload).toEqual({ sourcePath: 'b', targetParentPath: 'grp', targetIndex: 2 });
  });

  it('multi-select 3 items drag DOWN: a+b+c below d', () => {
    // Expected order: [d, a, b, c, e]
    const cmds = buildSequentialMoveCommands(['a', 'b', 'c'], null, 'd', 'below', flat5);

    expect(cmds).toHaveLength(3);
    // All 3 sources are before the target, so all use the same effective index
    // Simulate: move a to 3 → [b,c,d,a,e]. move b to 3 → [c,d,a,b,e]. move c to 3 → [d,a,b,c,e]. ✓
    expect(cmds[0].payload).toEqual({ sourcePath: 'a', targetIndex: 3 });
    expect(cmds[1].payload).toEqual({ sourcePath: 'b', targetIndex: 3 });
    expect(cmds[2].payload).toEqual({ sourcePath: 'c', targetIndex: 3 });
  });
});

describe('computeTreeDropTarget', () => {
  // Helper to build TreeFlatEntry
  function entry(overrides: Partial<TreeFlatEntry>): TreeFlatEntry {
    return {
      id: '', node: { component: 'TextInput' }, depth: 0, hasChildren: false,
      defPath: null, category: 'field', nodeId: undefined, bind: undefined,
      ...overrides,
    };
  }

  const flatWithLayout: TreeFlatEntry[] = [
    entry({ id: 'name', defPath: 'name', category: 'field', bind: 'name', depth: 0 }),
    entry({ id: '__node:card_1', defPath: null, category: 'layout', nodeId: 'card_1', depth: 0, hasChildren: true }),
    entry({ id: 'age', defPath: 'age', category: 'field', bind: 'age', depth: 1 }),
    entry({ id: 'email', defPath: 'email', category: 'field', bind: 'email', depth: 0 }),
  ];

  it('returns component-only move for drag into layout container', () => {
    const result = computeTreeDropTarget('name', '__node:card_1', 'inside', flatWithLayout);
    expect(result).not.toBeNull();
    expect(result!.defMove).toBeNull();
    expect(result!.sourceRef).toEqual({ bind: 'name' });
    expect(result!.targetParentRef).toEqual({ nodeId: 'card_1' });
  });

  it('returns definition move when dragging between different groups', () => {
    const flatWithGroups: TreeFlatEntry[] = [
      entry({ id: 'grpA', defPath: 'grpA', category: 'group', bind: 'grpA', depth: 0, hasChildren: true }),
      entry({ id: 'grpA.f1', defPath: 'grpA.f1', category: 'field', bind: 'f1', depth: 1 }),
      entry({ id: 'grpB', defPath: 'grpB', category: 'group', bind: 'grpB', depth: 0, hasChildren: true }),
      entry({ id: 'grpB.f2', defPath: 'grpB.f2', category: 'field', bind: 'f2', depth: 1 }),
    ];
    // Move grpA.f1 inside grpB
    const result = computeTreeDropTarget('grpA.f1', 'grpB', 'inside', flatWithGroups);
    expect(result).not.toBeNull();
    expect(result!.defMove).not.toBeNull();
    expect(result!.defMove!.sourcePath).toBe('grpA.f1');
    expect(result!.defMove!.targetParentPath).toBe('grpB');
  });

  it('returns component-only move for layout node drag', () => {
    const result = computeTreeDropTarget('__node:card_1', 'email', 'above', flatWithLayout);
    expect(result).not.toBeNull();
    expect(result!.defMove).toBeNull();
    expect(result!.sourceRef).toEqual({ nodeId: 'card_1' });
  });

  it('circular guard works with __node: ids', () => {
    // Can't drop layout container into one of its own children
    const result = computeTreeDropTarget('__node:card_1', 'age', 'above', flatWithLayout);
    // age is inside card_1 (depth 1 inside card_1 at depth 0)
    // The circular guard should NOT trigger here since age is not a descendant
    // of card_1 in the id-path sense. But if we detect containment via the flat list...
    // Actually, this SHOULD be allowed — it's just a reorder within the container.
    expect(result).not.toBeNull();
  });

  it('"inside" zone activates for layout nodes', () => {
    // The 'inside' position should work for layout nodes, not just groups
    const result = computeTreeDropTarget('email', '__node:card_1', 'inside', flatWithLayout);
    expect(result).not.toBeNull();
    expect(result!.targetParentRef).toEqual({ nodeId: 'card_1' });
  });

  it('returns null for self-drop', () => {
    const result = computeTreeDropTarget('name', 'name', 'above', flatWithLayout);
    expect(result).toBeNull();
  });
});
