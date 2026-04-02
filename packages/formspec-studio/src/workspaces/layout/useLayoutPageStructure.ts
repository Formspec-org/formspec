/** @filedesc Hook that resolves the current Layout page structure through the studio-core Project seam. */
import { useMemo } from 'react';
import type { PageStructureView } from '@formspec-org/studio-core';
import { useProject } from '../../state/useProject';
import { useProjectState } from '../../state/useProjectState';

export function useLayoutPageStructure(): PageStructureView {
  const project = useProject();
  const state = useProjectState();
  return useMemo(
    () => project.pageStructure(),
    [project, state.component, state.theme, state.definition],
  );
}
