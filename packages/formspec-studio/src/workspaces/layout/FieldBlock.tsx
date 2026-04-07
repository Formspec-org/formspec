/** @filedesc Layout canvas block for bound fields — label edit, read-only definition copy + Editor link, drag/resize, inline toolbar. */
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { useDraggable } from '@dnd-kit/react';
import { dataTypeInfo, hasTier3Content } from '@formspec-org/studio-core';
import { DragHandle } from '../../components/ui/DragHandle';
import { FieldIcon } from '../../components/ui/FieldIcon';
import { EditMark } from '../editor/item-row-shared';
import { useResizeHandle } from './useResizeHandle';
import { InlineToolbar } from './InlineToolbar';
import { PropertyPopover } from './PropertyPopover';
import { DefinitionCopyReadonlyPanel } from './DefinitionCopyReadonlyPanel';
import { useLayoutResizeReporter } from './LayoutResizeContext';
import { LAYOUT_LEAF_SELECTED, LAYOUT_LEAF_UNSELECTED } from './layout-node-styles';

/** Blocks outer shell click-to-select (drag handle, inputs, toolbar, resize). */
const STOP_SELECT = 'data-layout-stop-select';

function targetStopsSelect(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(`[${STOP_SELECT}]`) != null;
}

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
  /** When set, toolbars / inline edits show only on the primary row during multi-select. */
  layoutPrimaryKey?: string | null;
  index?: number;
  onSelect?: (ev: MouseEvent | KeyboardEvent, selectionKey: string) => void;
  /** Dot-delimited parent path prefix (e.g. `demographics.`) shown before the key when inline editing. */
  groupPathPrefix?: string | null;
  /** Tier 1 definition copy — shown as inline summary rows when selected. */
  description?: string | null;
  hint?: string | null;
  /**
   * When set, selected fields allow inline **label** edits (keys stay read-only on the layout canvas).
   * Description and hint are edited in Editor only (`DefinitionCopyReadonlyPanel`).
   */
  onRenameDefinitionItem?: (nextKey: string, nextLabel: string | null) => void;
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
  /** Called when toolbar wants to set column span via setColumnSpan. */
  onSetColumnSpan?: (newSpan: number) => void;
  /** Called when "Remove from Tree" action is triggered from the PropertyPopover. */
  onRemove?: () => void;
  /** Called when style is removed from the PropertyPopover. */
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
  layoutPrimaryKey = null,
  index = 0,
  onSelect,
  groupPathPrefix = null,
  description = null,
  hint = null,
  onRenameDefinitionItem,
  layoutContext,
  nodeStyle,
  onResizeColSpan,
  onResizeRowSpan,
  nodeProps,
  onSetProp,
  onSetStyle,
  onSetColumnSpan,
  onRemove,
  onStyleRemove,
}: FieldBlockProps) {
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const dragHandleRef = useRef<Element | null>(null);
  const overflowButtonRef = useRef<HTMLButtonElement | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const reportResize = useLayoutResizeReporter();

  const [activeIdentityField, setActiveIdentityField] = useState<'label' | null>(null);
  const [draftLabel, setDraftLabel] = useState(() => (label?.trim() ? label.trim() : ''));

  const { ref: dragRef, isDragging } = useDraggable({
    id: `field:${bindPath}`,
    data: { nodeRef: { bind: itemKey }, index, type: 'tree-node' },
    handle: dragHandleRef,
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

  const { handleProps, isDragging: isResizing, dragValue, dragPoint } = useResizeHandle({
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

  const { handleProps: rowHandleProps, isDragging: isResizingRow, dragValue: dragRowValue, dragPoint: dragRowPoint } = useResizeHandle({
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

  // Apply gridColumn style only when inside a grid container
  const effectiveColSpan = isResizing ? dragSpan : currentColSpan;
  const effectiveRowSpan = isResizingRow ? dragRowSpan : currentRowSpan;
  const gridStyle: React.CSSProperties = {
    ...(isInGrid ? { gridColumn: `span ${effectiveColSpan}` } : {}),
    ...(isInGrid ? { gridRow: `span ${effectiveRowSpan}` } : {}),
  };

  const resolvedNodeProps = nodeProps ?? {};
  const hasPopoverContent = hasTier3Content(resolvedNodeProps);

  const dt = dataType ? dataTypeInfo(dataType) : null;
  const hasDistinctHumanLabel = Boolean(label?.trim() && label.trim() !== itemKey);

  const editable = Boolean(onRenameDefinitionItem);
  const effectiveSelected = selected && !isDragging;
  const isToolbarPrimary = layoutPrimaryKey == null || layoutPrimaryKey === selectionKey;
  const showEditMark = effectiveSelected && editable && isToolbarPrimary;

  useEffect(() => {
    if (!activeIdentityField) {
      setDraftLabel(label?.trim() ? label.trim() : '');
    }
  }, [itemKey, label, activeIdentityField]);

  useEffect(() => {
    if (!selected) {
      setActiveIdentityField(null);
    }
  }, [selected]);

  const showToolbar = selected && isToolbarPrimary && !!onSetProp && !!selectionKey;

  const openLabelEditor = () => {
    setDraftLabel(label?.trim() ? label.trim() : '');
    setActiveIdentityField('label');
  };

  const cancelIdentityField = () => {
    setDraftLabel(label?.trim() ? label.trim() : '');
    setActiveIdentityField(null);
  };

  const commitLabelField = () => {
    if (!onRenameDefinitionItem) return;
    if (!draftLabel.trim()) {
      cancelIdentityField();
      return;
    }
    onRenameDefinitionItem(itemKey, draftLabel.trim() || itemKey);
    setActiveIdentityField(null);
  };

  const handleLabelKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitLabelField();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelIdentityField();
    }
  };

  const shellClasses = [
    'group relative flex w-full min-w-0 flex-col rounded-[18px] px-3 py-3 text-left transition-[border-color,background-color,opacity] md:px-4 md:py-3.5',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35',
    isDragging ? 'opacity-40' : '',
    selected ? LAYOUT_LEAF_SELECTED : LAYOUT_LEAF_UNSELECTED,
  ].join(' ');

  const stopProps = { [STOP_SELECT]: '' } as React.HTMLAttributes<HTMLDivElement>;

  const renderReadonlyKeyRow = () => {
    const selectedEditable = effectiveSelected && editable;
    const showKeySegment = hasDistinctHumanLabel || selectedEditable;
    if (!showKeySegment && !dataType) return null;
    return (
      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[12px] tracking-[0.04em] text-ink/50">
        {showKeySegment ? (
          <span className="inline-flex min-w-0 max-w-full items-baseline gap-0" title={bindPath || itemKey}>
            {groupPathPrefix ? (
              <span className="shrink-0 text-ink/35">{groupPathPrefix}</span>
            ) : null}
            <span className="min-w-0 truncate">{itemKey}</span>
          </span>
        ) : null}
        {dataType && dt ? (
          <span className={`text-[11px] font-normal tracking-[0.08em] ${dt.color}`}>{dataType}</span>
        ) : null}
      </div>
    );
  };

  const renderIdentity = () => {
    const headlineUnselected = label?.trim() || itemKey;

    if (!effectiveSelected || !editable || !isToolbarPrimary) {
      return (
        <>
          <div className="min-w-0 text-[19px] font-semibold leading-tight tracking-tight text-ink md:text-[21px]">
            <span className="break-words">{headlineUnselected}</span>
          </div>
          {renderReadonlyKeyRow()}
        </>
      );
    }

    return (
      <>
        <div className="min-w-0">
          {activeIdentityField === 'label' ? (
            <input
              aria-label="Inline label"
              type="text"
              autoFocus
              value={draftLabel}
              className="w-full rounded-[6px] border border-border/80 bg-surface px-2 py-1.5 text-[19px] font-semibold leading-tight tracking-tight text-ink outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 md:text-[20px]"
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setDraftLabel(e.currentTarget.value)}
              onBlur={() => commitLabelField()}
              onKeyDown={handleLabelKeyDown}
            />
          ) : (
            <div
              className={`inline-flex max-w-full flex-wrap items-center gap-x-1 text-[19px] font-semibold leading-tight tracking-tight text-ink md:text-[20px] ${showEditMark ? 'group cursor-text' : ''}`}
              onClick={(e) => {
                if (!showEditMark) return;
                e.stopPropagation();
                openLabelEditor();
              }}
            >
              <span className={label?.trim() ? '' : 'italic text-ink/50'}>
                {label?.trim() ? label.trim() : 'Add a display label\u2026'}
              </span>
              {showEditMark ? <EditMark testId={`layout-field-${itemKey}-label-edit`} /> : null}
            </div>
          )}
        </div>
        {renderReadonlyKeyRow()}
      </>
    );
  };

  return (
    <div
      ref={(el) => { dragRef(el as HTMLElement); (buttonRef as React.MutableRefObject<HTMLDivElement | null>).current = el; }}
      role="group"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Field ${itemKey}`}
      data-testid={`layout-field-${itemKey}`}
      data-layout-node
      data-layout-node-type="field"
      data-layout-bind={bindPath}
      data-layout-tree-bind={itemKey}
      data-layout-select-key={selectionKey}
      style={gridStyle}
      className={shellClasses}
      onClick={(e) => {
        if (targetStopsSelect(e.target)) return;
        onSelect?.(e, selectionKey);
      }}
      onKeyDown={(e) => {
        if (targetStopsSelect(e.target)) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect?.(e, selectionKey);
        }
      }}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div {...stopProps} className="shrink-0">
          <DragHandle
            ref={dragHandleRef}
            label={`Reorder ${label || itemKey}`}
            className="h-11"
          />
        </div>
        {dataType && dt ? (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-bg-default/85">
            <FieldIcon dataType={dataType} className={`shrink-0 ${dt.color}`} />
          </div>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {renderIdentity()}
          {effectiveSelected ? (
            <DefinitionCopyReadonlyPanel
              definitionPath={bindPath}
              kind="field"
              description={description}
              hint={hint}
              selected={effectiveSelected}
              showToolbar={showToolbar}
              testIdPrefix={`layout-field-${itemKey}`}
            />
          ) : null}
          {showToolbar ? (
            <div
              {...stopProps}
              className="-mx-3 mt-2 min-w-0 rounded-b-[16px] border-t border-border/40 bg-subtle/40 px-3 pt-2 pb-2 shadow-[inset_0_1px_0_rgba(0,0,0,0.04)] md:-mx-4 md:px-4 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
            >
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
                onSetColumnSpan={onSetColumnSpan}
                onOpenPopover={() => setPopoverOpen(true)}
                hasPopoverContent={hasPopoverContent}
                overflowButtonRef={overflowButtonRef}
              />
            </div>
          ) : null}
        </div>
      </div>

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
          onRemove={onRemove ?? (() => {})}
          onClose={() => setPopoverOpen(false)}
        />
      )}

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
