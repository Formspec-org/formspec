/**
 * Migration command handlers for Formspec Core.
 *
 * Migrations declare how to transform responses collected under a prior definition
 * version into the current version's structure. This enables backwards compatibility
 * when form definitions evolve: fields may be renamed, removed, split, merged, or
 * have their values recomputed.
 *
 * The schema models migrations as `{ from: { [version]: MigrationDescriptor } }` —
 * a keyed map where the version string is the key. Each descriptor contains an
 * ordered `fieldMap` array of transform rules plus optional `defaults` for new fields.
 *
 * None of these commands affect the component tree, so all handlers return
 * `{ rebuildComponentTree: false }`.
 *
 * @module definition-migrations
 */
import { registerHandler } from '../handler-registry.js';
import type { MigrationDescriptor } from 'formspec-types';

/**
 * Locate a migration descriptor by its source version key.
 *
 * @param state - The current project state containing the definition.
 * @param fromVersion - The source version string (key in `migrations.from`).
 * @returns The matching migration descriptor.
 * @throws {Error} If no migration exists for the given version.
 */
function findMigration(state: { definition: { migrations?: { from?: Record<string, MigrationDescriptor> } } }, fromVersion: string): MigrationDescriptor {
  const descriptor = state.definition.migrations?.from?.[fromVersion];
  if (!descriptor) throw new Error(`Migration not found for version: ${fromVersion}`);
  return descriptor;
}

/**
 * **definition.addMigration** -- Create a new migration descriptor for a specific
 * source version.
 *
 * Initialises the `migrations.from` map on the definition if it does not already
 * exist, then adds a new descriptor keyed by `fromVersion` with an empty `fieldMap`.
 * The caller typically follows up with `definition.addFieldMapRule` to populate
 * the transformation rules.
 *
 * @param payload.fromVersion - The version string this migration converts *from*.
 * @param payload.description - Optional human-readable summary of what changed.
 */
registerHandler('definition.addMigration', (state, payload) => {
  const p = payload as { fromVersion: string; description?: string };

  if (!state.definition.migrations) {
    state.definition.migrations = {};
  }
  if (!state.definition.migrations.from) {
    state.definition.migrations.from = {};
  }

  const descriptor: MigrationDescriptor = { fieldMap: [] };
  if (p.description) descriptor.description = p.description;

  state.definition.migrations.from[p.fromVersion] = descriptor;
  return { rebuildComponentTree: false };
});

/**
 * **definition.deleteMigration** -- Remove a migration descriptor identified by
 * its `fromVersion` key.
 *
 * Deletes the key from the `migrations.from` map. If the map does not exist or
 * has no such key, this is a no-op.
 *
 * @param payload.fromVersion - The version string of the migration to remove.
 */
registerHandler('definition.deleteMigration', (state, payload) => {
  const { fromVersion } = payload as { fromVersion: string };
  if (!state.definition.migrations?.from) return { rebuildComponentTree: false };

  delete state.definition.migrations.from[fromVersion];
  return { rebuildComponentTree: false };
});

/**
 * **definition.setMigrationProperty** -- Update a scalar property on a migration
 * descriptor (e.g. `description` or `extensions`).
 *
 * @param payload.fromVersion - Identifies the target migration.
 * @param payload.property - The property name to set (e.g. `"description"`).
 * @param payload.value - The new value for the property.
 * @throws {Error} If no migration exists for the given `fromVersion`.
 */
registerHandler('definition.setMigrationProperty', (state, payload) => {
  const { fromVersion, property, value } = payload as {
    fromVersion: string; property: string; value: unknown;
  };
  const descriptor = findMigration(state, fromVersion);
  (descriptor as any)[property] = value;
  return { rebuildComponentTree: false };
});

