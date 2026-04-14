/** @filedesc Pure DnD event handlers for the layout canvas — routes drag-end events to project methods. */
import type { DragStartEvent as DndDragStartEvent, DragEndEvent as DndDragEndEvent } from '@dnd-kit/dom';
import type { CompNode, Project } from '@formspec-org/studio-core';
import { isCircularComponentMove } from '@formspec-org/studio-core';

export type NodeRef = { bind?: string; nodeId?: string };

/** Parent of the node matching `ref`, or `null` if the match is the tree root, or `undefined` if not found. */
export function findParentOfNodeRef(
  tree: CompNode | undefined,
  ref: NodeRef,
): CompNode | null | undefined {
  if (!tree) return undefined;
  if (!ref.nodeId && !ref.bind) return undefined;

  const walk = (node: CompNode | undefined, parent: CompNode | null): CompNode | null | undefined => {
    if (!node) return undefined;
    const matches =
      (ref.nodeId != null && node.nodeId === ref.nodeId) || (ref.bind != null && node.bind === ref.bind);
    if (matches) return parent;
    for (const child of node.children ?? []) {
      const hit = walk(child, node);
      if (hit !== undefined) return hit;
    }
    return undefined;
  };

  return walk(tree, null);
}

export type UnassignedItemData = { key: string; label: string; itemType: 'field' | 'group' | 'display' };
export type DragStartPayload = Parameters<DndDragStartEvent>[0];
export type DragEndPayload = Parameters<DndDragEndEvent>[0];

export function isUnassignedItemData(data: unknown): data is UnassignedItemData {
  return !!data && typeof data === 'object' && 'key' in data && 'label' in data && 'itemType' in data;
}

/**
 * Pure handler: place a tray item onto the canvas.
 * Unassigned items already exist in the definition — re-bind with {@link Project.placeOnPage}
 * instead of {@link Project.addItemToLayout} (which would call `addField` and throw on duplicate keys).
 */
export function handleTrayDrop(
  project: Project,
  item: UnassignedItemData,
  activePageId: string | null,
): void {
  if (project.itemAt(item.key)) {
    project.placeOnPage(item.key, activePageId ?? 'root');
    return;
  }

  project.addItemToLayout(
    { itemType: item.itemType, label: item.label, key: item.key },
    activePageId ?? undefined,
  );
}

/** Move sourceRef to a specific insert index within a container. */
export function handleSpatialDrop(
  project: Project,
  sourceRef: NodeRef,
  targetParent: { bind?: string; nodeId?: string },
  insertIndex: number,
): void {
  project.moveComponentNodeToIndex(sourceRef, targetParent, insertIndex);
}

/** Move sourceRef to be the last child of targetParent. */
export function handleContainerDrop(
  project: Project,
  sourceRef: NodeRef,
  targetParent: { bind?: string; nodeId?: string },
): void {
  project.moveComponentNodeToContainer(sourceRef, targetParent);
}

/**
 * Maps a sortable `group` id back to a `component.moveNode` target parent ref.
 *
 * Encoding (stays in sync with `render-tree.tsx`):
 * - `bind:<key>` → `{ bind: key }` (parent container without a nodeId)
 * - Anything else → `{ nodeId: group }` (root, page ids, layout nodeIds)
 */
export function sortGroupToParentRef(group: string | number): NodeRef | null {
  const g = String(group);
  if (!g) return null;
  if (g.startsWith('bind:')) return { bind: g.slice('bind:'.length) };
  return { nodeId: g };
}

/** Sortable placement extracted from the raw @dnd-kit source after drag. */
export interface SortablePlacement {
  group: string | number;
  index: number;
  initialGroup?: string | number;
  initialIndex?: number;
}

/** Normalized event shape used by handleDragEnd (pure, testable). */
export interface DragEndEvent {
  canceled: boolean;
  source: { id: string; data: Record<string, unknown> };
  target: { id: string; data: Record<string, unknown> } | null | undefined;
  /** Sortable final state from the source — populated by LayoutDndProvider from the raw @dnd-kit event. */
  sortable?: SortablePlacement | null;
}

/**
 * Pure handler: routes a drag-end event to the appropriate project method.
 * Exported for unit testing — the LayoutDndProvider wires dnd-kit events to this.
 */
