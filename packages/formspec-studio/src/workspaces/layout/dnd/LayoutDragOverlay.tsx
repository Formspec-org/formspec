/** @filedesc Layout canvas drag preview — floating chip from Pragmatic `monitorForElements` source data. */
import type { ReactNode } from 'react';

type OverlaySource = {
  id?: string | number;
  data?: Record<string, unknown>;
};

function titleFromSource(source: OverlaySource): string {
  const id = source.id != null ? String(source.id) : '';
  const data = source.data ?? {};
  const t = data.type;

  if (t === 'unassigned-item' && typeof data.label === 'string') {
    return data.label;
  }

  if (t === 'tree-node') {
    const ref = data.nodeRef as { bind?: string; nodeId?: string } | undefined;
    if (ref?.bind) return ref.bind;
    if (ref?.nodeId) return `node:${ref.nodeId}`;
  }

  return id || 'Dragging';
}

function badgeFromSource(source: OverlaySource): string {
  const t = source.data?.type;
  if (t === 'unassigned-item') return 'Place';
  if (t === 'tree-node') return 'Reorder';
  return 'Drag';
}

function overlayBody(source: OverlaySource): ReactNode {
  return (
    <div
      className="pointer-events-none max-w-[min(24rem,calc(100vw-2rem))] rounded-lg border border-accent/50 bg-surface/95 px-3 py-2 shadow-lg backdrop-blur-sm"
      data-testid="layout-drag-overlay-preview"
    >
      <div className="font-mono text-[9px] font-semibold uppercase tracking-wider text-muted">
        {badgeFromSource(source)}
      </div>
      <div className="truncate text-[13px] font-medium text-ink">{titleFromSource(source)}</div>
    </div>
  );
}

/** Pragmatic monitor overlay — `source.data` from `getInitialData`. */
export function layoutDragOverlayFromPdndSource(data: Record<string, unknown>): ReactNode {
  return overlayBody({ data });
}
