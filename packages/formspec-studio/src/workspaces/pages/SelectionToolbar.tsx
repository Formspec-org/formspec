/** @filedesc Toolbar for the selected grid item — width presets, custom width, offset, breakpoint-aware. */
import { useState } from 'react';
import type { PageItemView } from 'formspec-studio-core';

export interface SelectionToolbarProps {
  item: PageItemView;
  activeBreakpoint: string;
  onSetWidth: (width: number) => void;
  onSetOffset: (offset: number | undefined) => void;
  onSetResponsive: (bp: string, overrides: { width?: number; offset?: number; hidden?: boolean }) => void;
}

const PRESETS: Array<{ label: string; width: number }> = [
  { label: 'Full', width: 12 },
  { label: 'Half', width: 6 },
  { label: 'Third', width: 4 },
  { label: 'Quarter', width: 3 },
];

/** Resolve effective width for the current breakpoint. */
function effectiveWidth(item: PageItemView, bp: string): number {
  if (bp === 'base') return item.width;
  return item.responsive[bp]?.width ?? item.width;
}

export function SelectionToolbar({
  item,
  activeBreakpoint,
  onSetWidth,
  onSetOffset,
  onSetResponsive,
}: SelectionToolbarProps) {
  const [showOffset, setShowOffset] = useState(false);
  const isBase = activeBreakpoint === 'base';
  const currentWidth = effectiveWidth(item, activeBreakpoint);

  function setWidth(w: number) {
    if (isBase) {
      onSetWidth(w);
    } else {
      onSetResponsive(activeBreakpoint, { width: w });
    }
  }

  function setOffset(o: number | undefined) {
    if (isBase) {
      onSetOffset(o);
    } else {
      onSetResponsive(activeBreakpoint, { offset: o });
    }
  }

  function handleCustomWidthBlur(e: React.FocusEvent<HTMLInputElement>) {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 1 && val <= 12) {
      setWidth(val);
    }
  }

  function handleOffsetBlur(e: React.FocusEvent<HTMLInputElement>) {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 1 && val <= 12) {
      setOffset(val);
    } else {
      setOffset(undefined);
    }
  }

  return (
    <div className="flex items-center gap-1.5 p-1.5 bg-surface border border-border rounded-md shadow-sm text-[11px]">
      {/* Width presets */}
      {PRESETS.map((p) => (
        <button
          key={p.label}
          type="button"
          aria-label={p.label}
          aria-pressed={currentWidth === p.width}
          onClick={() => setWidth(p.width)}
          className={`px-2 py-0.5 rounded transition-colors ${
            currentWidth === p.width
              ? 'bg-accent text-white'
              : 'bg-subtle/50 text-muted hover:text-ink hover:bg-subtle'
          }`}
        >
          {p.label}
        </button>
      ))}

      {/* Separator */}
      <div className="w-px h-4 bg-border mx-0.5" />

      {/* Custom width input */}
      <input
        type="number"
        min={1}
        max={12}
        aria-label="custom width"
        defaultValue={currentWidth}
        key={`cw-${item.key}-${currentWidth}`}
        onBlur={handleCustomWidthBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        className="w-10 text-center font-mono bg-transparent border border-border/50 rounded py-0.5 text-ink"
      />

      {/* Separator */}
      <div className="w-px h-4 bg-border mx-0.5" />

      {/* Offset toggle / input */}
      {showOffset ? (
        <div className="flex items-center gap-1">
          <span className="text-muted text-[9px]">Offset</span>
          <input
            type="number"
            min={1}
            max={12}
            aria-label="offset"
            defaultValue={item.offset ?? ''}
            onBlur={handleOffsetBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
            className="w-10 text-center font-mono bg-transparent border border-border/50 rounded py-0.5 text-ink"
          />
        </div>
      ) : (
        <button
          type="button"
          aria-label="Offset"
          onClick={() => setShowOffset(true)}
          className="px-2 py-0.5 rounded text-muted hover:text-ink hover:bg-subtle transition-colors"
        >
          Offset
        </button>
      )}
    </div>
  );
}
