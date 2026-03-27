/** @filedesc Layout canvas block for bound field items — shows label and data type. */

interface FieldBlockProps {
  itemKey: string;
  label?: string;
  dataType?: string;
}

export function FieldBlock({ itemKey, label, dataType }: FieldBlockProps) {
  return (
    <div
      data-testid={`layout-field-${itemKey}`}
      data-layout-node
      data-layout-node-type="field"
      data-layout-bind={itemKey}
      className="flex items-center gap-2 rounded border border-border bg-surface px-3 py-2"
    >
      <span className="text-[13px] font-medium text-ink">{label || itemKey}</span>
      {dataType && (
        <span className="text-[11px] text-muted font-mono">{dataType}</span>
      )}
    </div>
  );
}
