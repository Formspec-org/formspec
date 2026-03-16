/**
 * Command handlers for managing definition-level shapes (cross-field validation rules).
 *
 * Shapes are form-level constraints defined in `definition.shapes`. Unlike
 * field-level bind constraints (required, constraint, readonly), shapes
 * express cross-field or form-wide validation rules. Each shape targets one
 * or more fields via a path expression (supporting wildcards like
 * `items[*].field`), contains a FEL constraint expression that must evaluate
 * to true for the form to be valid, and carries a human-readable message
 * with a severity level (`error`, `warning`, or `info`).
 *
 * Shapes can be composed using boolean combinators (`and`, `or`, `xone`,
 * `not`) that reference other shapes by ID, enabling complex validation
 * logic to be built from smaller, reusable rules.
 *
 * Shapes do not affect the component tree layout, so all handlers in this
 * module return `{ rebuildComponentTree: false }`.
 *
 * @module definition-shapes
 */
import { registerHandler } from '../handler-registry.js';
import type { FormShape } from 'formspec-types';

/** Auto-incrementing counter used to generate default shape IDs when none is provided. */
let shapeCounter = 0;

/**
 * **Command: `definition.addShape`**
 *
 * Appends a new shape (cross-field validation rule) to `definition.shapes`.
 * If `id` is omitted, a unique ID is auto-generated (e.g. `shape_1`).
 * The `target` field is required and specifies which field(s) the shape
 * applies to (supports path wildcards). The `severity` defaults to `'error'`
 * and `message` defaults to an empty string.
 *
 * Optional fields:
 * - `constraint` -- a FEL boolean expression that must be true for validity.
 * - `code` -- a machine-readable error code for programmatic handling.
 * - `activeWhen` -- a FEL boolean expression; the shape only fires when this is true.
 * - `timing` -- when to evaluate: `'continuous'`, `'submit'`, or `'demand'`.
 * - `context` -- a key-to-FEL-expression map providing additional diagnostic data.
 *
 * @param state   - The current project state (mutated in place).
 * @param payload - `AddShapePayload` with required `target` and optional shape properties.
 * @returns `{ rebuildComponentTree: false }` -- shapes do not affect component layout.
 */
registerHandler('definition.addShape', (state, payload) => {
  const p = payload as Record<string, unknown>;
  if (!state.definition.shapes) state.definition.shapes = [];

  const shape: FormShape = {
    id: (p.id as string) ?? `shape_${++shapeCounter}`,
    target: p.target as string,
    message: (p.message as string) ?? '',
    severity: (p.severity as 'error' | 'warning' | 'info') ?? 'error',
  };

  if (p.constraint) shape.constraint = p.constraint as string;
  if (p.code) shape.code = p.code as string;
  if (p.activeWhen) shape.activeWhen = p.activeWhen as string;
  if (p.timing) shape.timing = p.timing as 'continuous' | 'submit' | 'demand';
  if (p.context) shape.context = p.context as Record<string, string>;

  state.definition.shapes.push(shape);
  return { rebuildComponentTree: false };
});

/**
 * **Command: `definition.setShapeProperty`**
 *
 * Updates a single property on an existing shape identified by `id`.
 * Valid properties include `constraint`, `message`, `severity`, `target`,
 * `code`, `context`, `activeWhen`, `timing`, and `extensions`.
 *
 * @param state   - The current project state (mutated in place).
 * @param payload - `{ id: string; property: string; value: unknown }`
 *                  where `id` identifies the target shape, `property`
 *                  is the field to update, and `value` is the new value.
 * @throws Error if no shape with the given `id` exists.
 * @returns `{ rebuildComponentTree: false }` -- shapes do not affect component layout.
 */
registerHandler('definition.setShapeProperty', (state, payload) => {
  const { id, property, value } = payload as { id: string; property: string; value: unknown };
  const shape = state.definition.shapes?.find(s => s.id === id);
  if (!shape) throw new Error(`Shape not found: ${id}`);

  (shape as any)[property] = value;
  return { rebuildComponentTree: false };
});

