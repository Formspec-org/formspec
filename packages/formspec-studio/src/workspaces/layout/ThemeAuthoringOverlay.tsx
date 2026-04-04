/** @filedesc Transparent click-capture overlay for Theme mode — resolves data-bind at click point to select fields. */
import { useRef, useCallback, useState, useEffect } from 'react';

interface ThemeAuthoringOverlayProps {
  onFieldSelect: (itemKey: string, position: { x: number; y: number }) => void;
  selectedItemKey?: string | null;
}

/** Walk up the DOM from `el` looking for the first element with data-bind attribute. */
function findDataBind(el: Element | null): string | null {
  let current = el;
  while (current && current !== document.body) {
    if (current instanceof HTMLElement && current.dataset.bind) {
      return current.dataset.bind;
    }
    current = current.parentElement;
  }
  return null;
}

export function ThemeAuthoringOverlay({ onFieldSelect, selectedItemKey }: ThemeAuthoringOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [missMessage, setMissMessage] = useState<string | null>(null);
  const missTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showMiss = useCallback(() => {
    if (missTimerRef.current) clearTimeout(missTimerRef.current);
    setMissMessage('Click a field to edit its theme properties');
    missTimerRef.current = setTimeout(() => setMissMessage(null), 2000);
  }, []);

  useEffect(() => {
    return () => {
      if (missTimerRef.current) clearTimeout(missTimerRef.current);
    };
  }, []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const { clientX, clientY } = e;
    const overlay = overlayRef.current;
    if (!overlay) return;

    // Temporarily hide overlay so elementFromPoint can reach the element beneath
    overlay.style.pointerEvents = 'none';
    const target = document.elementFromPoint(clientX, clientY);
    overlay.style.pointerEvents = 'all';

    const itemKey = findDataBind(target);
    if (itemKey) {
      onFieldSelect(itemKey, { x: clientX, y: clientY });
    } else {
      // V-10: transient feedback on click miss
      showMiss();
    }
  }, [onFieldSelect, showMiss]);

  return (
    <div className="absolute inset-0 z-10 flex flex-col">
      {/* SD-12: Theme preview label banner */}
      <div className="flex items-center justify-center gap-2 bg-accent/10 px-3 py-1.5 text-[12px] font-medium text-accent border-b border-accent/20 select-none">
        Theme Preview — click a field to customize
      </div>

      {/* V-03: persistent authoring signal banner */}
      <div className="flex items-center justify-center gap-2 bg-bg-subtle px-3 py-1 text-[11px] text-muted select-none border-b border-border/30">
        Theme Mode — Click a field to override
      </div>

      {/* V-10: aria-live region for miss feedback */}
      <div aria-live="polite" className="sr-only">
        {missMessage ?? ''}
      </div>
      {missMessage && (
        <div className="flex justify-center pointer-events-none">
          <span className="mt-2 rounded bg-surface px-3 py-1.5 text-[12px] text-muted shadow-md border border-border/40 select-none">
            {missMessage}
          </span>
        </div>
      )}

      {/* Click-capture layer with crosshair cursor */}
      <div
        ref={overlayRef}
        data-testid="theme-authoring-overlay"
        data-selected-key={selectedItemKey ?? undefined}
        onClick={handleClick}
        className="absolute inset-0 cursor-crosshair"
        style={{ pointerEvents: 'all', background: 'transparent' }}
      />
    </div>
  );
}
