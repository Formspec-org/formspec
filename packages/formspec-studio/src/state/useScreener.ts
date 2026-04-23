/** @filedesc Hook that returns the current standalone Screener Document from project state. */
import { useProjectSlice } from './useProjectSlice';
import type { ScreenerDocument } from '@formspec-org/types';

export function useScreener(): ScreenerDocument | null {
  return useProjectSlice((s) => s.screener);
}
