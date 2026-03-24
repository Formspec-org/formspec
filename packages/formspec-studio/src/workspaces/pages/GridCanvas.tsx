/** @filedesc 12-column interactive grid canvas for page layout editing. */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useSortable } from '@dnd-kit/react/sortable';
import { useDroppable } from '@dnd-kit/react';
import type { PageItemView } from 'formspec-studio-core';
import { GridItemBlock } from './GridItemBlock';
import { SelectionToolbar } from './SelectionToolbar';

export interface GridCanvasProps {
  items: PageItemView[];
  activeBreakpoint: string;
  selectedItemKey?: string | null;
  onSelectItem: (key: string | null) => void;
  onRemoveItem: (key: string) => void;
  onSetWidth: (key: string, width: number) => void;
  onSetOffset: (key: string, offset: number | undefined) => void;
  onSetResponsive: (key: string, bp: string, overrides: { width?: number; offset?: number; hidden?: boolean }) => void;
  onMoveItem: (key: string, targetIndex: number) => void;
  /** Other pages the selected item can be moved to. */
  otherPages?: Array<{ id: string; title: string }>;
  /** Called when the user moves the selected item to another page. */
  onMoveToPage?: (itemKey: string, targetPageId: string) => void;
  /** Called when the user unassigns the selected item back to the unassigned pool. */
  onUnassignItem?: (itemKey: string) => void;
  /**
   * When true the canvas is non-interactive (pointer-events disabled, reduced opacity).
   * Used when the page is dormant (single mode).
   */
  disabled?: boolean;
  /**
   * When true the canvas uses a reduced min-height (100px instead of 200px).
   * Useful when embedded inline in a card.
   */
  compact?: boolean;
  /**
   * Unique identifier for the page this canvas belongs to.
   * Used to generate a unique droppable ID when multiple canvases share a DragDropProvider.
   */
  pageId?: string;
}

/** Resolve effective width for a breakpoint. */
function effectiveWidth(item: PageItemView, bp: string): number {
  if (bp === 'base') return item.width;
  return item.responsive[bp]?.width ?? item.width;
}

// ── SortableGridItem ──────────────────────────────────────────────────

function SortableGridItem({
  id,
  index,
  width,
  children,
}: {
  id: string;
  index: number;
  width: number;
  children: React.ReactNode;
}) {
  const { ref, isDragSource } = useSortable({
    id,
    index,
    data: { type: 'grid-item', key: id },
    transition: null,
  });

  return (
    <div
      ref={ref}
      data-grid-item
      style={{ gridColumn: `span ${Math.min(width, 12)}` }}
      className={`relative ${isDragSource ? 'opacity-40' : ''}`}
    >
      {children}
    </div>
  );
}

// ── GridCanvas ────────────────────────────────────────────────────────

