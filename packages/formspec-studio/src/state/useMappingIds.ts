/** @filedesc Hook that returns all mapping IDs and the currently selected ID from project state. */
import { useProjectSlice } from './useProjectSlice';

export function useMappingIds() {
  const ids = useProjectSlice((s) => Object.keys(s.mappings));
  const selectedMappingId = useProjectSlice((s) => s.selectedMappingId);
  const selectedId = selectedMappingId ?? ids[0] ?? 'default';
  return { ids, selectedId };
}
