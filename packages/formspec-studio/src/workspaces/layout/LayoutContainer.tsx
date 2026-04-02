/** @filedesc Layout canvas wrapper for layout nodes (Card, Grid, Panel, Stack). */
import type { ReactNode } from 'react';

interface LayoutContainerProps {
  component: string;
  nodeType: 'group' | 'layout';
  bind?: string;
  bindPath?: string;
  nodeId?: string;
  selected?: boolean;
  onSelect?: () => void;
  children?: ReactNode;
}

export function LayoutContainer({
  component,
  nodeType,
  bind,
  bindPath,
  nodeId,
  selected = false,
  onSelect,
  children,
}: LayoutContainerProps) {
  return (
    <div
      data-testid={`layout-container-${nodeId ?? bind ?? component}`}
      data-layout-node
      data-layout-node-type={nodeType}
      {...(bindPath ? { 'data-layout-bind': bindPath } : {})}
      {...(nodeId ? { 'data-layout-node-id': nodeId } : {})}
      className={`rounded border border-dashed bg-surface px-3 py-2 transition-colors ${
        selected
          ? 'border-accent bg-accent/5 shadow-sm'
          : 'border-muted'
      }`}
    >
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className="mb-1.5 flex w-full items-center gap-2 rounded px-1 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
      >
        <span className={`inline-block rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${
          selected
            ? 'bg-accent/15 text-accent'
            : 'bg-subtle text-muted'
        }`}>
          {component}
        </span>
      </button>
      {children && (
        <div className="flex flex-col gap-1.5">{children}</div>
      )}
    </div>
  );
}
