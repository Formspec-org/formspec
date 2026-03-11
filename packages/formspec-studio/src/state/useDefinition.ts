import { useProjectState } from './useProjectState';

export function useDefinition() {
  return useProjectState().definition;
}
