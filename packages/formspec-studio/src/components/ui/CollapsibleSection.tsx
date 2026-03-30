/** @filedesc Generic collapsible section with expand/collapse toggle and aria-expanded support. */
import { useState } from 'react';

interface CollapsibleSectionProps {
  title: string;
  testId: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function CollapsibleSection({
  title,
  testId,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border/60 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-3 text-left text-[13px] font-semibold text-ink transition-colors hover:bg-subtle/50"
        aria-expanded={open}
      >
        {title}
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          className={`text-muted transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 3.5 L5 6.5 L8 3.5" />
        </svg>
      </button>
      <div data-testid={testId} className="px-5 pb-4" hidden={!open}>
        {children}
      </div>
    </div>
  );
}
