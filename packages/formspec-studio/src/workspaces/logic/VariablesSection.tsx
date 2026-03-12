import { useState } from 'react';

interface Variable {
  name: string;
  expression: string;
}

interface VariablesSectionProps {
  variables: Variable[];
}

export function VariablesSection({ variables }: VariablesSectionProps) {
  const [editingName, setEditingName] = useState<string | null>(null);
  if (variables.length === 0) return null;

  return (
    <div className="space-y-2">
      {variables.map((v) => (
        <div key={v.name} className="border border-border rounded bg-surface p-2">
          <div className="text-sm font-medium text-ink">{v.name}</div>
          {editingName === v.name ? (
            <input
              type="text"
              value={v.expression}
              readOnly
              className="mt-1 w-full text-xs font-mono text-muted bg-subtle border border-border rounded px-2 py-1"
            />
          ) : (
            <div
              className="text-xs font-mono text-muted mt-1"
              onDoubleClick={() => setEditingName(v.name)}
            >
              {v.expression}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
