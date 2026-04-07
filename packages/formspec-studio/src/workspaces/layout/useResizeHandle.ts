/** @filedesc Shared hook for drag-to-resize with snapping and min/max clamping. */
import { useCallback, useRef, useState } from 'react';

export interface UseResizeHandleOptions {
  /** Drag axis. */
  axis: 'x' | 'y';
  /** Minimum allowed value. */
  min: number;
  /** Maximum allowed value. */
  max: number;
  /** Snap to multiples of this value (e.g. 1 for integers). Omit for no snapping. */
  snap?: number;
  /** The current value of the property being resized — drag starts from this, not from min. */
  initialValue: number;
  /**
   * Pixels per logical unit. When set, raw pixel delta is divided by this value before
   * being added to initialValue. Use this for column-span resize where 1 unit = 1 span
   * and the pixel width of a span varies with container width.
   * E.g. pixelsPerUnit = containerWidth / numColumns.
   */
  pixelsPerUnit?: number;
  /** Called on every pointermove during drag for visual updates (e.g. local CSS update). */
  onDrag?: (value: number) => void;
  /** Called once on pointerup with the final value — commits change to project/state. */
  onCommit?: (value: number) => void;
}

/**
 * Snap a raw float to the nearest multiple of `snap`, then clamp to [min, max].
 * Exported for unit testing of the pure math.
 */
export function snapAndClamp(raw: number, min: number, max: number, snap?: number): number {
  let value = raw;
  if (snap !== undefined && snap > 0) {
    value = Math.round(raw / snap) * snap;
  }
  return Math.min(max, Math.max(min, value));
}

/**
 * Pointer-event-based resize handle hook.
 *
 * Returns `{ handleProps, isDragging }`.
 * Spread `handleProps` onto the handle element.
 * The hook stops propagation on pointerdown to prevent dnd-kit reorder drags.
 */
export function useResizeHandle(options: UseResizeHandleOptions) {
  const { axis, min, max, snap, initialValue, pixelsPerUnit, onDrag, onCommit } = options;
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(initialValue);
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null);
  const startRef = useRef<{ pos: number; value: number } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Stop propagation so dnd-kit doesn't start a reorder drag
      e.preventDefault?.();
      e.stopPropagation?.();
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDragging(true);
      setDragValue(initialValue);
      setDragPoint({ x: e.clientX, y: e.clientY });
      startRef.current = {
        pos: axis === 'x' ? e.clientX : e.clientY,
        value: initialValue,
      };
    },
    [axis, initialValue],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!startRef.current) return;
      setDragPoint({ x: e.clientX, y: e.clientY });
      const currentPos = axis === 'x' ? e.clientX : e.clientY;
      const pixelDelta = currentPos - startRef.current.pos;
      const unitDelta = pixelsPerUnit && pixelsPerUnit > 0 ? pixelDelta / pixelsPerUnit : pixelDelta;
      const rawValue = startRef.current.value + unitDelta;
      const snapped = snapAndClamp(rawValue, min, max, snap);
      setDragValue(snapped);
      onDrag?.(snapped);
    },
    [axis, min, max, snap, pixelsPerUnit, onDrag],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      e.currentTarget.releasePointerCapture(e.pointerId);
      setIsDragging(false);
      setDragPoint(null);
      // Commit final value on pointerup
      if (startRef.current) {
        onCommit?.(dragValue);
      }
      startRef.current = null;
    },
    [dragValue, onCommit],
  );

  // onPointerCancel: same cleanup as onPointerUp — fires when pointer is interrupted
  // (e.g. browser context menu, touch cancelled). releasePointerCapture may throw if
  // capture was never set, so guard with isDragging state.
  const onPointerCancel = useCallback(
    (e: React.PointerEvent) => {
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }
      setIsDragging(false);
      setDragPoint(null);
      startRef.current = null;
    },
    [],
  );

  const handleProps = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  };

  return { handleProps, isDragging, dragValue, dragPoint };
}
