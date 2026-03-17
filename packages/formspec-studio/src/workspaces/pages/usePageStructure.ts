/** @filedesc Hook that resolves the current page structure (mode, pages, diagnostics) from project state. */
import { useMemo } from 'react';
import { resolvePageStructure, type ResolvedPageStructure } from 'formspec-studio-core';
import { useProjectState } from '../../state/useProjectState';

export function buildLabelMap(items: any[], map?: Map<string, string>): Map<string, string> {
  const result = map ?? new Map<string, string>();
  for (const item of items) {
    result.set(item.key, item.label ?? item.key);
    if (item.children) {
      buildLabelMap(item.children, result);
    }
  }
  return result;
}

export interface PageStructureResult {
  structure: ResolvedPageStructure;
  labelMap: Map<string, string>;
}

export function usePageStructure(): PageStructureResult {
  const state = useProjectState();

  const labelMap = useMemo(
    () => buildLabelMap(state.definition.items ?? []),
    [state.definition.items],
  );

  const keys = useMemo(
    () => Array.from(labelMap.keys()),
    [labelMap],
  );

  const structure = useMemo(
    () => resolvePageStructure(state, keys),
    [state.theme, state.definition, keys],
  );

  return { structure, labelMap };
}

export { type ResolvedPageStructure };
