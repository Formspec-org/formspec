/** @filedesc Layout canvas block for display-only items — label, body editor for notes, read-only definition copy with link to Editor, toolbar. */
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { hasTier3Content } from '@formspec-org/studio-core';
import { DragHandle } from '../../components/ui/DragHandle';
import type { LayoutContext } from './FieldBlock';
import { EditMark } from '../shared/item-row-shared';
import { useResizeHandle } from './useResizeHandle';
import { InlineToolbar } from './InlineToolbar';
import { PropertyPopover } from './PropertyPopover';
import { DefinitionCopyReadonlyPanel } from './DefinitionCopyReadonlyPanel';
import { useLayoutResizeReporter } from './LayoutResizeContext';
import { LAYOUT_LEAF_SELECTED, LAYOUT_LEAF_UNSELECTED, LAYOUT_DRAG_SOURCE_STYLE } from './layout-node-styles';
import { LayoutCanvasRowDropGuides } from './LayoutCanvasRowDropGuides';
import { useLayoutPragmaticItem } from './useLayoutPragmaticItem';

const STOP_SELECT = 'data-layout-stop-select';

function targetStopsSelect(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(`[${STOP_SELECT}]`) != null;
}

/** Matches editor ItemRow display glyph semantics (component names are often TitleCase). */
function layoutDisplayGlyph(widgetHint?: string): string {
  const w = widgetHint?.toLowerCase() ?? '';
  if (w.includes('heading')) return 'H';
  if (w.includes('divider')) return '\u2014';
  return '\u2139';
}

interface DisplayBlockProps {
  itemKey: string;
  selectionKey: string;
  label?: string;
  widgetHint?: string;
  selected?: boolean;
  layoutPrimaryKey?: string | null;
  onSelect?: (ev: MouseEvent | KeyboardEvent, selectionKey: string) => void;
  groupPathPrefix?: string | null;
  description?: string | null;
  hint?: string | null;
  onRenameDefinitionItem?: (nextKey: string, nextLabel: string | null) => void;
  /** Definition path for description/hint (Editor is canonical); omit for tree-only display nodes. */
  definitionCopyPath?: string | null;
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
  /**
   * Tier 1 definition display items: commit body text to `item.label` (Layout-added notes).
   * When set, a multi-line editor is shown while the block is selected.
   */
  onCommitDisplayLabel?: (text: string | null) => void;
  /** Layout canvas: parent reorder list id (with sortableIndex + treeDragNodeRef). */
  sortableGroup?: string;
  sortableIndex?: number;
  treeDragNodeRef?: { bind?: string; nodeId?: string };
}

