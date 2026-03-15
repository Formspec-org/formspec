/**
 * Handlers for definition bind management and field configuration commands.
 *
 * **Binds** in Formspec are declarative rules that connect a field (identified by
 * a dot-path) to dynamic behaviors: calculated values, relevance conditions,
 * required/readonly state, validation constraints, default values, and various
 * processing directives. Each bind entry targets a single path and carries one
 * or more property expressions (typically FEL strings). The binds array lives at
 * `definition.binds` and is the primary mechanism for making fields reactive.
 *
 * This module also registers handlers for direct field/item property editing
 * (data type, options, extensions) which operate on the `definition.items` tree
 * rather than the binds array.
 *
 * @module definition-binds
 */

import { registerHandler } from '../handler-registry.js';
import { resolveItemLocation } from './helpers.js';
import type { FormspecBind, FormspecItem } from 'formspec-engine';

// ── setBind ──────────────────────────────────────────────────────────

/**
 * **Command: `definition.setBind`**
 *
 * Sets one or more bind properties on a target path. Binds are the Formspec
 * mechanism for attaching dynamic behavior (calculation, validation, visibility,
 * etc.) to fields and groups.
 *
 * **Payload shape (`SetBindPayload`):**
 * - `path` -- Dot-path identifying the target field or group. Wildcards are
 *   allowed (e.g. `'items[*].amount'`) to bind multiple fields at once.
 * - `properties` -- A partial map of bind property names to their values.
 *   Each value is typically a FEL expression string. Supported properties:
 *   - `calculate`  -- FEL expression whose result continuously updates the field value.
 *   - `relevant`   -- FEL boolean; when false, the field is hidden and its value
 *                     is governed by `nonRelevantBehavior`.
 *   - `required`   -- FEL boolean; when true, the field must have a value.
 *   - `readonly`   -- FEL boolean; when true, the field is not user-editable.
 *   - `constraint` -- FEL boolean that must be true for the field value to be valid.
 *   - `constraintMessage` -- Human-readable message shown when `constraint` fails.
 *   - `default`    -- Value applied when a field transitions from non-relevant to relevant.
 *   - `nonRelevantBehavior` -- `'remove'` | `'empty'` | `'keep'`; controls what
 *                     happens to the field value when relevance becomes false.
 *   - `whitespace` -- `'preserve'` | `'trim'` | `'normalize'` | `'remove'`;
 *                     whitespace handling for string values.
 *   - `excludedValue` -- `'preserve'` | `'null'`; controls excluded option values.
 *   - `disabledDisplay` -- `'hidden'` | `'protected'`; how disabled fields render.
 *   - `extensions` -- `Record<string, unknown>`; extension properties (x-prefixed).
 *
 * **Null-removal semantics:** Setting any property to `null` removes that property
 * from the bind entry. If removing a property leaves only `path` (no other keys),
 * the entire bind entry is deleted from the array -- keeping the binds array clean.
 *
 * **Upsert behavior:** If no bind exists for the given path, a new entry is created.
 * If one already exists, its properties are merged with the provided values.
 *
 * @returns `{ rebuildComponentTree: false }` -- Bind changes do not alter the
 * component tree structure; they affect runtime behavior only.
 */
registerHandler('definition.setBind', (state, payload) => {
  const { path, properties } = payload as {
    path: string;
    properties: Record<string, unknown>;
  };

  const binds = (state.definition.binds ??= []);

  let bind = binds.find(b => b.path === path);
  if (!bind) {
    bind = { path };
    binds.push(bind);
  }

  // Apply properties — null removes
  for (const [key, value] of Object.entries(properties)) {
    if (value === null) {
      delete (bind as any)[key];
    } else {
      (bind as any)[key] = value;
    }
  }

  // If only 'path' remains, remove the bind entry
  const keys = Object.keys(bind).filter(k => k !== 'path');
  if (keys.length === 0) {
    state.definition.binds = binds.filter((b: FormspecBind) => b !== bind);
  }

  return { rebuildComponentTree: false };
});

// ── setItemProperty ──────────────────────────────────────────────────

/** Properties accepted on any item type by `definition.setItemProperty`. */
const COMMON_ITEM_PROPERTIES = new Set([
  'label',
  'description',
  'hint',
  'labels',
  'presentation',
  'relevant',
  'required',
  'readonly',
  'calculate',
  'constraint',
  'constraintMessage',
  'initialValue',
]);

/** Properties restricted to field items. */
const FIELD_ONLY_PROPERTIES = new Set([
  'dataType',
  'currency',
  'precision',
  'prefix',
  'suffix',
  'semanticType',
  'prePopulate',
  'optionSet',
  'options',
]);

