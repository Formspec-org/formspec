import { describe, it, expect } from 'vitest';
import {
  flattenComponentTree,
  buildDefLookup,
  isLayoutId,
  nodeIdFromLayoutId,
  nodeRefFor,
  type FlatEntry,
} from '../../src/lib/field-helpers';

// ── Helpers ────────────────────────────────────────────────────────

/** Shorthand for a bound field node. */
function fieldNode(bind: string, component = 'TextInput') {
  return { component, bind };
}

/** Shorthand for a bound group node with children. */
function groupNode(bind: string, children: any[], component = 'Stack') {
  return { component, bind, children };
}

/** Shorthand for a display node. */
function displayNode(nodeId: string, component = 'Text', text = '') {
  return { component, nodeId, text };
}

/** Shorthand for a layout container node. */
function layoutNode(nodeId: string, component: string, children: any[] = [], props: Record<string, unknown> = {}) {
  return { component, nodeId, _layout: true, children, ...props };
}

// ── Definition items for lookup ─────────────────────────────────────

const sampleItems = [
  { key: 'name', type: 'field', dataType: 'string' },
  { key: 'age', type: 'field', dataType: 'integer' },
  {
    key: 'address', type: 'group', children: [
      { key: 'street', type: 'field', dataType: 'string' },
      { key: 'city', type: 'field', dataType: 'string' },
    ],
  },
  { key: 'note', type: 'display' },
];

// ── flattenComponentTree ────────────────────────────────────────────

