/** @filedesc Layout canvas card for an authored Page node and its placed children. */
import type { ReactNode } from 'react';

interface LayoutPageSectionProps {
  title: string;
  pageId: string;
  active?: boolean;
  onSelect?: (pageId: string) => void;
  children?: ReactNode;
}

export function LayoutPageSection({ title, pageId, active = false, onSelect, children }: LayoutPageSectionProps) {
  return (
    <div
      data-testid={`layout-page-${pageId}`}
      className={`rounded-[10px] border bg-surface transition-all ${
        active
          ? 'border-border/80 border-s-[4px] border-s-accent/80 shadow-[0_2px_8px_rgba(0,0,0,0.04)] ring-1 ring-accent/10'
          : 'border-border/60 opacity-80 hover:opacity-100 hover:border-border/80'
      }`}
    >
      <button
        type="button"
        onClick={() => onSelect?.(pageId)}
        aria-pressed={active}
        className="flex w-full items-center border-b border-border px-4 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
      >
        <span className="text-[14px] font-semibold text-ink">{title}</span>
      </button>
      <div className="flex flex-col gap-1.5 p-3">
        {children}
      </div>
    </div>
  );
}
