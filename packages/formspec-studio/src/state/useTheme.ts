import { useProjectState } from './useProjectState';

export function useTheme() {
  return useProjectState().theme;
}
