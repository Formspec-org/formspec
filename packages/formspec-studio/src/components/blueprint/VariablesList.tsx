import { useDefinition } from '../../state/useDefinition';
import { Section } from '../ui/Section';

export function VariablesList() {
  const definition = useDefinition();
  const variables = definition.variables ?? [];

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
          <div key={v.name} className="py-1">
            <div className="text-sm font-mono text-accent">@{v.name}</div>
            <div className="text-xs font-mono text-muted">{v.expression}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}
