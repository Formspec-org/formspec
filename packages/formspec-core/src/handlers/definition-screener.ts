/**
 * Screener command handlers for the Formspec Studio Core.
 *
 * The screener is a pre-form eligibility check mechanism -- a self-contained
 * routing subsystem with its own items, binds, and conditional routes. It
 * operates in its own scope, entirely separate from the main form's instance
 * data. The purpose of the screener is to collect a small set of answers
 * (screening questions) and then evaluate routing rules to determine which
 * form definition (or variant) the respondent should be directed to.
 *
 * A screener consists of:
 * - **Items**: form fields presented to the respondent (same shape as main form
 *   items, but scoped to the screener).
 * - **Binds**: FEL-based bind expressions (calculate, relevant, required, etc.)
 *   that target screener item keys.
 * - **Routes**: an ordered list of condition/target pairs. Each route has a FEL
 *   `condition` expression evaluated against screener item values and a `target`
 *   URI pointing to the destination definition. Routes are evaluated in order;
 *   first match wins.
 *
 * @module definition-screener
 */
import { registerHandler } from '../handler-registry.js';
import type { FormspecDefinition, FormspecItem } from 'formspec-engine';

function getEnabledScreener(state: { definition: FormspecDefinition }) {
  const screener = state.definition.screener;
  if (!screener || screener.enabled === false) {
    throw new Error('Screener is not enabled');
  }
  return screener;
}

/**
 * **definition.setScreener** -- Enable or disable the screener on the definition.
 *
 * When `enabled` is `true`, creates an empty screener structure with empty
 * `items` and `routes` arrays if one does not already exist. When `false`,
 * removes the screener entirely from the definition.
 *
 * @param state   - The current project state (mutated in-place).
 * @param payload - `{ enabled: boolean }`.
 * @returns `{ rebuildComponentTree: false }`.
 */
registerHandler('definition.setScreener', (state, payload) => {
  const { enabled } = payload as { enabled: boolean };

  if (enabled) {
    if (!state.definition.screener) {
      state.definition.screener = { items: [], routes: [] };
    }
    delete state.definition.screener.enabled;
  } else {
    if (state.definition.screener) {
      state.definition.screener.enabled = false;
    }
  }

  return { rebuildComponentTree: false };
});

/**
 * **definition.addScreenerItem** -- Add a screening field to the screener.
 *
 * Creates a new `FormspecItem` from the payload and appends it to the screener's
 * `items` array. The payload shape mirrors `definition.addItem` but targets the
 * screener scope. At minimum, `type` and `key` are required; `label` and
 * `dataType` are optional.
 *
 * @param state   - The current project state (mutated in-place).
 * @param payload - `{ type: string; key: string; label?: string; dataType?: string }`.
 * @throws {Error} If the screener is not enabled (i.e., `definition.screener` is absent).
 * @returns `{ rebuildComponentTree: false }`.
 */
registerHandler('definition.addScreenerItem', (state, payload) => {
  const p = payload as Record<string, unknown>;
  const screener = getEnabledScreener(state);
  type ItemType = FormspecItem['type'];
  type FieldDataType = NonNullable<FormspecItem['dataType']>;

  const item: FormspecItem = {
    type: p.type as ItemType,
    key: p.key as string,
    label: (p.label as string) ?? '',
  };
  if (p.dataType) item.dataType = p.dataType as FieldDataType;

  screener.items.push(item);
  return { rebuildComponentTree: false };
});

/**
 * **definition.deleteScreenerItem** -- Remove a screening field by key.
 *
 * Filters the screener's `items` array to exclude the item matching the given
 * key. Also cleans up any screener binds whose `path` matches the deleted item's
 * key, since those binds would be orphaned. If the bind cleanup empties the
 * binds array, the `binds` property is removed entirely.
 *
 * @param state   - The current project state (mutated in-place).
 * @param payload - `{ key: string }` -- the key of the screener item to remove.
 * @throws {Error} If the screener is not enabled.
 * @returns `{ rebuildComponentTree: false }`.
 */
registerHandler('definition.deleteScreenerItem', (state, payload) => {
  const { key } = payload as { key: string };
  const screener = getEnabledScreener(state);

  screener.items = screener.items.filter(it => it.key !== key);

  // Clean up screener binds referencing deleted item
  if (screener.binds) {
    screener.binds = screener.binds.filter((b: any) => b.path !== key);
    if (screener.binds.length === 0) delete screener.binds;
  }

  return { rebuildComponentTree: false };
});

/**
 * **definition.setScreenerBind** -- Set bind properties on a screener item.
 *
 * Works identically to `definition.setBind` but operates within the screener's
 * bind scope. Paths reference screener item keys (not main form paths). If no
 * bind exists for the given path, a new bind entry is created. Properties set to
 * `null` are removed from the bind object. Supported bind properties include
 * `calculate`, `relevant`, `required`, `readonly`, `constraint`, etc.
 *
 * @param state   - The current project state (mutated in-place).
 * @param payload - `{ path: string; properties: Record<string, unknown> }` where
 *                  `path` is a screener item key and `properties` is a partial bind
 *                  object. Setting a property to `null` removes it.
 * @throws {Error} If the screener is not enabled.
 * @returns `{ rebuildComponentTree: false }`.
 */
