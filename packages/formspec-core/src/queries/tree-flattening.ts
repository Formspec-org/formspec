/** @filedesc Flatten the definition item tree into a depth-first list with path and depth info. */
import type { FormItem } from 'formspec-types';
import type { ProjectState } from '../types.js';

/**
 * A single entry in the flattened tree representation.
 */
export interface FlatTreeItem {
  /** Full dot-notation path (e.g. "contact.email"). */
  path: string;
  /** Nesting depth: 0 for root items. */
  depth: number;
  /** Item kind: field, group, or display. */
  type: string;
  /** Human-readable label (falls back to key). */
  label: string;
  /** Parent's dot-path, or undefined for root items. */
  parentPath: string | undefined;
}

/**
 * Walk the definition item tree depth-first and return a flat list of items
 * with path, depth, type, label, and parentPath.
 */
export function flattenDefinitionTree(state: ProjectState): FlatTreeItem[] {
  const result: FlatTreeItem[] = [];

  function walk(items: FormItem[], depth: number, prefix: string, parentPath: string | undefined): void {
    for (const item of items) {
      const path = prefix ? `${prefix}.${item.key}` : item.key;
      result.push({
        path,
        depth,
        type: item.type,
        label: item.label || item.key,
        parentPath,
      });
      if (item.children?.length) {
        walk(item.children, depth + 1, path, path);
      }
    }
  }

  walk(state.definition.items, 0, '', undefined);
  return result;
}
