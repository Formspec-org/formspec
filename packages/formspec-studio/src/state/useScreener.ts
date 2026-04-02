/** @filedesc Hook that returns the current standalone Screener Document from project state. */
import { useProjectState } from './useProjectState';
import type { ScreenerDocument } from '@formspec-org/types';

export function useScreener(): ScreenerDocument | null {
  return useProjectState().screener;
}