describe('flattenComponentTree', () => {
  it('flattens a bound-only tree matching flatItems ordering', () => {
    const tree = {
      component: 'Stack', nodeId: 'root', children: [
        fieldNode('name'),
        fieldNode('age'),
        groupNode('address', [
          fieldNode('street'),
          fieldNode('city'),
        ]),
      ],
    };
    const defLookup = buildDefLookup(sampleItems as any);
    const entries = flattenComponentTree(tree, defLookup);

    expect(entries.map(e => e.id)).toEqual([
      'name',
      'age',
      'address',
      'address.street',
      'address.city',
    ]);
  });

  it('assigns __node: prefixed IDs to layout nodes', () => {
    const tree = {
      component: 'Stack', nodeId: 'root', children: [
        layoutNode('node_1', 'Card', [
          fieldNode('name'),
        ]),
      ],
    };
    const defLookup = buildDefLookup(sampleItems as any);
    const entries = flattenComponentTree(tree, defLookup);

    expect(entries[0].id).toBe('__node:node_1');
    expect(entries[0].category).toBe('layout');
    expect(entries[1].id).toBe('name');
  });

  it('layout nodes do not alter definition paths of their children', () => {
    const tree = {
      component: 'Stack', nodeId: 'root', children: [
        layoutNode('node_1', 'Card', [
          fieldNode('name'),
          fieldNode('age'),
        ]),
      ],
    };
    const defLookup = buildDefLookup(sampleItems as any);
    const entries = flattenComponentTree(tree, defLookup);

    // name and age should have flat def paths, not prefixed by the Card
    const nameEntry = entries.find(e => e.id === 'name')!;
    const ageEntry = entries.find(e => e.id === 'age')!;
    expect(nameEntry.defPath).toBe('name');
    expect(ageEntry.defPath).toBe('age');
  });

  it('nested groups produce correct depth and path prefixes', () => {
    const tree = {
      component: 'Stack', nodeId: 'root', children: [
        groupNode('address', [
          fieldNode('street'),
          fieldNode('city'),
        ]),
      ],
    };
    const defLookup = buildDefLookup(sampleItems as any);
    const entries = flattenComponentTree(tree, defLookup);

    expect(entries.map(e => ({ id: e.id, depth: e.depth, defPath: e.defPath }))).toEqual([
      { id: 'address', depth: 0, defPath: 'address' },
      { id: 'address.street', depth: 1, defPath: 'address.street' },
      { id: 'address.city', depth: 1, defPath: 'address.city' },
    ]);
  });

  it('categorizes fields, groups, displays, and layouts correctly', () => {
    const tree = {
      component: 'Stack', nodeId: 'root', children: [
        fieldNode('name'),
        groupNode('address', []),
        displayNode('note', 'Heading'),
        layoutNode('node_1', 'Card'),
      ],
    };
    const defLookup = buildDefLookup(sampleItems as any);
    const entries = flattenComponentTree(tree, defLookup);

    expect(entries.map(e => ({ id: e.id, category: e.category }))).toEqual([
      { id: 'name', category: 'field' },
      { id: 'address', category: 'group' },
      { id: 'note', category: 'display' },
      { id: '__node:node_1', category: 'layout' },
    ]);
  });

  it('tracks hasChildren for groups and layout containers', () => {
    const tree = {
      component: 'Stack', nodeId: 'root', children: [
        groupNode('address', [fieldNode('street')]),
        layoutNode('node_1', 'Card', [fieldNode('name')]),
        groupNode('empty_group', []),
      ],
    };
    const items = [
      ...sampleItems,
      { key: 'empty_group', type: 'group', children: [] },
    ];
    const defLookup = buildDefLookup(items as any);
    const entries = flattenComponentTree(tree, defLookup);

    const addressEntry = entries.find(e => e.id === 'address')!;
    const layoutEntry = entries.find(e => e.id === '__node:node_1')!;
    const emptyGroup = entries.find(e => e.id === 'empty_group')!;

    expect(addressEntry.hasChildren).toBe(true);
    expect(layoutEntry.hasChildren).toBe(true);
    expect(emptyGroup.hasChildren).toBe(false);
  });

  it('handles deeply nested layout inside group', () => {
    const tree = {
      component: 'Stack', nodeId: 'root', children: [
        groupNode('address', [
          layoutNode('node_1', 'Card', [
            fieldNode('street'),
          ]),
          fieldNode('city'),
        ]),
      ],
    };
    const defLookup = buildDefLookup(sampleItems as any);
    const entries = flattenComponentTree(tree, defLookup);

    expect(entries.map(e => ({ id: e.id, depth: e.depth, defPath: e.defPath }))).toEqual([
      { id: 'address', depth: 0, defPath: 'address' },
      { id: '__node:node_1', depth: 1, defPath: null },
      { id: 'address.street', depth: 2, defPath: 'address.street' },
      { id: 'address.city', depth: 1, defPath: 'address.city' },
    ]);
  });

  it('display nodes inside groups use defPath as id (not bare nodeId)', () => {
    const tree = {
      component: 'Stack', nodeId: 'root', children: [
        groupNode('address', [
          displayNode('note', 'Heading'),
          fieldNode('street'),
        ]),
      ],
    };
    const items = [
      {
        key: 'address', type: 'group', children: [
          { key: 'note', type: 'display' },
          { key: 'street', type: 'field', dataType: 'string' },
        ],
      },
    ];
    const defLookup = buildDefLookup(items as any);
    const entries = flattenComponentTree(tree, defLookup);

    // Display node id must be the full defPath for DnD consistency
    const displayEntry = entries.find(e => e.category === 'display')!;
    expect(displayEntry.id).toBe('address.note');
    expect(displayEntry.defPath).toBe('address.note');
  });

  it('display node inside layout container uses bindKeyMap fallback', () => {
    // Simulates wizard mode: display is at page1.heading1 in definition,
    // but has been moved into a root-level Card in the component tree.
    const tree = {
      component: 'Stack', nodeId: 'root', children: [
        layoutNode('card_1', 'Card', [
          displayNode('heading1', 'Heading'),
        ]),
        groupNode('page1', [
          fieldNode('name'),
        ]),
      ],
    };
    const items = [
      {
        key: 'page1', type: 'group', children: [
          { key: 'heading1', type: 'display' },
          { key: 'name', type: 'field', dataType: 'string' },
        ],
      },
    ];
    const defLookup = buildDefLookup(items as any);
    const bindKeyMap = new Map([['heading1', 'page1.heading1']]);
    const entries = flattenComponentTree(tree, defLookup, bindKeyMap);

    const displayEntry = entries.find(e => e.category === 'display')!;
    expect(displayEntry).toBeDefined();
    expect(displayEntry.id).toBe('page1.heading1');
    expect(displayEntry.defPath).toBe('page1.heading1');
  });

  it('returns empty array for tree with no children', () => {
    const tree = { component: 'Stack', nodeId: 'root', children: [] };
    const defLookup = buildDefLookup([]);
    expect(flattenComponentTree(tree, defLookup)).toEqual([]);
  });

  it('preserves node reference info (bind, nodeId)', () => {
    const tree = {
      component: 'Stack', nodeId: 'root', children: [
        fieldNode('name'),
        layoutNode('node_1', 'Card'),
        displayNode('note'),
      ],
    };
    const defLookup = buildDefLookup(sampleItems as any);
    const entries = flattenComponentTree(tree, defLookup);

    expect(entries[0].bind).toBe('name');
    expect(entries[0].nodeId).toBeUndefined();
    expect(entries[1].bind).toBeUndefined();
    expect(entries[1].nodeId).toBe('node_1');
    expect(entries[2].bind).toBeUndefined();
    expect(entries[2].nodeId).toBe('note');
  });
});