export function handleDragEnd(
  project: Project,
  event: DragEndEvent,
  activePageId: string | null,
  select: (
    key: string,
    itemType: 'field' | 'group' | 'display',
    opts?: { tab?: string; keepView?: boolean },
  ) => void,
): void {
  if (event.canceled) return;

  const sourceData = event.source?.data ?? {};
  const targetData = event.target?.data ?? {};
  const componentTree = project.component.tree as CompNode | undefined;

  // ── Tray-to-canvas: unassigned item dragged onto the tree ──
  if (sourceData.type === 'unassigned-item' && isUnassignedItemData(sourceData)) {
    handleTrayDrop(project, sourceData, activePageId);

    const leafKey = sourceData.key.split('.').pop() ?? sourceData.key;
    const traySourceRef: NodeRef = { bind: leafKey };

    if (targetData.type === 'container-drop' && targetData.nodeRef) {
      const containerRef = targetData.nodeRef as NodeRef;
      if ((containerRef.nodeId || containerRef.bind) && !isCircularComponentMove(componentTree, traySourceRef, containerRef)) {
        handleContainerDrop(project, traySourceRef, containerRef);
      }
    } else if (targetData.type === 'tree-node') {
      const targetRef: NodeRef | undefined = targetData.nodeRef as NodeRef | undefined;
      const parent = targetRef ? findParentOfNodeRef(componentTree, targetRef) : null;
      if (parent) {
        const parentRef = parent.bind ? { bind: parent.bind } : { nodeId: parent.nodeId };
        const children = parent.children ?? [];
        const targetIndex = children.findIndex(c => 
          (targetRef?.nodeId && c.nodeId === targetRef.nodeId) || (targetRef?.bind && c.bind === targetRef.bind)
        );
        if (targetIndex !== -1 && !isCircularComponentMove(componentTree, traySourceRef, parentRef)) {
          handleSpatialDrop(project, traySourceRef, parentRef, targetIndex);
        }
      }
    }

    select(sourceData.key, sourceData.itemType, { tab: 'layout' });
    return;
  }

  // ── Component-tree node drop ──
  const sourceRef: NodeRef | undefined = sourceData.nodeRef as NodeRef | undefined;
  if (!sourceRef) return;

  // Container-drop (drop directly onto a container → last child)
  if (targetData.type === 'container-drop' && targetData.nodeRef) {
    const containerRef = targetData.nodeRef as NodeRef;
    if ((containerRef.nodeId || containerRef.bind) && !isCircularComponentMove(componentTree, sourceRef, containerRef)) {
      handleContainerDrop(project, sourceRef, containerRef);
    }
    return;
  }

  // ── Sortable reorder: @dnd-kit sortable sets source.index/group to the final position ──
  const sortable = event.sortable;
  if (sortable && sortable.group != null && typeof sortable.index === 'number') {
    const targetParent = sortGroupToParentRef(sortable.group);
    if (!targetParent) return;

    // Skip if the item didn't actually move
    const unchanged =
      sortable.initialGroup !== undefined &&
      sortable.initialIndex !== undefined &&
      String(sortable.initialGroup) === String(sortable.group) &&
      sortable.initialIndex === sortable.index;
    if (unchanged) return;

    if (!isCircularComponentMove(componentTree, sourceRef, targetParent)) {
      handleSpatialDrop(project, sourceRef, targetParent, sortable.index);
    }
    return;
  }

  // ── Fallback: tree-node dropped on a different tree-node ──
  if (targetData.type === 'tree-node') {
    const targetRef: NodeRef | undefined = targetData.nodeRef as NodeRef | undefined;
    const sourceId = String(event.source?.id ?? '');
    const targetId = String(event.target?.id ?? '');
    if (!targetRef || sourceId === targetId) return;

    const parent = findParentOfNodeRef(componentTree, targetRef);
    if (!parent) return;
    const parentRef = parent.bind ? { bind: parent.bind } : { nodeId: parent.nodeId };
    if (!parentRef.bind && !parentRef.nodeId) return;
    if (isCircularComponentMove(componentTree, sourceRef, parentRef)) return;

    let targetIndex = 0;
    const children = parent.children ?? [];
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if ((targetRef.nodeId && child.nodeId === targetRef.nodeId) || (targetRef.bind && child.bind === targetRef.bind)) {
        targetIndex = i;
        break;
      }
    }

    handleSpatialDrop(project, sourceRef, parentRef, targetIndex);
  }
}
