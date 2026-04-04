/** @filedesc Tray showing definition items not bound in the component tree. */
import { useMemo } from 'react';
import type { FormItem } from '@formspec-org/types';
import {
  computeUnassignedItems,
  type CompNode,
  type UnassignedItem,
} from '@formspec-org/studio-core';

interface UnassignedTrayProps {
  items: FormItem[];
  treeChildren: Pick<CompNode, 'component' | 'bind' | 'nodeId' | 'children'>[];
  activePageId?: string | null;
  onPlaceItem?: (item: UnassignedItem) => void;
}

export function UnassignedTray({ items, treeChildren, activePageId, onPlaceItem }: UnassignedTrayProps) {
  const unassigned = useMemo(
    () => computeUnassignedItems(items, treeChildren),
    [items, treeChildren],
  );

  if (unassigned.length === 0) return null;

  return (
    <section
      aria-label="Unassigned items"
      className="space-y-3 rounded-2xl border border-border/70 bg-surface px-5 py-4"
    >
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
          Unassigned
        </p>
        <p className="text-[12px] text-muted">
          These items are defined but not placed in the component tree.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {unassigned.map((item) => (
          <div
            key={item.key}
            data-testid={`unassigned-${item.key}`}
            className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-[12px] text-muted"
          >
            <span className="truncate">{item.label}</span>
            <span className="text-[10px] font-mono text-muted/60">{item.itemType}</span>
            {activePageId && onPlaceItem && (
              <button
                type="button"
                aria-label={`Add ${item.label} to current page`}
                onClick={() => onPlaceItem(item)}
                className="rounded-full border border-border/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
              >
                Add
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
