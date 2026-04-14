/** @filedesc Shared studio icons used across chat surfaces and context menus. */

// These icons are deliberately minimal and colocated here because they are
// reused across more than one chat-related surface. Icons that are
// single-use (ChatPanel-only IconClose/IconWarning, ChatPanelV2's extended
// sparkle, etc.) stay next to their consumer.

interface SvgProps {
  className?: string;
}

export function IconSparkle({ className }: SvgProps = {}) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5L8 1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="currentColor" fillOpacity="0.15" />
    </svg>
  );
}

export function IconArrowUp() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 14V4M5 8l4-4 4 4" />
    </svg>
  );
}
