/** @filedesc Registers Pragmatic `draggable` + row `dropTarget` on a layout canvas sortable row (Field, Display, Layout container). */
import { useEffect } from 'react';
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { attachClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { LAYOUT_PDND_KIND } from './layout-pdnd';
import type { LayoutPdndSourceData } from './layout-pdnd';
import { isRecord } from '../../shared/runtime-guards';

export interface UseLayoutPragmaticItemArgs {
  enabled: boolean;
  /** Row shell element — receives `draggable` and list `dropTarget`. */
  element: HTMLElement | null;
  dragHandle: Element | null;
  sortableGroup: string;
  sortableIndex: number;
  nodeRef: { bind?: string; nodeId?: string };
  /** Stable id for {@link handleDragEnd} source (matches prior `field:…` / `node:…` ids). */
  sourceId: string;
  /** Fired when this row becomes / stops being the active drag source. */
  onDragSourceChange?: (active: boolean) => void;
}

export function useLayoutPdndItem(args: UseLayoutPragmaticItemArgs): void {
  const { enabled, element, dragHandle, sortableGroup, sortableIndex, nodeRef, sourceId, onDragSourceChange } = args;
  const bind = nodeRef.bind;
  const nodeId = nodeRef.nodeId;
  const resolvedRef =
    bind !== undefined ? { bind } : nodeId !== undefined ? { nodeId } : ({} as { bind?: string; nodeId?: string });

  useEffect(() => {
    if (!enabled || !element) return;

    const initial: Pick<LayoutPdndSourceData, 'initialSortGroup' | 'initialSortIndex'> = {
      initialSortGroup: sortableGroup,
      initialSortIndex: sortableIndex,
    };

    const d = draggable({
      element,
      dragHandle: dragHandle ?? undefined,
      onDragStart: () => onDragSourceChange?.(true),
      onDrop: () => onDragSourceChange?.(false),
      getInitialData: () =>
        ({
          kind: LAYOUT_PDND_KIND,
          type: 'tree-node',
          id: sourceId,
          nodeRef: resolvedRef,
          sortGroup: sortableGroup,
          sortIndex: sortableIndex,
          ...initial,
        }) satisfies LayoutPdndSourceData,
    });

    const dt = dropTargetForElements({
      element,
      canDrop: ({ source }) => {
        const sd = source.data;
        if (!isRecord(sd)) return false;
        return sd.kind === LAYOUT_PDND_KIND;
      },
      getData: ({ input }) =>
        attachClosestEdge(
          {
            kind: LAYOUT_PDND_KIND,
            type: 'tree-node',
            nodeRef: resolvedRef,
            sortGroup: sortableGroup,
            sortableIndex,
          },
          { element, input, allowedEdges: ['top', 'bottom'] },
        ),
    });

    return combine(d, dt);
  }, [
    enabled,
    element,
    dragHandle,
    sortableGroup,
    sortableIndex,
    bind,
    nodeId,
    sourceId,
    onDragSourceChange,
  ]);
}
