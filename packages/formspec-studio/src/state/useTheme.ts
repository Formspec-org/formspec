/** @filedesc Hook that returns the current theme document from project state. */
import { useProjectState } from './useProjectState';

export function useTheme() {
  return useProjectState().theme;
}
