import { useProjectState } from './useProjectState';

export function useComponent() {
  return useProjectState().component;
}