/** Properties restricted to group items. */
const GROUP_ONLY_PROPERTIES = new Set([
  'repeatable',
  'minRepeat',
  'maxRepeat',
]);

/** Reject attempts to write structurally invalid properties onto an item. */
function assertPropertyApplicable(item: FormspecItem, propertyPath: string): void {
  const rootProperty = propertyPath.split('.').filter(Boolean)[0];
  if (!rootProperty) {
    throw new Error('Property path cannot be empty');
  }
  if (rootProperty.startsWith('x-')) return;
  if (rootProperty === 'children') {
    throw new Error('children is managed structurally and cannot be set with definition.setItemProperty');
  }
  if (COMMON_ITEM_PROPERTIES.has(rootProperty)) return;
  if (FIELD_ONLY_PROPERTIES.has(rootProperty) && item.type !== 'field') {
    throw new Error(`Property "${rootProperty}" is only valid for field items`);
  }
  if (GROUP_ONLY_PROPERTIES.has(rootProperty) && item.type !== 'group') {
    throw new Error(`Property "${rootProperty}" is only valid for group items`);
  }
}

/** Delete a nested property and prune any parent objects left empty by that removal. */
function deleteNestedProperty(target: Record<string, unknown>, segments: string[]): void {
  const stack: Array<{ obj: Record<string, unknown>; key: string }> = [];
  let cursor: Record<string, unknown> = target;

  for (let i = 0; i < segments.length - 1; i++) {
    const key = segments[i];
    const next = cursor[key];
    if (!next || typeof next !== 'object' || Array.isArray(next)) return;
    stack.push({ obj: cursor, key });
    cursor = next as Record<string, unknown>;
  }

  delete cursor[segments[segments.length - 1]];

  // Prune empty parent objects so clearing `presentation.widget`, for example,
  // does not leave behind `{ presentation: {} }`.
  for (let i = stack.length - 1; i >= 0; i--) {
    const { obj, key } = stack[i];
    const candidate = obj[key];
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) break;
    if (Object.keys(candidate as Record<string, unknown>).length > 0) break;
    delete obj[key];
  }
}

/** Set or clear a dotted property path on an item, creating intermediate objects as needed. */
function setNestedProperty(target: Record<string, unknown>, propertyPath: string, value: unknown): void {
  const segments = propertyPath.split('.').filter(Boolean);
  if (segments.length === 0) {
    throw new Error('Property path cannot be empty');
  }

  if (value === null || value === undefined) {
    deleteNestedProperty(target, segments);
    return;
  }

  let cursor: Record<string, unknown> = target;
  for (let i = 0; i < segments.length - 1; i++) {
    const key = segments[i];
    const existing = cursor[key];

    // Materialize missing intermediate objects so callers can assign deep
    // properties like `presentation.widget` in one command.
    if (existing === undefined || existing === null) {
      const nested: Record<string, unknown> = {};
      cursor[key] = nested;
      cursor = nested;
      continue;
    }

    if (typeof existing !== 'object' || Array.isArray(existing)) {
      throw new Error(`Cannot assign nested property "${propertyPath}" through non-object "${key}"`);
    }

    cursor = existing as Record<string, unknown>;
  }

  cursor[segments[segments.length - 1]] = value;
}

/**
 * **Command: `definition.setItemProperty`**
 *
 * Generic setter for any property on a definition item (field, group, or display).
 * Resolves the item by dot-path in the `definition.items` tree and sets the
 * specified property to the given value.
 *
 * **Payload:**
 * - `path`     -- Dot-path to the target item (e.g. `'address.city'` for a nested field).
 * - `property` -- Name of the property to set. Supports common properties (`label`,
 *                 `description`, `hint`, `labels`, `presentation`), field-specific
 *                 properties (`currency`, `precision`, `prefix`, `suffix`,
 *                 `initialValue`, `semanticType`, `prePopulate`, `optionSet`),
 *                 and group-specific properties (`repeatable`, `minRepeat`, `maxRepeat`).
 *                 Nested dot-paths (e.g. `'presentation.widgetHint'`) are also supported.
 * - `value`    -- The new value for the property.
 *
 * @throws {Error} If the item cannot be found at the given path.
 * @returns `{ rebuildComponentTree: false }` -- Property changes do not alter
 * the component tree structure.
 */
