import { useDefinition } from '../../state/useDefinition';

interface Instance {
  name: string;
  source?: string;
  schema?: unknown;
}

export function DataSources() {
  const definition = useDefinition();
  const rawInstances = definition?.instances;
  const instances: Instance[] = Array.isArray(rawInstances)
    ? rawInstances
    : Object.entries(rawInstances || {}).map(([name, inst]) => ({
        name,
        ...(inst as object),
      }));

  if (instances.length === 0) {
    return (
      <div className="p-4 text-sm">
        <p className="text-muted">No data sources defined.</p>
        <button
          type="button"
          className="mt-3 rounded border border-border bg-surface px-3 py-2 text-xs font-medium text-ink hover:bg-subtle"
        >
          Add Data Source
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-4">
      {instances.map((inst) => (
        <div
          key={inst.name}
          className="rounded border border-border bg-surface p-3"
        >
          <div className="font-medium text-sm">{inst.name}</div>
          {inst.source && (
            <div className="text-xs text-muted mt-1 truncate">{inst.source}</div>
          )}
        </div>
      ))}
    </div>
  );
}
