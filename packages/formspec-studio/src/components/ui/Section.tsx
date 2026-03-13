import { useState, type ReactNode } from 'react';

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
    <div className="mb-4">
      <button
        type="button"
        className="w-full flex items-center justify-between py-1.5 cursor-pointer group"
        onClick={() => setOpen(!open)}
      >
        <span className="font-mono text-[10px] font-bold tracking-[0.15em] uppercase text-muted group-hover:text-ink transition-colors">
          {title}
        </span>
        <span className={`text-[10px] text-muted transition-transform duration-150 ${open ? 'rotate-90' : ''}`}>
          {open ? '▼' : '▶'}
        </span>
      </button>
      {open && <div className="space-y-1">{children}</div>}
    </div>
  );
}