/**
 * **definition.addFieldMapRule** -- Append (or insert) a field mapping rule into a
 * migration's `fieldMap` array.
 *
 * Each rule describes how a single field's value travels from the old version to the
 * new one:
 * - `transform: 'preserve'` -- copy the value as-is from `source` to `target`.
 * - `transform: 'drop'` -- discard the source field (`target` is `null`).
 * - `transform: 'expression'` -- compute the target value using a FEL expression.
 *
 * @param payload.fromVersion - Identifies the parent migration.
 * @param payload.source - Field path in the source (old) version's response.
 * @param payload.target - Field path in the target (current) version, or `null` to drop.
 * @param payload.transform - One of `'preserve'`, `'drop'`, or `'expression'`.
 * @param payload.expression - FEL expression (required when `transform` is `'expression'`).
 * @param payload.insertIndex - Position to splice into `fieldMap`; omit to append.
 * @throws {Error} If no migration exists for the given `fromVersion`.
 */
registerHandler('definition.addFieldMapRule', (state, payload) => {
  const p = payload as {
    fromVersion: string; source: string; target: string | null;
    transform: string; expression?: string; insertIndex?: number;
  };
  const descriptor = findMigration(state, p.fromVersion);

  if (!descriptor.fieldMap) descriptor.fieldMap = [];

  const rule: any = { source: p.source, target: p.target, transform: p.transform };
  if (p.expression) rule.expression = p.expression;

  if (p.insertIndex !== undefined) {
    descriptor.fieldMap.splice(p.insertIndex, 0, rule);
  } else {
    descriptor.fieldMap.push(rule);
  }

  return { rebuildComponentTree: false };
});

/**
 * **definition.setFieldMapRule** -- Update a single property on an existing field-map
 * rule within a migration's `fieldMap` array.
 *
 * Typical editable properties: `source`, `target`, `transform`, `expression`.
 *
 * @param payload.fromVersion - Identifies the parent migration.
 * @param payload.index - Zero-based index of the rule in the `fieldMap` array.
 * @param payload.property - The rule property to update.
 * @param payload.value - The new value.
 * @throws {Error} If no migration exists for the given `fromVersion`.
 * @throws {Error} If no rule exists at the given index.
 */
registerHandler('definition.setFieldMapRule', (state, payload) => {
  const { fromVersion, index, property, value } = payload as {
    fromVersion: string; index: number; property: string; value: unknown;
  };
  const descriptor = findMigration(state, fromVersion);
  const rule = descriptor.fieldMap?.[index];
  if (!rule) throw new Error(`Rule not found at index: ${index}`);

  (rule as any)[property] = value;
  return { rebuildComponentTree: false };
});

/**
 * **definition.deleteFieldMapRule** -- Remove a field-map rule from a migration's
 * `fieldMap` array by index.
 *
 * @param payload.fromVersion - Identifies the parent migration.
 * @param payload.index - Zero-based index of the rule to remove.
 * @throws {Error} If no migration exists for the given `fromVersion`.
 */
registerHandler('definition.deleteFieldMapRule', (state, payload) => {
  const { fromVersion, index } = payload as { fromVersion: string; index: number };
  const descriptor = findMigration(state, fromVersion);

  descriptor.fieldMap?.splice(index, 1);
  return { rebuildComponentTree: false };
});

/**
 * **definition.setMigrationDefaults** -- Set literal default values for fields that
 * are new in the current version and have no source in the old version.
 *
 * The `defaults` object is a map of target field paths to their default values.
 * Overwrites any previously stored defaults for this migration.
 *
 * @param payload.fromVersion - Identifies the parent migration.
 * @param payload.defaults - Record mapping target field paths to default values.
 * @throws {Error} If no migration exists for the given `fromVersion`.
 */
registerHandler('definition.setMigrationDefaults', (state, payload) => {
  const { fromVersion, defaults } = payload as { fromVersion: string; defaults: Record<string, unknown> };
  const descriptor = findMigration(state, fromVersion);

  (descriptor as any).defaults = defaults;
  return { rebuildComponentTree: false };
});
