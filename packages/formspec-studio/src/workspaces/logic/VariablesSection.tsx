interface Variable {
  name: string;
  expression: string;
}

interface VariablesSectionProps {
  variables: Variable[];
}

export function VariablesSection({ variables }: VariablesSectionProps) {
  if (variables.length === 0) return null;

  return (
    <div className="space-y-2">
      {variables.map((v) => (
        <div key={v.name} className="border border-border rounded bg-surface p-2">
          <div className="text-sm font-medium text-ink">{v.name}</div>
          <div className="text-xs font-mono text-muted mt-1">{v.expression}</div>
        </div>
      ))}
    </div>
  );
}