/**
 * **Command: `definition.setShapeComposition`**
 *
 * Replaces a shape's direct `constraint` with a boolean composition over
 * other shapes. This clears any existing constraint and all prior composition
 * fields (`and`, `or`, `xone`, `not`) before applying the new mode.
 *
 * Composition modes:
 * - `and` -- all referenced shapes must pass (logical AND).
 * - `or` -- at least one referenced shape must pass (logical OR).
 * - `xone` -- exactly one referenced shape must pass (exclusive OR).
 * - `not` -- the single referenced shape must fail (logical NOT); uses
 *   `ref` (singular) instead of `refs`.
 *
 * @param state   - The current project state (mutated in place).
 * @param payload - `SetShapeCompositionPayload`: either
 *                  `{ id, mode: 'and'|'or'|'xone', refs: string[] }` or
 *                  `{ id, mode: 'not', ref: string }`.
 * @throws Error if no shape with the given `id` exists.
 * @returns `{ rebuildComponentTree: false }` -- shapes do not affect component layout.
 */
registerHandler('definition.setShapeComposition', (state, payload) => {
  const p = payload as { id: string; mode: string; refs?: string[]; ref?: string };
  const shape = state.definition.shapes?.find(s => s.id === p.id);
  if (!shape) throw new Error(`Shape not found: ${p.id}`);

  // Clear all composition modes and constraint
  delete shape.and;
  delete shape.or;
  delete shape.xone;
  delete shape.not;
  delete shape.constraint;

  if (p.mode === 'not') {
    shape.not = p.ref!;
  } else {
    (shape as any)[p.mode] = p.refs;
  }

  return { rebuildComponentTree: false };
});

/**
 * **Command: `definition.renameShape`**
 *
 * Changes a shape's `id` and rewrites all composition references across
 * every other shape in the definition. Any `and`, `or`, `xone`, or `not`
 * reference pointing to the old ID is updated to the new ID, ensuring
 * referential integrity of shape compositions.
 *
 * @param state   - The current project state (mutated in place).
 * @param payload - `{ id: string; newId: string }` where `id` is the
 *                  current shape identifier and `newId` is the replacement.
 * @throws Error if no shape with the given `id` exists.
 * @returns `{ rebuildComponentTree: false }` -- shapes do not affect component layout.
 */
registerHandler('definition.renameShape', (state, payload) => {
  const { id, newId } = payload as { id: string; newId: string };
  const shapes = state.definition.shapes;
  if (!shapes) throw new Error(`Shape not found: ${id}`);

  const shape = shapes.find(s => s.id === id);
  if (!shape) throw new Error(`Shape not found: ${id}`);

  shape.id = newId;

  // Rewrite composition references in all other shapes
  for (const s of shapes) {
    if (s.and) s.and = s.and.map(r => r === id ? newId : r);
    if (s.or) s.or = s.or.map(r => r === id ? newId : r);
    if (s.xone) s.xone = s.xone.map(r => r === id ? newId : r);
    if (s.not === id) s.not = newId;
  }

  return { rebuildComponentTree: false };
});

/**
 * **Command: `definition.deleteShape`**
 *
 * Removes a shape from `definition.shapes` by ID and cleans up all
 * composition references to the deleted shape across remaining shapes.
 * Specifically, the deleted shape's ID is filtered out of `and`, `or`,
 * and `xone` arrays, and any `not` reference pointing to it is removed.
 *
 * If the shapes array does not exist, this is a no-op.
 *
 * @param state   - The current project state (mutated in place).
 * @param payload - `{ id: string }` identifying the shape to remove.
 * @returns `{ rebuildComponentTree: false }` -- shapes do not affect component layout.
 */
registerHandler('definition.deleteShape', (state, payload) => {
  const { id } = payload as { id: string };
  if (!state.definition.shapes) return { rebuildComponentTree: false };

  state.definition.shapes = state.definition.shapes.filter(s => s.id !== id);

  // Remove from compositions referencing deleted shape
  for (const s of state.definition.shapes) {
    if (s.and) s.and = s.and.filter(r => r !== id);
    if (s.or) s.or = s.or.filter(r => r !== id);
    if (s.xone) s.xone = s.xone.filter(r => r !== id);
    if (s.not === id) delete s.not;
  }

  return { rebuildComponentTree: false };
});
