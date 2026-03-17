/** @filedesc Absolute-positioned line or highlight shown at the current drop target during drag. */
import { useEffect, useState } from 'react';
import type { DropPosition } from './compute-drop-target';

interface DropIndicatorProps {
  targetPath: string;
  position: DropPosition;
}

export function DropIndicator({ targetPath, position }: DropIndicatorProps) {
  const [style, setStyle] = useState<React.CSSProperties | null>(null);

  useEffect(() => {
    const el = document.querySelector<HTMLElement>(`[data-item-path="${CSS.escape(targetPath)}"]`);
    if (!el) {
      setStyle(null);
      return;
    }

    const rect = el.getBoundingClientRect();
    const scrollContainer = el.closest('[data-workspace-section]') ?? el.offsetParent;
    const containerRect = scrollContainer?.getBoundingClientRect() ?? { left: 0, top: 0 };

    if (position === 'inside') {
      // Highlight the group
      setStyle({
        position: 'absolute',
        left: rect.left - containerRect.left,
        top: rect.top - containerRect.top,
        width: rect.width,
        height: rect.height,
        border: '2px solid var(--color-accent)',
        borderRadius: 4,
        background: 'color-mix(in srgb, var(--color-accent) 8%, transparent)',
        pointerEvents: 'none',
        zIndex: 50,
      });
    } else {
      // Line indicator above or below
      const y = position === 'above'
        ? rect.top - containerRect.top
        : rect.bottom - containerRect.top;

      setStyle({
        position: 'absolute',
        left: rect.left - containerRect.left,
        top: y - 1,
        width: rect.width,
        height: 2,
        background: 'var(--color-accent)',
        borderRadius: 1,
        pointerEvents: 'none',
        zIndex: 50,
      });
    }
  }, [targetPath, position]);

  if (!style) return null;

  return <div style={style} data-testid="drop-indicator" />;
}
