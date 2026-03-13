import { useMemo } from 'react';
import { resolvePageStructure, type ResolvedPageStructure } from 'formspec-studio-core';
import { useProjectState } from '../../state/useProjectState';

function flattenItemKeys(items: any[]): string[] {
  const keys: string[] = [];
  for (const item of items) {
    keys.push(item.key);
    if (item.children) {
      keys.push(...flattenItemKeys(item.children));
    }
  }
  return keys;
}

export function usePageStructure(): ResolvedPageStructure {
  const state = useProjectState();
  const allItemKeys = useMemo(
    () => flattenItemKeys(state.definition.items ?? []),
    [state.definition.items],
  );
  return useMemo(
    () => resolvePageStructure(state, allItemKeys),
    [state, allItemKeys],
  );
}