export function GridCanvas({
  items,
  activeBreakpoint,
  selectedItemKey,
  onSelectItem,
  onRemoveItem,
  onSetWidth,
  onSetOffset,
  onSetResponsive,
  onMoveItem,
  otherPages,
  onMoveToPage,
  onUnassignItem,
  disabled = false,
  compact = false,
  pageId,
}: GridCanvasProps) {
  const selectedItem = selectedItemKey ? items.find(i => i.key === selectedItemKey) : null;
  const isBrokenSelected = selectedItem?.status === 'broken';

  const containerRef = useRef<HTMLDivElement>(null);

  // Clear selection when the selected item is no longer in the items array (removed, moved, or unassigned).
  useEffect(() => {
    if (selectedItemKey && !items.some(i => i.key === selectedItemKey)) {
      onSelectItem(null);
    }
  }, [items, selectedItemKey, onSelectItem]);

  // ── D1: Drag-to-resize ───────────────────────────────────────────
  // Mutable ref holds drag state so pointermove/pointerup listeners
  // are registered once (on down) and removed once (on up) — no
  // re-registration on every frame.
  const dragRef = useRef<{
    key: string;
    startX: number;
    startWidth: number;
    columnWidth: number;
    currentWidth: number;
  } | null>(null);
  // Render-facing state: only the key (to know which item is resizing)
  // and the live column width (for the visual badge).
  const [resizingDisplay, setResizingDisplay] = useState<{
    key: string;
    width: number;
  } | null>(null);

  // Stable refs for the callbacks so the closure in pointermove/up
  // always reads the latest values without re-registering listeners.
  const callbacksRef = useRef({ onSetWidth, onSetResponsive, activeBreakpoint });
  callbacksRef.current = { onSetWidth, onSetResponsive, activeBreakpoint };

  const handleResizeStart = useCallback((itemKey: string, currentWidth: number, e: React.PointerEvent) => {
    if (disabled) return;
    const captureEl = e.currentTarget;
    if (!(captureEl instanceof HTMLElement)) return;
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;
    const columnWidth = containerRect.width / 12;
    const pointerId = e.pointerId;

    dragRef.current = {
      key: itemKey,
      startX: e.clientX,
      startWidth: currentWidth,
      columnWidth,
      currentWidth,
    };
    setResizingDisplay({ key: itemKey, width: currentWidth });

    document.body.style.userSelect = 'none';

    try {
      captureEl.setPointerCapture(pointerId);
    } catch {
      // Missing capture support or invalid id — fall back to document listeners below.
    }

    function onPointerMove(ev: PointerEvent) {
      if (ev.pointerId !== pointerId) return;
      const drag = dragRef.current;
      if (!drag) return;
      const deltaColumns = Math.round((ev.clientX - drag.startX) / drag.columnWidth);
      const newWidth = Math.max(1, Math.min(12, drag.startWidth + deltaColumns));
      if (newWidth !== drag.currentWidth) {
        drag.currentWidth = newWidth;
        setResizingDisplay({ key: drag.key, width: newWidth });
      }
    }

    function finishPointer(ev: PointerEvent) {
      if (ev.pointerId !== pointerId) return;
      try {
        captureEl.releasePointerCapture(pointerId);
      } catch {
        /* already released */
      }
      document.body.style.userSelect = '';
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', finishPointer);
      document.removeEventListener('pointercancel', finishPointer);

      const drag = dragRef.current;
      if (!drag) return;

      const { key, currentWidth: finalWidth, startWidth } = drag;
      dragRef.current = null;
      setResizingDisplay(null);

      if (finalWidth !== startWidth) {
        const { activeBreakpoint: bp, onSetWidth: setW, onSetResponsive: setR } = callbacksRef.current;
        if (bp === 'base') {
          setW(key, finalWidth);
        } else {
          setR(key, bp, { width: finalWidth });
        }
      }
    }

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', finishPointer);
    document.addEventListener('pointercancel', finishPointer);
  }, [disabled]);

  // ── Droppable: canvas itself is a fallback drop target ────────────
  // Use a page-scoped ID so multiple canvases sharing a DragDropProvider get unique droppable IDs.
  const { ref: dropRef } = useDroppable({
    id: pageId ? `grid-canvas-drop-${pageId}` : 'grid-canvas-drop',
    data: { type: 'grid-canvas' },
  });

  const minHeightClass = compact ? 'min-h-[100px]' : 'min-h-[200px]';
  const disabledClass = disabled ? 'pointer-events-none opacity-50' : '';

  return (
    <div
      ref={(el) => {
        (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
        dropRef(el);
      }}
      data-grid-canvas
      role="region"
      aria-label="Page layout grid"
      className={`relative ${minHeightClass} p-4 bg-subtle/30 rounded-xl border border-border/50 ${disabledClass}`}
      style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '8px' }}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === 'Escape' && selectedItemKey) {
          e.stopPropagation();
          onSelectItem(null);
        }
      }}
      onClick={(e) => {
        if (disabled) return;
        if (e.target === e.currentTarget && selectedItemKey) {
          onSelectItem(null);
        }
      }}
    >
      {/* Column guides */}
      {Array.from({ length: 12 }, (_, i) => (
        <div
          key={`guide-${i}`}
          className="absolute top-0 bottom-0 border-l border-border/30 border-dashed pointer-events-none"
          style={{ left: `${(i / 12) * 100}%` }}
        />
      ))}

      {items.length === 0 ? (
        <div
          className="col-span-12 flex items-center justify-center text-muted text-[12px] py-12"
          style={{ gridColumn: 'span 12' }}
        >
          Drag fields from the palette to build this page's layout.
        </div>
      ) : (
        items.map((item, index) => {
          const isSelected = item.key === selectedItemKey;
          const width = resizingDisplay?.key === item.key
            ? resizingDisplay.width
            : effectiveWidth(item, activeBreakpoint);

          return (
            <SortableGridItem
              key={item.key}
              id={item.key}
              index={index}
              width={width}
            >
              <GridItemBlock
                item={item}
                isSelected={isSelected}
                activeBreakpoint={activeBreakpoint}
                onSelect={() => {
                  if (!disabled) onSelectItem(item.key);
                }}
                onRemove={() => onRemoveItem(item.key)}
                onResizeStart={(e) => handleResizeStart(
                  item.key,
                  effectiveWidth(item, activeBreakpoint),
                  e,
                )}
                resizingWidth={resizingDisplay?.key === item.key ? resizingDisplay.width : undefined}
              />

              {/* SelectionToolbar for valid selected items */}
              {isSelected && !isBrokenSelected && !disabled && (
                <div
                  className="absolute left-0 z-10 mt-1 w-max max-w-full"
                  style={{ top: '100%' }}
                >
                  <SelectionToolbar
                    item={item}
                    activeBreakpoint={activeBreakpoint}
                    onSetWidth={(w) => onSetWidth(item.key, w)}
                    onSetOffset={(o) => onSetOffset(item.key, o)}
                    onSetResponsive={(bp, overrides) => onSetResponsive(item.key, bp, overrides)}
                    otherPages={otherPages}
                    onMoveToPage={onMoveToPage}
                    onUnassignItem={onUnassignItem}
                  />
                </div>
              )}
            </SortableGridItem>
          );
        })
      )}
    </div>
  );
}
