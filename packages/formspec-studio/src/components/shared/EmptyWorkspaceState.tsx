/** @filedesc Larger dashed-border empty state used for main workspace panels. */

interface EmptyWorkspaceStateProps {
  message: string;
  description?: string | React.ReactNode;
}

export function EmptyWorkspaceState({ message, description }: EmptyWorkspaceStateProps) {
  return (
    <div className="py-8 border-2 border-dashed border-border/50 rounded-2xl flex flex-col items-center justify-center text-center px-6">
      <p className="text-sm text-muted font-medium mb-2">{message}</p>
      {description && (
        <div className="text-[12px] text-muted/70 leading-relaxed max-w-[400px]">
          {description}
        </div>
      )}
    </div>
  );
}
