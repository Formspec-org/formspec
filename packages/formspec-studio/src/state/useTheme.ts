/** @filedesc Hook that returns the current theme document from project state. */
import { useProjectSlice } from './useProjectSlice';

export function useTheme() {
  return useProjectSlice((s) => s.theme);
}