registerHandler('definition.setScreenerBind', (state, payload) => {
  const { path, properties } = payload as { path: string; properties: Record<string, unknown> };
  const screener = getEnabledScreener(state);

  if (!screener.binds) screener.binds = [];

  let bind = screener.binds.find((b: any) => b.path === path) as any;
  if (!bind) {
    bind = { path };
    screener.binds.push(bind);
  }

  for (const [key, value] of Object.entries(properties)) {
    if (value === null) {
      delete bind[key];
    } else {
      bind[key] = value;
    }
  }

  return { rebuildComponentTree: false };
});

/**
 * **definition.addRoute** -- Append or insert a routing rule into the screener.
 *
 * Each route consists of a FEL `condition` expression (evaluated against screener
 * item values) and a `target` URI pointing to the form definition to navigate to
 * when the condition is satisfied. An optional `label` provides a human-readable
 * description. Routes are order-dependent -- the first route whose condition
 * evaluates to true wins.
 *
 * If `insertIndex` is provided, the route is spliced at that position; otherwise
 * it is appended to the end of the routes array.
 *
 * @param state   - The current project state (mutated in-place).
 * @param payload - `{ condition: string; target: string; label?: string; insertIndex?: number }`.
 * @throws {Error} If the screener is not enabled.
 * @returns `{ rebuildComponentTree: false }`.
 */
registerHandler('definition.addRoute', (state, payload) => {
  const p = payload as { condition: string; target: string; label?: string; insertIndex?: number };
  const screener = getEnabledScreener(state);

  const route: any = { condition: p.condition, target: p.target };
  if (p.label) route.label = p.label;

  if (p.insertIndex !== undefined) {
    screener.routes.splice(p.insertIndex, 0, route);
  } else {
    screener.routes.push(route);
  }

  return { rebuildComponentTree: false };
});

/**
 * **definition.setRouteProperty** -- Update a single property on an existing route.
 *
 * Targets a route by its zero-based index in the screener's `routes` array and
 * sets the specified property to the given value. Valid properties include
 * `condition` (FEL expression), `target` (URI), `label`, and `extensions`.
 *
 * @param state   - The current project state (mutated in-place).
 * @param payload - `{ index: number; property: string; value: unknown }`.
 * @throws {Error} If the screener is not enabled.
 * @throws {Error} If no route exists at the given index.
 * @returns `{ rebuildComponentTree: false }`.
 */
registerHandler('definition.setRouteProperty', (state, payload) => {
  const { index, property, value } = payload as { index: number; property: string; value: unknown };
  const screener = getEnabledScreener(state);

  const route = screener.routes[index];
  if (!route) throw new Error(`Route not found at index: ${index}`);

  (route as any)[property] = value;
  return { rebuildComponentTree: false };
});

/**
 * **definition.deleteRoute** -- Remove a routing rule by index.
 *
 * Removes the route at the given zero-based index from the screener's `routes`
 * array. A screener must always have at least one route, so attempting to delete
 * the last remaining route throws an error.
 *
 * @param state   - The current project state (mutated in-place).
 * @param payload - `{ index: number }`.
 * @throws {Error} If the screener is not enabled.
 * @throws {Error} If this is the last route (screeners require at least one route).
 * @returns `{ rebuildComponentTree: false }`.
 */
registerHandler('definition.deleteRoute', (state, payload) => {
  const { index } = payload as { index: number };
  const screener = getEnabledScreener(state);

  if (screener.routes.length <= 1) {
    throw new Error('Cannot delete the last route');
  }

  screener.routes.splice(index, 1);
  return { rebuildComponentTree: false };
});

/**
 * **definition.reorderRoute** -- Move a routing rule up or down in evaluation order.
 *
 * Since routes are evaluated in order (first match wins), reordering changes
 * routing precedence. Swaps the route at the given index with its neighbor in
 * the specified direction. If the swap would move the route out of bounds
 * (e.g., moving the first route up or the last route down), this is a no-op.
 *
 * @param state   - The current project state (mutated in-place).
 * @param payload - `{ index: number; direction: 'up' | 'down' }`.
 * @throws {Error} If the screener is not enabled.
 * @returns `{ rebuildComponentTree: false }`.
 */
registerHandler('definition.reorderRoute', (state, payload) => {
  const { index, direction } = payload as { index: number; direction: 'up' | 'down' };
  const screener = getEnabledScreener(state);

  const targetIdx = direction === 'up' ? index - 1 : index + 1;
  if (targetIdx < 0 || targetIdx >= screener.routes.length) return { rebuildComponentTree: false };

  [screener.routes[index], screener.routes[targetIdx]] = [screener.routes[targetIdx], screener.routes[index]];
  return { rebuildComponentTree: false };
});
