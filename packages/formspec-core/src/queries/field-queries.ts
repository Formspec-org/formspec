/**
 * Pure query functions over ProjectState for field/item lookups,
 * response schema, bind resolution, and cross-artifact queries.
 *
 * Every function receives `state: ProjectState` as its first parameter
 * and returns a result with no side effects.
 */
import type { FormItem, FormShape } from 'formspec-types';
import { itemAtPath, normalizeIndexedPath } from 'formspec-engine/fel-runtime';
import { getCurrentComponentDocument, getEditableComponentDocument } from '../component-documents.js';
import type {
  ProjectState,
  ItemFilter,
  ItemSearchResult,
  DataTypeInfo,
  ResponseSchemaRow,
} from '../types.js';

/**
 * All leaf field paths in the definition item tree, in document order.
 * Paths use dot-notation (e.g., `"contact.email"`). Groups are traversed
 * but not included -- only items with `type === 'field'` appear.
 */
export function fieldPaths(state: ProjectState): string[] {
  const paths: string[] = [];
  const walk = (items: FormItem[], prefix: string) => {
    for (const item of items) {
      const path = prefix ? `${prefix}.${item.key}` : item.key;
      if (item.type === 'field') {
        paths.push(path);
      }
      if (item.children) {
        walk(item.children, path);
      }
    }
  };
  walk(state.definition.items, '');
  return paths;
}

/**
 * Resolve an item by its dot-path within the definition tree.
 */
export function itemAt(state: ProjectState, path: string): FormItem | undefined {
  return itemAtPath(state.definition.items, path);
}

/**
 * Build a flat list of rows describing the response schema for the current definition.
 */
export function responseSchemaRows(state: ProjectState): ResponseSchemaRow[] {
  const rows: ResponseSchemaRow[] = [];
  const binds = state.definition.binds ?? [];

  const getBindFor = (path: string) => binds.find((b: any) => b.path === path) as any | undefined;

  const jsonTypeForItem = (item: FormItem): ResponseSchemaRow['jsonType'] => {
    if (item.type === 'group') {
      return (item as any).repeatable ? 'array<object>' : 'object';
    }
    const dataType = (item as any).dataType as string | undefined;
    if (dataType === 'integer' || dataType === 'decimal') return 'number';
    if (dataType === 'boolean') return 'boolean';
    return 'string';
  };

  const walk = (items: FormItem[], prefix: string, depth: number) => {
    for (const item of items) {
      const path = prefix ? `${prefix}.${item.key}` : item.key;
      const bind = getBindFor(path);

      rows.push({
        path,
        key: item.key,
        label: item.label || item.key,
        depth,
        jsonType: jsonTypeForItem(item),
        required: bind ? 'required' in bind : false,
        calculated: bind ? 'calculate' in bind : false,
        conditional: bind ? ('relevant' in bind || 'readonly' in bind) : false,
      });

      if (item.children?.length) {
        walk(item.children, path, depth + 1);
      }
    }
  };

  walk(state.definition.items, '', 0);
  return rows;
}

/**
 * All instance names declared in the definition's `instances` map.
 */
export function instanceNames(state: ProjectState): string[] {
  const instances = state.definition.instances;
  if (!instances) return [];
  return Object.keys(instances);
}

/**
 * All variable names declared in the definition.
 */
export function variableNames(state: ProjectState): string[] {
  return (state.definition.variables ?? []).map((v: any) => v.name);
}

/**
 * Find all field paths that reference a given named option set.
 */
export function optionSetUsage(state: ProjectState, name: string): string[] {
  const paths: string[] = [];
  const walk = (items: FormItem[], prefix: string) => {
    for (const item of items) {
      const path = prefix ? `${prefix}.${item.key}` : item.key;
      if ((item as any).optionSet === name) {
        paths.push(path);
      }
      if (item.children) walk(item.children, path);
    }
  };
  walk(state.definition.items, '');
  return paths;
}

/**
 * Search definition items by type, dataType, label substring, or extension usage.
 * All filter criteria are AND-ed. Results include the full dot-notation path.
 */
export function searchItems(state: ProjectState, filter: ItemFilter): ItemSearchResult[] {
  const results: ItemSearchResult[] = [];
  const walk = (items: FormItem[], prefix: string) => {
    for (const item of items) {
      const path = prefix ? `${prefix}.${item.key}` : item.key;
      let match = true;
      if (filter.type && item.type !== filter.type) match = false;
      if (filter.dataType && (item as any).dataType !== filter.dataType) match = false;
      if (filter.label && !(item.label ?? '').toLowerCase().includes(filter.label.toLowerCase())) match = false;
      if (filter.hasExtension && !(item as any).extensions?.[filter.hasExtension]) match = false;
      if (match) results.push(Object.assign({ path }, item));
      if (item.children) walk(item.children, path);
    }
  };
  walk(state.definition.items, '');
  return results;
}

/**
 * Resolve the effective presentation for a field through the theme cascade.
 */
