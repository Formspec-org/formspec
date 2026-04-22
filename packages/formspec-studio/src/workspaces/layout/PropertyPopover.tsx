/** @filedesc Overflow popover for Tier 3 layout properties (accessibility, style overrides, CSS class) with dirty guard. */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { DirtyGuardConfirm, useDirtyGuard } from './DirtyGuardConfirm';
import { useOptionalLayoutMode } from './LayoutModeContext';

// ── Types ─────────────────────────────────────────────────────────────────

export interface PropertyPopoverProps {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  /** Full component node props (read-only, for initial values). */
  nodeProps: Record<string, unknown>;
  /** Whether this is a container node (shows Unwrap action). */
  isContainer: boolean;
  /** Item key for theme mode navigation (optional, enables "Theme properties →" link). */
  itemKey?: string;
  onSetProp: (key: string, value: unknown) => void;
  onSetStyle: (key: string, value: string) => void;
  onStyleRemove: (key: string) => void;
  onUnwrap?: () => void;
  onRemove: () => void;
  onClose: () => void;
}

// ── Blur-to-commit text input ─────────────────────────────────────────────

function PopoverInput({
  testId,
  label,
  value,
  placeholder,
  onCommit,
  onDirtyChange,
}: {
  testId: string;
  label: string;
  value: string;
  placeholder?: string;
  onCommit: (v: string) => void;
  onDirtyChange: (id: string, isDirty: boolean) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);

  return (
    <div className="flex items-center gap-2">
      <label className="w-20 shrink-0 text-[11px] font-mono text-muted">{label}</label>
      <input
        type="text"
        data-testid={testId}
        aria-label={label}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => {
          setDraft(e.currentTarget.value);
          onDirtyChange(testId, e.currentTarget.value !== value);
        }}
        onBlur={(e) => {
          onDirtyChange(testId, false);
          onCommit(e.currentTarget.value.trim());
        }}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }}
        className="flex-1 h-7 rounded-[6px] border border-border/80 bg-surface px-2 text-[12px] font-mono text-ink outline-none placeholder:text-muted/40 transition-all focus:border-accent focus:ring-2 focus:ring-accent/30"
      />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export function PropertyPopover({
  open,
  anchorRef,
  nodeProps,
  isContainer,
  itemKey,
  onSetProp,
  onSetStyle,
  onStyleRemove,
  onUnwrap,
  onRemove,
  onClose,
}: PropertyPopoverProps) {
  const layoutMode = useOptionalLayoutMode();
  const { isDirty: hasDirtyInputs, markDirty: trackDirty, reset: resetDirty } = useDirtyGuard();
  const hasDirtyInputsRef = useRef(hasDirtyInputs);
  hasDirtyInputsRef.current = hasDirtyInputs;
  const [showDirtyGuard, setShowDirtyGuard] = useState(false);
  const [addingStyle, setAddingStyle] = useState(false);
  const [newStyleKey, setNewStyleKey] = useState('');
  const [newStyleValue, setNewStyleValue] = useState('');
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const clampPopoverInViewport = useCallback(() => {
    if (!open) return;
    const anchor = anchorRef.current;
    const pop = popoverRef.current;
    if (!pop) return;

    const margin = 8;
    const vv = window.visualViewport;
    const vw = vv?.width ?? window.innerWidth;
    const vh = vv?.height ?? window.innerHeight;
    const vx = vv?.offsetLeft ?? 0;
    const vy = vv?.offsetTop ?? 0;
    const w = pop.offsetWidth;
    const h = pop.offsetHeight;

    let left: number;
    let top: number;

    if (anchor) {
      const a = anchor.getBoundingClientRect();
      left = a.right + margin;
      top = a.top;
      if (left + w > vx + vw - margin) {
        left = Math.max(vx + margin, a.left - w - margin);
      }
      if (left < vx + margin) left = vx + margin;
      if (left + w > vx + vw - margin) {
        left = Math.max(vx + margin, vx + vw - w - margin);
      }
      if (top + h > vy + vh - margin) {
        top = Math.max(vy + margin, vy + vh - h - margin);
      }
      if (top < vy + margin) top = vy + margin;
    } else {
      left = vx + margin;
      top = vy + margin;
      if (left + w > vx + vw - margin) left = Math.max(vx + margin, vx + vw - w - margin);
      if (top + h > vy + vh - margin) top = Math.max(vy + margin, vy + vh - h - margin);
    }

    setPosition((prev) =>
      prev && prev.left === left && prev.top === top ? prev : { left, top },
    );
  }, [open, anchorRef]);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    clampPopoverInViewport();
    window.addEventListener('resize', clampPopoverInViewport);
    const v = window.visualViewport;
    v?.addEventListener('resize', clampPopoverInViewport);
    v?.addEventListener('scroll', clampPopoverInViewport);
    return () => {
      window.removeEventListener('resize', clampPopoverInViewport);
      v?.removeEventListener('resize', clampPopoverInViewport);
      v?.removeEventListener('scroll', clampPopoverInViewport);
    };
  }, [open, clampPopoverInViewport]);

  useLayoutEffect(() => {
    if (!open || !popoverRef.current) return;
    const ro = new ResizeObserver(() => clampPopoverInViewport());
    ro.observe(popoverRef.current);
    return () => ro.disconnect();
  }, [open, clampPopoverInViewport]);

  // Reset dirty state when the popover opens/closes
  useEffect(() => {
    if (!open) {
      resetDirty();
      setShowDirtyGuard(false);
      setAddingStyle(false);
      setNewStyleKey('');
      setNewStyleValue('');
    }
  }, [open, resetDirty]);

  useEffect(() => {
    if (!layoutMode) return;
    const popoverId = 'property-popover';
    if (open && hasDirtyInputs) {
      layoutMode.registerDirtyPopover(popoverId);
    } else {
      layoutMode.clearDirtyPopover(popoverId);
    }
    return () => layoutMode.clearDirtyPopover(popoverId);
  }, [layoutMode, open, hasDirtyInputs]);

  const requestClose = useCallback(() => {
    if (hasDirtyInputsRef.current) {
      setShowDirtyGuard(true);
    } else {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onPointerDownCapture = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (popoverRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      requestClose();
    };
    document.addEventListener('pointerdown', onPointerDownCapture, true);
    return () => document.removeEventListener('pointerdown', onPointerDownCapture, true);
  }, [open, requestClose, anchorRef]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      requestClose();
    }
  }

  if (!open) return null;

  const accessibility = (nodeProps.accessibility as Record<string, unknown>) ?? {};
  const style = (nodeProps.style as Record<string, unknown>) ?? {};
  const cssClass = (nodeProps.cssClass as string) ?? '';

  // Build current accessibility patch from existing + committed values
  function commitAccessibility(field: 'description' | 'role', value: string) {
    const current = (nodeProps.accessibility as Record<string, unknown>) ?? {};
    onSetProp('accessibility', { ...current, [field]: value });
  }

  function commitStyleAdd() {
    if (newStyleKey.trim()) {
      onSetStyle(newStyleKey.trim(), newStyleValue);
      setNewStyleKey('');
      setNewStyleValue('');
      setAddingStyle(false);
    }
  }

  const popoverContent = (
    <div
      ref={popoverRef}
      data-testid="property-popover"
      role="dialog"
      aria-label="Component properties"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed',
        top: position != null ? `${position.top}px` : 0,
        left: position != null ? `${position.left}px` : 0,
        visibility: position != null ? 'visible' : 'hidden',
        zIndex: 50,
      }}
      className="flex w-[320px] max-h-[min(32rem,calc(100dvh-1rem))] flex-col overflow-hidden rounded-[8px] border border-border/70 bg-surface/95 backdrop-blur-[2px] shadow-[0_4px_16px_rgba(0,0,0,0.06)]"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 bg-surface/80 shrink-0">
        <span className="text-[13px] font-semibold text-ink font-ui">Properties</span>
        <button
          type="button"
          aria-label="Close"
          onClick={requestClose}
          className="text-muted hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/70"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">

        {/* Accessibility */}
        <section>
          <p className="text-[10px] font-mono text-muted uppercase tracking-wider mb-1.5">Accessibility</p>
          <div className="space-y-1.5">
            <PopoverInput
              testId="popover-aria-label"
              label="Accessible description"
              value={(accessibility.description as string) ?? ''}
              placeholder="aria-describedby text (optional)"
              onCommit={(v) => commitAccessibility('description', v)}
              onDirtyChange={(id, isDirty) => trackDirty(id, isDirty)}
            />
            <PopoverInput
              testId="popover-aria-role"
              label="ARIA role"
              value={(accessibility.role as string) ?? ''}
              placeholder="Optional role override"
              onCommit={(v) => commitAccessibility('role', v)}
              onDirtyChange={(id, isDirty) => trackDirty(id, isDirty)}
            />
          </div>
        </section>

        {/* Style overrides */}
        <section>
          <p className="text-[10px] font-mono text-muted uppercase tracking-wider mb-1.5">Style Overrides</p>
          <div className="space-y-1">
            {Object.entries(style).map(([key, val]) => (
              <div key={key} data-testid={`style-row-${key}`} className="flex items-center gap-1.5">
                <span className="flex-1 text-[11px] font-mono text-ink truncate">{key}: {String(val)}</span>
                <button
                  type="button"
                  data-testid={`style-row-remove-${key}`}
                  aria-label={`Remove ${key}`}
                  onClick={() => onStyleRemove(key)}
                  className="text-muted hover:text-error transition-colors focus-visible:outline-none"
                >
                  ×
                </button>
              </div>
            ))}
            {addingStyle ? (
              <div className="flex items-center gap-1 mt-1">
                <input
                  type="text"
                  data-testid="style-new-key-input"
                  aria-label="Style key"
                  value={newStyleKey}
                  placeholder="key"
                  onChange={(e) => setNewStyleKey(e.currentTarget.value)}
                  className="w-20 h-7 rounded-[6px] border border-border/80 bg-surface px-1.5 text-[11px] font-mono outline-none transition-shadow focus:border-accent focus:ring-2 focus:ring-accent/30"
                />
                <input
                  type="text"
                  data-testid="style-new-value-input"
                  aria-label="Style value"
                  value={newStyleValue}
                  placeholder="value"
                  onChange={(e) => setNewStyleValue(e.currentTarget.value)}
                  className="flex-1 h-7 rounded-[6px] border border-border/80 bg-surface px-1.5 text-[11px] font-mono outline-none transition-shadow focus:border-accent focus:ring-2 focus:ring-accent/30"
                />
                <button
                  type="button"
                  data-testid="style-new-commit"
                  aria-label="Add style"
                  onClick={commitStyleAdd}
                  className="h-6 px-2 rounded border border-accent bg-accent/10 text-[11px] text-accent hover:bg-accent/20 transition-colors focus-visible:outline-none"
                >
                  +
                </button>
              </div>
            ) : (
              <button
                type="button"
                data-testid="popover-style-add"
                onClick={() => setAddingStyle(true)}
                className="text-[11px] text-muted hover:text-accent transition-colors focus-visible:outline-none"
              >
                + add
              </button>
            )}
          </div>
        </section>

        {/* CSS class */}
        <section>
          <p className="text-[10px] font-mono text-muted uppercase tracking-wider mb-1.5">CSS Class</p>
          <PopoverInput
            testId="popover-css-class"
            label="Class"
            value={cssClass}
            placeholder="Optional CSS class"
            onCommit={(v) => onSetProp('cssClass', v)}
            onDirtyChange={trackDirty}
          />
        </section>

        {/* Actions */}
        <section>
          <p className="text-[10px] font-mono text-muted uppercase tracking-wider mb-1.5">Actions</p>
          <div className="flex flex-wrap gap-2">
            {itemKey && layoutMode && (
              <button
                type="button"
                data-testid="popover-theme-properties"
                onClick={(event) => {
                  layoutMode.setThemeSelectedKey(itemKey);
                  const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
                  layoutMode.setThemePopoverPosition({
                    x: rect.right + 12,
                    y: rect.top,
                  });
                  onClose();
                }}
                className="rounded-full border border-border bg-surface px-3 py-1 text-[12px] font-semibold text-ink hover:border-accent hover:text-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
              >
                Theme properties →
              </button>
            )}
            {isContainer && (
              <button
                type="button"
                data-testid="popover-unwrap"
                onClick={onUnwrap}
                className="rounded-full border border-border bg-surface px-3 py-1 text-[12px] font-semibold text-ink hover:border-accent hover:text-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
              >
                Unwrap
              </button>
            )}
            <button
              type="button"
              data-testid="popover-remove"
              onClick={onRemove}
              className="rounded-full border border-border bg-surface px-3 py-1 text-[12px] font-semibold text-ink hover:border-error hover:text-error transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/70"
            >
              Remove from Tree
            </button>
          </div>
        </section>
      </div>

      {/* Dirty guard overlay */}
      {showDirtyGuard && (
        <DirtyGuardConfirm
          onDiscard={() => { setShowDirtyGuard(false); onClose(); }}
          onCancel={() => setShowDirtyGuard(false)}
        />
      )}
    </div>
  );

  return popoverContent;
}
