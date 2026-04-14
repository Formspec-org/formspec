/** @filedesc Tray showing definition items not bound in the component tree. */
import { useMemo } from 'react';
import { useDraggable } from '@dnd-kit/react';
import { STUDIO_DND_FEEDBACK } from '../shared/dnd-config';
import { LAYOUT_DRAG_SOURCE_STYLE } from '../layout/layout-node-styles';
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

function UnassignedTrayItem({
  item,
  activePageId,
  onPlaceItem,
}: {
  item: UnassignedItem;
  activePageId?: string | null;
  onPlaceItem?: (item: UnassignedItem) => void;
}) {
  const { ref: dragRef, isDragging } = useDraggable({
    id: `unassigned:${item.key}`,
    feedback: STUDIO_DND_FEEDBACK,
    data: {
      type: 'unassigned-item',
      key: item.key,
      label: item.label,
      itemType: item.itemType,
    },
  });

  return (
    <div
      ref={dragRef}
      tabIndex={0}
      data-testid={`unassigned-${item.key}`}
      aria-label={`${item.label} — drag to canvas or focus and press Space to pick up, arrow keys to move, Space to drop`}
      className={`flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-[12px] text-muted outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-accent/55 ${
        isDragging ? `cursor-grabbing ${LAYOUT_DRAG_SOURCE_STYLE}` : 'cursor-grab'
      }`}
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
  );
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
          <UnassignedTrayItem
            key={item.key}
            item={item}
            activePageId={activePageId}
            onPlaceItem={onPlaceItem}
          />
        ))}
      </div>
    </section>
  );
}
