/** @filedesc Layout canvas block for bound field items — shows label and data type, supports drag reordering, column span resize, and inline toolbar. */
import { useRef, useState } from 'react';
import { useDraggable } from '@dnd-kit/react';
import { hasTier3Content } from '@formspec-org/studio-core';
import { useResizeHandle } from './useResizeHandle';
import { InlineToolbar } from './InlineToolbar';
import { PropertyPopover } from './PropertyPopover';

/** Layout context passed from the parent container so FieldBlock can apply spatial CSS. */
export interface LayoutContext {
  /** Type of the parent container (lowercase component name). */
  parentContainerType: string;
  /** Number of columns in the parent Grid (only meaningful when parentContainerType === 'grid'). */
  parentGridColumns: number;
  /** Current column span of this field (used to determine if right-edge handle should be shown). */
  currentColSpan: number;
  /** Current row span of this field (used by row span resize handle). */
  currentRowSpan?: number;
}

interface FieldBlockProps {
  itemKey: string;
  bindPath: string;
  selectionKey: string;
  label?: string;
  dataType?: string;
  /** Item type — 'field' | 'group' | 'display'. */
  itemType?: string;
  selected?: boolean;
  index?: number;
  onSelect?: (selectionKey: string) => void;
  /** Layout context from the parent container. */
  layoutContext?: LayoutContext;
  /** Component node style map — gridColumn, padding, etc. */
  nodeStyle?: Record<string, unknown>;
  /** Called when the user drag-resizes the column span. */
  onResizeColSpan?: (newSpan: number) => void;
  /** Called when the user drag-resizes the row span. */
  onResizeRowSpan?: (newSpan: number) => void;
  /**
   * Full raw node props for the field's component node — used by InlineToolbar.
   * When provided with onSetProp, enables the inline toolbar.
   */
  nodeProps?: Record<string, unknown>;
  /** Called when toolbar writes a property to the component node. */
  onSetProp?: (key: string, value: unknown) => void;
  /** Called when toolbar writes a style property (via style map, not direct prop). */
  onSetStyle?: (key: string, value: string) => void;
  /** Called when "Remove from Tree" action is triggered from the PropertyPopover. */
  onRemove?: () => void;
  /** Called when style is added from the PropertyPopover. */
  onStyleAdd?: (key: string, value: string) => void;  /** Called when style is removed from the PropertyPopover. */
  onStyleRemove?: (styleKey: string) => void;
}

export function FieldBlock({
  itemKey,
  bindPath,
  selectionKey,
  label,
  dataType,
  itemType = 'field',
  selected = false,
  index = 0,
  onSelect,
  layoutContext,
  nodeStyle,
  onResizeColSpan,
  onResizeRowSpan,
  nodeProps,
  onSetProp,
  onSetStyle,
  onRemove,
  onStyleRemove,
}: FieldBlockProps) {
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const overflowButtonRef = useRef<HTMLButtonElement | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const { ref: dragRef, isDragging } = useDraggable({
    id: `field:${bindPath}`,
    data: { nodeRef: { bind: itemKey }, index, type: 'tree-node' },
  });

  const isInGrid = layoutContext?.parentContainerType === 'grid';
  const spansAllColumns =
    isInGrid &&
    layoutContext!.parentGridColumns > 0 &&
    layoutContext!.currentColSpan >= layoutContext!.parentGridColumns;

  const showColHandle = isInGrid && !spansAllColumns;
  const currentColSpan = layoutContext?.currentColSpan ?? 1;
  const currentRowSpan = layoutContext?.currentRowSpan ?? 1;
  const parentGridColumns = layoutContext?.parentGridColumns ?? 1;

  // Column span resize
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
    const el = buttonRef.current;
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
    const el = buttonRef.current;
    if (el && currentRowSpan > 0) {
      pixelsPerUnitRowRef.current = el.offsetHeight / currentRowSpan;
    }
    rowHandleProps.onPointerDown(e);
  };

  // Apply gridColumn style only when inside a grid container
  // During drag, use local dragSpan to update CSS grid-column; after commit, use nodeStyle
  const effectiveColSpan = isResizing ? dragSpan : currentColSpan;
  const gridColumnStyle: React.CSSProperties = isInGrid
    ? { gridColumn: `span ${effectiveColSpan}` }
    : {};

  const resolvedNodeProps = nodeProps ?? {};

  // Determine dot indicator for overflow button
  const hasPopoverContent = hasTier3Content(resolvedNodeProps);

  const showToolbar = selected && !!onSetProp;

  return (
    <div
      ref={(el) => { dragRef(el as HTMLElement); (buttonRef as React.MutableRefObject<HTMLDivElement | null>).current = el; }}
      role="button"
      tabIndex={0}
      data-testid={`layout-field-${itemKey}`}
      data-layout-node
      data-layout-node-type="field"
      data-layout-bind={bindPath}
      aria-pressed={selected}
      onClick={() => onSelect?.(selectionKey)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(selectionKey); } }}
      style={gridColumnStyle}
      className={`relative flex w-full items-center gap-2 rounded border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 ${
        isDragging ? 'opacity-40' : ''
      } ${
        selected
          ? 'border-accent bg-accent/10 shadow-sm'
          : 'border-border bg-surface hover:border-accent/40 hover:bg-subtle/50'
      }`}
    >
      {!showToolbar && (
        <>
          <span className="text-[13px] font-medium text-ink">{label || itemKey}</span>
          {dataType && (
            <span className="text-[11px] text-muted font-mono">{dataType}</span>
          )}
        </>
      )}

      {/* Inline toolbar — shown when selected and onSetProp is provided */}
      {showToolbar && (
        <InlineToolbar
          selectionKey={selectionKey}
          itemKey={itemKey}
          component={resolvedNodeProps.component as string ?? 'TextInput'}
          nodeProps={resolvedNodeProps}
          itemType={itemType}
          itemDataType={dataType}
          layoutContext={layoutContext}
          onSetProp={onSetProp!}
          onSetStyle={onSetStyle}
          onOpenPopover={() => setPopoverOpen(true)}
          hasPopoverContent={hasPopoverContent}
          overflowButtonRef={overflowButtonRef}
        />
      )}

      {/* PropertyPopover */}
      {showToolbar && popoverOpen && (
        <PropertyPopover
          open={popoverOpen}
          anchorRef={overflowButtonRef}
          nodeProps={resolvedNodeProps}
          isContainer={false}
          itemKey={itemKey}
          onSetProp={onSetProp!}
          onSetStyle={onSetStyle ?? (() => {})}
          onStyleRemove={onStyleRemove ?? (() => {})}
          onUnwrap={() => {}}
          onRemove={onRemove ?? (() => {})}
          onClose={() => setPopoverOpen(false)}
        />
      )}

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
    </div>
  );
}
