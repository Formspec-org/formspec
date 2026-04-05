/** @filedesc Layout canvas block for bound field items — shows label and data type, supports drag reordering, column span resize, inline toolbar, and definition inline edits. */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useDraggable } from '@dnd-kit/react';
import { dataTypeInfo, hasTier3Content } from '@formspec-org/studio-core';
import { DragHandle } from '../../components/ui/DragHandle';
import { FieldIcon } from '../../components/ui/FieldIcon';
import { EditMark, summaryInputClassName, summaryInputLabel } from '../editor/item-row-shared';
import { useResizeHandle } from './useResizeHandle';
import { InlineToolbar } from './InlineToolbar';
import { PropertyPopover } from './PropertyPopover';
import { useLayoutResizeReporter } from './LayoutResizeContext';

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
  index?: number;
  onSelect?: (selectionKey: string) => void;
  /** Dot-delimited parent path prefix (e.g. `demographics.`) shown before the key when inline editing. */
  groupPathPrefix?: string | null;
  /** Tier 1 definition copy — shown as inline summary rows when selected. */
  description?: string | null;
  hint?: string | null;
  /**
   * When both this and `onUpdateDefinitionItem` are set, selected fields show ItemRow-style inline key/label edits.
   * Signature matches editor `onRenameIdentity`: `(nextKey, nextLabel)` after any key rename.
   */
  onRenameDefinitionItem?: (nextKey: string, nextLabel: string | null) => void;
  /** Persist definition item changes (description, hint, …). */
  onUpdateDefinitionItem?: (changes: Record<string, unknown>) => void;
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
  index = 0,
  onSelect,
  groupPathPrefix = null,
  description = null,
  hint = null,
  onRenameDefinitionItem,
  onUpdateDefinitionItem,
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

  const [activeIdentityField, setActiveIdentityField] = useState<'key' | 'label' | null>(null);
  const [draftKey, setDraftKey] = useState(itemKey);
  const [draftLabel, setDraftLabel] = useState(() => (label?.trim() ? label.trim() : ''));
  const [activeInlineSummary, setActiveInlineSummary] = useState<'Description' | 'Hint' | null>(null);
  const [summaryDraft, setSummaryDraft] = useState('');
  const [summaryOriginal, setSummaryOriginal] = useState('');

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
  const showToolbar = selected && !!onSetProp;

  const dt = dataType ? dataTypeInfo(dataType) : null;
  const labelForDescription = label?.trim() && label.trim() !== itemKey ? label.trim() : null;

  const editable = Boolean(onRenameDefinitionItem && onUpdateDefinitionItem);
  const effectiveSelected = selected && !isDragging;
  const showEditMark = effectiveSelected && editable;

  useEffect(() => {
    if (!activeIdentityField) {
      setDraftKey(itemKey);
      setDraftLabel(label?.trim() ? label.trim() : '');
    }
  }, [itemKey, label, activeIdentityField]);

  useEffect(() => {
    if (!selected) {
      setActiveIdentityField(null);
      setActiveInlineSummary(null);
    }
  }, [selected]);

  const openIdentityField = (field: 'key' | 'label') => {
    setActiveInlineSummary(null);
    if (field === 'key') setDraftKey(itemKey);
    if (field === 'label') setDraftLabel(label?.trim() ? label.trim() : '');
    setActiveIdentityField(field);
  };

  const cancelIdentityField = () => {
    setDraftKey(itemKey);
    setDraftLabel(label?.trim() ? label.trim() : '');
    setActiveIdentityField(null);
  };

  const commitIdentityField = (field: 'key' | 'label') => {
    if (!onRenameDefinitionItem) return;
    if (field === 'key' && !draftKey.trim()) {
      cancelIdentityField();
      return;
    }
    if (field === 'label' && !draftLabel.trim()) {
      cancelIdentityField();
      return;
    }
    const nextKey = field === 'key' ? draftKey.trim() : itemKey;
    const nextLabel =
      field === 'label'
        ? (draftLabel.trim() || itemKey)
        : (label?.trim() ? label.trim() : itemKey);
    onRenameDefinitionItem(nextKey, nextLabel);
    setActiveIdentityField(null);
  };

  const handleIdentityKeyDown =
    (field: 'key' | 'label') => (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        commitIdentityField(field);
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        cancelIdentityField();
      }
    };

  const openSummary = (which: 'Description' | 'Hint') => {
    setActiveIdentityField(null);
    const val = which === 'Description' ? (description ?? '') : (hint ?? '');
    setSummaryOriginal(val);
    setSummaryDraft(val);
    setActiveInlineSummary(which);
  };

  const commitSummary = () => {
    if (!onUpdateDefinitionItem || !activeInlineSummary) return;
    const key = activeInlineSummary === 'Description' ? 'description' : 'hint';
    const raw = summaryDraft.trim();
    onUpdateDefinitionItem({ [key]: raw === '' ? null : raw });
    setActiveInlineSummary(null);
  };

  const cancelSummary = () => {
    setSummaryDraft(summaryOriginal);
    setActiveInlineSummary(null);
  };

  const shellClasses = [
    'group relative flex w-full min-w-0 flex-col rounded-[18px] border px-3 py-3 text-left transition-[border-color,background-color,box-shadow,opacity] md:px-4 md:py-3.5',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35',
    isDragging ? 'opacity-40' : '',
    selected
      ? 'border-accent/50 bg-accent/[0.09] shadow-[0_14px_34px_rgba(59,130,246,0.12)]'
      : 'border-transparent hover:border-border/70 hover:bg-bg-default/56',
  ].join(' ');

  const stopProps = { [STOP_SELECT]: '' } as React.HTMLAttributes<HTMLDivElement>;

  const renderIdentity = () => {
    if (!effectiveSelected || !editable) {
      const labelForSecondary =
        label?.trim() && label.trim() !== itemKey ? label.trim() : null;
      return (
        <>
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[17px] font-semibold leading-6 md:text-[18px]">
            <span className="truncate font-mono text-ink">{itemKey}</span>
            {dataType ? (
              <span
                className={`font-mono text-[12px] font-normal tracking-[0.08em] ${dt?.color ?? 'text-muted'}`}
              >
                {dataType}
              </span>
            ) : null}
          </div>
          {labelForSecondary ? (
            <p className="text-[14px] font-normal leading-snug tracking-normal text-ink/80 md:text-[15px]">
              {labelForSecondary}
            </p>
          ) : null}
        </>
      );
    }

    return (
      <>
        {activeIdentityField === 'key' ? (
          <input
            aria-label="Inline key"
            type="text"
            autoFocus
            value={draftKey}
            className="w-full rounded-[6px] border border-accent/30 bg-surface px-2 py-1.5 text-[17px] font-semibold font-mono leading-6 text-ink outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 md:text-[18px]"
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setDraftKey(e.currentTarget.value)}
            onBlur={() => commitIdentityField('key')}
            onKeyDown={handleIdentityKeyDown('key')}
          />
        ) : (
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[17px] font-semibold leading-6 md:text-[18px]">
            <div
              className={`inline-flex max-w-full items-center font-mono text-ink ${showEditMark ? 'group cursor-text' : ''}`}
              onClick={(e) => {
                if (!showEditMark) return;
                e.stopPropagation();
                openIdentityField('key');
              }}
            >
              {groupPathPrefix ? (
                <span className="text-ink/35">{groupPathPrefix}</span>
              ) : null}
              <span className="truncate">{itemKey}</span>
              {showEditMark ? <EditMark testId={`layout-field-${itemKey}-key-edit`} /> : null}
            </div>
            {dataType ? (
              <span
                className={`font-mono text-[12px] font-normal tracking-[0.08em] ${dt?.color ?? 'text-muted'}`}
              >
                {dataType}
              </span>
            ) : null}
          </div>
        )}

        {(labelForDescription || effectiveSelected) && (
          <div className="mt-0.5 max-w-full">
            {activeIdentityField === 'label' ? (
              <input
                aria-label="Inline label"
                type="text"
                autoFocus
                value={draftLabel}
                className="w-full rounded-[6px] border border-border/80 bg-surface px-2 py-1.5 text-[14px] font-normal leading-snug tracking-normal text-ink outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 md:text-[15px]"
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setDraftLabel(e.currentTarget.value)}
                onBlur={() => commitIdentityField('label')}
                onKeyDown={handleIdentityKeyDown('label')}
              />
            ) : (
              <div
                className={`text-[14px] font-normal leading-snug tracking-normal text-ink/80 md:text-[15px] ${showEditMark ? 'group inline-flex cursor-text flex-wrap items-center gap-x-1' : ''}`}
                onClick={(e) => {
                  if (!showEditMark) return;
                  e.stopPropagation();
                  openIdentityField('label');
                }}
              >
                <span className={labelForDescription ? '' : 'italic text-ink/50'}>
                  {labelForDescription ?? 'Add a display label\u2026'}
                </span>
                {showEditMark ? <EditMark testId={`layout-field-${itemKey}-label-edit`} /> : null}
              </div>
            )}
          </div>
        )}
      </>
    );
  };

  const renderSummaryStrip = () => {
    if (!effectiveSelected || !editable || !onUpdateDefinitionItem) return null;

    const row = (which: 'Description' | 'Hint', value: string) => {
      const open = activeInlineSummary === which;
      if (open) {
        return (
          <textarea
            aria-label={summaryInputLabel(which)}
            rows={which === 'Description' ? 3 : 2}
            value={summaryDraft}
            className={summaryInputClassName}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setSummaryDraft(e.currentTarget.value)}
            onBlur={() => commitSummary()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                cancelSummary();
              }
            }}
          />
        );
      }
      const has = value.trim().length > 0;
      return (
        <button
          type="button"
          className="w-full rounded-[8px] border border-transparent px-1 py-1 text-left transition-colors hover:border-border/50 hover:bg-bg-default/40"
          aria-label={which === 'Description' ? 'Edit description' : 'Edit hint'}
          onClick={(e) => {
            e.stopPropagation();
            openSummary(which);
          }}
        >
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{which}</span>
          <div className={`text-[13px] leading-snug ${has ? 'text-ink/85' : 'italic text-ink/45'}`}>
            {has ? value : which === 'Description' ? 'Add description\u2026' : 'Add hint\u2026'}
          </div>
        </button>
      );
    };

    return (
      <div
        {...stopProps}
        className="mt-3 flex flex-col gap-2 border-t border-border/35 pt-3"
      >
        {row('Description', description ?? '')}
        {row('Hint', hint ?? '')}
      </div>
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
      style={gridStyle}
      className={shellClasses}
      onClick={(e) => {
        if (targetStopsSelect(e.target)) return;
        onSelect?.(selectionKey);
      }}
      onKeyDown={(e) => {
        if (targetStopsSelect(e.target)) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect?.(selectionKey);
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
          {renderSummaryStrip()}
          {showToolbar ? (
            <div {...stopProps} className="min-w-0 pt-2">
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
