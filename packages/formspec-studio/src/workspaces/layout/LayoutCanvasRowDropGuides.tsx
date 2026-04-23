/** @filedesc Accent insertion bar on the top or bottom edge of a layout row when it is the active list drop target. */
import { useLayoutRowDropEdge } from './dnd/LayoutDragFeedbackContext';
import { LAYOUT_CANVAS_ROW_INSERT_BAR_BASE } from './dnd/layout-dnd-styles';

export function LayoutCanvasRowDropGuides({
  sortableGroup,
  sortableIndex,
}: {
  sortableGroup: string;
  sortableIndex: number;
}) {
  const edge = useLayoutRowDropEdge(sortableGroup, sortableIndex);
  if (!edge) return null;
  return (
    <>
      {edge === 'top' ? <div className={`${LAYOUT_CANVAS_ROW_INSERT_BAR_BASE} -top-1`} aria-hidden /> : null}
      {edge === 'bottom' ? <div className={`${LAYOUT_CANVAS_ROW_INSERT_BAR_BASE} -bottom-1`} aria-hidden /> : null}
    </>
  );
}
