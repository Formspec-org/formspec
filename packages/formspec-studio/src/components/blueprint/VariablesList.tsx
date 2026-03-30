/** @filedesc Blueprint section listing computed variables with their FEL expressions and a navigate-to-Manage link. */
import { useDefinition } from '../../state/useDefinition';

export function VariablesList() {
  const definition = useDefinition();
  const variables = definition.variables ?? [];

  const displayExpression = (expression: string) => expression.replace(/@([A-Za-z_]\w*)/g, '$1');

  const navigateToManage = () => {
    window.dispatchEvent(new CustomEvent('formspec:navigate-workspace', { detail: { tab: 'Editor', view: 'manage' } }));
  };

  if (variables.length === 0) {
    return <p className="text-xs text-muted py-2">No variables defined</p>;
  }

  return (
    <div className="space-y-1">
      {variables.map((v) => (
        <button
          key={v.name}
          type="button"
          onClick={navigateToManage}
          className="w-full rounded-[4px] px-2 py-1 text-left transition-colors hover:bg-subtle group"
        >
          <div className="flex items-center justify-between">
            <div className="text-sm font-mono text-accent">@{v.name}</div>
            <div className="text-[9px] text-muted opacity-0 group-hover:opacity-100 transition-opacity">Go to Manage</div>
          </div>
          <div className="text-xs font-mono text-muted truncate" title={v.expression}>
            {displayExpression(v.expression)}
          </div>
        </button>
      ))}
    </div>
  );
}
