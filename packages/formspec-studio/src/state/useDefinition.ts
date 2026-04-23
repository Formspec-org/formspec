/** @filedesc Hooks that return the current form definition document from project state. */
import { useProjectSlice } from './useProjectSlice';
import { useContext, useCallback, useSyncExternalStore } from 'react';
import { ProjectContext } from './ProjectContext';
import type { FormDefinition } from '@formspec-org/studio-core';

export function useDefinition(): Readonly<FormDefinition> {
  return useProjectSlice((s) => s.definition);
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
