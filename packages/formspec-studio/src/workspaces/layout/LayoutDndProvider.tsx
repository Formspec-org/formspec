/** @filedesc DnD wrapper for the Layout canvas — reorders component tree nodes. */
import { useState, useCallback, type ReactNode } from 'react';
import { DragDropProvider, type DragStartEvent, type DragEndEvent as DnDKitDragEndEvent } from '@dnd-kit/react';
import { LayoutDragContext } from './LayoutDragContext';
import { PointerSensor, PointerActivationConstraints } from '@dnd-kit/dom';
import { useProject } from '../../state/useProject';
import { useSelection } from '../../state/useSelection';
import type { Project } from '@formspec-org/studio-core';

const LAYOUT_TAB = 'layout';

interface LayoutDndProviderProps {
  children: ReactNode;
  activePageId?: string | null;
}

type NodeRef = { bind?: string; nodeId?: string };
type UnassignedItemData = { key: string; label: string; itemType: 'field' | 'group' | 'display' };

function isUnassignedItemData(data: unknown): data is UnassignedItemData {
  return !!data && typeof data === 'object' && 'key' in data && 'label' in data && 'itemType' in data;
}

/**
 * Pure handler: place a tray item onto the canvas via project.addItemToLayout.
 * Exported for unit testing.
 */
export function handleTrayDrop(
  project: Project,
  item: UnassignedItemData,
  activePageId: string | null,
): void {
  project.addItemToLayout(
    { itemType: item.itemType, label: item.label, key: item.key },
    activePageId ?? undefined,
  );
}

/**
 * Pure handler: reorder a component tree node via project.reorderComponentNode.
 * Direction is determined by the caller (source before/after target).
 * Exported for unit testing.
 */
export function handleTreeReorder(
  project: Project,
  sourceRef: NodeRef,
  _targetRef: NodeRef,
  direction: 'up' | 'down',
): void {
  project.reorderComponentNode(sourceRef, direction);
}

/**
 * Pure handler: spatial reorder — move sourceRef to a specific insert index within a container.
 * Used when the user drops into a Grid/Stack slot at a known position.
 * Exported for unit testing.
 */
export function handleSpatialDrop(
  project: Project,
  sourceRef: NodeRef,
  targetContainerId: string,
  insertIndex: number,
): void {
  project.moveComponentNodeToIndex(sourceRef, targetContainerId, insertIndex);
}

/**
 * Pure handler: drop-into-container — move sourceRef to be the last child of targetContainerId.
 * Used when the user drops directly onto a container (not onto a sibling slot).
 * Exported for unit testing.
 */
export function handleContainerDrop(
  project: Project,
  sourceRef: NodeRef,
  targetParent: { bind?: string; nodeId?: string },
): void {
  project.moveComponentNodeToContainer(sourceRef, targetParent);
}

/** Normalized event shape used by handleDragEnd (pure, testable). */
export interface DragEndEvent {
  canceled: boolean;
  source: { id: string; data: Record<string, unknown> };
  target: { id: string; data: Record<string, unknown> } | null | undefined;
}

/**
 * Pure handler: routes a drag-end event to the appropriate project method.
 * Exported for unit testing — the LayoutDndProvider wires dnd-kit events to this.
 */
export function handleDragEnd(
  project: Project,
  event: DragEndEvent,
  activePageId: string | null,
  selectFn: (key: string, itemType: string, opts: { tab: string }) => void,
): void {
  if (event.canceled) return;

  const sourceId = String(event.source?.id ?? '');
  const targetId = String(event.target?.id ?? '');
  if (!sourceId || !targetId || sourceId === targetId) return;

  const sourceData = event.source?.data ?? {};

  // Tray-to-canvas: unassigned item dragged onto the tree
  if (sourceData.type === 'unassigned-item' && isUnassignedItemData(sourceData)) {
    handleTrayDrop(project, sourceData, activePageId);
    selectFn(sourceData.key, sourceData.itemType, { tab: LAYOUT_TAB });
    return;
  }

  // Component-tree node drop
  const sourceRef: NodeRef | undefined = sourceData.nodeRef as NodeRef | undefined;
  if (!sourceRef) return;

  const targetData = event.target?.data ?? {};

  // Spatial insert-slot drop: target carries { type: 'insert-slot', containerId, insertIndex }
  if (targetData.type === 'insert-slot' && targetData.containerId) {
    handleSpatialDrop(project, sourceRef, String(targetData.containerId), Number(targetData.insertIndex ?? 0));
    return;
  }

  // Container drop: target carries { type: 'container-drop', nodeRef } — places as last child
  if (targetData.type === 'container-drop' && targetData.nodeRef) {
    const containerRef = targetData.nodeRef as { nodeId?: string; bind?: string };
    if (containerRef.nodeId || containerRef.bind) {
      handleContainerDrop(project, sourceRef, containerRef);
      return;
    }
  }

  // Fallback: linear reorder for non-spatial drops (e.g. Stack siblings without insert slots)
  const targetRef: NodeRef | undefined = (targetData.nodeRef as NodeRef | undefined);
  if (targetRef) {
    const sourceIndex = (sourceData.index as number) ?? 0;
    const targetIndex = (targetData.index as number) ?? 0;
    const direction: 'up' | 'down' = sourceIndex > targetIndex ? 'up' : 'down';
    handleTreeReorder(project, sourceRef, targetRef, direction);
  }
}

/**
 * DnD provider for the Layout workspace.
 *
 * Handles two drag types:
 * 1. Component-tree node reordering (drag a node to reorder among siblings)
 * 2. Tray-to-canvas (drag an unassigned item onto the canvas to bind it)
 */
export function LayoutDndProvider({ children, activePageId = null }: LayoutDndProviderProps) {
  const project = useProject();
  const { select } = useSelection();
  const [activeId, setActiveId] = useState<string | null>(null);

  const onDragStart = useCallback((event: DragStartEvent) => {
    const sourceId = String(event.operation?.source?.id ?? '');
    if (!sourceId) return;
    setActiveId(sourceId);
  }, []);

  const onDragEnd = useCallback((event: DnDKitDragEndEvent) => {
    setActiveId(null);
    const source = event.operation?.source;
    const target = event.operation?.target;
    handleDragEnd(
      project,
      {
        canceled: !!event.canceled,
        source: source ? { id: String(source.id ?? ''), data: source.data ?? {} } : { id: '', data: {} },
        target: target ? { id: String(target.id ?? ''), data: target.data ?? {} } : null,
      },
      activePageId,
      (key, itemType, opts) => select(key, itemType, opts),
    );
  }, [project, select, activePageId]);

  return (
    <DragDropProvider
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      sensors={() => [
        PointerSensor.configure({
          activationConstraints: [
            new PointerActivationConstraints.Distance({ value: 5 }),
          ],
        }),
      ]}
    >
      <LayoutDragContext.Provider value={{ isDragActive: activeId !== null }}>
        {children}
      </LayoutDragContext.Provider>
    </DragDropProvider>
  );
}
