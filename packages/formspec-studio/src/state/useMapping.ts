/** @filedesc Hook that returns the selected mapping document from project state. */
import { useProjectState } from './useProjectState';

export function useMapping() {
  const state = useProjectState();
  const id = state.selectedMappingId ?? Object.keys(state.mappings)[0] ?? 'default';
  return state.mappings[id] ?? null;
}