// ── buildDefLookup ──────────────────────────────────────────────────

describe('buildDefLookup', () => {
  it('builds a flat map from item key to item + path', () => {
    const lookup = buildDefLookup(sampleItems as any);
    expect(lookup.get('name')).toEqual({
      item: sampleItems[0],
      path: 'name',
      parentPath: null,
    });
    expect(lookup.get('address.street')).toEqual({
      item: (sampleItems[2] as any).children[0],
      path: 'address.street',
      parentPath: 'address',
    });
  });

  it('handles empty items', () => {
    expect(buildDefLookup([])).toEqual(new Map());
  });
});

// ── Identity helpers ────────────────────────────────────────────────

describe('isLayoutId', () => {
  it('returns true for __node: prefixed ids', () => {
    expect(isLayoutId('__node:node_1')).toBe(true);
    expect(isLayoutId('__node:root')).toBe(true);
  });

  it('returns false for definition paths', () => {
    expect(isLayoutId('name')).toBe(false);
    expect(isLayoutId('address.street')).toBe(false);
    expect(isLayoutId('')).toBe(false);
  });
});

describe('nodeIdFromLayoutId', () => {
  it('extracts nodeId from __node: prefixed id', () => {
    expect(nodeIdFromLayoutId('__node:node_1')).toBe('node_1');
    expect(nodeIdFromLayoutId('__node:root')).toBe('root');
  });

  it('returns the input unchanged for non-layout ids', () => {
    expect(nodeIdFromLayoutId('name')).toBe('name');
  });
});

describe('nodeRefFor', () => {
  it('returns bind ref for bound entries', () => {
    const entry: FlatEntry = {
      id: 'name', node: fieldNode('name'), depth: 0,
      hasChildren: false, defPath: 'name', category: 'field' as const,
      bind: 'name', nodeId: undefined,
    };
    expect(nodeRefFor(entry)).toEqual({ bind: 'name' });
  });

  it('returns nodeId ref for layout entries', () => {
    const entry: FlatEntry = {
      id: '__node:node_1', node: layoutNode('node_1', 'Card'), depth: 0,
      hasChildren: false, defPath: null, category: 'layout' as const,
      bind: undefined, nodeId: 'node_1',
    };
    expect(nodeRefFor(entry)).toEqual({ nodeId: 'node_1' });
  });

  it('returns nodeId ref for display entries', () => {
    const entry: FlatEntry = {
      id: 'note', node: displayNode('note'), depth: 0,
      hasChildren: false, defPath: 'note', category: 'display' as const,
      bind: undefined, nodeId: 'note',
    };
    expect(nodeRefFor(entry)).toEqual({ nodeId: 'note' });
  });
});
