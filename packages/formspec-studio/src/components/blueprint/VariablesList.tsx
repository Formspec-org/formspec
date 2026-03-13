import { useDefinition } from '../../state/useDefinition';

export function VariablesList() {
  const definition = useDefinition();
  const variables = definition.variables ?? [];
  const displayExpression = (expression: string) => expression.replace(/@([A-Za-z_]\w*)/g, '$1');

  if (variables.length === 0) {
    return <p className="text-xs text-muted py-2">No variables defined</p>;
  }

  return (
    <div className="space-y-1">
      {variables.map((v) => (
        <div key={v.name} className="w-full rounded-[4px] px-2 py-1 text-left">
          <div className="text-sm font-mono text-accent">@{v.name}</div>
          <div className="text-xs font-mono text-muted" title={v.expression}>
            {displayExpression(v.expression)}
          </div>
        </div>
      ))}
    </div>
  );
}
