import { useDefinition } from '../../state/useDefinition';
import { Section } from '../ui/Section';

export function VariablesList() {
  const definition = useDefinition();
  const variables = definition.variables ?? [];
  const displayExpression = (expression: string) => expression.replace(/@([A-Za-z_]\w*)/g, '$1');

  const openLogicWorkspace = () => {
    window.dispatchEvent(new CustomEvent('formspec:navigate-workspace', {
      detail: { tab: 'Logic' },
    }));
  };

  if (variables.length === 0) {
    return (
      <Section title="Variables">
        <p className="text-xs text-muted py-2">No variables defined</p>
      </Section>
    );
  }

  return (
    <Section title="Variables">
      <div className="space-y-1">
        {variables.map((v) => (
          <button
            key={v.name}
            type="button"
            aria-label={`@${v.name}`}
            className="w-full rounded-[4px] px-2 py-1 text-left hover:bg-subtle transition-colors cursor-pointer"
            onClick={openLogicWorkspace}
          >
            <div className="text-sm font-mono text-accent">@{v.name}</div>
            <div className="text-xs font-mono text-muted" title={v.expression}>
              {displayExpression(v.expression)}
            </div>
          </button>
        ))}
      </div>
    </Section>
  );
}
