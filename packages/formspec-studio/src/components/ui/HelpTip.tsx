/** @filedesc Inline help tooltip that wraps content with a hover-triggered floating popover. */
import { useState, type ReactNode } from 'react';
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useHover,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
} from '@floating-ui/react';

interface HelpTipProps {
  text: string;
  children: ReactNode;
}

/**
 * Wraps content with a ? icon. Hovering anywhere on the wrapper shows
 * a portal-rendered tooltip positioned by Floating UI (no overflow clipping).
 */
export function HelpTip({ text, children }: HelpTipProps) {
  const [open, setOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: 'bottom-start',
    middleware: [offset(6), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const hover = useHover(context, { move: false });
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'tooltip' });
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, dismiss, role]);

  return (
    <>
      <span
        ref={refs.setReference}
        className="inline-flex items-center gap-1 cursor-help"
        {...getReferenceProps()}
      >
        {children}
        <span className="text-[9px] text-muted opacity-60 hover:opacity-100 transition-opacity" aria-label="Help">?</span>
      </span>
      {open && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            role="tooltip"
            className="z-50 w-52 px-2.5 py-2 text-[11px] font-medium leading-snug text-ink bg-surface border border-border/60 rounded-xl shadow-premium-lg font-ui animate-fade-in"
            {...getFloatingProps()}
          >
            {text}
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
