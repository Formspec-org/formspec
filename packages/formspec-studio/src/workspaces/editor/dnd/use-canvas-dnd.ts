/** @filedesc Hook wiring dnd-kit drag events to canvas drop-target computation and project moves. */
import { useState, useCallback } from 'react';
import type { Project } from 'formspec-studio-core';
import {
  computeDropTarget,
  buildSequentialMoves,
  isDescendantOf,
  type DropPosition,
} from './compute-drop-target';
import type { FlatEntry } from '../../../lib/tree-helpers';
import { pruneDescendants } from '../../../lib/selection-helpers';

interface OverTarget {
  path: string;
  position: DropPosition;
}

interface UseCanvasDndOptions {
  flatList: FlatEntry[];
  selectedKeys: Set<string>;
  select: (path: string, type: string) => void;
  project: Project;
}

export function useCanvasDnd({
  flatList,
  selectedKeys,
  select,
  project,
}: UseCanvasDndOptions) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overTarget, setOverTarget] = useState<OverTarget | null>(null);

  // Event handlers use `any` for the dnd-kit event types since
  // the library exports handler-signature types, not event-parameter types.

  const onDragStart = useCallback((event: any) => {
    const sourceId = String(event.operation?.source?.id ?? '');
    if (!sourceId) return;

    setActiveId(sourceId);

    // If dragged item is not in current selection, single-select it
    if (!selectedKeys.has(sourceId)) {
      const entry = flatList.find(e => e.id === sourceId);
      select(sourceId, entry?.category ?? 'field');
    }
  }, [selectedKeys, flatList, select]);

  const onDragMove = useCallback((event: any) => {
    // Position computation lives here (not in onDragOver) because dragover
    // only fires when the TARGET changes, but the position (above/below/inside)
    // must update continuously as the pointer moves within the same target.
    const native = event.nativeEvent;
    const source = event.operation?.source;
    const target = event.operation?.target;

    if (!source || !target || !native || !('clientY' in native)) {
      return;
    }

    const sourceId = String(source.id);
    const targetId = String(target.id);

    // Guard: can't drop into own descendant
    if (sourceId === targetId || isDescendantOf(targetId, sourceId, flatList)) {
      setOverTarget(null);
      return;
    }

    // Multi-select guard
    for (const sp of selectedKeys) {
      if (isDescendantOf(targetId, sp, flatList)) {
        setOverTarget(null);
        return;
      }
    }

    const pointerY = (native as PointerEvent).clientY;
    const targetEntry = flatList.find(e => e.id === targetId);
    const el = document.querySelector<HTMLElement>(`[data-item-path="${CSS.escape(targetId)}"]`);

    let position: DropPosition = 'below';
    if (el) {
      const rect = el.getBoundingClientRect();
      const relY = (pointerY - rect.top) / rect.height;

      if (targetEntry?.category === 'group' || targetEntry?.category === 'layout') {
        if (relY < 0.25) position = 'above';
        else if (relY > 0.75) position = 'below';
        else position = 'inside';
      } else {
        position = relY < 0.5 ? 'above' : 'below';
      }
    }

    setOverTarget({ path: targetId, position });
  }, [flatList, selectedKeys]);

  const onDragOver = useCallback((event: any) => {
    // Prevent optimistic reordering — position is computed in onDragMove
    event.preventDefault?.();
  }, []);

  const onDragEnd = useCallback((event: any) => {
    const wasCanceled = event.canceled;
    const currentOverTarget = overTarget;

    // Clear state first
    setActiveId(null);
    setOverTarget(null);

    if (wasCanceled || !currentOverTarget) return;

    const sourcePath = String(event.operation?.source?.id ?? '');
    if (!sourcePath) return;

    const target = computeDropTarget(
      sourcePath,
      currentOverTarget.path,
      currentOverTarget.position,
      flatList,
      selectedKeys.size > 1 ? selectedKeys : undefined,
    );

    if (!target) return;

    if (target.kind === 'definition' && selectedKeys.size > 1 && selectedKeys.has(sourcePath)) {
      // Multi-select drag — batch-move via Project helper
      const pruned = pruneDescendants(selectedKeys);
      const movablePaths = pruned.filter((path) => flatList.find((entry) => entry.id === path)?.defPath);
      const pathOrder = new Map(flatList.map((entry, index) => [entry.id, index]));
      movablePaths.sort((a, b) => (pathOrder.get(a) ?? 0) - (pathOrder.get(b) ?? 0));

      const moves = buildSequentialMoves(
        movablePaths,
        target.parentPath,
        target.rawIndex,
        flatList,
      );
      if (moves.length > 0) {
        project.moveItems(moves);
      }
    } else if (target.definitionMove) {
      const m = target.definitionMove;
      project.moveItem(m.sourcePath, m.targetParentPath, m.targetIndex);
    } else if (target.componentMove) {
      const m = target.componentMove;
      project.moveLayoutNode(m.sourceNodeId, m.targetParentNodeId, m.targetIndex);
    }
  }, [overTarget, flatList, selectedKeys, project]);

  return {
    activeId,
    overTarget,
    onDragStart,
    onDragMove,
    onDragOver,
    onDragEnd,
  };
}
