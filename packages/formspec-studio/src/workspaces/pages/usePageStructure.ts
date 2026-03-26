/** @filedesc Hook that resolves the current page structure via the behavioral page-view query. */
import { useMemo } from 'react';
import { resolvePageView, type PageStructureView } from 'formspec-studio-core';
import { useProjectState } from '../../state/useProjectState';

export function usePageStructure(): PageStructureView {
  const state = useProjectState();
  return useMemo(
    () => resolvePageView(state),
    [state.component, state.theme, state.definition],
  );
}
