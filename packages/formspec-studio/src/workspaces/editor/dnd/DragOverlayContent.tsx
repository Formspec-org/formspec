/** @filedesc Floating overlay rendered under the cursor while dragging canvas items. */
interface DragOverlayContentProps {
  label: string;
  itemType: string;
  extraCount?: number;
}

export function DragOverlayContent({ label, itemType, extraCount }: DragOverlayContentProps) {
  return (
    <div
      data-testid="drag-overlay"
      className="flex items-center gap-2 px-3 py-2 bg-surface border border-accent rounded-[4px] shadow-lg font-ui text-[13px] text-ink max-w-[240px] pointer-events-none"
    >
      <span className="font-mono text-[10px] text-muted uppercase">{itemType}</span>
      <span className="truncate">{label}</span>
      {extraCount != null && extraCount > 0 && (
        <span className="shrink-0 ml-auto px-1.5 py-0.5 bg-accent text-surface rounded-full text-[10px] font-bold">
          +{extraCount}
        </span>
      )}
    </div>
  );
}