export function effectivePresentation(state: ProjectState, fieldKey: string): Record<string, unknown> {
  const item = itemAt(state, fieldKey);
  if (!item) return {};

  const result: Record<string, unknown> = {};

  // Tier 1: defaults
  const defaults = state.theme.defaults as Record<string, unknown> | undefined;
  if (defaults) Object.assign(result, defaults);

  // Tier 2: selectors (document order)
  const selectors = state.theme.selectors as any[] | undefined;
  if (selectors) {
    for (const sel of selectors) {
      const match = sel.match;
      if (!match) continue;
      let matches = true;
      if (match.type && item.type !== match.type) matches = false;
      if (match.dataType && (item as any).dataType !== match.dataType) matches = false;
      if (matches) Object.assign(result, sel.apply);
    }
  }

  // Tier 3: per-item overrides
  const items = state.theme.items as Record<string, Record<string, unknown>> | undefined;
  if (items?.[fieldKey]) Object.assign(result, items[fieldKey]);

  return result;
}

/**
 * Get the effective bind properties for a field path.
 */
export function bindFor(state: ProjectState, path: string): Record<string, unknown> | undefined {
  const binds = state.definition.binds;
  if (!binds) return undefined;
  const bind = binds.find((b: any) => b.path === path);
  if (!bind) return undefined;
  const { path: _, ...props } = bind as any;
  return Object.keys(props).length > 0 ? props : undefined;
}

/**
 * Find the component tree node bound to a field key.
 */
export function componentFor(state: ProjectState, fieldKey: string): Record<string, unknown> | undefined {
  const tree = getEditableComponentDocument(state).tree as any;
  if (!tree) return undefined;
  const queue = [tree];
  while (queue.length > 0) {
    const node = queue.shift()!;
    if (node.bind === fieldKey) return node;
    if (node.children) queue.push(...node.children);
  }
  return undefined;
}

/**
 * Find definition fields that have no corresponding node in the component tree.
 */
export function unboundItems(state: ProjectState): string[] {
  const fieldKeys = fieldPaths(state);
  const boundKeys = new Set<string>();
  const tree = getEditableComponentDocument(state).tree as any;
  if (tree) {
    const queue = [tree];
    while (queue.length > 0) {
      const node = queue.shift()!;
      if (node.bind) boundKeys.add(node.bind);
      if (node.children) queue.push(...node.children);
    }
  }
  return fieldKeys.filter(p => !boundKeys.has(p));
}

/**
 * Resolve a design token value through the two-tier cascade.
 */
export function resolveToken(state: ProjectState, key: string): string | number | undefined {
  // Tier 3: component tokens
  const compTokens = state.component.tokens as Record<string, unknown> | undefined;
  if (compTokens?.[key] !== undefined) return compTokens[key] as string | number;

  // Tier 2: theme tokens
  const themeTokens = state.theme.tokens as Record<string, unknown> | undefined;
  if (themeTokens?.[key] !== undefined) return themeTokens[key] as string | number;

  return undefined;
}

/**
 * Enumerate all valid data types: the 13 core types plus any dataType extensions
 * from loaded registries.
 */
export function allDataTypes(state: ProjectState): DataTypeInfo[] {
  const core: DataTypeInfo[] = [
    'string', 'integer', 'decimal', 'boolean', 'date', 'time', 'dateTime',
    'money', 'choice', 'multiChoice', 'attachment', 'signature', 'barcode',
  ].map(name => ({ name, source: 'core' as const }));

  for (const reg of state.extensions.registries) {
    for (const entry of Object.values(reg.entries)) {
      const e = entry as any;
      if (e.category === 'dataType') {
        core.push({
          name: e.name,
          source: 'extension',
          baseType: e.baseType,
          registryUrl: reg.url,
        });
      }
    }
  }

  return core;
}

/**
 * All shape rules targeting a given path.
 * A shape matches if its `target` equals the path (exact) or matches via wildcard (`[*]`).
 */
export function shapesForPath(state: ProjectState, path: string): FormShape[] {
  const shapes = (state.definition.shapes ?? []) as FormShape[];
  const normalized = normalizeIndexedPath(path);
  return shapes.filter(s => {
    const target = (s as any).target as string | undefined;
    if (!target) return false;
    if (target === path || target === normalized) return true;
    // Wildcard match: target "items[*].amount" matches path "items.amount"
    const normalizedTarget = normalizeIndexedPath(target);
    return normalizedTarget === normalized;
  });
}

/** Merged view of all bind constraints and prePopulate affecting a field path. */
export interface NormalizedBinds {
  required?: string;
  readonly?: string;
  relevant?: string;
  calculate?: string;
  constraint?: string;
  constraintMessage?: string;
  initialValue?: unknown;
  default?: unknown;
  prePopulate?: unknown;
  [key: string]: unknown;
}

/**
 * Merge all bind properties targeting `path` with any `prePopulate`/`initialValue`
 * from the item definition into a flat record of constraints.
 */
export function normalizeBinds(state: ProjectState, path: string): NormalizedBinds {
  const result: NormalizedBinds = {};

  // Collect from binds
  const binds = state.definition.binds ?? [];
  for (const b of binds) {
    const bind = b as any;
    if (bind.path !== path) continue;
    for (const [key, val] of Object.entries(bind)) {
      if (key === 'path') continue;
      result[key] = val;
    }
  }

  // Overlay from item's prePopulate/initialValue
  const item = itemAt(state, path) as any;
  if (item) {
    if (item.prePopulate !== undefined) result.prePopulate = item.prePopulate;
    if (item.initialValue !== undefined) result.initialValue = item.initialValue;
    if (item.default !== undefined) result.default = item.default;
  }

  return result;
}
