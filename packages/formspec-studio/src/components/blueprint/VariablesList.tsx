/** @filedesc Blueprint section listing computed variables with their FEL expressions and a navigate-to-Manage link. */
import { useDefinition } from '../../state/useDefinition';
import { EmptyBlueprintState } from '../shared/EmptyBlueprintState';

export function VariablesList() {
  const definition = useDefinition();
  const variables = definition.variables ?? [];

  const displayExpression = (expression: string) => expression.replace(/@([A-Za-z_]\w*)/g, '$1');

  const navigateToManage = () => {
    window.dispatchEvent(new CustomEvent('formspec:navigate-workspace', { detail: { tab: 'Editor', view: 'manage' } }));
  };

  if (variables.length === 0) {
    return <EmptyBlueprintState message="No variables defined" />;
  }

  return (
    <div className="space-y-1">
      {variables.map((v) => (
        <button
          key={v.name}
          type="button"
          onClick={navigateToManage}
          className="w-full rounded-[6px] px-2.5 py-1.5 text-left transition-colors hover:bg-subtle hover:text-ink group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <div className="flex items-center justify-between">
            <div className="text-[13px] font-mono text-accent font-medium">@{v.name}</div>
            <div className="text-[9px] uppercase tracking-widest text-muted opacity-0 group-hover:opacity-100 transition-opacity">Manage ↗</div>
          </div>
          <div className="text-xs font-mono text-muted truncate" title={v.expression}>
            {displayExpression(v.expression)}
          </div>
        </button>
      ))}
    </div>
  );
}
