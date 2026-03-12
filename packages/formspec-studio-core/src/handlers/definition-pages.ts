/**
 * Page, form-presentation, definition-property, and group-ref command handlers.
 *
 * Pages define the wizard / multi-step form structure. When page mode is enabled
 * the definition's `formPresentation.pages` array contains an ordered list of page
 * descriptors, each with a stable `key` and a user-facing `title`. Items are
 * assigned to pages, giving the form a paginated navigation flow.
 *
 * This module also houses the general-purpose `definition.setDefinitionProperty`
 * handler for top-level definition metadata, `definition.setFormPresentation` for
 * presentation-level settings, and `definition.setGroupRef` for modular composition
 * via `$ref` on group items.
 *
 * @module definition-pages
 */
import { registerHandler } from '../handler-registry.js';
import { resolveItemLocation } from './helpers.js';


/**
 * **definition.setDefinitionProperty** -- Set or delete a top-level property on
 * the form definition.
 *
 * Writable properties include: `name`, `description`, `url`, `version`, `status`,
 * `date`, `derivedFrom`, `versionAlgorithm`, `nonRelevantBehavior`, among others.
 *
 * Setting a value to `null` or `undefined` removes the property from the definition.
 * Does not trigger a component-tree rebuild since these are metadata-only changes.
 *
 * @param payload.property - The definition property name.
 * @param payload.value - The new value, or `null`/`undefined` to delete.
 */
registerHandler('definition.setDefinitionProperty', (state, payload) => {
  const { property, value } = payload as { property: string; value: unknown };

  if (value === null || value === undefined) {
    delete (state.definition as any)[property];
  } else {
    (state.definition as any)[property] = value;
  }

  return { rebuildComponentTree: false };
});

/**
 * **definition.setFormPresentation** -- Set a property on the definition's
 * `formPresentation` object.
 *
 * Manages form-level presentation settings such as `pageMode`, `labelPosition`,
 * `density`, `defaultCurrency`, and wizard configuration.
 *
 * `null`/`undefined` values delete the property.
 *
 * @param payload.property - The formPresentation property to set.
 * @param payload.value - The new value, or null/undefined to remove.
 */
registerHandler('definition.setFormPresentation', (state, payload) => {
  const { property, value } = payload as { property: string; value: unknown };

  if (!state.definition.formPresentation) {
    state.definition.formPresentation = {};
  }

  if (value === null || value === undefined) {
    delete state.definition.formPresentation[property];
  } else {
    state.definition.formPresentation[property] = value;
  }

  return { rebuildComponentTree: false };
});

/**
 * **definition.setGroupRef** -- Set or clear a `$ref` (and optional `keyPrefix`)
 * on a group item for modular composition.
 *
 * When `ref` is a non-null string, the group item becomes a reference to an external
 * definition fragment (identified by URI). The optional `keyPrefix` allows the
 * referenced items' keys to be namespaced to avoid collisions.
 *
 * When `ref` is `null`, the reference is removed and the group becomes a standalone
 * inline group again (both `$ref` and `keyPrefix` are deleted).
 *
 * Triggers a component-tree rebuild because the group's content changes.
 *
 * @param payload.path - Dot-separated path to the group item in the item tree.
 * @param payload.ref - URI string for the referenced definition, or `null` to clear.
 * @param payload.keyPrefix - Optional key prefix for the referenced items.
 * @throws {Error} If no item exists at the given path.
 */
registerHandler('definition.setGroupRef', (state, payload) => {
  const { path, ref, keyPrefix } = payload as { path: string; ref: string | null; keyPrefix?: string };
  const loc = resolveItemLocation(state, path);
  if (!loc) throw new Error(`Item not found: ${path}`);

  if (ref === null) {
    delete (loc.item as any).$ref;
    delete (loc.item as any).keyPrefix;
  } else {
    (loc.item as any).$ref = ref;
    if (keyPrefix) (loc.item as any).keyPrefix = keyPrefix;
  }

  return { rebuildComponentTree: true };
});
