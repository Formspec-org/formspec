/** @filedesc DnD wrapper for the Layout canvas — reorders component tree nodes. */
import { useState, useCallback, type ReactNode } from 'react';
import { DragDropProvider } from '@dnd-kit/react';
import { PointerSensor, PointerActivationConstraints } from '@dnd-kit/dom';
import { useProject } from '../../state/useProject';
import { useSelection } from '../../state/useSelection';

const LAYOUT_TAB = 'layout';

interface LayoutDndProviderProps {
  children: ReactNode;
}

/**
 * DnD provider for the Layout workspace.
 *
 * Handles two drag types:
 * 1. Component-tree node reordering (drag a node to reorder among siblings)
 * 2. Tray-to-canvas (drag an unassigned item onto the canvas to bind it)
 */
export function LayoutDndProvider({ children }: LayoutDndProviderProps) {
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
      // Add the item to the component tree at the target location
      // For now, add to root of tree
      (project as any).core.dispatch({
        type: 'component.addNode',
        payload: {
          parent: { nodeId: '__root' },
          node: { component: 'TextInput', bind: sourceData.key },
        },
      });
      select(sourceData.key, 'field', { tab: LAYOUT_TAB });
      return;
    }

    // Component-tree reorder: move sourceId before/after targetId
    const sourceRef = sourceData?.nodeRef;
    const targetRef = event.operation?.target?.data?.nodeRef;
    if (sourceRef && targetRef) {
      // Use the component tree reorder command
      (project as any).core.dispatch({
        type: 'component.reorderNode',
        payload: { node: sourceRef, direction: 'down' },
      });
    }
  }, [project, select]);

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
