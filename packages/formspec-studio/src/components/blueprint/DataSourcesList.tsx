/** @filedesc Blueprint section listing named data source instances defined on the form. */
import { useDefinition } from '../../state/useDefinition';
import { EmptyBlueprintState } from '../shared/EmptyBlueprintState';

interface InstanceEntry {
  name: string;
  source?: string;
  description?: string;
}

export function DataSourcesList() {
  const definition = useDefinition();
  const raw = definition.instances;

  const entries: InstanceEntry[] = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? Object.entries(raw).map(([name, val]) => ({
        name,
        ...(typeof val === 'object' && val !== null ? val as Record<string, unknown> : {}),
      })) as InstanceEntry[]
    : [];

  if (entries.length === 0) {
    return <EmptyBlueprintState message="No data sources defined" />;
  }

  return (
    <div className="space-y-1">
      {entries.map((inst) => (
        <div key={inst.name} className="px-2.5 py-1.5 rounded-[4px] hover:bg-subtle/50 transition-colors cursor-default">
          <div className="text-[13px] font-mono font-medium text-ink/80">{inst.name}</div>
          {inst.source && (
            <div className="text-[11px] text-muted truncate mt-0.5">{inst.source}</div>
          )}
        </div>
      ))}
    </div>
  );
}
