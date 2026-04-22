/** @filedesc Dashed-border empty state used across blueprint sidebar panels. */

interface EmptyBlueprintStateProps {
  message: string;
}

export function EmptyBlueprintState({ message }: EmptyBlueprintStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-5 border border-dashed border-border/70 rounded-[6px] bg-subtle/30 text-muted mx-1">
      <span className="text-[12px] font-medium font-ui tracking-tight">{message}</span>
    </div>
  );
}
