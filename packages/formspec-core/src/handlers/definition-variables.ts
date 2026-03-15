/**
 * Command handlers for managing definition-level variables.
 *
 * Variables are form-level constants or computed values defined in the
 * `definition.variables` array. Each variable has a `name` and a FEL
 * (Formspec Expression Language) `expression` that can be referenced
 * from bind expressions, shape constraints, and other FEL contexts
 * throughout the form definition. An optional `scope` restricts
 * visibility to a specific section of the form.
 *
 * Variables do not affect the component tree layout, so all handlers
 * in this module return `{ rebuildComponentTree: false }`.
 *
 * @module definition-variables
 */
import { registerHandler } from '../handler-registry.js';
import type { FormspecVariable } from 'formspec-engine';

/** Auto-incrementing counter used to generate default variable names when none is provided. */
let varCounter = 0;

/**
 * **Command: `definition.addVariable`**
 *
 * Appends a new variable to `definition.variables`. If the `name` field is
 * omitted from the payload, a unique name is auto-generated (e.g. `var_1`,
 * `var_2`). If the `expression` field is omitted, it defaults to an empty
 * string. The optional `scope` field restricts the variable's visibility.
 *
 * @param state   - The current project state (mutated in place).
 * @param payload - `{ name?: string; expression?: string; scope?: string }`
 * @returns `{ rebuildComponentTree: false }` -- variables do not affect component layout.
 */
registerHandler('definition.addVariable', (state, payload) => {
  const p = payload as Record<string, unknown>;
  if (!state.definition.variables) state.definition.variables = [];

  const variable: FormspecVariable = {
    name: (p.name as string) ?? `var_${++varCounter}`,
    expression: (p.expression as string) ?? '',
  };

  if (p.scope) variable.scope = p.scope as string;

  state.definition.variables.push(variable);
  return { rebuildComponentTree: false };
});

/**
 * **Command: `definition.setVariable`**
 *
 * Updates a single property on an existing variable identified by `name`.
 * Valid properties include `expression`, `scope`, `name`, and `extensions`.
 *
 * @param state   - The current project state (mutated in place).
 * @param payload - `{ name: string; property: string; value: unknown }`
 *                  where `name` identifies the target variable, `property`
 *                  is the field to update, and `value` is the new value.
 * @throws Error if no variable with the given `name` exists.
 * @returns `{ rebuildComponentTree: false }` -- variables do not affect component layout.
 */
registerHandler('definition.setVariable', (state, payload) => {
  const { name, property, value } = payload as { name: string; property: string; value: unknown };
  const variable = state.definition.variables?.find(v => v.name === name);
  if (!variable) throw new Error(`Variable not found: ${name}`);

  (variable as any)[property] = value;
  return { rebuildComponentTree: false };
});

/**
 * **Command: `definition.deleteVariable`**
 *
 * Removes a variable from `definition.variables` by name. If the variables
 * array does not exist, this is a no-op. Note: other FEL expressions that
 * reference the deleted variable are not automatically rewritten; stale
 * references surface as diagnostics rather than blocking deletion.
 *
 * @param state   - The current project state (mutated in place).
 * @param payload - `{ name: string }` identifying the variable to remove.
 * @returns `{ rebuildComponentTree: false }` -- variables do not affect component layout.
 */
registerHandler('definition.deleteVariable', (state, payload) => {
  const { name } = payload as { name: string };
  if (!state.definition.variables) return { rebuildComponentTree: false };

  state.definition.variables = state.definition.variables.filter(v => v.name !== name);
  return { rebuildComponentTree: false };
});
