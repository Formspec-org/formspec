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
}: GridCanvasProps) {
  const selectedItem = selectedItemKey ? items.find(i => i.key === selectedItemKey) : null;
  const isBrokenSelected = selectedItem?.status === 'broken';

  const containerRef = useRef<HTMLDivElement>(null);

  // ── D1: Drag-to-resize state ──────────────────────────────────────
  const [resizing, setResizing] = useState<{
    key: string;
    startX: number;
    startWidth: number;
    columnWidth: number;
    currentWidth: number;
  } | null>(null);

  const handleResizeStart = useCallback((itemKey: string, currentWidth: number, e: React.PointerEvent) => {
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;
    const columnWidth = containerRect.width / 12;
    setResizing({
      key: itemKey,
      startX: e.clientX,
      startWidth: currentWidth,
      columnWidth,
      currentWidth,
    });
    document.body.style.pointerEvents = 'none';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    if (!resizing) return;

    function onPointerMove(e: PointerEvent) {
      if (!resizing) return;
      const deltaColumns = Math.round((e.clientX - resizing.startX) / resizing.columnWidth);
      const newWidth = Math.max(1, Math.min(12, resizing.startWidth + deltaColumns));
      if (newWidth !== resizing.currentWidth) {
        setResizing(prev => prev ? { ...prev, currentWidth: newWidth } : null);
      }
    }

    function onPointerUp() {
      if (!resizing) return;
      const finalWidth = resizing.currentWidth;
      const key = resizing.key;
      document.body.style.pointerEvents = '';
      document.body.style.userSelect = '';
      setResizing(null);
      // Commit the width change
      if (finalWidth !== resizing.startWidth) {
        if (activeBreakpoint === 'base') {
          onSetWidth(key, finalWidth);
        } else {
          onSetResponsive(key, activeBreakpoint, { width: finalWidth });
        }
      }
    }

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    return () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
    };
  }, [resizing, activeBreakpoint, onSetWidth, onSetResponsive]);

  // ── Droppable: canvas itself is a fallback drop target ────────────
  const { ref: dropRef } = useDroppable({
    id: 'grid-canvas-drop',
    data: { type: 'grid-canvas' },
  });

  return (
    <div
      ref={(el) => {
        (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
        dropRef(el);
      }}
      data-grid-canvas
      className="relative min-h-[200px] p-4 bg-subtle/5 rounded-lg"
      style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '8px' }}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && selectedItemKey) {
          e.stopPropagation();
          onSelectItem(null);
        }
      }}
      onClick={(e) => {
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
          const width = resizing?.key === item.key
            ? resizing.currentWidth
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
                onSelect={() => onSelectItem(item.key)}
                onRemove={() => onRemoveItem(item.key)}
                onResizeStart={(e) => handleResizeStart(
                  item.key,
                  effectiveWidth(item, activeBreakpoint),
                  e,
                )}
                resizingWidth={resizing?.key === item.key ? resizing.currentWidth : undefined}
              />

              {/* SelectionToolbar for valid selected items */}
              {isSelected && !isBrokenSelected && (
                <div className="absolute left-0 right-0 z-10 mt-1" style={{ top: '100%' }}>
                  <SelectionToolbar
                    item={item}
                    activeBreakpoint={activeBreakpoint}
                    onSetWidth={(w) => onSetWidth(item.key, w)}
                    onSetOffset={(o) => onSetOffset(item.key, o)}
                    onSetResponsive={(bp, overrides) => onSetResponsive(item.key, bp, overrides)}
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
