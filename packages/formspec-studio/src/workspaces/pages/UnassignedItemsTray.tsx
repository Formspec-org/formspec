/** @filedesc Draggable tray showing definition items not assigned to any page. */
import { useDraggable } from '@dnd-kit/react';
import type { PlaceableItem } from 'formspec-studio-core';

function DraggableUnassignedItem({
  itemKey,
  label,
}: {
  itemKey: string;
  label: string;
}) {
  const { ref, isDragSource } = useDraggable({
    id: `item-${itemKey}`,
    data: { type: 'item', key: itemKey },
  });

  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      data-draggable-item={itemKey}
      className={`flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-[12px] text-muted ${
        isDragSource ? 'opacity-40' : ''
      }`}
    >
      <svg
        width="6"
        height="10"
        viewBox="0 0 6 10"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <circle cx="1.5" cy="2" r="1" fill="currentColor" />
        <circle cx="4.5" cy="2" r="1" fill="currentColor" />
        <circle cx="1.5" cy="5" r="1" fill="currentColor" />
        <circle cx="4.5" cy="5" r="1" fill="currentColor" />
        <circle cx="1.5" cy="8" r="1" fill="currentColor" />
        <circle cx="4.5" cy="8" r="1" fill="currentColor" />
      </svg>
      <span className="truncate">{label}</span>
    </div>
  );
}

export function UnassignedItemsTray({ items }: { items: PlaceableItem[] }) {
  if (items.length === 0) return null;

  return (
    <section
      aria-label="Unassigned items"
      className="space-y-3 rounded-[24px] border border-border/70 bg-surface px-5 py-4"
    >
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
          Unassigned
        </p>
        <p className="text-[12px] text-muted">
          Drag these onto a page card or use a page&apos;s quick-add actions.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <DraggableUnassignedItem
            key={item.key}
            itemKey={item.key}
            label={item.label}
          />
        ))}
      </div>
    </section>
  );
}
