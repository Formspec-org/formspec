/** @filedesc Unit tests for {@link pragmaticMonitorDropToDragEnd} — Pragmatic payload → {@link DragEndEvent} mapping. */
import { describe, expect, it } from 'vitest';
import { attachClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { pragmaticMonitorDropToDragEnd, LAYOUT_PDND_KIND } from '../../../src/workspaces/layout/dnd/layout-pdnd';
import { postRemovalIndexForFinalIndex } from '../../../src/workspaces/shared/reorder-insert-index';
import type { CompNode, Project } from '@formspec-org/studio-core';

function mockProject(tree: CompNode): Project {
  return { component: { tree } } as unknown as Project;
}

function dropPayload(
  sourceData: Record<string, unknown>,
  innerData: Record<string, unknown>,
): Parameters<typeof pragmaticMonitorDropToDragEnd>[1] {
  return {
    source: { data: sourceData } as Parameters<typeof pragmaticMonitorDropToDragEnd>[1]['source'],
    location: {
      current: {
        dropTargets: [{ element: document.createElement('div'), data: innerData }],
      },
    },
  };
}

function rowDropInner(
  row: { bind: string; sortGroup: string; sortableIndex: number },
  clientY: number,
): Record<string, unknown> {
  const el = document.createElement('div');
  el.getBoundingClientRect = () =>
    ({
      top: 0,
      left: 0,
      bottom: 100,
      right: 100,
      width: 100,
      height: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
  return attachClosestEdge(
    {
      kind: LAYOUT_PDND_KIND,
      type: 'tree-node',
      nodeRef: { bind: row.bind },
      sortGroup: row.sortGroup,
      sortableIndex: row.sortableIndex,
    },
    {
      element: el,
      input: { clientX: 50, clientY } as Parameters<typeof attachClosestEdge>[1]['input'],
      allowedEdges: ['top', 'bottom'],
    },
  ) as Record<string, unknown>;
}

describe('pragmaticMonitorDropToDragEnd', () => {
  const rootTree: CompNode = {
    component: 'Root',
    nodeId: 'root',
    children: [
      { component: 'FieldBlock', bind: 'a' },
      { component: 'FieldBlock', bind: 'b' },
    ],
  } as CompNode;

  it('cancels unassigned tray drag when there are no drop targets', () => {
    const project = mockProject(rootTree);
    const ev = pragmaticMonitorDropToDragEnd(project, {
      source: {
        data: {
          kind: LAYOUT_PDND_KIND,
          type: 'unassigned-item',
          id: 'unassigned:email',
          key: 'email',
          label: 'Email',
          itemType: 'field',
        },
      } as unknown as Parameters<typeof pragmaticMonitorDropToDragEnd>[1]['source'],
      location: { current: { dropTargets: [] } },
    });
    expect(ev).not.toBeNull();
    expect(ev!.canceled).toBe(true);
    expect(ev!.sortable).toBeNull();
  });

  it('cancels unassigned tray when first drop target data is not a record', () => {
    const project = mockProject(rootTree);
    const ev = pragmaticMonitorDropToDragEnd(project, {
      source: {
        data: {
          kind: LAYOUT_PDND_KIND,
          type: 'unassigned-item',
          id: 'unassigned:email',
          key: 'email',
          label: 'Email',
          itemType: 'field',
        },
      } as unknown as Parameters<typeof pragmaticMonitorDropToDragEnd>[1]['source'],
      location: {
        current: {
          dropTargets: [{ element: document.createElement('div'), data: null as unknown as Record<string, unknown> }],
        },
      },
    });
    expect(ev).not.toBeNull();
    expect(ev!.canceled).toBe(true);
    expect(ev!.target).toBeNull();
  });

  it('maps unassigned tray onto first drop target data', () => {
    const project = mockProject(rootTree);
    const inner = { kind: LAYOUT_PDND_KIND, type: 'tree-node', nodeRef: { bind: 'a' }, sortGroup: 'root', sortableIndex: 0 };
    const ev = pragmaticMonitorDropToDragEnd(
      project,
      dropPayload(
        {
          kind: LAYOUT_PDND_KIND,
          type: 'unassigned-item',
          id: 'unassigned:email',
          key: 'email',
          label: 'Email',
          itemType: 'field',
        },
        inner,
      ),
    );
    expect(ev!.canceled).toBe(false);
    expect(ev!.sortable).toBeNull();
    expect(ev!.target?.data).toEqual(inner);
  });

  it('maps container-drop target without sortable placement', () => {
    const project = mockProject({
      component: 'Root',
      nodeId: 'root',
      children: [{ component: 'Accordion', nodeId: 'acc1', children: [] }],
    } as CompNode);
    const inner: Record<string, unknown> = {
      kind: LAYOUT_PDND_KIND,
      type: 'container-drop',
      nodeRef: { nodeId: 'acc1' },
    };
    const ev = pragmaticMonitorDropToDragEnd(
      project,
      dropPayload(
        {
          kind: LAYOUT_PDND_KIND,
          type: 'tree-node',
          id: 'field:firstName',
          nodeRef: { bind: 'firstName' },
          sortGroup: 'root',
          sortIndex: 0,
        },
        inner,
      ),
    );
    expect(ev!.canceled).toBe(false);
    expect(ev!.target?.data).toMatchObject({ type: 'container-drop', nodeRef: { nodeId: 'acc1' } });
    expect(ev!.sortable).toBeNull();
  });

  it('same-parent row drop uses postRemovalIndexForFinalIndex for sortable.index', () => {
    const project = mockProject(rootTree);
    const inner = rowDropInner({ bind: 'b', sortGroup: 'root', sortableIndex: 1 }, 99);
    const ev = pragmaticMonitorDropToDragEnd(
      project,
      dropPayload(
        {
          kind: LAYOUT_PDND_KIND,
          type: 'tree-node',
          id: 'field:a',
          nodeRef: { bind: 'a' },
          sortGroup: 'root',
          sortIndex: 0,
          initialSortGroup: 'root',
          initialSortIndex: 0,
        },
        inner,
      ),
    );
    expect(ev!.sortable).not.toBeNull();
    const n = 2;
    const finalIndex = 1;
    expect(ev!.sortable!.index).toBe(postRemovalIndexForFinalIndex(n, 0, finalIndex));
    expect(ev!.sortable!.group).toBe('root');
  });

  it('cross-parent row drop uses finalIndex as sortable.index (no post-removal adjustment)', () => {
    const tree: CompNode = {
      component: 'Root',
      nodeId: 'root',
      children: [
        {
          component: 'Accordion',
          nodeId: 'acc1',
          children: [{ component: 'FieldBlock', bind: 'c' }],
        },
        { component: 'FieldBlock', bind: 'a' },
      ],
    } as CompNode;
    const project = mockProject(tree);
    const inner = rowDropInner({ bind: 'a', sortGroup: 'root', sortableIndex: 1 }, 99);
    const ev = pragmaticMonitorDropToDragEnd(
      project,
      dropPayload(
        {
          kind: LAYOUT_PDND_KIND,
          type: 'tree-node',
          id: 'field:c',
          nodeRef: { bind: 'c' },
          sortGroup: 'acc1',
          sortIndex: 0,
          initialSortGroup: 'acc1',
          initialSortIndex: 0,
        },
        inner,
      ),
    );
    expect(ev!.sortable!.group).toBe('root');
    expect(ev!.sortable!.index).toBe(1);
  });

  it('cancels tree drag when source data is missing layout kind', () => {
    const project = mockProject(rootTree);
    const ev = pragmaticMonitorDropToDragEnd(
      project,
      dropPayload(
        {
          type: 'tree-node',
          id: 'field:a',
          nodeRef: { bind: 'a' },
        },
        rowDropInner({ bind: 'b', sortGroup: 'root', sortableIndex: 1 }, 99),
      ),
    );
    expect(ev!.canceled).toBe(true);
  });
});
