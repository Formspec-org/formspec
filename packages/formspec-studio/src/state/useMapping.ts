/** @filedesc Hook that returns the current mapping document from project state. */
import { useProjectState } from './useProjectState';

export function useMapping() {
  return useProjectState().mapping;
}
