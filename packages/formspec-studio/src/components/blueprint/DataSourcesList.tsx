import { useDefinition } from '../../state/useDefinition';

interface InstanceEntry {
  name: string;
  source?: string;
  description?: string;
}

export function DataSourcesList() {
  const definition = useDefinition();
  const raw = (definition as any).instances;

  let entries: InstanceEntry[] = [];
  if (Array.isArray(raw)) {
    entries = raw;
  } else if (raw && typeof raw === 'object') {
    entries = Object.entries(raw).map(([name, val]) => ({
      name,
      ...(typeof val === 'object' && val !== null ? val as Record<string, unknown> : {}),
    })) as InstanceEntry[];
  }

  if (entries.length === 0) {
    return <p className="text-xs text-muted py-2">No data sources defined</p>;
  }

  return (
    <div className="space-y-1">
      {entries.map((inst) => (
        <div key={inst.name} className="py-1">
          <div className="text-sm font-mono text-ink">{inst.name}</div>
          {inst.source && (
            <div className="text-xs text-muted">{inst.source}</div>
          )}
        </div>
      ))}
    </div>
  );
}
