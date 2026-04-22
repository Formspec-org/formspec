/** @filedesc Shared layout leaf block shell — drag setup, resize handles, shell styling, resize overlay, stop-select. Used by FieldBlock and DisplayBlock. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { LAYOUT_LEAF_SELECTED, LAYOUT_LEAF_UNSELECTED, LAYOUT_DRAG_SOURCE_STYLE } from './layout-node-styles';
import { useResizeHandle } from './useResizeHandle';
import { useLayoutResizeReporter } from './LayoutResizeContext';

export const STOP_SELECT = 'data-layout-stop-select';

export function targetStopsSelect(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(`[${STOP_SELECT}]`) != null;
}

export interface LeafBlockResizeProps {
  isInGrid: boolean;
  parentGridColumns: number;
  currentColSpan: number;
  currentRowSpan: number;
  onResizeColSpan?: (newSpan: number) => void;
  onResizeRowSpan?: (newSpan: number) => void;
}

export interface LayoutLeafBlockProps {
  blockRef: React.RefCallback<HTMLDivElement | null>;
  selected: boolean;
  isDragSource: boolean;
  /** Grid style applied to the outer div. */
  gridStyle: React.CSSProperties;
  /** Test id for the outer div. */
  testId: string;
  /** Aria label for the outer div. */
  ariaLabel: string;
  /** data-layout-node-type attribute. */
  nodeType: 'field' | 'display';
  /** data-layout-bind attribute. */
  layoutBind?: string;
  /** data-layout-tree-bind attribute. */
  treeBind?: string;
  /** data-layout-select-key attribute. */
  selectKey: string;
  /** Called on click (only when target does not stop select). */
  onSelect?: (ev: React.MouseEvent | React.KeyboardEvent, selectionKey: string) => void;
  /** Resize configuration. Omit to disable resize handles. */
  resize?: LeafBlockResizeProps;
  /** Content rendered inside the shell. */
  children: ReactNode;
}

