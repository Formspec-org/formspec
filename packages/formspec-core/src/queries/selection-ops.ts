/** @filedesc Pure selection operations over dot-paths: ancestor finding, overlap check, expansion. */
import type { FormItem } from 'formspec-types';
import type { ProjectState } from '../types.js';

/**
 * Find the deepest shared prefix of dot-separated paths.
 * Returns undefined if paths share no common ancestor (or if the array is empty).
 */
export function commonAncestor(paths: string[]): string | undefined {
  if (paths.length === 0) return undefined;
  if (paths.length === 1) return paths[0];

  const segmentsArr = paths.map(p => p.split('.'));
  const minLen = Math.min(...segmentsArr.map(s => s.length));
  const common: string[] = [];

  for (let i = 0; i < minLen; i++) {
    const seg = segmentsArr[0][i];
    if (segmentsArr.every(s => s[i] === seg)) {
      common.push(seg);
    } else {
      break;
    }
  }

  // If every segment matched and the shortest path is fully consumed,
  // the common ancestor is that shortest path (it's the full path).
  // If no segments matched, there is no common ancestor.
  if (common.length === 0) return undefined;
  return common.join('.');
}

/**
 * Check whether one path is an ancestor of the other (or they are identical).
 * Uses dot-boundary matching to avoid partial-segment false positives.
 */
export function pathsOverlap(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < b.length) return b.startsWith(a + '.');
  return a.startsWith(b + '.');
}

/**
 * Given selected paths, expand to include all descendants from the definition tree.
 * Returns a deduplicated list.
 */
export function expandSelection(paths: string[], state: ProjectState): string[] {
  if (paths.length === 0) return [];

  const selected = new Set(paths);
  const result = new Set<string>();

  function collectDescendants(items: FormItem[], prefix: string): void {
    for (const item of items) {
      const itemPath = prefix ? `${prefix}.${item.key}` : item.key;
      // Check if this item or any of its ancestors is selected
      if (isOrHasSelectedAncestor(itemPath)) {
        result.add(itemPath);
      }
      if (item.children?.length) {
        collectDescendants(item.children, itemPath);
      }
    }
  }

  function isOrHasSelectedAncestor(itemPath: string): boolean {
    if (selected.has(itemPath)) return true;
    for (const sel of selected) {
      if (itemPath.startsWith(sel + '.')) return true;
    }
    return false;
  }

  // Add all originally selected paths
  for (const p of paths) {
    result.add(p);
  }

  collectDescendants(state.definition.items, '');
  return [...result];
}
