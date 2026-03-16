import { useSyncExternalStore, useCallback } from 'react';
import type { ProjectSnapshot } from 'formspec-studio-core';
import { useProject } from './useProject';

export function useProjectState(): Readonly<ProjectSnapshot> {
  const project = useProject();
  const subscribe = useCallback(
    (onStoreChange: () => void) => project.onChange(onStoreChange),
    [project]
  );
  const getSnapshot = useCallback(() => project.state, [project]);
  return useSyncExternalStore(subscribe, getSnapshot);
}
