/** @filedesc DnD wrapper for the Layout canvas — reorders component tree nodes. */
import { useCallback, type ReactNode } from 'react';
import { DragDropProvider, PointerSensor } from '@dnd-kit/react';
import { STUDIO_POINTER_ACTIVATION } from '../shared/dnd-config';
import { useProject } from '../../state/useProject';
import { useSelection } from '../../state/useSelection';
import { handleDragEnd, type DragEndEvent, type DragEndPayload } from './layout-dnd-utils';

interface LayoutDndProviderProps {
  children: ReactNode;
  activePageId?: string | null;
}

interface SortableDraggable {
  sortable: {
    group: string | number;
    index: number;
    initialGroup: string | number;
    initialIndex: number;
  };
}

function isSortableDraggable(draggable: unknown): draggable is SortableDraggable {
  return (
    !!draggable &&
    typeof draggable === 'object' &&
    'sortable' in draggable &&
    typeof (draggable as any).sortable === 'object'
  );
}

/**
 * DnD provider for the Layout workspace.
 * Reset to stock configuration as requested.
 */
export function LayoutDndProvider({ children, activePageId = null }: LayoutDndProviderProps) {
  const project = useProject();
  const { select } = useSelection();

  const onDragEnd = useCallback((event: DragEndPayload) => {
    if (event.canceled) return;

    const source = event.operation?.source;
    const target = event.operation?.target;

    const dragEndPayload: DragEndEvent = {
      canceled: false,
      source: source ? { id: String(source.id ?? ''), data: source.data ?? {} } : { id: '', data: {} },
      target: target ? { id: String(target.id ?? ''), data: target.data ?? {} } : null,
      sortable: isSortableDraggable(source) ? source.sortable : null,
    };

    // Defer state update so dnd-kit can settle its own DOM cleanup before React re-renders.
    setTimeout(() => {
      handleDragEnd(project, dragEndPayload, activePageId, (key, itemType, opts) => 
        select(key, itemType, opts)
      );
    }, 0);
  }, [project, select, activePageId]);

  return (
    <DragDropProvider
      onDragEnd={onDragEnd}
      sensors={() => [
        PointerSensor.configure({
          activationConstraints: STUDIO_POINTER_ACTIVATION,
        }),
      ]}
    >
      {children}
    </DragDropProvider>
  );
}
