/** @filedesc Hooks that return the current form definition document from project state. */
import { useSyncExternalStore, useCallback, useContext } from 'react';
import { useProjectState } from './useProjectState';
import { ProjectContext } from './ProjectContext';

export function useDefinition() {
  return useProjectState().definition;
}

export function useOptionalDefinition() {
  const project = useContext(ProjectContext);
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!project) return () => {};
      return project.onChange(onStoreChange);
    },
    [project],
  );
  const getSnapshot = useCallback(() => {
    if (!project) return null;
    return project.state.definition;
  }, [project]);
  return useSyncExternalStore(subscribe, getSnapshot);
}