export function DisplayBlock({
  itemKey,
  selectionKey,
  label,
  widgetHint,
  selected = false,
  layoutPrimaryKey = null,
  onSelect,
  groupPathPrefix = null,
  description = null,
  hint = null,
  onRenameDefinitionItem,
  definitionCopyPath = null,
  layoutContext,
  nodeStyle,
  onResizeColSpan,
  onResizeRowSpan,
  nodeProps,
  onSetProp,
  onSetStyle,
  onRemove,
  onStyleRemove,
  onCommitDisplayLabel,
  sortableGroup,
  sortableIndex,
  treeDragNodeRef,
}: DisplayBlockProps) {
  const blockRef = useRef<HTMLDivElement | null>(null);
  const dragHandleRef = useRef<Element | null>(null);
  const [shellEl, setShellEl] = useState<HTMLDivElement | null>(null);
  const [dragHandleHost, setDragHandleHost] = useState<Element | null>(null);
  const overflowButtonRef = useRef<HTMLButtonElement | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const reportResize = useLayoutResizeReporter();

  const [activeIdentityField, setActiveIdentityField] = useState<'label' | null>(null);
  const [draftLabel, setDraftLabel] = useState(() => (label?.trim() ? label.trim() : ''));

  const [bodyDraft, setBodyDraft] = useState(label ?? '');
  useEffect(() => {
    setBodyDraft(label ?? '');
  }, [label]);

  const layoutSortable = Boolean(
    sortableGroup &&
      sortableIndex !== undefined &&
      treeDragNodeRef &&
      (treeDragNodeRef.nodeId != null || treeDragNodeRef.bind != null),
  );
  const sortableDragId =
    treeDragNodeRef?.nodeId != null
      ? `node:${treeDragNodeRef.nodeId}`
      : treeDragNodeRef?.bind != null
        ? `bind:${treeDragNodeRef.bind}`
        : 'layout-display:noop';

  const [isDragSource, setIsDragSource] = useState(false);
  const onDragSourceChange = useCallback((active: boolean) => {
    setIsDragSource(active);
  }, []);

  useLayoutPragmaticItem({
    enabled: layoutSortable,
    element: shellEl,
    dragHandle: layoutSortable ? dragHandleHost : null,
    sortableGroup: sortableGroup ?? 'noop',
    sortableIndex: sortableIndex ?? 0,
    nodeRef: treeDragNodeRef ?? {},
    sourceId: sortableDragId,
    onDragSourceChange,
  });

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
    const el = blockRef.current;
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
    onCommit: (newSpan) => onResizeRowSpan?.(newSpan),
  });

  const onRowHandlePointerDown = (e: React.PointerEvent<HTMLSpanElement>) => {
    const el = blockRef.current;
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
  const gridStyle: React.CSSProperties = {
    ...(isInGrid ? { gridColumn: `span ${effectiveColSpan}` } : {}),
    ...(isInGrid ? { gridRow: `span ${effectiveRowSpan}` } : {}),
  };

  const resolvedNodeProps = nodeProps ?? {};
  const hasPopoverContent = hasTier3Content(resolvedNodeProps);
  const isToolbarPrimary = layoutPrimaryKey == null || layoutPrimaryKey === selectionKey;
  const showToolbar = selected && isToolbarPrimary && !!onSetProp && !!selectionKey;
  const showBodyEditor = selected && !!onCommitDisplayLabel && isToolbarPrimary;

  const editable = Boolean(onRenameDefinitionItem);
  const effectiveSelected = selected && !isDragSource;
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
    const nextLabel = draftLabel.trim() === '' ? null : draftLabel.trim();
    onRenameDefinitionItem(itemKey, nextLabel);
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
    'group relative flex w-full min-w-0 flex-col rounded-[18px] px-3 py-3 text-left transition-all duration-200 md:px-4 md:py-3.5',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35',
    isDragSource ? LAYOUT_DRAG_SOURCE_STYLE : '',
    selected ? LAYOUT_LEAF_SELECTED : LAYOUT_LEAF_UNSELECTED,
  ].join(' ');

  const glyph = layoutDisplayGlyph(widgetHint);
  const stopProps = { [STOP_SELECT]: '' } as React.HTMLAttributes<HTMLDivElement>;


  const renderReadonlyKeyRow = () => {
    const selectedEditable = effectiveSelected && editable;
    const hasDistinctHeadline =
      Boolean(label?.trim()) && label!.trim() !== itemKey;
    const showKeySegment = hasDistinctHeadline || selectedEditable;
    if (!showKeySegment && !widgetHint) return null;
    return (
      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[12px] tracking-[0.04em] text-ink/50">
        {showKeySegment ? (
          <span className="inline-flex min-w-0 max-w-full items-baseline gap-0" title={itemKey}>
            {groupPathPrefix ? (
              <span className="shrink-0 text-ink/35">{groupPathPrefix}</span>
            ) : null}
            <span className="min-w-0 truncate">{itemKey}</span>
          </span>
        ) : null}
        {widgetHint ? (
          <span className="text-[11px] font-normal tracking-[0.08em] text-accent/80">{widgetHint}</span>
        ) : null}
      </div>
    );
  };

  const renderIdentity = () => {
    const headlineUnselected = label?.trim() || itemKey;

    if (!effectiveSelected || !editable || !isToolbarPrimary) {
      return (
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="min-w-0 text-[19px] font-semibold leading-tight tracking-tight text-ink md:text-[21px]">
            <span className="whitespace-pre-wrap break-words">{headlineUnselected}</span>
          </div>
          {renderReadonlyKeyRow()}
        </div>
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
              className="w-full rounded-[6px] border border-accent/30 bg-surface px-2 py-1.5 text-[19px] font-semibold leading-tight tracking-tight text-ink outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 md:text-[20px]"
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
              <span className="min-w-0 whitespace-pre-wrap break-words">
                {label?.trim() ? (
                  label.trim()
                ) : (
                  <span className="italic text-ink/50">Empty display text</span>
                )}
              </span>
              {showEditMark ? <EditMark testId={`layout-display-${itemKey}-label-edit`} /> : null}
            </div>
          )}
        </div>
        {renderReadonlyKeyRow()}
      </>
    );
  };

  return (
    <div
      ref={(el) => {
        blockRef.current = el;
        setShellEl(el);
      }}
      role="group"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Display ${itemKey}`}
      data-testid={`layout-display-${itemKey}`}
      data-layout-node
      data-layout-node-type="display"
      data-layout-node-id={itemKey}
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
      {layoutSortable && sortableGroup != null && sortableIndex != null ? (
        <LayoutCanvasRowDropGuides sortableGroup={sortableGroup} sortableIndex={sortableIndex} />
      ) : null}
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {layoutSortable ? (
          <div {...stopProps} className="shrink-0">
            <DragHandle
              ref={(el) => {
                dragHandleRef.current = el;
                setDragHandleHost(el);
              }}
              label={`Reorder ${label?.trim() || itemKey}`}
              className="h-11"
            />
          </div>
        ) : null}
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-bg-default/85">
          <span className="shrink-0 font-mono text-accent">{glyph}</span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {renderIdentity()}
          {showBodyEditor ? (
            <div {...stopProps} className="flex min-w-0 flex-col gap-1.5">
              <textarea
                data-testid="layout-display-body-editor"
                aria-label="Display note text"
                rows={2}
                value={bodyDraft}
                className="min-h-[2.75rem] w-full resize-y rounded-[6px] border border-border/80 bg-surface px-2 py-1.5 text-[14px] leading-snug text-ink outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 md:text-[15px]"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onChange={(e) => setBodyDraft(e.currentTarget.value)}
                onBlur={() => {
                  const next = bodyDraft;
                  const prev = label ?? '';
                  if (next === prev) return;
                  onCommitDisplayLabel!(next.trim() === '' ? null : next);
                }}
              />
            </div>
          ) : null}
          {effectiveSelected && definitionCopyPath ? (
            <DefinitionCopyReadonlyPanel
              definitionPath={definitionCopyPath}
              kind="display"
              description={description}
              hint={hint}
              selected={effectiveSelected}
              showToolbar={showToolbar}
              testIdPrefix={`layout-display-${itemKey}`}
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
                component={resolvedNodeProps.component as string ?? 'Heading'}
                nodeProps={resolvedNodeProps}
                itemType="display"
                itemDataType={widgetHint}
                layoutContext={layoutContext}
                onSetProp={onSetProp!}
                onSetStyle={onSetStyle}
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

      {isInGrid && selected ? (
        <span
          className="pointer-events-none absolute bottom-1.5 end-1.5 z-[1] h-1 w-1 bg-accent/55"
          aria-hidden
        />
      ) : null}

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
