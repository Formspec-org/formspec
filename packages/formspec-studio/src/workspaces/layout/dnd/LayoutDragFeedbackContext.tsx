/** @filedesc React context for live layout drag feedback — pointer position + active row/container drop indicator. */
import { createContext, useContext, type ReactNode } from 'react';
import { layoutCanvasDropNodeRefMatches } from './layout-dnd-styles';
import type { LayoutCanvasDropIndicator } from './layout-pdnd';

export type LayoutDragPointer = { clientX: number; clientY: number };

export type LayoutDragFeedbackState = {
  pointer: LayoutDragPointer | null;
  indicator: LayoutCanvasDropIndicator | null;
};

const LayoutDragFeedbackContext = createContext<LayoutDragFeedbackState | null>(null);

export function LayoutDragFeedbackProvider({
  value,
  children,
}: {
  value: LayoutDragFeedbackState;
  children: ReactNode;
}) {
  return <LayoutDragFeedbackContext.Provider value={value}>{children}</LayoutDragFeedbackContext.Provider>;
}

/** When the innermost drop target is this row, which edge shows the insertion bar. */
export function useLayoutRowDropEdge(sortableGroup: string, sortableIndex: number): 'top' | 'bottom' | null {
  const ctx = useContext(LayoutDragFeedbackContext);
  const ind = ctx?.indicator;
  if (!ind || ind.mode !== 'row') return null;
  if (ind.sortGroup !== sortableGroup || ind.sortableIndex !== sortableIndex) return null;
  return ind.edge;
}

/** True when the pointer’s innermost target is this container’s `container-drop` zone. */
export function useLayoutContainerDropTargetActive(nodeRef: { nodeId?: string; bind?: string } | null): boolean {
  const ctx = useContext(LayoutDragFeedbackContext);
  if (!nodeRef || !ctx?.indicator || ctx.indicator.mode !== 'container') return false;
  return layoutCanvasDropNodeRefMatches(nodeRef, ctx.indicator.nodeRef);
}

/** Pointer during an active layout drag — for positioning the floating preview chip. */
export function useLayoutDragPointer(): LayoutDragPointer | null {
  return useContext(LayoutDragFeedbackContext)?.pointer ?? null;
}
