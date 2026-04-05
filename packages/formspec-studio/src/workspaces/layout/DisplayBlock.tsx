/** @filedesc Layout canvas block for display-only items (heading, divider, paragraph). Supports column-span resize, inline toolbar, and definition identity/summary edits. */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { hasTier3Content } from '@formspec-org/studio-core';
import type { LayoutContext } from './FieldBlock';
import { EditMark, summaryInputClassName, summaryInputLabel } from '../editor/item-row-shared';
import { useResizeHandle } from './useResizeHandle';
import { InlineToolbar } from './InlineToolbar';
import { PropertyPopover } from './PropertyPopover';
import { useLayoutResizeReporter } from './LayoutResizeContext';

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
  onSelect?: (selectionKey: string) => void;
  groupPathPrefix?: string | null;
  description?: string | null;
  hint?: string | null;
  onRenameDefinitionItem?: (nextKey: string, nextLabel: string | null) => void;
  onUpdateDefinitionItem?: (changes: Record<string, unknown>) => void;
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
}

export function DisplayBlock({
  itemKey,
  selectionKey,
  label,
  widgetHint,
  selected = false,
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
  onRemove,
  onStyleRemove,
  onCommitDisplayLabel,
}: DisplayBlockProps) {
  const blockRef = useRef<HTMLDivElement | null>(null);
  const overflowButtonRef = useRef<HTMLButtonElement | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const reportResize = useLayoutResizeReporter();

  const [activeIdentityField, setActiveIdentityField] = useState<'key' | 'label' | null>(null);
  const [draftKey, setDraftKey] = useState(itemKey);
  const [draftLabel, setDraftLabel] = useState(() => (label?.trim() ? label.trim() : ''));
  const [activeInlineSummary, setActiveInlineSummary] = useState<'Description' | 'Hint' | null>(null);
  const [summaryDraft, setSummaryDraft] = useState('');
  const [summaryOriginal, setSummaryOriginal] = useState('');

  const [bodyDraft, setBodyDraft] = useState(label ?? '');
  useEffect(() => {
    setBodyDraft(label ?? '');
  }, [label]);

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
  const showToolbar = selected && !!onSetProp;
  const showBodyEditor = selected && !!onCommitDisplayLabel;

  const editable = Boolean(onRenameDefinitionItem && onUpdateDefinitionItem);
  const effectiveSelected = selected;
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
    const nextKey = field === 'key' ? draftKey.trim() : itemKey;
    const nextLabel =
      field === 'label'
        ? (draftLabel.trim() === '' ? null : draftLabel.trim())
        : (label?.trim() ? label.trim() : null);
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
    'group relative flex w-full min-w-0 flex-col rounded-[18px] border px-3 py-3 text-left transition-[border-color,background-color,box-shadow] md:px-4 md:py-3.5',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35',
    selected
      ? 'border-accent/50 bg-accent/[0.09] shadow-[0_14px_34px_rgba(59,130,246,0.12)]'
      : 'border-transparent hover:border-border/70 hover:bg-bg-default/56',
  ].join(' ');

  const glyph = layoutDisplayGlyph(widgetHint);
  const stopProps = { [STOP_SELECT]: '' } as React.HTMLAttributes<HTMLDivElement>;

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
      <div {...stopProps} className="mt-3 flex flex-col gap-2 border-t border-border/35 pt-3">
        {row('Description', description ?? '')}
        {row('Hint', hint ?? '')}
      </div>
    );
  };

  const renderIdentity = () => {
    if (!effectiveSelected || !editable) {
      return (
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[17px] font-semibold leading-6 text-ink md:text-[18px]">
            <span className="min-w-0 whitespace-pre-wrap break-words">{label || itemKey}</span>
            {widgetHint ? (
              <span className="font-mono text-[12px] font-normal tracking-[0.08em] text-accent/80">
                {widgetHint}
              </span>
            ) : null}
          </div>
        </div>
      );
    }

    return (
      <>
        {activeIdentityField === 'label' ? (
          <input
            aria-label="Inline label"
            type="text"
            autoFocus
            value={draftLabel}
            className="w-full rounded-[6px] border border-accent/30 bg-surface px-2 py-1.5 text-[17px] font-semibold leading-6 text-ink outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 md:text-[18px]"
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setDraftLabel(e.currentTarget.value)}
            onBlur={() => commitIdentityField('label')}
            onKeyDown={handleIdentityKeyDown('label')}
          />
        ) : (
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[17px] font-semibold leading-6 text-ink md:text-[18px]">
            <span
              className={showEditMark ? 'group inline-flex max-w-full cursor-text items-center text-ink' : 'inline-flex max-w-full items-center text-ink'}
              onClick={(e) => {
                if (!showEditMark) return;
                e.stopPropagation();
                openIdentityField('label');
              }}
            >
              <span className="min-w-0 whitespace-pre-wrap break-words">
                {label?.trim() ? label.trim() : <span className="italic text-ink/50">Empty display text</span>}
              </span>
              {showEditMark ? <EditMark testId={`layout-display-${itemKey}-label-edit`} /> : null}
            </span>
            {widgetHint ? (
              <span className="font-mono text-[12px] font-normal tracking-[0.08em] text-accent/80">
                {widgetHint}
              </span>
            ) : null}
          </div>
        )}

        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          {activeIdentityField === 'key' ? (
            <input
              aria-label="Inline key"
              type="text"
              autoFocus
              value={draftKey}
              className="max-w-[16rem] rounded-[6px] border border-border/80 bg-surface px-2 py-1.5 font-mono text-[12px] tracking-[0.08em] text-ink outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/25"
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setDraftKey(e.currentTarget.value)}
              onBlur={() => commitIdentityField('key')}
              onKeyDown={handleIdentityKeyDown('key')}
            />
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <span className="font-mono text-[11px] tracking-[0.12em] text-ink/60">Key</span>
              <span
                className={`group inline-flex items-center font-mono text-[12px] tracking-[0.08em] text-ink/68 ${showEditMark ? 'cursor-text' : ''}`}
                onClick={(e) => {
                  if (!showEditMark) return;
                  e.stopPropagation();
                  openIdentityField('key');
                }}
              >
                {groupPathPrefix ? <span className="text-ink/35">{groupPathPrefix}</span> : null}
                {itemKey}
                {showEditMark ? <EditMark testId={`layout-display-${itemKey}-key-edit`} /> : null}
              </span>
            </span>
          )}
        </div>
      </>
    );
  };

  return (
    <div
      ref={blockRef}
      role="group"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Display ${itemKey}`}
      data-testid={`layout-display-${itemKey}`}
      data-layout-node
      data-layout-node-type="display"
      data-layout-node-id={itemKey}
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
          {editable && effectiveSelected ? renderSummaryStrip() : null}
          {showToolbar ? (
            <div {...stopProps} className="min-w-0 pt-2">
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

      {showColHandle && (
        <>
          <span
            data-testid="resize-handle-col"
            aria-hidden="true"
            className="absolute inset-y-0 right-0 w-2 cursor-col-resize hover:bg-accent/30 rounded-r"
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
