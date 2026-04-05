/** @filedesc Tests for shared authoring helpers moved out of the Studio UI package. */
import { describe, expect, it } from 'vitest';
import {
  buildBatchMoveCommands,
  buildBindKeyMap,
  buildDefLookup,
  compatibleWidgets,
  computeUnassignedItems,
  countDefinitionFields,
  dataTypeInfo,
  flatItems,
  findComponentNodeById,
  findComponentNodeByRef,
  flattenComponentTree,
  isCircularComponentMove,
  getFieldTypeCatalog,
  humanizeFEL,
  isLayoutId,
  nodeIdFromLayoutId,
  nodeRefFor,
  normalizeBindEntries,
  resolveLayoutSelectionNodeRef,
  normalizeBindsView,
  pruneDescendants,
  sanitizeIdentifier,
  shapesFor,
  sortForBatchDelete,
} from '../src/authoring-helpers';

function fieldNode(bind: string, component = 'TextInput') {
  return { component, bind };
}

function groupNode(bind: string, children: any[], component = 'Stack') {
  return { component, bind, children };
}

function displayNode(nodeId: string, component = 'Text', text = '') {
  return { component, nodeId, text };
}

function layoutNode(nodeId: string, component: string, children: any[] = []) {
  return { component, nodeId, _layout: true, children };
}

const sampleItems = [
  { key: 'name', type: 'field', dataType: 'string' },
  {
    key: 'address', type: 'group', children: [
      { key: 'street', type: 'field', dataType: 'string' },
      { key: 'city', type: 'field', dataType: 'string' },
    ],
  },
  { key: 'note', type: 'display' },
];

