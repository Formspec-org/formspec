/** @filedesc Blueprint section summarizing mapping rule count and direction for the current project. */
import { useProjectState } from '../../state/useProjectState';
import { Pill } from '../ui/Pill';

export function MappingsList() {
  const state = useProjectState();
  const id = state.selectedMappingId ?? Object.keys(state.mappings)[0] ?? 'default';
  const mapping = state.mappings[id] ?? {};
  const rules = (mapping.rules as unknown[] | undefined) ?? [];
  const direction = mapping.direction ?? 'bidirectional';

  if (rules.length === 0) {
    return <p className="text-xs text-muted py-2">No mapping rules defined</p>;
  }

  return (
    <div className="space-y-1 py-1">
      <div className="flex items-center gap-2">
        <Pill text={`${rules.length} rule${rules.length === 1 ? '' : 's'}`} color="accent" size="sm" />
        <Pill text={direction} color="muted" size="sm" />
      </div>
    </div>
  );
}
