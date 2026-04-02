/** @filedesc Draggable resize handle for adjustable panel widths. */
import { useCallback, useRef } from 'react';

interface ResizeHandleProps {
  /** Current position (left edge of handle). */
  side: 'left' | 'right';
  onResize: (delta: number) => void;
  className?: string;
}

/**
 * Thin vertical bar that can be dragged to resize adjacent panels.
 * Uses pointer capture for smooth, jank-free dragging.
 */
export function ResizeHandle({ side, onResize, className = '' }: ResizeHandleProps) {
  const startXRef = useRef(0);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      startXRef.current = e.clientX;

      const target = e.currentTarget;

      const onPointerMove = (ev: PointerEvent) => {
        const delta = ev.clientX - startXRef.current;
        startXRef.current = ev.clientX;
        onResize(side === 'left' ? delta : -delta);
      };

      const onPointerUp = () => {
        try { target.releasePointerCapture(e.pointerId); } catch { /* already released */ }
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
      };

      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
    },
    [onResize, side],
  );

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      className={`group relative z-10 w-0 shrink-0 cursor-col-resize select-none ${className}`}
      onPointerDown={onPointerDown}
    >
      {/* Invisible hit area */}
      <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
      {/* Visible indicator on hover/drag */}
      <div className="absolute inset-y-0 -left-px w-[2px] bg-transparent transition-colors group-hover:bg-accent/40 group-active:bg-accent/60" />
    </div>
  );
}
