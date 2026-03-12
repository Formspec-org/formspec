/**
 * Option set command handlers for the Formspec Studio Core.
 *
 * Option sets are named, reusable collections of selectable options (label/value pairs)
 * that can be shared across multiple choice-type fields (dropdowns, radio groups,
 * checkbox groups, etc.). Instead of duplicating the same list of options on every
 * field that needs them, authors declare a named option set once in
 * `definition.optionSets` and reference it by name from any field via the
 * `optionSet` property.
 *
 * An option set can be defined in two forms:
 * - **Inline**: an array of `Option` objects (each with at least `value` and `label`),
 *   optionally including FEL-based visibility conditions per option.
 * - **External source**: a URI string pointing to a remote option list, with optional
 *   `valueField` and `labelField` mappings.
 *
 * @module definition-optionsets
 */
import { registerHandler } from '../handler-registry.js';
import type { FormspecItem } from 'formspec-engine';

/**
 * **definition.setOptionSet** -- Create or replace a named reusable option set.
 *
 * Accepts either inline options (an array of label/value objects) or an external
 * source reference (a URI string). If the named option set already exists, it is
 * fully replaced. If `definition.optionSets` does not yet exist on the definition,
 * it is initialized as an empty object first.
 *
 * @param state   - The current project state (mutated in-place).
 * @param payload - `{ name: string; options?: Option[]; source?: string }`.
 *                  Provide `options` for inline sets or `source` for external sets.
 *                  If both are provided, `options` takes precedence.
 * @returns `{ rebuildComponentTree: false }` -- option set changes do not affect
 *          the component tree structure.
 */
registerHandler('definition.setOptionSet', (state, payload) => {
  const p = payload as { name: string; options?: unknown[]; source?: string };
  if (!state.definition.optionSets) {
    state.definition.optionSets = {};
  }
  if (p.options) {
    state.definition.optionSets[p.name] = { options: p.options } as any;
  } else if (p.source) {
    state.definition.optionSets[p.name] = { source: p.source } as any;
  }
  return { rebuildComponentTree: false };
});

/**
 * **definition.deleteOptionSet** -- Remove a named option set and inline its
 * options into all fields that were referencing it.
 *
 * When a named option set is deleted, any field whose `optionSet` property points
 * to that name has its reference removed and, if the deleted set contained inline
 * options (an array), those options are copied directly onto the field's `options`
 * property. This ensures fields remain functional after the shared set is removed.
 * The walk is recursive through all `children` of all items.
 *
 * If the named set does not exist, this is a no-op.
 *
 * @param state   - The current project state (mutated in-place).
 * @param payload - `{ name: string }` -- the name of the option set to delete.
 * @returns `{ rebuildComponentTree: false }`.
 */
registerHandler('definition.deleteOptionSet', (state, payload) => {
  const { name } = payload as { name: string };
  const optionSets = state.definition.optionSets;
  if (!optionSets?.[name]) return { rebuildComponentTree: false };

  const options = optionSets[name];

  // Inline options into referencing fields
  const inlineRefs = (items: FormspecItem[]) => {
    for (const item of items) {
      if (item.optionSet === name) {
        delete item.optionSet;
        if (options && 'options' in (options as any) && Array.isArray((options as any).options)) {
          item.options = (options as any).options;
        }
      }
      if (item.children) inlineRefs(item.children);
    }
  };
  inlineRefs(state.definition.items);

  delete optionSets[name];
  return { rebuildComponentTree: false };
});

/**
 * **definition.promoteToOptionSet** -- Extract a field's inline options into a
 * named option set and replace the inline options with a reference.
 *
 * This is the inverse of the inlining that `deleteOptionSet` performs. Given a
 * dot-separated field path, this handler:
 * 1. Walks the item tree to locate the target field.
 * 2. Copies the field's `options` array into a new named option set.
 * 3. Removes the inline `options` from the field and sets `optionSet` to the
 *    given name.
 *
 * This enables authors to refactor a one-off inline options list into a shared,
 * reusable option set that multiple fields can reference.
 *
 * @param state   - The current project state (mutated in-place).
 * @param payload - `{ path: string; name: string }` -- `path` is a dot-separated
 *                  key path to the field (e.g. `"section1.favoriteColor"`), and
 *                  `name` is the desired name for the new option set.
 * @throws {Error} If the field at `path` cannot be found in the item tree.
 * @throws {Error} If the located field has no inline `options` to promote.
 * @returns `{ rebuildComponentTree: false }`.
 */
registerHandler('definition.promoteToOptionSet', (state, payload) => {
  const { path, name } = payload as { path: string; name: string };

  // Find the field by walking the dot-separated path through the item tree
  const parts = path.split('.');
  let items = state.definition.items;
  let item: FormspecItem | undefined;

  for (let i = 0; i < parts.length; i++) {
    const found = items.find(it => it.key === parts[i]);
    if (!found) throw new Error(`Item not found: ${path}`);
    if (i === parts.length - 1) {
      item = found;
    } else {
      if (!found.children) throw new Error(`Item not found: ${path}`);
      items = found.children;
    }
  }

  if (!item?.options) throw new Error(`Item has no inline options: ${path}`);

  // Create the option set from the field's inline options
  if (!state.definition.optionSets) {
    state.definition.optionSets = {};
  }
  state.definition.optionSets[name] = { options: item.options } as any;

  // Replace inline options with a named reference
  delete item.options;
  item.optionSet = name;

  return { rebuildComponentTree: false };
});
