import { useMemo, useState, useCallback } from 'react';
import type { FormDefinition } from '@formspec-org/types';
import {
  filterFELFieldOptions,
  filterFELFunctionOptions,
  getFELAutocompleteTrigger,
  getFELFunctionAutocompleteTrigger,
  getFELInstanceNameAutocompleteTrigger,
  getInstanceFieldOptions,
  getInstanceNameOptions,
  type FELAutocompleteTrigger,
} from '@formspec-org/studio-core';
import { getBuiltinFELFunctionCatalog } from '@formspec-org/engine';
import { useFieldOptions } from './useFieldOptions';
import { formatCategoryName } from '../components/ui/FELReferencePopup';

export type AutocompleteOption =
  | { kind: 'instanceName'; name: string }
  | { kind: 'path'; path: string; label: string; dataType?: string }
  | { kind: 'function'; name: string; label: string; signature?: string; description?: string; category?: string };

export function useFELAutocomplete(definition: FormDefinition | null | undefined) {
  const [activeOptionIndex, setActiveOptionIndex] = useState(0);
  const [autocomplete, setAutocomplete] = useState<FELAutocompleteTrigger | null>(null);
  const [autocompleteKind, setAutocompleteKind] = useState<'path' | 'function' | 'instanceName' | null>(null);

  const fieldOptions = useFieldOptions();

  const functionOptions = useMemo(() => {
    return getBuiltinFELFunctionCatalog().map(entry => ({
      name: entry.name,
      label: entry.name,
      signature: entry.signature ?? '',
      description: entry.description ?? '',
      category: formatCategoryName(entry.category),
    }));
  }, []);

  const functionSignatures = useMemo(() => {
    return Object.fromEntries(functionOptions.map(opt => [opt.name, opt.signature || '']));
  }, [functionOptions]);

  const autocompleteOptions = useMemo(() => {
    if (!autocomplete || !autocompleteKind) return [];

    if (autocompleteKind === 'path') {
      const options = autocomplete.instanceName
        ? getInstanceFieldOptions(definition?.instances, autocomplete.instanceName)
        : fieldOptions;

      return filterFELFieldOptions(options, autocomplete.query).map(opt => ({
        kind: 'path' as const,
        path: opt.path,
        label: opt.label,
        dataType: opt.dataType
      }));
    }

    if (autocompleteKind === 'instanceName') {
      return getInstanceNameOptions(definition?.instances, autocomplete.query).map(name => ({
        kind: 'instanceName' as const,
        name
      }));
    }

    return filterFELFunctionOptions(functionOptions, autocomplete.query).map(opt => ({
      kind: 'function' as const,
      name: opt.name,
      label: opt.label,
      signature: opt.signature,
      description: opt.description,
      category: opt.category
    }));
  }, [autocomplete, autocompleteKind, fieldOptions, functionOptions, definition]);

  const openAutocomplete = useCallback((nextValue: string, caret: number) => {
    const pathTrigger = getFELAutocompleteTrigger(nextValue, caret);
    if (pathTrigger) {
      setAutocomplete(pathTrigger);
      setAutocompleteKind('path');
      setActiveOptionIndex(0);
      return;
    }

    const instanceNameTrigger = getFELInstanceNameAutocompleteTrigger(nextValue, caret);
    if (instanceNameTrigger) {
      setAutocomplete(instanceNameTrigger);
      setAutocompleteKind('instanceName');
      setActiveOptionIndex(0);
      return;
    }

    const functionTrigger = getFELFunctionAutocompleteTrigger(nextValue, caret);
    if (functionTrigger) {
      setAutocomplete(functionTrigger);
      setAutocompleteKind('function');
      setActiveOptionIndex(0);
      return;
    }

    setAutocomplete(null);
    setAutocompleteKind(null);
  }, []);

  const closeAutocomplete = useCallback(() => {
    setAutocomplete(null);
    setAutocompleteKind(null);
  }, []);

  return {
    autocomplete,
    autocompleteKind,
    autocompleteOptions,
    activeOptionIndex,
    setActiveOptionIndex,
    openAutocomplete,
    closeAutocomplete,
    functionSignatures,
  };
}
