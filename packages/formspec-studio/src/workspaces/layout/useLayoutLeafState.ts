import { useCallback, useEffect, useRef, useState, type MouseEvent, type KeyboardEvent } from 'react';
import { hasTier3Content } from '@formspec-org/studio-core';
import { useResizeHandle } from './useResizeHandle';
import { useLayoutResizeReporter } from './LayoutResizeContext';
import { useLayoutPdndItem } from './dnd/useLayoutPdndItem';
import type { LayoutContext } from './FieldBlock';

export interface UseLayoutLeafStateProps {
  itemKey: string;
  selectionKey: string;
  selected: boolean;
  itemType: 'field' | 'group' | 'display';
  bindPath?: string;
  sortableGroup?: string;
  sortableIndex?: number;
  nodeProps?: Record<string, unknown>;
  layoutContext?: LayoutContext;
  onResizeColSpan?: (newSpan: number) => void;
  onResizeRowSpan?: (newSpan: number) => void;
  onSelect?: (ev: MouseEvent | KeyboardEvent, selectionKey: string) => void;
  layoutPrimaryKey?: string | null;
  onSetProp?: (key: string, value: unknown) => void;
}

export function useLayoutLeafState({
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
}: UseLayoutLeafStateProps) {
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const dragHandleRef = useRef<Element | null>(null);
  const [shellEl, setShellEl] = useState<HTMLDivElement | null>(null);
  const [dragHandleHost, setDragHandleHost] = useState<Element | null>(null);
  const overflowButtonRef = useRef<HTMLButtonElement | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const reportResize = useLayoutResizeReporter();

  const [isDragSource, setIsDragSource] = useState(false);
  const onDragSourceChange = useCallback((active: boolean) => {
    setIsDragSource(active);
  }, []);

  useLayoutPdndItem({
    enabled: true,
    element: shellEl,
    dragHandle: dragHandleHost,
    sortableGroup,
    sortableIndex,
    nodeRef: bindPath ? { bind: itemKey } : { nodeId: itemKey },
    sourceId: `${itemType}:${bindPath ?? itemKey}`,
    onDragSourceChange,
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

  const effectiveColSpan = isResizing ? dragSpan : currentColSpan;
  const effectiveRowSpan = isResizingRow ? dragRowSpan : currentRowSpan;
  const gridStyle: React.CSSProperties = {
    ...(isInGrid ? { gridColumn: `span ${effectiveColSpan}` } : {}),
    ...(isInGrid ? { gridRow: `span ${effectiveRowSpan}` } : {}),
  };

  const resolvedNodeProps = nodeProps ?? {};
  const hasPopoverContent = hasTier3Content(resolvedNodeProps);
  const effectiveSelected = selected && !isDragSource;
  const isToolbarPrimary = layoutPrimaryKey == null || layoutPrimaryKey === selectionKey;
  const showToolbar = selected && isToolbarPrimary && !!onSetProp && !!selectionKey;

  return {
    buttonRef,
    dragHandleRef,
    setShellEl,
    setDragHandleHost,
    overflowButtonRef,
    popoverOpen,
    setPopoverOpen,
    isResizing,
    isResizingRow,
    dragValue,
    dragRowValue,
    dragPoint,
    dragRowPoint,
    handleProps,
    rowHandleProps,
    onHandlePointerDown,
    onRowHandlePointerDown,
    gridStyle,
    effectiveSelected,
    showToolbar,
    hasPopoverContent,
    resolvedNodeProps,
    showColHandle,
    isDragSource,
  };
}
