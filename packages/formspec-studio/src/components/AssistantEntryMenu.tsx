/** @filedesc Single header control for all in-shell assistant actions — one surface, explicit destinations. */
import { useState, useRef, useEffect, type ReactElement } from 'react';
import { IconGrid, IconChat, IconChevronDown } from './icons';

export interface AssistantEntryMenuProps {
  compactLayout: boolean;
  onOpenFullWorkspace: () => void;
  /** Side rail chat visible (not overlay-only). */
  sideChatOpen: boolean;
  overlayChatOpen: boolean;
  onOpenSideChat: () => void;
  onCloseAllChat: () => void;
  onOpenOverlayChat: () => void;
}

export function AssistantEntryMenu({
  compactLayout,
  onOpenFullWorkspace,
  sideChatOpen,
  overlayChatOpen,
  onOpenSideChat,
  onCloseAllChat,
  onOpenOverlayChat,
}: AssistantEntryMenuProps): ReactElement {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const showHideChat = sideChatOpen || overlayChatOpen;
  const showExpandOverlay = sideChatOpen && !overlayChatOpen;

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        data-testid="assistant-entry-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Assistant menu"
        className={`inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent/10 font-semibold text-accent transition-colors hover:bg-accent/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 ${
          compactLayout ? 'p-2' : 'px-3 py-1.5 text-[12px]'
        }`}
        onClick={() => setOpen((v) => !v)}
      >
        <IconGrid size={compactLayout ? 18 : 15} className="text-accent shrink-0" />
        {!compactLayout && <span>Assistant</span>}
        <IconChevronDown size={12} className={`text-accent/80 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Assistant actions"
          className="absolute right-0 top-full z-[60] mt-1 w-[min(100vw-1.5rem,17.5rem)] rounded-[6px] border border-border bg-surface py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            data-testid="assistant-menu-open-workspace"
            className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-subtle focus-visible:bg-subtle focus-visible:outline-none"
            onClick={() => {
              setOpen(false);
              onOpenFullWorkspace();
            }}
          >
            <span className="text-[13px] font-medium text-ink">Assistant workspace</span>
            <span className="text-[11px] leading-snug text-muted">Full screen — starters, import, composer.</span>
          </button>
          <div className="my-1 border-t border-border" role="separator" />
          {!showHideChat && (
            <button
              type="button"
              role="menuitem"
              data-testid="assistant-menu-open-side-chat"
              className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-subtle focus-visible:bg-subtle focus-visible:outline-none"
              onClick={() => {
                setOpen(false);
                onOpenSideChat();
              }}
            >
              <span className="flex items-center gap-2 text-[13px] font-medium text-ink">
                <IconChat size={15} className="text-muted" />
                Open side chat
              </span>
              <span className="pl-[1.4rem] text-[11px] leading-snug text-muted">Docked panel while you edit.</span>
            </button>
          )}
          {showExpandOverlay && (
            <button
              type="button"
              role="menuitem"
              data-testid="assistant-menu-expand-overlay"
              className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-subtle focus-visible:bg-subtle focus-visible:outline-none"
              onClick={() => {
                setOpen(false);
                onOpenOverlayChat();
              }}
            >
              <span className="text-[13px] font-medium text-ink">Expand chat</span>
              <span className="text-[11px] leading-snug text-muted">
                {compactLayout ? 'Full-screen composer in this tab.' : 'Large overlay on top of the workspace.'}
              </span>
            </button>
          )}
          {showHideChat && (
            <button
              type="button"
              role="menuitem"
              data-testid="assistant-menu-hide-chat"
              className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-subtle focus-visible:bg-subtle focus-visible:outline-none"
              onClick={() => {
                setOpen(false);
                onCloseAllChat();
              }}
            >
              <span className="text-[13px] font-medium text-ink">{overlayChatOpen ? 'Exit chat' : 'Hide chat'}</span>
              <span className="text-[11px] leading-snug text-muted">Close the in-shell assistant panel.</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
