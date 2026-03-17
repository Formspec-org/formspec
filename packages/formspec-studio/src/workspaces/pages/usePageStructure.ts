import { useMemo } from 'react';
import { resolvePageStructure, type ResolvedPageStructure } from 'formspec-studio-core';
import { useProjectState } from '../../state/useProjectState';

export function buildLabelMap(items: any[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of items) {
    map.set(item.key, item.label ?? item.key);
    if (item.children) {
      for (const [k, v] of buildLabelMap(item.children)) {
        map.set(k, v);
      }
    }
  }
  return map;
}

export function usePageStructure(allItemKeys?: string[]): ResolvedPageStructure {
  const state = useProjectState();

  const labelMap = useMemo(
    () => buildLabelMap(state.definition.items ?? []),
    [state.definition.items],
  );

  const keys = useMemo(
    () => allItemKeys ?? Array.from(labelMap.keys()),
    [allItemKeys, labelMap],
  );

  return useMemo(
    () => resolvePageStructure(state, keys),
    [state.theme, state.definition, keys],
  );
}

export { type ResolvedPageStructure };
