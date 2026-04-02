/** @filedesc Layout canvas block for bound field items — shows label and data type. */

interface FieldBlockProps {
  itemKey: string;
  bindPath: string;
  selectionKey: string;
  label?: string;
  dataType?: string;
  selected?: boolean;
  onSelect?: (selectionKey: string) => void;
}

export function FieldBlock({
  itemKey,
  bindPath,
  selectionKey,
  label,
  dataType,
  selected = false,
  onSelect,
}: FieldBlockProps) {
  return (
    <button
      type="button"
      data-testid={`layout-field-${itemKey}`}
      data-layout-node
      data-layout-node-type="field"
      data-layout-bind={bindPath}
      aria-pressed={selected}
      onClick={() => onSelect?.(selectionKey)}
      className={`flex w-full items-center gap-2 rounded border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 ${
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
