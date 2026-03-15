import type { ProjectState } from '../types.js';
import { itemLocationAtPath, type FormspecItem } from 'formspec-engine';

/**
 * Resolve a dot-separated item path to its location within the definition item tree.
 *
 * Walks the `state.definition.items` hierarchy following each segment of the
 * dot-path through nested `children` arrays. Returns the parent array containing
 * the target item, the item's index within that array, and the item itself.
 *
 * Used by virtually every definition-item handler (`deleteItem`, `renameItem`,
 * `moveItem`, `reorderItem`, `duplicateItem`) to locate an item before mutating it.
 *
 * @param state - The current project state containing the definition item tree.
 * @param path - Dot-separated path of item keys (e.g. `"contacts.email"` for the
 *   `email` item nested under the `contacts` group).
 * @returns An object with `parent` (the containing `FormspecItem[]` array),
 *   `index` (position within that array), and `item` (the resolved item).
 *   Returns `undefined` if any segment of the path cannot be resolved.
 */
export function resolveItemLocation(
  state: ProjectState,
  path: string,
): { parent: FormspecItem[]; index: number; item: FormspecItem } | undefined {
  return itemLocationAtPath(state.definition.items, path);
}
