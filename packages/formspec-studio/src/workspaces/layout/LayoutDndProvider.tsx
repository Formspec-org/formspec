/** @filedesc DnD wrapper for the Layout canvas — Pragmatic drag-and-drop, reorders component tree nodes. */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { useProject } from '../../state/useProject';
import { useSelection } from '../../state/useSelection';
import { handleDragEnd, type DragEndEvent } from './layout-dnd-utils';
import {
  LAYOUT_PDND_KIND,
  layoutCanvasDropIndicatorFromTargetData,
  pragmaticMonitorDropToDragEnd,
} from './layout-pdnd';
import { layoutDragOverlayFromPdndSource } from './LayoutDragOverlay';
import {
  LayoutCanvasDragFeedbackProvider,
  type LayoutCanvasDragFeedbackState,
  type LayoutCanvasDragPointer,
} from './LayoutCanvasDragFeedbackContext';
import { layoutCanvasDragOverlayPositionStyle } from './layout-canvas-drag-chrome';
import { isRecord } from '../shared/runtime-guards';

interface LayoutDndProviderProps {
  children: ReactNode;
  activePageId?: string | null;
}

const emptyFeedback: LayoutCanvasDragFeedbackState = { pointer: null, indicator: null };

function indicatorEquals(
  a: LayoutCanvasDragFeedbackState['indicator'],
  b: LayoutCanvasDragFeedbackState['indicator'],
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.mode !== b.mode) return false;
  if (a.mode === 'row' && b.mode === 'row') {
    return a.sortGroup === b.sortGroup && a.sortableIndex === b.sortableIndex && a.edge === b.edge;
  }
  if (a.mode === 'container' && b.mode === 'container') {
    return a.nodeRef?.nodeId === b.nodeRef?.nodeId && a.nodeRef?.bind === b.nodeRef?.bind;
  }
  return false;
}

export function LayoutDndProvider({ children, activePageId = null }: LayoutDndProviderProps) {
  const project = useProject();
  const { select } = useSelection();
  const [overlaySource, setOverlaySource] = useState<Record<string, unknown> | null>(null);
  const [dragFeedback, setDragFeedback] = useState<LayoutCanvasDragFeedbackState>(emptyFeedback);
  const pointerRef = useRef<LayoutCanvasDragPointer | null>(null);

  const onDrop = useCallback(
    (payload: Parameters<NonNullable<Parameters<typeof monitorForElements>[0]['onDrop']>>[0]) => {
      try {
        const ev = pragmaticMonitorDropToDragEnd(project, {
          source: payload.source,
          location: payload.location,
        });
        if (ev && !ev.canceled) {
          handleDragEnd(project, ev, activePageId, (key, itemType, opts) => select(key, itemType, opts));
        }
      } finally {
        setOverlaySource(null);
        pointerRef.current = null;
        setDragFeedback(emptyFeedback);
      }
    },
    [project, select, activePageId],
  );

  const onDragStart = useCallback(
    (payload: Parameters<NonNullable<Parameters<typeof monitorForElements>[0]['onDragStart']>>[0]) => {
      const d = payload.source.data;
      setOverlaySource(isRecord(d) ? d : null);
      const input = payload.location.current.input;
      pointerRef.current = { clientX: input.clientX, clientY: input.clientY };
      setDragFeedback({
        pointer: pointerRef.current,
        indicator: null,
      });
    },
    [],
  );

  const onDrag = useCallback(
    (payload: Parameters<NonNullable<Parameters<typeof monitorForElements>[0]['onDrag']>>[0]) => {
      const input = payload.location.current.input;
      pointerRef.current = { clientX: input.clientX, clientY: input.clientY };
      const targets = payload.location.current.dropTargets;
      let indicator = null;
      if (targets.length > 0) {
        const data = targets[0].data;
        if (isRecord(data)) {
          indicator = layoutCanvasDropIndicatorFromTargetData(data);
        }
      }
      setDragFeedback((prev) => {
        if (indicatorEquals(prev.indicator, indicator)) return prev;
        return { pointer: pointerRef.current, indicator };
      });
    },
    [],
  );

  useEffect(() => {
    return monitorForElements({
      canMonitor: ({ source }) => {
        const d = source.data;
        if (!isRecord(d)) return false;
        return d.kind === LAYOUT_PDND_KIND;
      },
      onDragStart,
      onDrag,
      onDrop,
    });
  }, [onDragStart, onDrag, onDrop]);

  const ptr = dragFeedback.pointer;

  return (
    <LayoutCanvasDragFeedbackProvider value={dragFeedback}>
      {children}
      {overlaySource ? (
        <div
          className={`pointer-events-none fixed z-[9999] ${ptr ? '' : 'left-1/2 top-4 -translate-x-1/2'}`}
          style={layoutCanvasDragOverlayPositionStyle(ptr)}
        >
          {layoutDragOverlayFromPdndSource(overlaySource)}
        </div>
      ) : null}
    </LayoutCanvasDragFeedbackProvider>
  );
}
