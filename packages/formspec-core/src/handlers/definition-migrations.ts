/**
 * Migration command handlers for Formspec Studio Core.
 *
 * Migrations declare how to transform responses collected under a prior definition
 * version into the current version's structure. This enables backwards compatibility
 * when form definitions evolve: fields may be renamed, removed, split, merged, or
 * have their values recomputed. Each migration descriptor targets a specific
 * `fromVersion` and contains an ordered list of field-map rules (the `changes` array)
 * plus optional literal defaults for newly introduced fields.
 *
 * None of these commands affect the component tree, so all handlers return
 * `{ rebuildComponentTree: false }`.
 *
 * @module definition-migrations
 */
import { registerHandler } from '../handler-registry.js';

/**
 * Locate a migration descriptor within `state.definition.migrations` by its
 * `fromVersion` identifier.
 *
 * @param state - The current project state containing the definition.
 * @param fromVersion - The source version string that identifies the migration.
 * @returns The matching migration object.
 * @throws {Error} If no migration exists for the given `fromVersion`.
 */
function findMigration(state: any, fromVersion: string) {
  const migration = state.definition.migrations?.find((m: any) => m.fromVersion === fromVersion);
  if (!migration) throw new Error(`Migration not found for version: ${fromVersion}`);
  return migration;
}

/**
 * **definition.addMigration** -- Create a new migration descriptor for a specific
 * source version.
 *
 * Initialises the `migrations` array on the definition if it does not already exist,
 * then appends a new descriptor with an empty `changes` array. The caller typically
 * follows up with `definition.addFieldMapRule` to populate the transformation rules.
 *
 * @param payload.fromVersion - The version string this migration converts *from*.
 * @param payload.description - Optional human-readable summary of what changed.
 */
registerHandler('definition.addMigration', (state, payload) => {
  const p = payload as { fromVersion: string; description?: string };
  if (!state.definition.migrations) {
    state.definition.migrations = [];
  }

  const migration: any = { fromVersion: p.fromVersion, changes: [] };
  if (p.description) migration.description = p.description;

  state.definition.migrations.push(migration);
  return { rebuildComponentTree: false };
});

/**
 * **definition.deleteMigration** -- Remove a migration descriptor identified by
 * its `fromVersion` string.
 *
 * Filters the descriptor out of the `migrations` array. If the array does not
 * exist, this is a no-op.
 *
 * @param payload.fromVersion - The version string of the migration to remove.
 */
registerHandler('definition.deleteMigration', (state, payload) => {
  const { fromVersion } = payload as { fromVersion: string };
  if (!state.definition.migrations) return { rebuildComponentTree: false };

  state.definition.migrations = state.definition.migrations.filter(
    (m: any) => m.fromVersion !== fromVersion,
  );
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
  const migration = findMigration(state, fromVersion);
  migration[property] = value;
  return { rebuildComponentTree: false };
});

/**
 * **definition.addFieldMapRule** -- Append (or insert) a field mapping rule into a
 * migration's `changes` array.
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
 * @param payload.insertIndex - Position to splice into `changes`; omit to append.
 * @throws {Error} If no migration exists for the given `fromVersion`.
 */
registerHandler('definition.addFieldMapRule', (state, payload) => {
  const p = payload as {
    fromVersion: string; source: string; target: string | null;
    transform: string; expression?: string; insertIndex?: number;
  };
  const migration = findMigration(state, p.fromVersion);

  const rule: any = { type: 'fieldMap', source: p.source, target: p.target, transform: p.transform };
  if (p.expression) rule.expression = p.expression;

  if (p.insertIndex !== undefined) {
    migration.changes.splice(p.insertIndex, 0, rule);
  } else {
    migration.changes.push(rule);
  }

  return { rebuildComponentTree: false };
});

/**
 * **definition.setFieldMapRule** -- Update a single property on an existing field-map
 * rule within a migration's `changes` array.
 *
 * Typical editable properties: `source`, `target`, `transform`, `expression`.
 *
 * @param payload.fromVersion - Identifies the parent migration.
 * @param payload.index - Zero-based index of the rule in the `changes` array.
 * @param payload.property - The rule property to update.
 * @param payload.value - The new value.
 * @throws {Error} If no migration exists for the given `fromVersion`.
 * @throws {Error} If no rule exists at the given index.
 */
registerHandler('definition.setFieldMapRule', (state, payload) => {
  const { fromVersion, index, property, value } = payload as {
    fromVersion: string; index: number; property: string; value: unknown;
  };
  const migration = findMigration(state, fromVersion);
  const rule = migration.changes[index];
  if (!rule) throw new Error(`Rule not found at index: ${index}`);

  rule[property] = value;
  return { rebuildComponentTree: false };
});

/**
 * **definition.deleteFieldMapRule** -- Remove a field-map rule from a migration's
 * `changes` array by index.
 *
 * @param payload.fromVersion - Identifies the parent migration.
 * @param payload.index - Zero-based index of the rule to remove.
 * @throws {Error} If no migration exists for the given `fromVersion`.
 */
registerHandler('definition.deleteFieldMapRule', (state, payload) => {
  const { fromVersion, index } = payload as { fromVersion: string; index: number };
  const migration = findMigration(state, fromVersion);

  migration.changes.splice(index, 1);
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
  const migration = findMigration(state, fromVersion);

  migration.defaults = defaults;
  return { rebuildComponentTree: false };
});
