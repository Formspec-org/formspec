interface PropertyRowProps {
  label: string;
  children: React.ReactNode;
}

export function PropertyRow({ label, children }: PropertyRowProps) {
  return (
    <div className="flex items-start gap-2 py-1">
      <span className="text-xs text-muted w-24 shrink-0">{label}</span>
      <span className="text-sm text-ink flex-1">{children}</span>
    </div>
  );
}