registerHandler('definition.setItemProperty', (state, payload) => {
  const { path, property, value } = payload as { path: string; property: string; value: unknown };
  const loc = resolveItemLocation(state, path);
  if (!loc) throw new Error(`Item not found: ${path}`);

  assertPropertyApplicable(loc.item, property);
  setNestedProperty(loc.item as Record<string, unknown>, property, value);
  return { rebuildComponentTree: false };
});

// ── setFieldDataType ─────────────────────────────────────────────────

/**
 * **Command: `definition.setFieldDataType`**
 *
 * Changes the `dataType` of a field item. The data type determines what kind
 * of value the field holds at runtime (e.g. `'string'`, `'integer'`, `'decimal'`,
 * `'money'`, `'date'`, `'boolean'`, `'choice'`, `'multiChoice'`, etc.).
 *
 * Changing a field's data type may invalidate existing options, bind expressions,
 * or field-specific properties that are incompatible with the new type. Consumers
 * are expected to dispatch follow-up commands to reconcile those if needed.
 *
 * **Payload:**
 * - `path`     -- Dot-path to the target field item.
 * - `dataType` -- The new data type string.
 *
 * @throws {Error} If the item cannot be found at the given path.
 * @returns `{ rebuildComponentTree: false }` -- Data type changes do not alter
 * the component tree structure.
 */
registerHandler('definition.setFieldDataType', (state, payload) => {
  const { path, dataType } = payload as {
    path: string;
    dataType: NonNullable<FormspecItem['dataType']>;
  };
  const loc = resolveItemLocation(state, path);
  if (!loc) throw new Error(`Item not found: ${path}`);

  loc.item.dataType = dataType;
  return { rebuildComponentTree: false };
});

// ── setFieldOptions ──────────────────────────────────────────────────

/**
 * **Command: `definition.setFieldOptions`**
 *
 * Sets the available options for a choice or multiChoice field. Supports two
 * mutually exclusive modes:
 *
 * 1. **Inline options** -- When `options` is an array of `{ value, label }` objects,
 *    the options are stored directly on the item and any existing `optionSet`
 *    reference is removed.
 * 2. **External option set** -- When `options` is a string, it is treated as a
 *    reference name for a declared option set (`optionSet`). The inline `options`
 *    array is removed and the string is stored as `optionSet`.
 *
 * **Payload:**
 * - `path`    -- Dot-path to the target field item.
 * - `options` -- Either an array of `{ value: string; label: string }` for inline
 *               options, or a string naming an external option set.
 *
 * @throws {Error} If the item cannot be found at the given path.
 * @returns `{ rebuildComponentTree: false }` -- Option changes do not alter
 * the component tree structure.
 */
registerHandler('definition.setFieldOptions', (state, payload) => {
  const { path, options } = payload as { path: string; options: unknown };
  const loc = resolveItemLocation(state, path);
  if (!loc) throw new Error(`Item not found: ${path}`);

  if (typeof options === 'string') {
    loc.item.optionSet = options;
    delete loc.item.options;
  } else {
    loc.item.options = options as { value: string; label: string }[];
    delete loc.item.optionSet;
  }

  return { rebuildComponentTree: false };
});

// ── setItemExtension ─────────────────────────────────────────────────

/**
 * **Command: `definition.setItemExtension`**
 *
 * Sets or removes an extension property (`x-` prefixed) on a definition item.
 * Extensions allow registry-defined custom behavior to be attached to individual
 * fields, groups, or display items. For example, `x-formspec-url` marks a string
 * field as a URL with associated validation constraints from the registry.
 *
 * **Null-removal semantics:** Setting `value` to `null` removes the extension
 * property from the item entirely.
 *
 * **Payload:**
 * - `path`      -- Dot-path to the target item.
 * - `extension` -- The extension property name (e.g. `'x-formspec-url'`).
 * - `value`     -- The extension value, or `null` to remove it.
 *
 * @throws {Error} If the item cannot be found at the given path.
 * @returns `{ rebuildComponentTree: false }` -- Extension changes do not alter
 * the component tree structure.
 */
registerHandler('definition.setItemExtension', (state, payload) => {
  const { path, extension, value } = payload as { path: string; extension: string; value: unknown };
  const loc = resolveItemLocation(state, path);
  if (!loc) throw new Error(`Item not found: ${path}`);

  if (value === null) {
    if (loc.item.extensions) {
      delete (loc.item.extensions as any)[extension];
      if (Object.keys(loc.item.extensions).length === 0) {
        delete loc.item.extensions;
      }
    }
  } else {
    loc.item.extensions = loc.item.extensions || {};
    (loc.item.extensions as any)[extension] = value;
  }

  return { rebuildComponentTree: false };
});
