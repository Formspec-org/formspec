/** @filedesc Hook that subscribes to the project store and returns a reactive ProjectSnapshot. */
import { useProjectSlice } from './useProjectSlice';
import type { ProjectSnapshot } from '@formspec-org/studio-core';

export function useProjectState(): Readonly<ProjectSnapshot> {
  return useProjectSlice((s) => s);
}
