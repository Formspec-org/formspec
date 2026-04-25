/** @filedesc Shared studio icons used across the AI chat panel, workspaces, and context menus. */

interface SvgProps {
  className?: string;
  size?: number | string;
  strokeWidth?: number | string;
}

export function IconSparkle({ className, size = 16, strokeWidth = 1.3 }: SvgProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5L8 1z" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" fill="currentColor" fillOpacity="0.15" />
    </svg>
  );
}

export function IconArrowUp({ size = 18 }: { size?: number | string } = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 14V4M5 8l4-4 4 4" />
    </svg>
  );
}

export function IconChevronLeft({ className, size = 14 }: SvgProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M9 3L5 7l4 4" />
    </svg>
  );
}

export function IconChevronRight({ className, size = 14 }: SvgProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M5 3l4 4-4 4" />
    </svg>
  );
}

export function IconChevronDown({ className, size = 14 }: SvgProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M3 5l4 4 4-4" />
    </svg>
  );
}

export function IconClose({ className, size = 12, strokeWidth = 1.5 }: SvgProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" aria-hidden="true" className={className}>
      <path d="M9 3L3 9M3 3l6 6" />
    </svg>
  );
}

export function IconPlus({ className, size = 16 }: SvgProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2Z" />
    </svg>
  );
}

export function IconTrash({ className, size = 16 }: SvgProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M5.5 1a.75.75 0 0 0-.75.75V3h-2.5a.5.5 0 0 0 0 1h.5v8.5A1.5 1.5 0 0 0 3.75 14h8.5a1.5 1.5 0 0 0 1.5-1.5V4h.5a.5.5 0 0 0 0-1h-2.5V1.75A.75.75 0 0 0 10.5 1h-5ZM6 3V2h4v1H6Zm-1.5 2h7v7.5a.5.5 0 0 1-.5.5h-6a.5.5 0 0 1-.5-.5V5Z" />
    </svg>
  );
}

export function IconSettings({ className, size = 15 }: SvgProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <circle cx="7.5" cy="7.5" r="2" />
      <path d="M12.5 7.5a5 5 0 01-.3 1.6l1.2.9-1.3 2.2-1.4-.6a5 5 0 01-1.3.8l-.3 1.5H6.9l-.3-1.5a5 5 0 01-1.3-.8l-1.4.6L2.6 10l1.2-.9a5 5 0 01-.3-1.6 5 5 0 01.3-1.6l-1.2-.9L3.9 3l1.4.6a5 5 0 011.3-.8L6.9 1.3h2.2l.3 1.5a5 5 0 011.3.8l1.4-.6 1.3 2.2-1.2.9a5 5 0 01.3 1.6z" />
    </svg>
  );
}

export function IconWarning({ className, size = 11 }: SvgProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M5.5 1.5L10 9.5H1L5.5 1.5z" />
      <line x1="5.5" y1="4.5" x2="5.5" y2="6.5" />
      <circle cx="5.5" cy="8" r="0.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconExternal({ className, size = 13 }: SvgProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M9 2.5h2v2M7 6l4-4M5 2H3a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1V8" />
    </svg>
  );
}

export function IconDownload({ className, size = 13 }: SvgProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M6.5 2v6.5M4 6L6.5 8.5 9 6" />
      <path d="M2 9.5v1.5a1 1 0 001 1h7a1 1 0 001-1V9.5" />
    </svg>
  );
}

export function IconPen({ className, size = 22 }: SvgProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M14.5 3.5l4 4L8 18H4v-4L14.5 3.5z" />
    </svg>
  );
}

export function IconGrid({ className, size = 22 }: SvgProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="12" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="12" width="7" height="7" rx="1.5" />
      <rect x="12" y="12" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function IconUpload({ className, size = 22 }: SvgProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M11 14V5M7.5 8.5L11 5l3.5 3.5" />
      <path d="M4.5 15v2.5a1.5 1.5 0 001.5 1.5h10a1.5 1.5 0 001.5-1.5V15" />
    </svg>
  );
}

export function IconClock({ className, size = 15 }: SvgProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <circle cx="7.5" cy="7.5" r="6" />
      <path d="M7.5 4.5V7.5l2.5 1.5" />
    </svg>
  );
}

export function IconMonitor({ className, size = 16 }: SvgProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <path d="M8 21h8M12 17v4"/>
    </svg>
  );
}

export function IconMoon({ className, size = 16 }: SvgProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

export function IconSun({ className, size = 16 }: SvgProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
}

export function IconSearch({ className, size = 16 }: SvgProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
    </svg>
  );
}

export function IconUndo({ className, size = 16 }: SvgProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
    </svg>
  );
}

export function IconRedo({ className, size = 16 }: SvgProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/>
    </svg>
  );
}

export function IconMenu({ className, size = 20 }: SvgProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

export function IconStack({ className, size = 16 }: SvgProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true" className={className}>
      <rect x="2" y="1.5" width="8" height="2" rx=".4" fill="currentColor" />
      <rect x="2" y="5" width="8" height="2" rx=".4" fill="currentColor" fillOpacity=".7" />
      <rect x="2" y="8.5" width="8" height="2" rx=".4" fill="currentColor" fillOpacity=".4" />
    </svg>
  );
}

export function IconActivity({ className, size = 16 }: SvgProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

export function IconRotate({ className, size = 13 }: SvgProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M1.5 6.5a5 5 0 019-2.5l.5.5" />
      <path d="M11 1v3H8" />
      <path d="M11.5 6.5a5 5 0 01-9 2.5l-.5-.5" />
      <path d="M2 12V9h3" />
    </svg>
  );
}

export function IconCheck({ className, size = 13 }: SvgProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M10.5 3.5L5 9.5 2.5 7" />
    </svg>
  );
}

export function IconArrowRight({ className, size = 12 }: SvgProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M2.5 6H9.5M9.5 6L6.5 3M9.5 6L6.5 9" />
    </svg>
  );
}

export function IconTriangleWarning({ className, size = 14 }: SvgProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M7 5v3M7 10h.01" />
      <path d="M6.13 1.87l-4.9 8.5A1 1 0 002.1 12h9.8a1 1 0 00.87-1.5l-4.9-8.5a1 1 0 00-1.74-.13z" />
    </svg>
  );
}

export function IconExclamation({ className, size = 12, strokeWidth = 2 }: SvgProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

export function IconEdit({ className, size = 16 }: SvgProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61Zm.176 4.823L9.75 4.81l-6.286 6.287a.253.253 0 0 0-.064.108l-.558 1.953 1.953-.558a.253.253 0 0 0 .108-.064Zm1.238-3.763a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354Z" />
    </svg>
  );
}
