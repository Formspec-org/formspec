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
      className={`rounded-lg border bg-surface ${
        active ? 'border-accent shadow-sm' : 'border-border'
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
