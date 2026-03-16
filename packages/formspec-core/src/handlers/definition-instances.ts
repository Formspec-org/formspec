/**
 * Instance command handlers for Formspec Studio Core.
 *
 * Instances are named external data sources declared in a form definition. FEL
 * expressions reference them via `@instance('name')` to read (or, when
 * `readonly: false`, write) data that lives outside the form's own item tree.
 * Common use cases include pre-populating fields from a patient record, looking
 * up reference data, or exposing a writable scratch-pad for intermediate
 * calculations.
 *
 * Each instance can point to an external URI (`source`), carry inline `data`,
 * declare a JSON Schema for its structure, and be marked `static` (a caching
 * hint) or `readonly` (default `true`).
 *
 * None of these commands affect the component tree, so all handlers return
 * `{ rebuildComponentTree: false }`.
 *
 * @module definition-instances
 */
import { registerHandler } from '../handler-registry.js';
import { rewriteFELReferences } from 'formspec-engine';
import type { FormItem } from 'formspec-types';

/**
 * Monotonically increasing counter for auto-generating instance names when the
 * caller does not provide one.
 */
let instanceCounter = 0;

/**
 * **definition.addInstance** -- Create a named external data source instance on
 * the definition.
 *
 * Initialises the `instances` map on the definition if it does not already exist,
 * then adds the new instance under the provided (or auto-generated) name. Only
 * properties that are explicitly present in the payload are written to the
 * instance object, keeping the definition minimal.
 *
 * @param payload.name - Instance name; auto-generated as `instance_N` if omitted.
 * @param payload.source - URI pointing to the external data source.
 * @param payload.schema - JSON Schema describing the instance data structure.
 * @param payload.data - Inline data (mutually exclusive with `source` at load time).
 * @param payload.static - Caching hint: `true` if the data is unlikely to change.
 * @param payload.readonly - Whether the instance is read-only (default `true`);
 *   set to `false` to enable a writable scratch-pad.
 * @param payload.description - Human-readable description of the instance.
 * @param payload.extensions - Extension properties (e.g. custom metadata).
 */
registerHandler('definition.addInstance', (state, payload) => {
  const p = payload as Record<string, unknown>;
  if (!state.definition.instances) {
    state.definition.instances = {};
  }

  const name = (p.name as string) ?? `instance_${++instanceCounter}`;
  const instance: Record<string, unknown> = {};

  if (p.source !== undefined) instance.source = p.source;
  if (p.schema !== undefined) instance.schema = p.schema;
  if (p.data !== undefined) instance.data = p.data;
  if (p.static !== undefined) instance.static = p.static;
  if (p.readonly !== undefined) instance.readonly = p.readonly;
  if (p.description !== undefined) instance.description = p.description;
  if (p.extensions !== undefined) instance.extensions = p.extensions;

  state.definition.instances[name] = instance as any;
  return { rebuildComponentTree: false };
});

/**
 * **definition.setInstance** -- Update a single property on an existing instance.
 *
 * Writable properties include: `source`, `schema`, `data`, `static`, `readonly`,
 * `description`, and `extensions`. Setting a value to `null` or `undefined`
 * deletes the property from the instance.
 *
 * @param payload.name - The instance name to update.
 * @param payload.property - The property to set or delete.
 * @param payload.value - The new value, or `null`/`undefined` to remove.
 * @throws {Error} If no instance exists with the given name.
 */
registerHandler('definition.setInstance', (state, payload) => {
  const { name, property, value } = payload as { name: string; property: string; value: unknown };
  const instances = state.definition.instances;
  if (!instances?.[name]) throw new Error(`Instance not found: ${name}`);

  if (value === null || value === undefined) {
    delete (instances[name] as any)[property];
  } else {
    (instances[name] as any)[property] = value;
  }

  return { rebuildComponentTree: false };
});

/**
 * **definition.renameInstance** -- Rename an instance and rewrite all FEL
 * references throughout the definition.
 *
 * Moves the instance object from the old key to the new key in the `instances`
 * map, then performs a global find-and-replace of `@instance('oldName')` with
 * `@instance('newName')` across every FEL-bearing property in the definition:
 *
 * - **Binds**: `calculate`, `relevant`, `required`, `readonly`, `constraint`
 * - **Shapes**: `constraint`, `activeWhen`
 * - **Variables**: `expression`
 *
 * The old name is regex-escaped to handle special characters safely. Both
 * single- and double-quoted instance references are matched.
 *
 * @param payload.name - The current instance name.
 * @param payload.newName - The desired new name.
 * @throws {Error} If no instance exists with the given name.
 */
