/** @filedesc Pragmatic drag-and-drop data + drop mapping for {@link LayoutStepNav}. */
import { extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import type { ElementDragPayload } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { finalIndexFromRowEdge } from '../../shared/reorder-insert-index';
import { isRecord } from '../../shared/runtime-guards';

export const STEP_NAV_PDND_KIND = 'layout-step-nav';

export type StepNavPdndSourceData = {
  kind: typeof STEP_NAV_PDND_KIND;
  pageId: string;
  index: number;
};

export type StepNavPdndRowData = {
  kind: typeof STEP_NAV_PDND_KIND;
  pageId: string;
  rowIndex: number;
};

export type StepNavDropPayload = {
  source: ElementDragPayload;
  location: {
    current: { dropTargets: { element: Element; data: Record<string, unknown> }[] };
  };
};

/** Resolves desired tab index (0..n-1) and invokes `onMove` when the drag should reorder pages. */
export function applyLayoutStepNavDrop(
  pages: ReadonlyArray<{ id: string }>,
  payload: StepNavDropPayload,
  onMove: (navPageId: string, targetIndex: number) => void,
): void {
  const sd = payload.source.data;
  if (!isRecord(sd) || sd.kind !== STEP_NAV_PDND_KIND) return;

  const draggedId = String(sd.pageId ?? '');
  const s = Number(sd.index);
  if (!draggedId || Number.isNaN(s)) return;

  const targets = payload.location.current.dropTargets;
  if (!targets.length) return;

  const inner = targets[0].data;
  if (!isRecord(inner) || inner.kind !== STEP_NAV_PDND_KIND) return;

  const rowIndex = Number(inner.rowIndex);
  if (Number.isNaN(rowIndex)) return;

  const n = pages.length;
  const edge = extractClosestEdge(inner) ?? 'right';
  const F = finalIndexFromRowEdge(rowIndex, edge, n);
  if (F === s) return;

  onMove(draggedId, F);
}
