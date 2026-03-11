import { useDefinition } from '../../state/useDefinition';
import { flatItems } from '../../lib/field-helpers';

interface OptionEntry {
  value: string;
  label: string;
}

interface OptionSetDef {
  options: OptionEntry[];
}

export function OptionSets() {
  const definition = useDefinition();
  const optionSets = (definition?.optionSets as Record<string, OptionSetDef>) || {};
  const items = (definition?.items as any[]) || [];

  // Count how many fields reference each option set
  const flat = flatItems(items);
  const usageCounts: Record<string, number> = {};
  for (const { item } of flat) {
    const ref = item.optionSet as string | undefined;
    if (ref) {
      usageCounts[ref] = (usageCounts[ref] || 0) + 1;
    }
  }

  const entries = Object.entries(optionSets);

  if (entries.length === 0) {
    return (
      <div className="p-4 text-muted text-sm">
        No option sets defined.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-4">
      {entries.map(([name, os]) => (
        <div
          key={name}
          className="border border-neutral-700 rounded p-3"
        >
          <div className="flex items-center justify-between">
            <div className="font-medium text-sm">{name}</div>
            <div className="text-xs text-muted">
              Used by {usageCounts[name] || 0} field{(usageCounts[name] || 0) !== 1 ? 's' : ''}
            </div>
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {os.options.map((opt) => (
              <span
                key={opt.value}
                className="text-xs bg-neutral-800 rounded px-2 py-0.5"
              >
                {opt.label}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
