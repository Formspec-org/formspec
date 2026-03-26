/**
 * Definition normalization utilities.
 *
 * Converts legacy/alternative serialization shapes into the canonical forms
 * expected by the studio engine:
 *
 * - `instances[]` (array with `name` property) → `instances{}` (object keyed by name)
 * - `binds{}` (object keyed by path) → `binds[]` (array with `path` property)
 *
 * Safe to call on already-normalized definitions (idempotent).
 *
 * @module normalization
 */
import type { FormDefinition } from '@formspec-org/types';

/**
 * Normalize a definition by converting legacy shape forms to canonical forms.
 *
 * Conversions applied:
 * - If `definition.instances` is an array, converts to object keyed by each
 *   item's `name` property. The `name` property is stripped from each value.
 * - If `definition.binds` is a non-array object, converts to array of
 *   `{ path, ...config }` entries where each key becomes the `path`.
 *
 * Both conversions are idempotent: calling on already-normalized data is safe.
 *
 * @param definition - The definition to normalize (not mutated; a new object is returned).
 * @returns A new definition with canonical instances and binds shapes.
 */
export function normalizeDefinition(definition: FormDefinition): FormDefinition {
  let result: any = definition;

  // Normalize instances: array → object keyed by name
  if (Array.isArray(result.instances)) {
    const instancesMap: Record<string, unknown> = {};
    for (const entry of result.instances as Array<Record<string, unknown>>) {
      const { name, ...rest } = entry;
      if (typeof name === 'string') {
        instancesMap[name] = rest;
      }
    }
    result = { ...result, instances: instancesMap };
  }

  // Normalize binds: object → array with path property
  if (result.binds !== undefined && !Array.isArray(result.binds) && typeof result.binds === 'object') {
    const bindsArray = Object.entries(result.binds as Record<string, Record<string, unknown>>).map(
      ([path, config]) => ({ path, ...config }),
    );
    result = { ...result, binds: bindsArray };
  }

  // Normalize legacy presentation → formPresentation at the definition root
  if (result.presentation && !result.formPresentation) {
    const { presentation, ...rest } = result;
    result = { ...rest, formPresentation: presentation };
  }

  return result as FormDefinition;
}
