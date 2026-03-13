import { useDispatch } from '../../state/useDispatch';
import { useDefinition } from '../../state/useDefinition';

interface Instance {
  name: string;
  source?: string;
  schema?: unknown;
}

export function DataSources() {
  const definition = useDefinition();
  const dispatch = useDispatch();
  const rawInstances = definition?.instances;
  const instances: Instance[] = Array.isArray(rawInstances)
    ? rawInstances
    : Object.entries(rawInstances || {}).map(([name, inst]) => ({
        name,
        ...(inst as object),
      }));

  const handleAddDataSource = () => {
    const name = window.prompt('Data source name');
    if (!name?.trim()) return;
    const source = window.prompt('Data source URL');
    if (source === null) return;
    dispatch({
      type: 'definition.addInstance',
      payload: source.trim()
        ? { name: name.trim(), source: source.trim() }
        : { name: name.trim() },
    });
  };

  if (instances.length === 0) {
    return (
      <div className="p-4 text-sm space-y-3">
        <button
          type="button"
          className="px-3 py-1.5 text-[12.5px] font-medium rounded-[4px] border border-border text-ink hover:bg-subtle transition-colors"
          onClick={handleAddDataSource}
        >
          Add Data Source
        </button>
        <p className="text-muted">No data sources defined.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-4">
      <div>
        <button
          type="button"
          className="px-3 py-1.5 text-[12.5px] font-medium rounded-[4px] border border-border text-ink hover:bg-subtle transition-colors"
          onClick={handleAddDataSource}
        >
          Add Data Source
        </button>
      </div>
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
