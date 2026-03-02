import { batch, effect, signal } from '@preact/signals';
import { FormEngine, type FormspecDefinition, type FormspecItem } from 'formspec-engine';
import type { BuilderDiagnostic } from '../types';
import { diagnostics, engine, project } from './project';

export const definition = signal<FormspecDefinition>(createEmptyDefinition());
export const definitionVersion = signal(0);

project.value = { ...project.value, definition: definition.value };

export function createEmptyDefinition(): FormspecDefinition {
  return {
    $formspec: '1.0',
    url: 'https://example.gov/forms/untitled',
    version: '0.1.0',
    status: 'draft',
    title: 'Untitled Form',
    items: [
      {
        key: 'basicInfo',
        type: 'group',
        label: 'Basic Information',
        children: [
          { key: 'fullName', type: 'field', label: 'Full Name', dataType: 'string' },
          { key: 'email', type: 'field', label: 'Email Address', dataType: 'string' },
        ],
      },
      { key: 'notes', type: 'field', label: 'Additional Notes', dataType: 'text' },
    ],
  } as FormspecDefinition;
}

export function updateDefinition(mutator: (def: FormspecDefinition) => void) {
  const current = definition.value;
  mutator(current);
  batch(() => {
    definitionVersion.value += 1;
    project.value = { ...project.value, definition: current };
  });
}

export function setDefinition(next: FormspecDefinition) {
  batch(() => {
    definition.value = next;
    definitionVersion.value += 1;
    project.value = { ...project.value, definition: next };
  });
}

export function findItemByKey(
  key: string,
  items: FormspecItem[] = definition.value.items,
): { item: FormspecItem; siblings: FormspecItem[]; index: number } | null {
  for (let i = 0; i < items.length; i += 1) {
    const candidate = items[i];
    if (candidate.key === key) {
      return { item: candidate, siblings: items, index: i };
    }
    if (candidate.children?.length) {
      const found = findItemByKey(key, candidate.children);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

effect(() => {
  definitionVersion.value;
  const current = definition.value;

  try {
    const nextEngine = new FormEngine(current);
    const report = nextEngine.getValidationReport();
    const mapped: BuilderDiagnostic[] = report.results.map((result) => ({
      severity: result.severity,
      artifact: 'definition',
      path: result.path,
      message: result.message,
      source: result.source ?? 'engine',
    }));

    batch(() => {
      engine.value = nextEngine;
      diagnostics.value = mapped;
    });
  } catch (error) {
    batch(() => {
      engine.value = null;
      diagnostics.value = [
        {
          severity: 'error',
          artifact: 'definition',
          path: '',
          message: `Engine error: ${(error as Error).message}`,
          source: 'engine',
        },
      ];
    });
  }
});
