/** @filedesc Layout canvas block for display-only items (heading, divider, paragraph). Supports column-span resize when inside a Grid. */
import { useRef, useState } from 'react';
import type { LayoutContext } from './FieldBlock';
import { useResizeHandle } from './useResizeHandle';
import { InlineToolbar } from './InlineToolbar';
import { PropertyPopover } from './PropertyPopover';

interface DisplayBlockProps {
  itemKey: string;
  selectionKey: string;
  label?: string;
  widgetHint?: string;
  selected?: boolean;
  onSelect?: (selectionKey: string) => void;
  /** Layout context from the parent container (for grid column span). */
  layoutContext?: LayoutContext;
  /** Component node style map — gridColumn, etc. */
  nodeStyle?: Record<string, unknown>;
  /** Called when the user drag-resizes the column span. */
  onResizeColSpan?: (newSpan: number) => void;
  /** Called when the user drag-resizes the row span. */
  onResizeRowSpan?: (newSpan: number) => void;
  /**
   * Full raw node props for the display item's component node — used by InlineToolbar.
   * When provided with onSetProp, enables the inline toolbar.
   */
  nodeProps?: Record<string, unknown>;
  /** Called when toolbar writes a property to the component node. */
  onSetProp?: (key: string, value: unknown) => void;
  /** Called when toolbar writes a style property (via style map, not direct prop). */
  onSetStyle?: (key: string, value: string) => void;
  /** Called when "Remove from Tree" action is triggered from the PropertyPopover. */
  onRemove?: () => void;
  /** Called when style is removed from the PropertyPopover. */
  onStyleRemove?: (styleKey: string) => void;
}

export function DisplayBlock({
  itemKey,
  selectionKey,
  label,
  widgetHint,
  selected = false,
  onSelect,
  layoutContext,
  nodeStyle,
  onResizeColSpan,
  onResizeRowSpan,
}: DisplayBlockProps) {
  const blockRef = useRef<HTMLButtonElement | null>(null);

  const isInGrid = layoutContext?.parentContainerType === 'grid';
  const parentGridColumns = layoutContext?.parentGridColumns ?? 1;
  const currentColSpan = layoutContext?.currentColSpan ?? 1;
  const currentRowSpan = layoutContext?.currentRowSpan ?? 1;
  const spansAllColumns =
    isInGrid &&
    parentGridColumns > 0 &&
    currentColSpan >= parentGridColumns;
  const showColHandle = isInGrid && !spansAllColumns;

  const pixelsPerUnitRef = useRef<number | undefined>(undefined);
  const [dragSpan, setDragSpan] = useState(currentColSpan);

  const { handleProps, isDragging: isResizing, dragValue } = useResizeHandle({
    axis: 'x',
    min: 1,
    max: parentGridColumns,
    snap: 1,
    initialValue: currentColSpan,
    pixelsPerUnit: pixelsPerUnitRef.current,
    onDrag: (newSpan) => setDragSpan(newSpan),
    onCommit: (newSpan) => onResizeColSpan?.(newSpan),
  });

  const onHandlePointerDown = (e: React.PointerEvent<HTMLSpanElement>) => {
    const el = blockRef.current;
    if (el && currentColSpan > 0) {
      pixelsPerUnitRef.current = el.offsetWidth / currentColSpan;
    }
    handleProps.onPointerDown(e);
  };

  // Row span resize
  const pixelsPerUnitRowRef = useRef<number | undefined>(undefined);
  const [dragRowSpan, setDragRowSpan] = useState(currentRowSpan);

  const { handleProps: rowHandleProps, isDragging: isResizingRow } = useResizeHandle({
    axis: 'y',
    min: 1,
    max: 12,
    snap: 1,
    initialValue: currentRowSpan,
    pixelsPerUnit: pixelsPerUnitRowRef.current,
    onDrag: (newSpan) => setDragRowSpan(newSpan),
    onCommit: (newSpan) => onResizeRowSpan?.(newSpan),
  });

  const onRowHandlePointerDown = (e: React.PointerEvent<HTMLSpanElement>) => {
    const el = blockRef.current;
    if (el && currentRowSpan > 0) {
      pixelsPerUnitRowRef.current = el.offsetHeight / currentRowSpan;
    }
    rowHandleProps.onPointerDown(e);
  };

  // During drag, use local dragSpan to update CSS grid-column; after commit, use nodeStyle
  const effectiveColSpan = isResizing ? dragSpan : currentColSpan;
  const gridColumnStyle: React.CSSProperties = isInGrid
    ? { gridColumn: `span ${effectiveColSpan}` }
    : {};

  return (
    <button
      ref={blockRef}
      type="button"
      data-testid={`layout-display-${itemKey}`}
      data-layout-node
      data-layout-node-type="display"
      data-layout-node-id={itemKey}
      aria-pressed={selected}
      onClick={() => onSelect?.(selectionKey)}
      style={gridColumnStyle}
      className={`relative flex w-full items-center gap-2 rounded px-3 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 ${
        selected
          ? 'border-l-2 border-accent bg-accent/10 shadow-sm'
          : 'border-l-2 border-accent/40 bg-surface hover:bg-subtle/50'
      }`}
    >
      {widgetHint && (
        <span className="text-[10px] font-mono font-semibold uppercase text-accent/70">{widgetHint}</span>
      )}
      <span className="text-[13px] text-ink">{label || itemKey}</span>

      {/* Right-edge column-span resize handle with touch zone */}
      {showColHandle && (
        <>
          {/* Visible handle */}
          <span
            data-testid="resize-handle-col"
            aria-hidden="true"
            className="absolute inset-y-0 right-0 w-2 cursor-col-resize hover:bg-accent/30 rounded-r"
            onPointerMove={handleProps.onPointerMove}
            onPointerUp={handleProps.onPointerUp}
            onPointerCancel={handleProps.onPointerCancel}
          />
          {/* Invisible 24px touch zone */}
          <span
            data-testid="resize-handle-col-touch-zone"
            aria-hidden="true"
            className="absolute inset-y-0 -right-2 w-6 cursor-col-resize"
            onPointerDown={onHandlePointerDown}
            onPointerMove={handleProps.onPointerMove}
            onPointerUp={handleProps.onPointerUp}
            onPointerCancel={handleProps.onPointerCancel}
          />
        </>
      )}

      {/* Bottom-edge row-span resize handle with touch zone */}
      {isInGrid && (
        <>
          {/* Visible handle */}
          <span
            data-testid="resize-handle-row"
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-2 cursor-row-resize hover:bg-accent/30 rounded-b"
            onPointerMove={rowHandleProps.onPointerMove}
            onPointerUp={rowHandleProps.onPointerUp}
            onPointerCancel={rowHandleProps.onPointerCancel}
          />
          {/* Invisible 24px touch zone */}
          <span
            data-testid="resize-handle-row-touch-zone"
            aria-hidden="true"
            className="absolute inset-x-0 -bottom-2 h-6 cursor-row-resize"
            onPointerDown={onRowHandlePointerDown}
            onPointerMove={rowHandleProps.onPointerMove}
            onPointerUp={rowHandleProps.onPointerUp}
            onPointerCancel={rowHandleProps.onPointerCancel}
          />
        </>
      )}
    </button>
  );
}
