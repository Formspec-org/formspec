import React, { type ReactNode, type MouseEvent, type KeyboardEvent } from 'react';
import { DragHandle } from '../../components/ui/DragHandle';
import { InlineToolbar } from './InlineToolbar';
import { PropertyPopover } from './PropertyPopover';
import { DefinitionCopyReadonlyPanel } from './DefinitionCopyReadonlyPanel';
import { LAYOUT_LEAF_SELECTED, LAYOUT_LEAF_UNSELECTED, LAYOUT_DRAG_SOURCE_STYLE } from './layout-node-styles';
import { LayoutCanvasRowDropGuides } from './LayoutCanvasRowDropGuides';
import { useLayoutLeafState } from './useLayoutLeafState';
import type { LayoutContext } from './FieldBlock';

const STOP_SELECT = 'data-layout-stop-select';
const stopProps = { [STOP_SELECT]: true };

function targetStopsSelect(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(`[${STOP_SELECT}]`) != null;
}

interface LayoutLeafBlockProps {
  itemKey: string;
  selectionKey: string;
  selected: boolean;
  itemType: 'field' | 'group' | 'display';
  bindPath?: string;
  label?: string;
  icon?: ReactNode;
  identity: ReactNode;
  sortableGroup?: string;
  sortableIndex?: number;
  layoutContext?: LayoutContext;
  nodeProps?: Record<string, unknown>;
  onSelect?: (ev: MouseEvent | KeyboardEvent, selectionKey: string) => void;
  onResizeColSpan?: (newSpan: number) => void;
  onResizeRowSpan?: (newSpan: number) => void;
  onSetProp?: (key: string, value: unknown) => void;
  onSetStyle?: (key: string, value: string) => void;
  onSetColumnSpan?: (newSpan: number) => void;
  onRemove?: () => void;
  onStyleRemove?: (styleKey: string) => void;
  layoutPrimaryKey?: string | null;
  description?: string | null;
  hint?: string | null;
}

