/** @filedesc Layout canvas section for Page nodes — titled region with children. */
import type { ReactNode } from 'react';

interface PageSectionProps {
  title: string;
  pageId: string;
  children?: ReactNode;
}

export function PageSection({ title, pageId, children }: PageSectionProps) {
  return (
    <div
      data-testid={`layout-page-${pageId}`}
      className="rounded-lg border border-border bg-surface"
    >
      <div className="border-b border-border px-4 py-2.5">
        <span className="text-[14px] font-semibold text-ink">{title}</span>
      </div>
      <div className="flex flex-col gap-1.5 p-3">
        {children}
      </div>
    </div>
  );
}
