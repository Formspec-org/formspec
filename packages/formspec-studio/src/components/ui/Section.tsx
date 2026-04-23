/** @filedesc Collapsible section with an uppercase header used in the properties panel and blueprint sidebar. */
import { useState, type ReactNode } from 'react';
import { IconChevronDown } from '../icons';

interface SectionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

/**
 * Collapsible section with high-contrast uppercase header.
 * Used in Properties Panel and Blueprint Sidebar.
 */
export function Section({ title, children, defaultOpen = true }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mb-5 rounded-[16px] border border-border/70 bg-bg-default/55 px-3 py-2.5">
      <button
        type="button"
        className="group flex w-full items-center justify-between gap-4 py-1 cursor-pointer text-left"
        onClick={() => setOpen(!open)}
      >
        <span className="text-[12px] font-semibold tracking-[0.08em] uppercase text-muted/90 group-hover:text-ink transition-colors">
          {title}
        </span>
        <IconChevronDown size={11} className={`text-muted transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="mt-3 space-y-2">{children}</div>}
    </div>
  );
}
