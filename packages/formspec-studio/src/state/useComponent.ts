/** @filedesc Hook that subscribes to the project's ComponentDocument and returns live snapshots. */
import { useProjectSlice } from './useProjectSlice';
import type { ComponentDocument } from '@formspec-org/studio-core';

export function useComponent(): Readonly<ComponentDocument> {
  return useProjectSlice((s) => s.component);
}