export function LayoutLeafBlockShell({
  blockRef,
  selected,
  isDragSource,
  gridStyle,
  testId,
  ariaLabel,
  nodeType,
  layoutBind,
  treeBind,
  selectKey,
  onSelect,
  resize,
  children,
}: LayoutLeafBlockProps) {
  const innerRef = useRef<HTMLDivElement | null>(null);
  const reportResize = useLayoutResizeReporter();

  const isInGrid = resize?.isInGrid ?? false;
  const parentGridColumns = resize?.parentGridColumns ?? 1;
  const currentColSpan = resize?.currentColSpan ?? 1;
  const currentRowSpan = resize?.currentRowSpan ?? 1;
  const spansAllColumns = isInGrid && parentGridColumns > 0 && currentColSpan >= parentGridColumns;
  const showColHandle = isInGrid && !spansAllColumns;

  const pixelsPerUnitRef = useRef<number | undefined>(undefined);
  const [dragSpan, setDragSpan] = useState(currentColSpan);
  const { handleProps, isDragging: isResizing, dragValue, dragPoint } = useResizeHandle({
    axis: 'x',
    min: 1,
    max: parentGridColumns,
    snap: 1,
    initialValue: currentColSpan,
    pixelsPerUnit: pixelsPerUnitRef.current,
    onDrag: (newSpan) => setDragSpan(newSpan),
    onCommit: (newSpan) => resize?.onResizeColSpan?.(newSpan),
  });

  const onHandlePointerDown = (e: React.PointerEvent<HTMLSpanElement>) => {
    const el = innerRef.current;
    if (el && currentColSpan > 0) {
      pixelsPerUnitRef.current = el.offsetWidth / currentColSpan;
    }
    handleProps.onPointerDown(e);
  };

  const pixelsPerUnitRowRef = useRef<number | undefined>(undefined);
  const [dragRowSpan, setDragRowSpan] = useState(currentRowSpan);
  const { handleProps: rowHandleProps, isDragging: isResizingRow, dragValue: dragRowValue, dragPoint: dragRowPoint } = useResizeHandle({
    axis: 'y',
    min: 1,
    max: 12,
    snap: 1,
    initialValue: currentRowSpan,
    pixelsPerUnit: pixelsPerUnitRowRef.current,
    onDrag: (newSpan) => setDragRowSpan(newSpan),
    onCommit: (newSpan) => resize?.onResizeRowSpan?.(newSpan),
  });

  const onRowHandlePointerDown = (e: React.PointerEvent<HTMLSpanElement>) => {
    const el = innerRef.current;
    if (el && currentRowSpan > 0) {
      pixelsPerUnitRowRef.current = el.offsetHeight / currentRowSpan;
    }
    rowHandleProps.onPointerDown(e);
  };

  useEffect(() => {
    if (isResizing) {
      reportResize({ axis: 'x', value: dragValue, cursor: dragPoint ?? { x: 0, y: 0 } });
      return () => reportResize(null);
    }
    if (isResizingRow) {
      reportResize({ axis: 'y', value: dragRowValue, cursor: dragRowPoint ?? { x: 0, y: 0 } });
      return () => reportResize(null);
    }
    reportResize(null);
    return () => reportResize(null);
  }, [dragPoint, dragRowPoint, dragRowValue, dragValue, isResizing, isResizingRow, reportResize]);

  const effectiveColSpan = isResizing ? dragSpan : currentColSpan;
  const effectiveRowSpan = isResizingRow ? dragRowSpan : currentRowSpan;
  const computedGridStyle: React.CSSProperties = {
    ...(isInGrid ? { gridColumn: `span ${effectiveColSpan}` } : {}),
    ...(isInGrid ? { gridRow: `span ${effectiveRowSpan}` } : {}),
  };

  const shellClasses = [
    'group relative flex w-full min-w-0 flex-col rounded-[18px] px-3 py-3 text-left transition-all duration-200 md:px-4 md:py-3.5',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35',
    isDragSource ? LAYOUT_DRAG_SOURCE_STYLE : '',
    selected ? LAYOUT_LEAF_SELECTED : LAYOUT_LEAF_UNSELECTED,
  ].join(' ');

  const stopProps = { [STOP_SELECT]: '' } as React.HTMLAttributes<HTMLDivElement>;

  const itemKey = selectKey;

  return (
    <div
      ref={(el) => {
        (innerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
        blockRef(el);
      }}
      role="group"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={ariaLabel}
      data-testid={testId}
      data-layout-node
      data-layout-node-type={nodeType}
      data-layout-bind={layoutBind}
      data-layout-tree-bind={treeBind}
      data-layout-select-key={selectKey}
      style={{ ...gridStyle, ...computedGridStyle }}
      className={shellClasses}
      onClick={(e) => {
        if (targetStopsSelect(e.target)) return;
        onSelect?.(e, selectKey);
      }}
      onKeyDown={(e) => {
        if (targetStopsSelect(e.target)) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect?.(e, selectKey);
        }
      }}
    >
      {children}

      {(isResizing || isResizingRow) && (
        <div data-testid={`resize-overlay-${itemKey}`} className="pointer-events-none absolute inset-0 z-10">
          <div className="absolute inset-0 rounded-[18px] border border-dashed border-accent/70 bg-accent/10 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.12)]" />
          <div
            data-testid={`resize-preview-${itemKey}`}
            className="absolute inset-y-1 right-1 flex items-center rounded-full border border-accent/30 bg-surface px-2 py-0.5 text-[10px] font-semibold text-accent shadow-sm"
          >
            {isResizing ? `${dragValue} cols` : `${dragRowValue} rows`}
          </div>
          {(dragPoint || dragRowPoint) && (
            <div
              data-testid={`resize-tooltip-${itemKey}`}
              className="fixed z-50 rounded-full border border-accent/30 bg-surface px-2 py-0.5 text-[10px] font-semibold text-accent shadow-md"
              style={{
                left: `${(dragPoint ?? dragRowPoint)!.x + 12}px`,
                top: `${(dragPoint ?? dragRowPoint)!.y - 26}px`,
                transform: 'translateX(-50%)',
              }}
            >
              {isResizing ? `${dragValue}` : `${dragRowValue}`}
            </div>
          )}
        </div>
      )}

      {showColHandle && (
        <>
          <span
            data-testid="resize-handle-col"
            aria-hidden="true"
            className="absolute inset-y-0 right-0 w-2 cursor-col-resize hover:bg-accent/30 rounded-r-[18px]"
            {...stopProps}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerMove={handleProps.onPointerMove}
            onPointerUp={handleProps.onPointerUp}
            onPointerCancel={handleProps.onPointerCancel}
          />
          <span
            data-testid="resize-handle-col-touch-zone"
            aria-hidden="true"
            className="absolute inset-y-0 -right-2 w-6 cursor-col-resize"
            {...stopProps}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={onHandlePointerDown}
            onPointerMove={handleProps.onPointerMove}
            onPointerUp={handleProps.onPointerUp}
            onPointerCancel={handleProps.onPointerCancel}
          />
        </>
      )}

      {isInGrid && selected ? (
        <span
          className="pointer-events-none absolute bottom-1.5 end-1.5 z-[1] h-1 w-1 bg-accent/55"
          aria-hidden
        />
      ) : null}

      {isInGrid && (
        <>
          <span
            data-testid="resize-handle-row"
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-2 cursor-row-resize hover:bg-accent/30 rounded-b"
            {...stopProps}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerMove={rowHandleProps.onPointerMove}
            onPointerUp={rowHandleProps.onPointerUp}
            onPointerCancel={rowHandleProps.onPointerCancel}
          />
          <span
            data-testid="resize-handle-row-touch-zone"
            aria-hidden="true"
            className="absolute inset-x-0 -bottom-2 h-6 cursor-row-resize"
            {...stopProps}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={onRowHandlePointerDown}
            onPointerMove={rowHandleProps.onPointerMove}
            onPointerUp={rowHandleProps.onPointerUp}
            onPointerCancel={rowHandleProps.onPointerCancel}
          />
        </>
      )}
    </div>
  );
}
