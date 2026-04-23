/** @filedesc Pragmatic drag-and-drop wiring for the layout canvas — data tags, index math, and monitor → {@link DragEndEvent} mapping. */
import { extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import type { ElementDragPayload } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import type { CompNode, Project } from '@formspec-org/studio-core';
import { findComponentNodeByRef } from '@formspec-org/studio-core';
import { finalIndexFromRowEdge, postRemovalIndexForFinalIndex } from '../../shared/reorder-insert-index';
import { sortGroupToParentRef, type DragEndEvent } from './layout-dnd-utils';
import { isRecord } from '../../shared/runtime-guards';

export const LAYOUT_PDND_KIND = 'layout-canvas' as const;

export type LayoutPdndSourceData = {
  kind: typeof LAYOUT_PDND_KIND;
  type: 'tree-node' | 'unassigned-item';
  id: string;
  nodeRef?: { bind?: string; nodeId?: string };
  sortGroup?: string;
  sortIndex?: number;
  initialSortGroup?: string;
  initialSortIndex?: number;
  key?: string;
  label?: string;
  itemType?: 'field' | 'group' | 'display';
};

export type LayoutPdndRowDropData = {
  kind: typeof LAYOUT_PDND_KIND;
  type: 'tree-node';
  nodeRef: { bind?: string; nodeId?: string };
  sortGroup: string;
  sortableIndex: number;
};

export type LayoutPdndContainerDropData = {
  kind: typeof LAYOUT_PDND_KIND;
  type: 'container-drop';
  nodeRef: { bind?: string; nodeId?: string };
};

function asLayoutSource(data: Record<string, unknown>): LayoutPdndSourceData | null {
  if (data.kind !== LAYOUT_PDND_KIND) return null;
  if (data.type !== 'tree-node' && data.type !== 'unassigned-item') return null;
  return data as unknown as LayoutPdndSourceData;
}

function readRowDrop(data: Record<string, unknown>): LayoutPdndRowDropData | null {
  if (data.kind !== LAYOUT_PDND_KIND || data.type !== 'tree-node') return null;
  if (!isRecord(data.nodeRef)) return null;
  if (typeof data.sortGroup !== 'string' || typeof data.sortableIndex !== 'number') return null;
  return data as unknown as LayoutPdndRowDropData;
}

function readContainerDrop(data: Record<string, unknown>): LayoutPdndContainerDropData | null {
  if (data.kind !== LAYOUT_PDND_KIND || data.type !== 'container-drop') return null;
  if (!isRecord(data.nodeRef)) return null;
  return data as unknown as LayoutPdndContainerDropData;
}

/** Live drop hint for layout-canvas UI (row insertion edge or empty-container target). */
export type LayoutCanvasDropIndicator =
  | { mode: 'row'; sortGroup: string; sortableIndex: number; edge: 'top' | 'bottom' }
  | { mode: 'container'; nodeRef: { bind?: string; nodeId?: string } };

/**
 * Derives drop-indicator state from the innermost Pragmatic drop target’s `getData()` payload
 * (same shape as {@link pragmaticMonitorDropToDragEnd} consumes).
 *
 * Row `edge` is top/bottom only: `extractClosestEdge` anything other than `'top'` is treated as `'bottom'`,
 * matching the row branch of {@link pragmaticMonitorDropToDragEnd} (`extractClosestEdge(...) ?? 'bottom'`).
 */
export function layoutCanvasDropIndicatorFromTargetData(data: Record<string, unknown>): LayoutCanvasDropIndicator | null {
  const containerHit = readContainerDrop(data);
  if (containerHit) {
    return { mode: 'container', nodeRef: containerHit.nodeRef };
  }
  const rowHit = readRowDrop(data);
  if (!rowHit) return null;
  const rawEdge = extractClosestEdge(data);
  const edge: 'top' | 'bottom' = rawEdge === 'top' ? 'top' : 'bottom';
  return { mode: 'row', sortGroup: rowHit.sortGroup, sortableIndex: rowHit.sortableIndex, edge };
}

/** Children count for a sortable group id (parent container). */
export function countChildrenForSortGroup(project: Project, sortGroup: string): number {
  const parentRef = sortGroupToParentRef(sortGroup);
  if (!parentRef) return 0;
  const tree = project.component.tree as CompNode | undefined;
  if (!tree) return 0;
  const node = findComponentNodeByRef(tree, parentRef);
  return node?.children?.length ?? 0;
}

export type PragmaticMonitorDropPayload = {
  source: ElementDragPayload;
  location: {
    current: { dropTargets: { element: Element; data: Record<string, unknown> }[] };
  };
};

export function pragmaticMonitorDropToDragEnd(
  project: Project,
  payload: PragmaticMonitorDropPayload,
): DragEndEvent | null {
  const { source, location } = payload;
  const sourceData = source.data;
  if (!isRecord(sourceData)) return { canceled: true, source: { id: '', data: {} }, target: null, sortable: null };

  const targets = location.current.dropTargets;

  if (sourceData.kind === LAYOUT_PDND_KIND && sourceData.type === 'unassigned-item') {
    if (!targets.length) {
      return {
        canceled: true,
        source: { id: String(sourceData.id ?? `unassigned:${sourceData.key ?? ''}`), data: sourceData },
        target: null,
        sortable: null,
      };
    }
    const innerData = targets[0].data;
    if (!isRecord(innerData)) {
      return {
        canceled: true,
        source: { id: String(sourceData.id ?? `unassigned:${sourceData.key ?? ''}`), data: sourceData },
        target: null,
        sortable: null,
      };
    }
    return {
      canceled: false,
      source: { id: String(sourceData.id ?? `unassigned:${sourceData.key ?? ''}`), data: sourceData },
      target: { id: '', data: innerData },
      sortable: null,
    };
  }

  if (!targets.length) {
    return { canceled: true, source: { id: String(sourceData.id ?? ''), data: sourceData }, target: null, sortable: null };
  }

  const inner = targets[0];
  const innerData = inner.data;

  const layoutSource = asLayoutSource(sourceData);
  if (!layoutSource || layoutSource.type !== 'tree-node') {
    return { canceled: true, source: { id: String(sourceData.id ?? ''), data: sourceData }, target: null, sortable: null };
  }

  const containerHit = readContainerDrop(innerData);
  if (containerHit) {
    return {
      canceled: false,
      source: { id: layoutSource.id, data: { ...sourceData, type: 'tree-node', nodeRef: layoutSource.nodeRef } },
      target: { id: '', data: { type: 'container-drop', nodeRef: containerHit.nodeRef } },
      sortable: null,
    };
  }

  const rowHit = readRowDrop(innerData);
  if (!rowHit) {
    return {
      canceled: false,
      source: { id: layoutSource.id, data: { ...sourceData, type: 'tree-node', nodeRef: layoutSource.nodeRef } },
      target: { id: '', data: innerData },
      sortable: null,
    };
  }

  const edge = extractClosestEdge(innerData) ?? 'bottom';
  const targetGroup = rowHit.sortGroup;
  const n = countChildrenForSortGroup(project, targetGroup);
  const finalIndex = finalIndexFromRowEdge(rowHit.sortableIndex, edge, n);

  const initialG = layoutSource.initialSortGroup ?? layoutSource.sortGroup;
  const initialI = layoutSource.initialSortIndex ?? layoutSource.sortIndex;
  const sameParent = initialG != null && initialI != null && String(initialG) === String(targetGroup);

  let sortIndex: number;
  if (sameParent && typeof initialI === 'number') {
    sortIndex = postRemovalIndexForFinalIndex(n, initialI, finalIndex);
  } else {
    sortIndex = finalIndex;
  }

  return {
    canceled: false,
    source: { id: layoutSource.id, data: { ...sourceData, type: 'tree-node', nodeRef: layoutSource.nodeRef } },
    target: { id: '', data: { type: 'tree-node', nodeRef: rowHit.nodeRef } },
    sortable: {
      group: targetGroup,
      index: sortIndex,
      initialGroup: initialG,
      initialIndex: initialI,
    },
  };
}
