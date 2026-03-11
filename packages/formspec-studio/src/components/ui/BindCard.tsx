const bindColors: Record<string, string> = {
  required: 'border-l-accent',
  relevant: 'border-l-logic',
  calculate: 'border-l-green',
  constraint: 'border-l-error',
  readonly: 'border-l-amber',
};

interface BindCardProps {
  bindType: string;
  expression: string;
  humanized?: string;
}

export function BindCard({ bindType, expression, humanized }: BindCardProps) {
  const borderColor = bindColors[bindType] || 'border-l-muted';
  return (
    <div className={`border border-border ${borderColor} border-l-2 rounded bg-surface p-2`}>
      <div className="text-xs font-medium text-muted uppercase tracking-wide">{bindType}</div>
      {humanized && <div className="text-sm text-ink mt-1">{humanized}</div>}
      <div className="text-xs font-mono text-muted mt-1">{expression}</div>
    </div>
  );
}
