/** @filedesc Shared “remove then insert” index math for Pragmatic list drops (layout canvas, editor, step nav). */
import type { Edge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';

/**
 * After removing the item at `sourceIndex` from a length-`childCount` list, the splice index that places it
 * at `finalIndex` in the resulting list (0 .. childCount-1).
 */
export function postRemovalIndexForFinalIndex(childCount: number, sourceIndex: number, finalIndex: number): number {
  const n = childCount;
  const s = sourceIndex;
  const f = Math.max(0, Math.min(finalIndex, n - 1));
  const working = Array.from({ length: n }, (_, i) => i);
  const [v] = working.splice(s, 1);
  for (let pos = 0; pos <= working.length; pos++) {
    const trial = [...working];
    trial.splice(pos, 0, v);
    if (trial.indexOf(v) === f) return pos;
  }
  return Math.min(f, Math.max(0, working.length));
}

/**
 * Desired final index (0..n-1) from a list item index and closest edge.
 * Vertical lists use top/bottom; horizontal tabs use left/right (same before/after semantics).
 */
export function finalIndexFromRowEdge(rowIndex: number, edge: Edge, childCount: number): number {
  const before = edge === 'top' || edge === 'left';
  if (before) return rowIndex;
  return Math.min(rowIndex + 1, Math.max(0, childCount - 1));
}
