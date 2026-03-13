import { useDefinition } from '../../state/useDefinition';
import { Pill } from '../ui/Pill';

interface FieldMapRule {
  source: string;
  target: string;
  transform?: string;
}

interface Migration {
  sourceVersion?: string;
  fromVersion?: string;
  description?: string;
  fieldMap?: FieldMapRule[];
  changes?: unknown[];
}

export function MigrationsSection() {
  const definition = useDefinition();
  const migrations: Migration[] = (definition as any).migrations ?? [];

  if (migrations.length === 0) {
    return <p className="text-xs text-muted py-2">No migrations defined</p>;
  }

  return (
    <div className="space-y-3">
      {migrations.map((mig, i) => {
        const version = mig.sourceVersion ?? mig.fromVersion ?? 'unknown';
        return (
          <div key={i} className="border border-border rounded p-2 space-y-1">
            <div className="flex items-center gap-2">
              <Pill text={version} color="accent" size="sm" />
            </div>
            {mig.description && (
              <p className="text-xs text-muted">{mig.description}</p>
            )}
            {mig.fieldMap && mig.fieldMap.length > 0 && (
              <div className="space-y-1">
                {mig.fieldMap.map((rule, j) => (
                  <div key={j} className="flex items-center gap-1 text-xs font-mono">
                    <span className="text-ink">{rule.source}</span>
                    <span className="text-muted">&rarr;</span>
                    <span className="text-ink">{rule.target}</span>
                    {rule.transform && (
                      <Pill text={rule.transform} color="muted" size="sm" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
