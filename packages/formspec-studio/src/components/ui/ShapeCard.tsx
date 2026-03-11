const severityColors: Record<string, string> = {
  error: 'border-l-error',
  warning: 'border-l-amber',
  info: 'border-l-accent',
};

const severityBadge: Record<string, string> = {
  error: 'bg-error/10 text-error',
  warning: 'bg-amber/10 text-amber',
  info: 'bg-accent/10 text-accent',
};

interface ShapeCardProps {
  name: string;
  severity: string;
  constraint: string;
}

export function ShapeCard({ name, severity, constraint }: ShapeCardProps) {
  return (
    <div className={`border border-border ${severityColors[severity] || ''} border-l-2 rounded bg-surface p-2`}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-ink">{name}</span>
        <span className={`text-xs px-1.5 rounded-sm ${severityBadge[severity] || ''}`}>{severity}</span>
      </div>
      <div className="text-xs font-mono text-muted mt-1">{constraint}</div>
    </div>
  );
}
