import { useDefinition } from '../../state/useDefinition';

interface Instance {
  name: string;
  source?: string;
  schema?: unknown;
}

export function DataSources() {
  const definition = useDefinition();
  const instances: Instance[] = (definition?.instances as Instance[]) || [];

  if (instances.length === 0) {
    return (
      <div className="p-4 text-muted text-sm">
        No data sources defined.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-4">
      {instances.map((inst) => (
        <div
          key={inst.name}
          className="border border-neutral-700 rounded p-3"
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
