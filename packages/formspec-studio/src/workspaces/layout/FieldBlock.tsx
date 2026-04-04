/** @filedesc Layout canvas block for bound field items — shows label and data type, supports drag reordering, column span resize, and inline toolbar. */
import { useRef, useState } from 'react';
import { useDraggable } from '@dnd-kit/react';
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
  const parentGridColumns = layoutContext?.parentGridColumns ?? 1;

  // pixelsPerUnit: width of one column span, measured from the element at drag start.
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
    handleProps.onPointerDown(e as unknown as React.PointerEvent);
  };

  // Apply gridColumn style only when inside a grid container
  // During drag, use local dragSpan to update CSS grid-column; after commit, use nodeStyle
  const effectiveColSpan = isResizing ? dragSpan : currentColSpan;
  const gridColumnStyle: React.CSSProperties = isInGrid
    ? { gridColumn: `span ${effectiveColSpan}` }
    : {};

  const resolvedNodeProps = nodeProps ?? {};

  // Determine dot indicator for overflow button
  const hasPopoverContent = !!(
    (resolvedNodeProps.accessibility as Record<string, unknown> | undefined)?.description ||
    (resolvedNodeProps.accessibility as Record<string, unknown> | undefined)?.role ||
    resolvedNodeProps.cssClass ||
    Object.keys((resolvedNodeProps.style as Record<string, unknown>) ?? {}).length > 0
  );

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
          onSetProp={onSetProp!}
          onStyleAdd={onStyleAdd ?? (() => {})}
          onStyleRemove={onStyleRemove ?? (() => {})}
          onUnwrap={() => {}}
          onRemove={onRemove ?? (() => {})}
          onClose={() => setPopoverOpen(false)}
        />
      )}

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
    </div>
  );
}
