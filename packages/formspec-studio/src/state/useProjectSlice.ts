/** @filedesc Generic hook for subscribing to a stable slice of project state. */
import { useSyncExternalStore, useCallback } from 'react';
import type { ProjectSnapshot } from '@formspec-org/studio-core';
import { useProject } from './useProject';

export function useProjectSlice<T>(selector: (state: ProjectSnapshot) => T): T {
  const project = useProject();
  
  const subscribe = useCallback(
    (onStoreChange: () => void) => project.onChange(onStoreChange),
    [project]
  );
  
  const getSnapshot = useCallback(() => {
    return selector(project.state);
  }, [project, selector]);

  return useSyncExternalStore(subscribe, getSnapshot);
}