describe('authoring-helpers', () => {
  it('builds a nested definition lookup and bind-key map', () => {
    const lookup = buildDefLookup(sampleItems as any);
    expect(lookup.get('address.city')?.item.key).toBe('city');

    const bindKeyMap = buildBindKeyMap(lookup);
    expect(bindKeyMap.get('city')).toBe('address.city');
  });

  it('flattens nested items and resolves shapes by path', () => {
    const flattened = flatItems(sampleItems as any);
    expect(flattened.map((entry) => entry.path)).toEqual([
      'name',
      'address',
      'address.street',
      'address.city',
      'note',
    ]);

    const shapes = [
      { name: 's1', targets: ['address.city'] },
      { name: 's2', target: 'name' },
    ];
    expect(shapesFor(shapes as any, 'address.city')).toEqual([{ name: 's1', targets: ['address.city'] }]);
    expect(shapesFor(shapes as any, 'name')).toEqual([{ name: 's2', target: 'name' }]);
  });

  it('normalizes binds into array and record views', () => {
    expect(normalizeBindEntries([{ path: 'age', required: 'true', calculate: '$x' }] as any)).toEqual([
      { path: 'age', entries: { required: 'true', calculate: '$x' } },
    ]);

    expect(normalizeBindEntries({ age: { required: 'true' } } as any)).toEqual([
      { path: 'age', entries: { required: 'true' } },
    ]);

    expect(
      normalizeBindsView(
        [{ path: 'age', required: 'true' }] as any,
        [{ key: 'age', type: 'field', dataType: 'integer', prePopulate: { instance: 'seed', path: 'age' } }] as any,
      ),
    ).toEqual({
      age: { 'pre-populate': { instance: 'seed', path: 'age' }, required: 'true' },
    });
  });

  it('flattens component trees without losing definition paths through layout nodes', () => {
    const tree = {
      component: 'Stack',
      nodeId: 'root',
      children: [
        layoutNode('card_1', 'Card', [
          fieldNode('name'),
        ]),
        groupNode('address', [
          fieldNode('street'),
          displayNode('note', 'Heading'),
        ]),
      ],
    };

    const lookup = buildDefLookup([
      ...sampleItems,
      {
        key: 'address', type: 'group', children: [
          { key: 'street', type: 'field', dataType: 'string' },
          { key: 'note', type: 'display' },
        ],
      },
    ] as any);

    const entries = flattenComponentTree(tree as any, lookup);
    expect(entries.map((entry) => entry.id)).toEqual([
      '__node:card_1',
      'name',
      'address',
      'address.street',
      'address.note',
    ]);
  });

  it('handles layout node helpers and batch move planning', () => {
    expect(isLayoutId('__node:card_1')).toBe(true);
    expect(nodeIdFromLayoutId('__node:card_1')).toBe('card_1');
    expect(nodeRefFor({ nodeId: 'card_1', bind: undefined })).toEqual({ nodeId: 'card_1' });

    const pruned = pruneDescendants(new Set(['group', 'group.child', 'solo']));
    expect(pruned.sort()).toEqual(['group', 'solo']);
    expect(sortForBatchDelete(['a', 'a.b', 'a.b.c'])).toEqual(['a.b.c', 'a.b', 'a']);

    const commands = buildBatchMoveCommands(new Set(['group', 'group.child', 'field']), 'target');
    expect(commands).toEqual([
      { type: 'definition.moveItem', payload: { sourcePath: 'group', targetParentPath: 'target', targetIndex: 0 } },
      { type: 'definition.moveItem', payload: { sourcePath: 'field', targetParentPath: 'target', targetIndex: 1 } },
    ]);
  });

  it('humanizes simple FEL comparisons', () => {
    expect(humanizeFEL('$age >= 18')).toBe('Age is at least 18');
    expect(humanizeFEL('$isActive = false')).toBe('Is Active is No');
    expect(humanizeFEL('count($items)')).toBe('count($items)');
  });

  it('returns the canonical add-item catalog with layout and display entries intact', () => {
    const catalog = getFieldTypeCatalog();
    expect(catalog.find((entry) => entry.label === 'Single Choice')?.dataType).toBe('choice');
    expect(catalog.find((entry) => entry.label === 'Multiple Choice')?.dataType).toBe('multiChoice');
    expect(catalog.filter((entry) => entry.itemType === 'layout').map((entry) => entry.label)).toEqual(
      expect.arrayContaining(['Card', 'Columns', 'Collapsible', 'Stack', 'Spacer']),
    );
  });

  it('uses spec-lowercase widgetHint values (CoreSpec S4.2.5.1)', () => {
    const catalog = getFieldTypeCatalog();
    const VALID_DISPLAY_HINTS = new Set(['paragraph', 'heading', 'divider', 'banner']);
    const displayEntries = catalog.filter((e) => e.extra?.presentation && (e.extra.presentation as any).widgetHint);
    for (const entry of displayEntries) {
      const hint = (entry.extra!.presentation as any).widgetHint as string;
      expect(
        VALID_DISPLAY_HINTS.has(hint),
        `'${entry.label}' uses widgetHint '${hint}' — must be spec-lowercase (one of: ${[...VALID_DISPLAY_HINTS].join(', ')})`,
      ).toBe(true);
    }
  });

  it('Spacer is a layout component (not a display widgetHint) (CoreSpec §4.2.5.1, ComponentSpec §5.5)', () => {
    const catalog = getFieldTypeCatalog();
    const spacer = catalog.find((e) => e.label === 'Spacer');
    expect(spacer).toBeDefined();
    expect(spacer!.itemType).toBe('layout');
    expect(spacer!.component).toBe('Spacer');
    // Must NOT carry a widgetHint — Spacer has no Tier 1 spec representation
    expect((spacer!.extra as any)?.presentation?.widgetHint).toBeUndefined();
  });

  it('includes Tabs in the group widget list (CoreSpec S4.2.5.1 tab → Tabs)', () => {
    const groupWidgets = compatibleWidgets('group');
    expect(groupWidgets).toContain('Tabs');
  });

  it('uses only spec-normative dataType values and covers all 13 spec types', () => {
    const SPEC_DATA_TYPES = new Set([
      'string', 'text', 'integer', 'decimal', 'boolean',
      'date', 'dateTime', 'time', 'uri', 'attachment',
      'choice', 'multiChoice', 'money',
    ]);
    const catalog = getFieldTypeCatalog();
    const fieldEntries = catalog.filter((e) => e.dataType);
    for (const entry of fieldEntries) {
      expect(SPEC_DATA_TYPES.has(entry.dataType!), `'${entry.label}' uses non-spec dataType '${entry.dataType}'`).toBe(true);
    }
    const coveredDataTypes = new Set(fieldEntries.map((e) => e.dataType));
    for (const specType of SPEC_DATA_TYPES) {
      expect(coveredDataTypes.has(specType), `spec dataType '${specType}' missing from catalog`).toBe(true);
    }
  });

  it('maps File Upload to the spec attachment dataType, not binary', () => {
    const catalog = getFieldTypeCatalog();
    const fileUpload = catalog.find((e) => e.label === 'File Upload');
    expect(fileUpload?.dataType).toBe('attachment');
  });

  it('does not include non-spec dataTypes in TYPE_MAP display entries', () => {
    const NON_SPEC_TYPES = ['select1', 'select', 'binary', 'geopoint', 'barcode'];
    for (const badType of NON_SPEC_TYPES) {
      const info = dataTypeInfo(badType);
      expect(info.icon, `non-spec type '${badType}' should use fallback icon`).toBe('?');
    }
  });

  it('returns proper display info for the spec attachment dataType', () => {
    const info = dataTypeInfo('attachment');
    expect(info.icon).not.toBe('?');
    expect(info.label).toBe('File');
  });

  it('counts nested field items across the definition tree', () => {
    expect(countDefinitionFields(sampleItems as any)).toBe(3);
  });

  it('sanitizes identifiers for studio-authored names', () => {
    expect(sanitizeIdentifier('my source!!!')).toBe('my_source');
    expect(sanitizeIdentifier('already__ok__')).toBe('already_ok');
  });

  it('computes unassigned items from the authored component tree', () => {
    const items = [
      { key: 'a', type: 'field', dataType: 'string', label: 'A' },
      { key: 'group', type: 'group', label: 'Group' },
      { key: 'notice', type: 'display', label: 'Notice' },
    ] as any;
    const tree = [
      fieldNode('a'),
      layoutNode('card_1', 'Card', [displayNode('notice')]),
    ];

    expect(computeUnassignedItems(items, tree as any)).toEqual([
      { key: 'group', label: 'Group', itemType: 'group' },
    ]);
  });

  it('ignores layout node ids and falls back to item keys for missing labels', () => {
    const items = [{ key: 'card_1', type: 'field', dataType: 'string' }] as any;
    const tree = [layoutNode('card_1', 'Card')];

    expect(computeUnassignedItems(items, tree as any)).toEqual([
      { key: 'card_1', label: 'card_1', itemType: 'field' },
    ]);
  });

  it('finds component nodes by nodeId anywhere in the tree', () => {
    const tree = {
      component: 'Stack',
      nodeId: 'root',
      children: [
        layoutNode('card_1', 'Card', [
          fieldNode('name'),
          layoutNode('inner_panel', 'Panel'),
        ]),
      ],
    };

    expect(findComponentNodeById(tree as any, 'inner_panel')).toMatchObject({ component: 'Panel', nodeId: 'inner_panel' });
    expect(findComponentNodeById(tree as any, 'missing')).toBeNull();
  });

  it('resolveLayoutSelectionNodeRef maps layout keys to bind or nodeId for setNodeStyle', () => {
    const treeShortLeaf = {
      component: 'Stack',
      nodeId: 'root',
      children: [
        groupNode('address', [fieldNode('city')]),
        fieldNode('name'),
        displayNode('notice_1'),
      ],
    } as any;
    expect(resolveLayoutSelectionNodeRef(treeShortLeaf, 'address.city')).toEqual({ bind: 'city' });
    expect(resolveLayoutSelectionNodeRef(treeShortLeaf, 'name')).toEqual({ bind: 'name' });
    expect(resolveLayoutSelectionNodeRef(treeShortLeaf, 'notice_1')).toEqual({ nodeId: 'notice_1' });
    expect(resolveLayoutSelectionNodeRef(treeShortLeaf, '__node:card_1')).toEqual({ nodeId: 'card_1' });

    const treeFullBind = {
      component: 'Stack',
      nodeId: 'root',
      children: [fieldNode('address.city')],
    } as any;
    expect(resolveLayoutSelectionNodeRef(treeFullBind, 'address.city')).toEqual({ bind: 'address.city' });

    const treeMixedLeaf = {
      component: 'Stack',
      nodeId: 'root',
      children: [
        groupNode('section', [fieldNode('email'), displayNode('intro')]),
      ],
    } as any;
    expect(resolveLayoutSelectionNodeRef(treeMixedLeaf, 'section.email')).toEqual({ bind: 'email' });
    expect(resolveLayoutSelectionNodeRef(treeMixedLeaf, 'section.intro')).toEqual({ nodeId: 'intro' });
  });

  it('findComponentNodeByRef resolves bind or nodeId', () => {
    const tree = {
      component: 'Stack',
      nodeId: 'root',
      children: [
        layoutNode('card_1', 'Card', [fieldNode('email')]),
      ],
    };
    expect(findComponentNodeByRef(tree as any, { nodeId: 'card_1' })?.component).toBe('Card');
    expect(findComponentNodeByRef(tree as any, { bind: 'email' })?.bind).toBe('email');
    expect(findComponentNodeByRef(tree as any, { nodeId: 'nope' })).toBeNull();
  });

  it('isCircularComponentMove is true when target parent is source or inside source subtree', () => {
    const inner = layoutNode('inner_stack', 'Stack', [fieldNode('email')]);
    const tree = {
      component: 'Stack',
      nodeId: 'root',
      children: [layoutNode('outer_stack', 'Stack', [inner])],
    };
    expect(isCircularComponentMove(tree as any, { nodeId: 'outer_stack' }, { nodeId: 'outer_stack' })).toBe(true);
    expect(isCircularComponentMove(tree as any, { nodeId: 'outer_stack' }, { nodeId: 'inner_stack' })).toBe(true);
    expect(isCircularComponentMove(tree as any, { nodeId: 'inner_stack' }, { nodeId: 'outer_stack' })).toBe(false);
    expect(isCircularComponentMove(tree as any, { bind: 'email' }, { nodeId: 'inner_stack' })).toBe(false);
  });
});
