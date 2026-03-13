import { useState, useCallback, useRef } from 'react';
import {
  computeDropTarget,
  computeTreeDropTarget,
  buildSequentialMoveCommands,
  isDescendantOf,
  type DropPosition,
  type FlatEntry,
} from './compute-drop-target';
import { isLayoutId } from '../../../lib/tree-helpers';
import { pruneDescendants } from '../../../lib/selection-helpers';

interface OverTarget {
  path: string;
  position: DropPosition;
}

interface UseCanvasDndOptions {
  flatList: FlatEntry[];
  items: any[];
  selectedKeys: Set<string>;
  primaryKey: string | null;
  select: (path: string, type: string) => void;
  dispatch: (command: any) => any;
  batch: (commands: any[]) => void;
}

export function useCanvasDnd({
  flatList,
  items,
  selectedKeys,
  primaryKey,
  select,
  dispatch,
  batch,
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
      const entry = flatList.find(e => e.path === sourceId);
      select(sourceId, entry?.type ?? 'field');
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
    if (sourceId === targetId || isDescendantOf(targetId, sourceId)) {
      setOverTarget(null);
      return;
    }

    // Multi-select guard
    for (const sp of selectedKeys) {
      if (isDescendantOf(targetId, sp)) {
        setOverTarget(null);
        return;
      }
    }

    const pointerY = (native as PointerEvent).clientY;
    const targetEntry = flatList.find(e => e.path === targetId);
    const el = document.querySelector<HTMLElement>(`[data-item-path="${CSS.escape(targetId)}"]`);

    let position: DropPosition = 'below';
    if (el) {
      const rect = el.getBoundingClientRect();
      const relY = (pointerY - rect.top) / rect.height;

      if (targetEntry?.type === 'group' || targetEntry?.type === 'layout') {
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

    // Check if layout nodes are involved — use tree-aware routing
    const involvesLayout = isLayoutId(sourcePath) || isLayoutId(currentOverTarget.path)
      || flatList.find(e => e.path === currentOverTarget.path)?.type === 'layout';

    if (involvesLayout) {
      // Tree-aware DnD: import TreeFlatEntry-compatible entries from flatList
      const treeFlatEntries = flatList.map(e => ({
        id: e.path,
        node: { component: '' },
        depth: e.depth,
        hasChildren: e.hasChildren,
        defPath: isLayoutId(e.path) ? null : e.path,
        category: e.type as any,
        nodeId: isLayoutId(e.path) ? e.path.slice('__node:'.length) : (e.type === 'display' ? e.path.split('.').pop() : undefined),
        bind: e.type !== 'layout' && e.type !== 'display' ? e.path.split('.').pop() : undefined,
      }));

      const treeTarget = computeTreeDropTarget(
        sourcePath,
        currentOverTarget.path,
        currentOverTarget.position,
        treeFlatEntries as any,
      );

      if (!treeTarget) return;

      if (treeTarget.defMove) {
        dispatch({
          type: 'definition.moveItem',
          payload: {
            sourcePath: treeTarget.defMove.sourcePath,
            targetParentPath: treeTarget.defMove.targetParentPath ?? undefined,
            targetIndex: treeTarget.defMove.targetIndex,
          },
        });
      } else {
        dispatch({
          type: 'component.moveNode',
          payload: {
            source: treeTarget.sourceRef,
            targetParent: treeTarget.targetParentRef,
            targetIndex: treeTarget.targetIndex,
          },
        });
      }
      return;
    }

    // Standard definition-based DnD (no layout nodes involved)
    const target = computeDropTarget(
      sourcePath,
      currentOverTarget.path,
      currentOverTarget.position,
      flatList,
      selectedKeys.size > 1 ? selectedKeys : undefined,
    );

    if (!target) return;

    if (selectedKeys.size > 1 && selectedKeys.has(sourcePath)) {
      // Multi-select drag — use simulation-based command builder
      const pruned = pruneDescendants(selectedKeys);
      const pathOrder = new Map(flatList.map((e, i) => [e.path, i]));
      pruned.sort((a, b) => (pathOrder.get(a) ?? 0) - (pathOrder.get(b) ?? 0));

      const commands = buildSequentialMoveCommands(
        pruned,
        target.parentPath,
        currentOverTarget.path,
        currentOverTarget.position,
        flatList,
      );
      batch(commands);
    } else {
      // Single item drag
      dispatch({
        type: 'definition.moveItem',
        payload: {
          sourcePath,
          targetParentPath: target.parentPath ?? undefined,
          targetIndex: target.index,
        },
      });
    }
  }, [overTarget, flatList, selectedKeys, dispatch, batch]);

  return {
    activeId,
    overTarget,
    onDragStart,
    onDragMove,
    onDragOver,
    onDragEnd,
  };
}