registerHandler('definition.renameInstance', (state, payload) => {
  const { name, newName } = payload as { name: string; newName: string };
  const instances = state.definition.instances;
  if (!instances?.[name]) throw new Error(`Instance not found: ${name}`);

  instances[newName] = instances[name];
  delete instances[name];

  const rewrite = (expr: string): string =>
    rewriteFELReferences(expr, {
      rewriteInstanceName(instanceName) {
        return instanceName === name ? newName : instanceName;
      },
    });

  // Binds
  for (const bind of state.definition.binds ?? []) {
    const b = bind as any;
    for (const prop of ['calculate', 'relevant', 'required', 'readonly', 'constraint']) {
      if (b[prop] && typeof b[prop] === 'string') {
        b[prop] = rewrite(b[prop]);
      }
    }
    if (typeof b.default === 'string' && b.default.startsWith('=')) {
      b.default = '=' + rewrite(b.default.slice(1));
    }
  }

  // Shapes
  for (const shape of state.definition.shapes ?? []) {
    const s = shape as any;
    if (s.constraint && typeof s.constraint === 'string') s.constraint = rewrite(s.constraint);
    if (s.activeWhen && typeof s.activeWhen === 'string') s.activeWhen = rewrite(s.activeWhen);
    if (s.context && typeof s.context === 'object') {
      for (const [key, value] of Object.entries(s.context as Record<string, unknown>)) {
        if (typeof value === 'string') s.context[key] = rewrite(value);
      }
    }
  }

  // Variables
  for (const v of state.definition.variables ?? []) {
    const va = v as any;
    if (va.expression && typeof va.expression === 'string') va.expression = rewrite(va.expression);
  }

  // Item-level FEL-bearing properties.
  const rewriteItemExpressions = (items: FormItem[]) => {
    for (const item of items) {
      const dynamic = item as any;
      for (const prop of ['relevant', 'required', 'readonly', 'calculate', 'constraint']) {
        if (typeof dynamic[prop] === 'string') {
          dynamic[prop] = rewrite(dynamic[prop]);
        }
      }
      if (typeof dynamic.initialValue === 'string' && dynamic.initialValue.startsWith('=')) {
        dynamic.initialValue = '=' + rewrite(dynamic.initialValue.slice(1));
      }
      if (item.children) rewriteItemExpressions(item.children);
    }
  };
  rewriteItemExpressions(state.definition.items);

  // Screener routes.
  const screenerRoutes = state.definition.screener?.routes;
  if (Array.isArray(screenerRoutes)) {
    for (const route of screenerRoutes) {
      if (typeof route.condition === 'string') {
        route.condition = rewrite(route.condition);
      }
    }
  }

  // Mapping expressions.
  const rules = (state.mapping as any).rules as any[] | undefined;
  if (rules) {
    for (const rule of rules) {
      for (const prop of ['expression', 'condition']) {
        if (typeof rule[prop] === 'string') {
          rule[prop] = rewrite(rule[prop]);
        }
      }
      if (rule.reverse && typeof rule.reverse === 'object') {
        for (const prop of ['expression', 'condition']) {
          if (typeof rule.reverse[prop] === 'string') {
            rule.reverse[prop] = rewrite(rule.reverse[prop]);
          }
        }
      }
      if (Array.isArray(rule.innerRules)) {
        for (const inner of rule.innerRules) {
          for (const prop of ['expression', 'condition']) {
            if (typeof inner[prop] === 'string') {
              inner[prop] = rewrite(inner[prop]);
            }
          }
        }
      }
    }
  }

  return { rebuildComponentTree: false };
});

/**
 * **definition.deleteInstance** -- Remove an instance from the definition by name.
 *
 * Deletes the instance entry from the `instances` map. This is a silent no-op if
 * the `instances` map does not exist. Note that FEL expressions referencing the
 * deleted instance (via `@instance('name')`) are NOT automatically cleaned up;
 * diagnostics will surface those as errors.
 *
 * @param payload.name - The instance name to delete.
 */
registerHandler('definition.deleteInstance', (state, payload) => {
  const { name } = payload as { name: string };
  if (state.definition.instances) {
    delete state.definition.instances[name];
  }
  return { rebuildComponentTree: false };
});
