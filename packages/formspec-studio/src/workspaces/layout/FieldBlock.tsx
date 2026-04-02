/** @filedesc Layout canvas block for bound field items — shows label and data type, supports drag reordering. */
import { useDraggable } from '@dnd-kit/react';

interface FieldBlockProps {
  itemKey: string;
  bindPath: string;
  selectionKey: string;
  label?: string;
  dataType?: string;
  selected?: boolean;
  index?: number;
  onSelect?: (selectionKey: string) => void;
}

export function FieldBlock({
  itemKey,
  bindPath,
  selectionKey,
  label,
  dataType,
  selected = false,
  index = 0,
  onSelect,
}: FieldBlockProps) {
  const { ref, isDragging } = useDraggable({
    id: `field:${bindPath}`,
    data: { nodeRef: { bind: itemKey }, index, type: 'tree-node' },
  });

  return (
    <button
      ref={ref}
      type="button"
      data-testid={`layout-field-${itemKey}`}
      data-layout-node
      data-layout-node-type="field"
      data-layout-bind={bindPath}
      aria-pressed={selected}
      onClick={() => onSelect?.(selectionKey)}
      className={`flex w-full items-center gap-2 rounded border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 ${
        isDragging ? 'opacity-40' : ''
      } ${
        selected
          ? 'border-accent bg-accent/10 shadow-sm'
          : 'border-border bg-surface hover:border-accent/40 hover:bg-subtle/50'
      }`}
    >
      <span className="text-[13px] font-medium text-ink">{label || itemKey}</span>
      {dataType && (
        <span className="text-[11px] text-muted font-mono">{dataType}</span>
      )}
    </button>
  );
}
