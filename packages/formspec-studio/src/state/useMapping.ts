import { useProjectState } from './useProjectState';

export function useMapping() {
  return useProjectState().mapping;
}
