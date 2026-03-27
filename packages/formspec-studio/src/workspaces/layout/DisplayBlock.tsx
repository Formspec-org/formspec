/** @filedesc Layout canvas block for display-only items (heading, divider, paragraph). */

interface DisplayBlockProps {
  itemKey: string;
  label?: string;
  widgetHint?: string;
}

export function DisplayBlock({ itemKey, label, widgetHint }: DisplayBlockProps) {
  return (
    <div
      data-testid={`layout-display-${itemKey}`}
      data-layout-node
      data-layout-node-type="display"
      data-layout-node-id={itemKey}
      className="flex items-center gap-2 rounded border-l-2 border-accent/40 bg-surface px-3 py-1.5"
    >
      {widgetHint && (
        <span className="text-[10px] font-mono font-semibold uppercase text-accent/70">{widgetHint}</span>
      )}
      <span className="text-[13px] text-ink">{label || itemKey}</span>
    </div>
  );
}
