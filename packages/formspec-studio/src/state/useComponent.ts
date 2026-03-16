import { useSyncExternalStore, useCallback } from 'react';
import type { ComponentDocument } from 'formspec-studio-core';
import { useProject } from './useProject';

export function useComponent(): Readonly<ComponentDocument> {
  const project = useProject();
  const subscribe = useCallback(
    (onStoreChange: () => void) => project.onChange(onStoreChange),
    [project]
  );
  const getSnapshot = useCallback(() => project.component, [project]);
  return useSyncExternalStore(subscribe, getSnapshot);
}
