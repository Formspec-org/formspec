/** @filedesc Shared hook to compute and memoize a flat list of field options for FEL editors. */
import { useMemo } from 'react';
import { flatItems, type FELEditorFieldOption } from '@formspec-org/studio-core';
import { useDefinition } from '../state/useDefinition';

export function useFieldOptions(): FELEditorFieldOption[] {
  const definition = useDefinition();

  return useMemo(() => {
    if (!definition?.items) return [];
    return flatItems(definition.items).map((fi) => ({
      path: fi.path,
      label: fi.item.label || fi.path,
      dataType: fi.item.dataType,
    }));
  }, [definition]);
}
