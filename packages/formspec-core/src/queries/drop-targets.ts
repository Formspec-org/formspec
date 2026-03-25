/** @filedesc Compute valid drop targets for drag-and-drop of definition items. */
import type { FormItem } from 'formspec-types';
import type { ProjectState } from '../types.js';

/**
 * A potential drop location in the definition tree.
 */
export interface DropTarget {
  /** Dot-path of the reference item. */
  targetPath: string;
  /** Position relative to the target: before, after, or inside (for groups). */
  position: 'before' | 'after' | 'inside';
  /** Whether this drop is valid (not onto self or descendant of dragged). */
  valid: boolean;
}

/**
 * Compute valid drop locations for a set of dragged item paths.
 *
 * Walks the definition tree and produces before/after targets for every item
 * not in the dragged set (or a descendant of it). Groups also get an "inside"
 * target allowing drops into them.
 */
export function computeDropTargets(state: ProjectState, draggedPaths: string[]): DropTarget[] {
  const dragged = new Set(draggedPaths);
  const targets: DropTarget[] = [];

  function isDraggedOrDescendant(path: string): boolean {
    if (dragged.has(path)) return true;
    for (const d of dragged) {
      if (path.startsWith(d + '.')) return true;
    }
    return false;
  }

  function walk(items: FormItem[], prefix: string): void {
    for (const item of items) {
      const path = prefix ? `${prefix}.${item.key}` : item.key;

      if (isDraggedOrDescendant(path)) {
        // Skip dragged items and their descendants entirely
        continue;
      }

      targets.push({ targetPath: path, position: 'before', valid: true });
      targets.push({ targetPath: path, position: 'after', valid: true });

      if (item.type === 'group') {
        targets.push({ targetPath: path, position: 'inside', valid: true });
      }

      if (item.children?.length) {
        walk(item.children, path);
      }
    }
  }

  walk(state.definition.items, '');
  return targets;
}
