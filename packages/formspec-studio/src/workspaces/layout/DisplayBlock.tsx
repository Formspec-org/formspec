/** @filedesc Layout canvas block for display-only items (heading, divider, paragraph). */

interface DisplayBlockProps {
  itemKey: string;
  selectionKey: string;
  label?: string;
  widgetHint?: string;
  selected?: boolean;
  onSelect?: (selectionKey: string) => void;
}

export function DisplayBlock({ itemKey, selectionKey, label, widgetHint, selected = false, onSelect }: DisplayBlockProps) {
  return (
    <button
      type="button"
      data-testid={`layout-display-${itemKey}`}
      data-layout-node
      data-layout-node-type="display"
      data-layout-node-id={itemKey}
      aria-pressed={selected}
      onClick={() => onSelect?.(selectionKey)}
      className={`flex w-full items-center gap-2 rounded px-3 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 ${
        selected
          ? 'border-l-2 border-accent bg-accent/10 shadow-sm'
          : 'border-l-2 border-accent/40 bg-surface hover:bg-subtle/50'
      }`}
    >
      {widgetHint && (
        <span className="text-[10px] font-mono font-semibold uppercase text-accent/70">{widgetHint}</span>
      )}
      <span className="text-[13px] text-ink">{label || itemKey}</span>
    </button>
  );
}
