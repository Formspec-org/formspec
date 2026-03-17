import type React from 'react';
import type { ReactNode } from 'react';
import { blockIndent, blockRef } from './block-utils';
import { DragHandle } from './DragHandle';

interface LayoutBlockProps {
  nodeId: string;
  component: string;
  layoutId: string;
  registerTarget: (path: string, element: HTMLElement | null) => void;
  depth: number;
  selected: boolean;
  isInSelection?: boolean;
  onSelect: (e: React.MouseEvent) => void;
  children?: ReactNode;
}

export function LayoutBlock({
  nodeId,
  component,
  layoutId,
  registerTarget,
  depth,
  selected,
  isInSelection,
  onSelect,
  children,
}: LayoutBlockProps) {
  return (
    <div style={{ marginLeft: blockIndent(depth) }} className="mb-1 mt-3">
      <div
        ref={blockRef(layoutId, registerTarget)}
        data-testid={`layout-${nodeId}`}
        data-item-path={layoutId}
        data-item-type="layout"
        onClick={onSelect}
        className={`group rounded border border-dashed px-3 py-2 cursor-pointer transition-colors ${
          selected ? 'border-accent bg-accent/5'
          : isInSelection ? 'border-accent bg-accent/5'
          : 'border-muted bg-surface hover:bg-subtle'
        }`}
      >
        {/* Header row with drag handle and component pill */}
        <div className="flex items-center gap-2">
          {/* Drag Handle */}
          <DragHandle />

          {/* Component type pill */}
          <span className={`inline-block font-mono text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded ${
            selected || isInSelection ? 'text-accent bg-accent/10' : 'text-muted bg-subtle'
          }`}>
            {component}
          </span>
        </div>

        {/* Children area */}
        {children && (
          <div className="mt-2 flex flex-col gap-1.5">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
