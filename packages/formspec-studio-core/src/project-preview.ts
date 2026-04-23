/** @filedesc Preview / normalization helpers over {@link ProjectInternals}. */
import type { FormDefinition, FormItem } from './types.js';
import type { ProjectInternals } from './project-internals.js';
import { filterByRelevance, pruneObject, sampleValueForField } from './lib/sample-data.js';

/**
 * Generate plausible sample data for each field based on its data type.
 * When overrides are provided, those values replace the generated defaults
 * for matching field paths. Override keys that don't match any field path
 * are silently ignored.
 *
 * Fields hidden by show_when/relevant conditions are excluded from the
 * result. Relevance is evaluated by loading the sample data into a
 * FormEngine and reading its relevance signals.
 */
export function generateSampleData(project: ProjectInternals, overrides?: Record<string, unknown>): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  const items = project.core.state.definition.items ?? [];
  let fieldIndex = 0;

  const buildInstance = (children: FormItem[]): Record<string, unknown> => {
    const instance: Record<string, unknown> = {};
    for (const child of children) {
      if (child.type === 'group') {
        if (child.repeatable && child.children?.length) {
          instance[child.key] = [buildInstance(child.children), buildInstance(child.children)];
        } else if (child.children?.length) {
          const nested = buildInstance(child.children);
          for (const [k, v] of Object.entries(nested)) {
            instance[`${child.key}.${k}`] = v;
          }
        }
        continue;
      }
      if (child.type !== 'field') continue;
      if (overrides) {
        const overrideKey = child.key;
        if (overrideKey in overrides) {
          instance[child.key] = overrides[overrideKey];
          fieldIndex++;
          continue;
        }
      }
      instance[child.key] = sampleValueForField(child, fieldIndex);
      fieldIndex++;
    }
    return instance;
  };

  const walkItems = (itemList: FormItem[], prefix: string) => {
    for (const item of itemList) {
      const path = prefix ? `${prefix}.${item.key}` : item.key;
      if (item.type === 'group') {
        if (item.repeatable && item.children?.length) {
          data[path] = [buildInstance(item.children), buildInstance(item.children)];
          continue;
        }
        if (item.children?.length) {
          walkItems(item.children, path);
        }
        continue;
      }
      if (item.type !== 'field') continue;

      if (overrides && path in overrides) {
        data[path] = overrides[path];
        fieldIndex++;
        continue;
      }

      data[path] = sampleValueForField(item, fieldIndex);
      fieldIndex++;
    }
  };

  walkItems(items, '');
  const definition = project.core.export().definition as FormDefinition;
  return filterByRelevance(definition, data);
}

/** Return a cleaned-up deep clone of the definition. Strips null values, empty arrays, and undefined keys. */
export function normalizeDefinition(project: ProjectInternals): Record<string, unknown> {
  const def = project.core.state.definition;
  const clone = JSON.parse(JSON.stringify(def));
  return pruneObject(clone) as Record<string, unknown>;
}
