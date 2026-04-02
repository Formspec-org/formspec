/** @filedesc DnD wrapper for the Layout canvas — reorders component tree nodes. */
import { useState, useCallback, type ReactNode } from 'react';
import { DragDropProvider } from '@dnd-kit/react';
import { PointerSensor, PointerActivationConstraints } from '@dnd-kit/dom';
import { useProject } from '../../state/useProject';
import { useSelection } from '../../state/useSelection';
import type { Project } from '@formspec-org/studio-core';

const LAYOUT_TAB = 'layout';

interface LayoutDndProviderProps {
  children: ReactNode;
  activePageId?: string | null;
}

type NodeRef = { bind: string } | { nodeId: string };
type UnassignedItemData = { key: string; label: string; itemType: 'field' | 'group' | 'display' };

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

  const onDragStart = useCallback((event: any) => {
    const sourceId = String(event.operation?.source?.id ?? '');
    if (!sourceId) return;
    setActiveId(sourceId);
  }, []);

  const onDragEnd = useCallback((event: any) => {
    setActiveId(null);

    if (event.canceled) return;

    const sourceId = String(event.operation?.source?.id ?? '');
    const targetId = String(event.operation?.target?.id ?? '');
    if (!sourceId || !targetId || sourceId === targetId) return;

    const sourceData = event.operation?.source?.data;

    // Tray-to-canvas: unassigned item dragged onto the tree
    if (sourceData?.type === 'unassigned-item') {
      handleTrayDrop(project, sourceData as UnassignedItemData, activePageId);
      select(sourceData.key, sourceData.itemType, { tab: LAYOUT_TAB });
      return;
    }

    // Component-tree reorder: move sourceId before/after targetId
    const sourceRef: NodeRef | undefined = sourceData?.nodeRef;
    const targetRef: NodeRef | undefined = event.operation?.target?.data?.nodeRef;
    if (sourceRef && targetRef) {
      // Determine direction: if source index > target index, moving up
      const sourceIndex = event.operation?.source?.data?.index ?? 0;
      const targetIndex = event.operation?.target?.data?.index ?? 0;
      const direction: 'up' | 'down' = sourceIndex > targetIndex ? 'up' : 'down';
      handleTreeReorder(project, sourceRef, targetRef, direction);
    }
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
      {children}
    </DragDropProvider>
  );
}
