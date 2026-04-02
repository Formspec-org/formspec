/** @filedesc Parent-controlled accordion section with color bar, badge, and chevron toggle. */

interface AccordionSectionProps {
  title: string;
  subtitle?: string;
  badge?: string | number;
  colorBar?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export function AccordionSection({
  title,
  subtitle,
  badge,
  colorBar,
  open,
  onToggle,
  children,
}: AccordionSectionProps) {
  return (
    <div className={`border-b border-border/60 last:border-b-0 ${colorBar ? `border-l-2 ${colorBar}` : ''}`}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] font-semibold text-ink transition-colors hover:bg-subtle/50"
        aria-expanded={open}
      >
        <span className="flex-1">
          <span>{title}</span>
          {subtitle && (
            <span className="ml-2 text-xs font-normal text-muted">{subtitle}</span>
          )}
        </span>
        {badge != null && (
          <span className="inline-flex items-center rounded-sm bg-subtle px-1.5 text-xs font-medium text-muted">
            {badge}
          </span>
        )}
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
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}
