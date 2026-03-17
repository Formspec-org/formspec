/** @filedesc Blueprint section listing named option sets and their option counts from the definition. */
import { useDefinition } from '../../state/useDefinition';
import { Pill } from '../ui/Pill';

export function OptionSetsList() {
  const definition = useDefinition();
  const optionSets = (definition as any).optionSets;

  if (!optionSets || typeof optionSets !== 'object') {
    return <p className="text-xs text-muted py-2">No option sets defined</p>;
  }

  const names = Object.keys(optionSets);

  if (names.length === 0) {
    return <p className="text-xs text-muted py-2">No option sets defined</p>;
  }

  return (
    <div className="space-y-1">
      {names.map((name) => {
        const set = optionSets[name];
        const options = Array.isArray(set) ? set : (set?.options ?? []);
        return (
          <div key={name} className="flex items-center gap-2 py-1">
            <span className="text-sm font-mono text-ink">{name}</span>
            <Pill text={`${options.length} options`} color="muted" size="sm" />
          </div>
        );
      })}
    </div>
  );
}
