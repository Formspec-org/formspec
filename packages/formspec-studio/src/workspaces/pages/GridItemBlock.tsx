/** @filedesc Presentational block for a single item on the 12-column grid canvas. */
import type { PageItemView } from 'formspec-studio-core';

export interface GridItemBlockProps {
  item: PageItemView;
  isSelected: boolean;
  activeBreakpoint: string;
  onSelect: () => void;
  onRemove: () => void;
  onResizeStart?: (e: React.PointerEvent) => void;
  /** When set, shows the live column count during a resize drag. */
  resizingWidth?: number;
}

/** Resolve effective width for the active breakpoint. */
function effectiveWidth(item: PageItemView, bp: string): { value: number; inherited: boolean } {
  if (bp === 'base') return { value: item.width, inherited: false };
  const override = item.responsive[bp];
  if (override?.width !== undefined) return { value: override.width, inherited: false };
  return { value: item.width, inherited: true };
}

/** Type indicator icons (simple inline SVGs). */
function TypeIcon({ itemType }: { itemType: 'field' | 'group' | 'display' }) {
  if (itemType === 'group') {
    return (
      <svg className="w-3 h-3 shrink-0" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="1" width="10" height="10" rx="1.5" />
        <line x1="1" y1="5" x2="11" y2="5" />
      </svg>
    );
  }
  if (itemType === 'display') {
    return (
      <svg className="w-3 h-3 shrink-0" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
        <line x1="2" y1="3" x2="10" y2="3" />
        <line x1="2" y1="6" x2="8" y2="6" />
        <line x1="2" y1="9" x2="6" y2="9" />
      </svg>
    );
  }
  // field
  return (
    <svg className="w-3 h-3 shrink-0" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="3" width="10" height="6" rx="1.5" />
    </svg>
  );
}

export function GridItemBlock({ item, isSelected, activeBreakpoint, onSelect, onRemove, onResizeStart, resizingWidth }: GridItemBlockProps) {
  const isBroken = item.status === 'broken';
  const isGroup = item.itemType === 'group';
  const { value: displayWidth, inherited } = effectiveWidth(item, activeBreakpoint);

  // Color classes
  const bgClass = isBroken
    ? 'bg-amber-300/30 border-amber-400/50'
    : isGroup
      ? 'bg-accent/30 border-accent/50'
      : 'bg-accent/20 border-accent/40';

  const selectedClass = isSelected ? 'ring-2 ring-accent' : '';

  return (
    <div
      className={`relative border rounded-md px-2 py-1.5 text-[11px] cursor-pointer group transition-all select-none ${bgClass} ${selectedClass}`}
      onClick={onSelect}
      role="button"
      aria-pressed={isSelected}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      {/* Content row */}
      <div className="flex items-center gap-1.5 min-w-0 pr-6">
        <TypeIcon itemType={item.itemType} />
        <span className="truncate font-medium text-ink" title={item.label}>{item.label}</span>

        {/* Group-specific indicators */}
        {isGroup && item.childCount !== undefined && (
          <span className="text-[9px] text-muted shrink-0">
            {item.childCount} fields
          </span>
        )}
        {isGroup && item.repeatable && (
          <svg
            aria-label="repeatable"
            className="w-3 h-3 text-muted shrink-0"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M2 6a4 4 0 0 1 8 0M10 6a4 4 0 0 1-8 0" />
            <path d="M8 4l2 2-2 2" />
          </svg>
        )}

        {/* Width badge */}
        <span
          className={`ml-auto text-[9px] font-mono shrink-0 ${
            resizingWidth !== undefined
              ? 'text-accent font-bold'
              : inherited ? 'text-muted italic' : 'text-ink/70'
          }`}
        >
          {resizingWidth ?? displayWidth}/12
        </span>
      </div>

      {/* Remove button — visible on hover */}
      <button
        type="button"
        aria-label="remove"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute top-1 right-4 z-20 w-4 h-4 flex items-center justify-center text-[10px] text-muted hover:text-error opacity-0 group-hover:opacity-100 transition-opacity rounded"
      >
        &times;
      </button>

      {/* Resize handle — right 12px zone */}
      <div
        data-resize-handle
        aria-label="Resize width"
        className="absolute top-0 right-0 z-10 w-3 h-full cursor-col-resize"
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onResizeStart?.(e);
        }}
      />
    </div>
  );
}
