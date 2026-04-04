/** @filedesc Layout canvas block for display-only items (heading, divider, paragraph). Supports column-span resize when inside a Grid. */
import { useRef, useState } from 'react';
import type { LayoutContext } from './FieldBlock';
import { useResizeHandle } from './useResizeHandle';

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
}: DisplayBlockProps) {
  const blockRef = useRef<HTMLButtonElement | null>(null);

  const isInGrid = layoutContext?.parentContainerType === 'grid';
  const parentGridColumns = layoutContext?.parentGridColumns ?? 1;
  const currentColSpan = layoutContext?.currentColSpan ?? 1;
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
    handleProps.onPointerDown(e as unknown as React.PointerEvent);
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

      {/* Right-edge column-span resize handle */}
      {showColHandle && (
        <span
          data-testid="resize-handle-col"
          aria-hidden="true"
          className="absolute inset-y-0 right-0 w-2 cursor-col-resize hover:bg-accent/30 rounded-r"
          onPointerDown={onHandlePointerDown}
          onPointerMove={handleProps.onPointerMove}
          onPointerUp={handleProps.onPointerUp}
          onPointerCancel={handleProps.onPointerCancel}
        />
      )}
    </button>
  );
}
