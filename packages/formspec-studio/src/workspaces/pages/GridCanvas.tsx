/** @filedesc 12-column interactive grid canvas for page layout editing. */
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

  return (
    <div
      data-grid-canvas
      className="relative min-h-[120px]"
      style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '8px' }}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && selectedItemKey) {
          onSelectItem(null);
        }
      }}
      onClick={(e) => {
        // Click on the canvas background deselects
        if (e.target === e.currentTarget && selectedItemKey) {
          onSelectItem(null);
        }
      }}
    >
      {/* Column guides (subtle background grid lines) */}
      {Array.from({ length: 12 }, (_, i) => (
        <div
          key={`guide-${i}`}
          className="absolute top-0 bottom-0 border-l border-border/10 pointer-events-none"
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
        items.map((item) => {
          const isSelected = item.key === selectedItemKey;
          const width = effectiveWidth(item, activeBreakpoint);

          return (
            <div
              key={item.key}
              data-grid-item
              style={{ gridColumn: `span ${Math.min(width, 12)}` }}
              className="relative"
            >
              <GridItemBlock
                item={item}
                isSelected={isSelected}
                activeBreakpoint={activeBreakpoint}
                onSelect={() => onSelectItem(item.key)}
                onRemove={() => onRemoveItem(item.key)}
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
            </div>
          );
        })
      )}
    </div>
  );
}
