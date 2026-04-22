/** @filedesc Hook that returns all mapping IDs and the currently selected ID from project state. */
import { useMemo } from 'react';
import { useProjectState } from './useProjectState';

export function useMappingIds() {
  const state = useProjectState();
  const ids = useMemo(() => Object.keys(state.mappings), [state.mappings]);
  const selectedId = state.selectedMappingId ?? ids[0] ?? 'default';
  return { ids, selectedId };
}
