/** @filedesc Layout canvas wrapper for layout nodes (Card, Grid, Panel, Stack). */
import type { ReactNode } from 'react';

interface LayoutContainerProps {
  component: string;
  nodeId: string;
  children?: ReactNode;
}

export function LayoutContainer({ component, nodeId, children }: LayoutContainerProps) {
  return (
    <div
      data-testid={`layout-container-${nodeId}`}
      data-layout-node
      data-layout-node-type="layout"
      data-layout-node-id={nodeId}
      className="rounded border border-dashed border-muted bg-surface px-3 py-2"
    >
      <div className="mb-1.5 flex items-center gap-2">
        <span className="inline-block rounded bg-subtle px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted">
          {component}
        </span>
      </div>
      {children && (
        <div className="flex flex-col gap-1.5">{children}</div>
      )}
    </div>
  );
}