export function LayoutLeafBlock({
  itemKey,
  selectionKey,
  selected,
  itemType,
  bindPath,
  label,
  icon,
  identity,
  sortableGroup,
  sortableIndex,
  layoutContext,
  nodeProps,
  onSelect,
  onResizeColSpan,
  onResizeRowSpan,
  onSetProp,
  onSetStyle,
  onSetColumnSpan,
  onRemove,
  onStyleRemove,
  layoutPrimaryKey,
  description,
  hint,
}: LayoutLeafBlockProps) {
  const state = useLayoutLeafState({
    itemKey,
    selectionKey,
    selected,
    itemType,
    bindPath,
    sortableGroup,
    sortableIndex,
    nodeProps,
    layoutContext,
    onResizeColSpan,
    onResizeRowSpan,
    onSelect,
    layoutPrimaryKey,
    onSetProp,
  });

  const shellClasses = [
    'group relative flex min-h-[56px] select-none flex-col rounded-[18px] border p-3 transition-all focus:outline-none focus:ring-2 focus:ring-accent/30 md:p-4',
    selected ? LAYOUT_LEAF_SELECTED : LAYOUT_LEAF_UNSELECTED,
    state.isDragSource ? LAYOUT_DRAG_SOURCE_STYLE : '',
  ].join(' ');

  return (
    <div
      ref={(el) => {
        state.setShellEl(el);
        (state.buttonRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
      }}
      role="group"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${itemType} ${itemKey}`}
      data-testid={`layout-${itemType}-${itemKey}`}
      data-layout-node
      data-layout-node-type={itemType}
      data-layout-bind={bindPath}
      data-layout-tree-bind={itemKey}
      data-layout-select-key={selectionKey}
      style={state.gridStyle}
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
      <LayoutCanvasRowDropGuides sortableGroup={sortableGroup || ''} sortableIndex={sortableIndex || 0} />
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div {...stopProps} className="shrink-0">
          <DragHandle
            ref={(el) => {
              state.dragHandleRef.current = el;
              state.setDragHandleHost(el);
            }}
            label={`Reorder ${label || itemKey}`}
            className="h-11"
          />
        </div>
        {icon}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {identity}
          {state.effectiveSelected ? (
            <DefinitionCopyReadonlyPanel
              definitionPath={bindPath || itemKey}
              kind={itemType === 'display' ? 'display' : 'field'}
              description={description}
              hint={hint}
              selected={state.effectiveSelected}
              showToolbar={state.showToolbar}
              testIdPrefix={`layout-${itemType}-${itemKey}`}
            />
          ) : null}
          {state.showToolbar ? (
            <div
              {...stopProps}
              className="-mx-3 mt-2 min-w-0 rounded-b-[16px] border-t border-border/40 bg-subtle/40 px-3 pt-2 pb-2 shadow-[inset_0_1px_0_rgba(0,0,0,0.04)] md:-mx-4 md:px-4 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
            >
              <InlineToolbar
                selectionKey={selectionKey}
                itemKey={itemKey}
                component={state.resolvedNodeProps.component as string ?? 'TextInput'}
                nodeProps={state.resolvedNodeProps}
                itemType={itemType}
                itemDataType={itemType === 'field' ? (nodeProps?.dataType as string) : undefined}
                layoutContext={layoutContext}
                onSetProp={onSetProp!}
                onSetStyle={onSetStyle}
                onSetColumnSpan={onSetColumnSpan}
                onOpenPopover={() => state.setPopoverOpen(true)}
                hasPopoverContent={state.hasPopoverContent}
                overflowButtonRef={state.overflowButtonRef}
              />
            </div>
          ) : null}
        </div>
      </div>

      {state.showToolbar && state.popoverOpen && (
        <PropertyPopover
          open={state.popoverOpen}
          anchorRef={state.overflowButtonRef}
          nodeProps={state.resolvedNodeProps}
          isContainer={false}
          itemKey={itemKey}
          onSetProp={onSetProp!}
          onSetStyle={onSetStyle ?? (() => {})}
          onStyleRemove={onStyleRemove ?? (() => {})}
          onRemove={onRemove ?? (() => {})}
          onClose={() => state.setPopoverOpen(false)}
        />
      )}

      {(state.isResizing || state.isResizingRow) && (
        <div data-testid={`resize-overlay-${itemKey}`} className="pointer-events-none absolute inset-0 z-10">
          <div className="absolute inset-0 rounded-[18px] border border-dashed border-accent/70 bg-accent/10 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.12)]" />
          <div
            data-testid={`resize-preview-${itemKey}`}
            className="absolute inset-y-1 right-1 flex items-center rounded-full border border-accent/30 bg-surface px-2 py-0.5 text-[10px] font-semibold text-accent shadow-sm"
          >
            {state.isResizing ? `${state.dragValue} cols` : `${state.dragRowValue} rows`}
          </div>
          {(state.dragPoint || state.dragRowPoint) && (
            <div
              data-testid={`resize-tooltip-${itemKey}`}
              className="fixed z-50 rounded-full border border-accent/30 bg-surface px-2 py-0.5 text-[10px] font-semibold text-accent shadow-md"
              style={{
                left: `${(state.dragPoint ?? state.dragRowPoint)!.x + 12}px`,
                top: `${(state.dragPoint ?? state.dragRowPoint)!.y - 26}px`,
                transform: 'translateX(-50%)',
              }}
            >
              {state.isResizing ? `${state.dragValue}` : `${state.dragRowValue}`}
            </div>
          )}
        </div>
      )}

      {state.showColHandle && (
        <>
          <span
            data-testid="resize-handle-col"
            aria-hidden="true"
            className="absolute inset-y-0 right-0 w-2 cursor-col-resize hover:bg-accent/30 rounded-r-[18px]"
            {...stopProps}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerMove={state.handleProps.onPointerMove}
            onPointerUp={state.handleProps.onPointerUp}
            onPointerCancel={state.handleProps.onPointerCancel}
          />
          <span
            data-testid="resize-handle-col-touch-zone"
            aria-hidden="true"
            className="absolute inset-y-0 -right-2 w-6 cursor-col-resize"
            {...stopProps}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={state.onHandlePointerDown}
            onPointerMove={state.handleProps.onPointerMove}
            onPointerUp={state.handleProps.onPointerUp}
            onPointerCancel={state.handleProps.onPointerCancel}
          />
        </>
      )}

      {state.isResizingRow && (
        <>
          <span
            data-testid="resize-handle-row"
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-2 cursor-row-resize hover:bg-accent/30 rounded-b-[18px]"
            {...stopProps}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerMove={state.rowHandleProps.onPointerMove}
            onPointerUp={state.rowHandleProps.onPointerUp}
            onPointerCancel={state.rowHandleProps.onPointerCancel}
          />
          <span
            data-testid="resize-handle-row-touch-zone"
            aria-hidden="true"
            className="absolute -bottom-2 inset-x-0 h-6 cursor-row-resize"
            {...stopProps}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={state.onRowHandlePointerDown}
            onPointerMove={state.rowHandleProps.onPointerMove}
            onPointerUp={state.rowHandleProps.onPointerUp}
            onPointerCancel={state.rowHandleProps.onPointerCancel}
          />
        </>
      )}
    </div>
  );
}
