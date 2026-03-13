export interface FlatEntry {
  path: string;
  type: string;
  depth: number;
  hasChildren: boolean;
}

export interface DropTarget {
  parentPath: string | null;
  index: number;
}

export type DropPosition = 'above' | 'below' | 'inside';

/** True if childPath is a dot-separated descendant of parentPath. */
export function isDescendantOf(childPath: string, parentPath: string): boolean {
  return childPath.startsWith(parentPath + '.');
}

/** Extract the parent path from a dot-separated path. Returns null for root-level items. */
function parentOf(path: string): string | null {
  const lastDot = path.lastIndexOf('.');
  return lastDot === -1 ? null : path.substring(0, lastDot);
}

/** Find the sibling index of a path within its parent by scanning the flat list. */
function siblingIndex(path: string, parent: string | null, flatList: FlatEntry[]): number {
  const targetDepth = parent === null ? 0 : parent.split('.').length;
  let idx = 0;
  for (const entry of flatList) {
    if (entry.depth !== targetDepth) continue;
    const entryParent = parentOf(entry.path);
    if (entryParent !== parent) continue;
    if (entry.path === path) return idx;
    idx++;
  }
  return -1;
}

/** Count direct children of a parent in the flat list. */
function childCount(parentPath: string, flatList: FlatEntry[]): number {
  const childDepth = parentPath.split('.').length;
  let count = 0;
  for (const entry of flatList) {
    if (entry.depth !== childDepth) continue;
    if (isDescendantOf(entry.path, parentPath)) count++;
  }
  return count;
}

/**
 * Compute the drop target for a drag operation.
 * Returns a moveItem payload { parentPath, index } or null if the drop is invalid/no-op.
 */
export function computeDropTarget(
  activePath: string,
  overPath: string,
  position: DropPosition,
  flatList: FlatEntry[],
  selectedPaths?: Set<string>,
): DropTarget | null {
  // Self-drop
  if (activePath === overPath) return null;

  // Circular guard: can't drop into own descendant
  if (isDescendantOf(overPath, activePath)) return null;

  // Multi-select circular guard
  if (selectedPaths) {
    for (const sp of selectedPaths) {
      if (isDescendantOf(overPath, sp)) return null;
    }
  }

  const overEntry = flatList.find(e => e.path === overPath);
  if (!overEntry) return null;

  let targetParent: string | null;
  let rawIndex: number;

  if (position === 'inside') {
    // Drop inside a group — only valid for group-type items
    if (overEntry.type !== 'group') return null;
    targetParent = overPath;
    rawIndex = childCount(overPath, flatList);
  } else {
    // above/below: drop as sibling of the over item
    targetParent = parentOf(overPath);
    const overIndex = siblingIndex(overPath, targetParent, flatList);
    if (overIndex === -1) return null;
    rawIndex = position === 'above' ? overIndex : overIndex + 1;
  }

  // Same-parent index adjustment
  const sourceParent = parentOf(activePath);
  if (sourceParent === targetParent) {
    const sourceIndex = siblingIndex(activePath, sourceParent, flatList);
    if (sourceIndex !== -1 && sourceIndex < rawIndex) {
      rawIndex -= 1;
    }
    // No-op check: would place item exactly where it already is
    if (sourceIndex === rawIndex) return null;
  }

  return { parentPath: targetParent, index: rawIndex };
}

/**
 * Build sequential moveItem commands for a multi-select drag.
 * Simulates each move to compute correct target indices, preserving relative order.
 *
 * The key challenge: sequential moveItem calls each change the list state.
 * Items BEFORE the target shift the effective index down when removed;
 * items AFTER the target don't. We simulate each removal+insertion to get
 * the right index for every command.
 *
 * @param sortedPaths - selected paths sorted by flat order
 * @param targetParentPath - target parent (from computeDropTarget), or null for root
 * @param overPath - the path of the item being hovered over
 * @param position - drop position relative to over item
 * @param flatList - the current flat entry list
 */
export function buildSequentialMoveCommands(
  sortedPaths: string[],
  targetParentPath: string | null,
  overPath: string,
  position: DropPosition,
  flatList: FlatEntry[],
): { type: string; payload: Record<string, any> }[] {
  // Compute the raw (un-adjusted) target index
  let rawTargetIndex: number;
  if (position === 'inside') {
    rawTargetIndex = childCount(overPath, flatList);
  } else {
    const overIndex = siblingIndex(overPath, parentOf(overPath), flatList);
    rawTargetIndex = position === 'above' ? overIndex : overIndex + 1;
  }

  // Get sibling paths in the target parent for simulation
  const targetDepth = targetParentPath === null ? 0 : targetParentPath.split('.').length;
  const siblings = flatList
    .filter(e => e.depth === targetDepth && parentOf(e.path) === targetParentPath)
    .map(e => e.path);

  // Simulate moves sequentially
  const sim = [...siblings];
  let currentTarget = rawTargetIndex;
  const commands: { type: string; payload: Record<string, any> }[] = [];

  for (const sourcePath of sortedPaths) {
    const sourceIdx = sim.indexOf(sourcePath);
    const sameParent = sourceIdx !== -1;

    let effectiveTarget = currentTarget;
    if (sameParent && sourceIdx < currentTarget) {
      effectiveTarget = currentTarget - 1;
    }

    const payload: Record<string, any> = { sourcePath, targetIndex: effectiveTarget };
    if (targetParentPath != null) {
      payload.targetParentPath = targetParentPath;
    }
    commands.push({ type: 'definition.moveItem', payload });

    // Simulate: remove from old position (if same parent), insert at effective target
    if (sameParent) {
      sim.splice(sourceIdx, 1);
    }
    sim.splice(effectiveTarget, 0, sourcePath);

    // Next item goes after this one
    currentTarget = effectiveTarget + 1;
  }

  return commands;
}

// ── Tree-aware drop target (dual-dispatch) ──────────────────────────

import type { TreeFlatEntry } from '../../../lib/tree-helpers';

export interface TreeDropTarget {
  sourceRef: { bind?: string; nodeId?: string };
  targetParentRef: { bind?: string; nodeId?: string };
  targetIndex: number;
  /** Non-null when a definition.moveItem is needed (cross-group moves). Null for component-only moves. */
  defMove: { sourcePath: string; targetParentPath: string | null; targetIndex: number } | null;
}

/**
 * Compute a drop target using the component tree flat list.
 * Returns routing info: whether to dispatch component.moveNode only or also definition.moveItem.
 *
 * Rules:
 * - Moving a layout node → component.moveNode only (defMove = null)
 * - Moving INTO a layout container → component.moveNode only
 * - Moving between bound groups (different def parent) → definition.moveItem (triggers rebuild)
 * - Moving within same def parent → component.moveNode only
 */
export function computeTreeDropTarget(
  activeId: string,
  overId: string,
  position: DropPosition,
  flatList: TreeFlatEntry[],
): TreeDropTarget | null {
  if (activeId === overId) return null;

  const sourceEntry = flatList.find(e => e.id === activeId);
  const overEntry = flatList.find(e => e.id === overId);
  if (!sourceEntry || !overEntry) return null;

  const isSourceLayout = sourceEntry.category === 'layout';
  const isOverLayout = overEntry.category === 'layout';

  // Build refs
  const sourceRef = sourceEntry.bind
    ? { bind: sourceEntry.bind }
    : { nodeId: sourceEntry.nodeId! };

  // Determine target parent and index
  let targetParentRef: { bind?: string; nodeId?: string };
  let targetIndex: number;

  if (position === 'inside') {
    // Drop inside — only valid for groups and layout containers
    if (overEntry.category !== 'group' && overEntry.category !== 'layout') return null;
    targetParentRef = overEntry.bind ? { bind: overEntry.bind } : { nodeId: overEntry.nodeId! };
    // Count direct children of the target in the flat list
    const overIdx = flatList.indexOf(overEntry);
    let count = 0;
    for (let i = overIdx + 1; i < flatList.length; i++) {
      if (flatList[i].depth <= overEntry.depth) break;
      if (flatList[i].depth === overEntry.depth + 1) count++;
    }
    targetIndex = count;
  } else {
    // above/below — sibling of the over item
    // Find the parent of the over item by walking back in the flat list
    const overIdx = flatList.indexOf(overEntry);
    let parentEntry: TreeFlatEntry | undefined;
    for (let i = overIdx - 1; i >= 0; i--) {
      if (flatList[i].depth < overEntry.depth) {
        parentEntry = flatList[i];
        break;
      }
    }
    targetParentRef = parentEntry
      ? (parentEntry.bind ? { bind: parentEntry.bind } : { nodeId: parentEntry.nodeId! })
      : { nodeId: 'root' };

    // Compute sibling index
    const parentDepth = parentEntry ? parentEntry.depth : -1;
    const siblingDepth = parentDepth + 1;
    let sibIdx = 0;
    const startIdx = parentEntry ? flatList.indexOf(parentEntry) + 1 : 0;
    for (let i = startIdx; i < flatList.length; i++) {
      if (flatList[i].depth < siblingDepth) break;
      if (flatList[i].depth === siblingDepth) {
        if (flatList[i].id === overId) {
          targetIndex = position === 'above' ? sibIdx : sibIdx + 1;
          break;
        }
        sibIdx++;
      }
    }
    targetIndex = targetIndex! ?? sibIdx;
  }

  // Determine if a definition move is needed
  let defMove: TreeDropTarget['defMove'] = null;

  if (!isSourceLayout) {
    const isTargetLayout = 'nodeId' in targetParentRef && targetParentRef.nodeId !== 'root'
      && flatList.find(e => e.nodeId === targetParentRef.nodeId)?.category === 'layout';

    if (!isTargetLayout) {
      // Target parent is a bound group or root — check if def parents differ
      const sourceDefParent = sourceEntry.defPath ? getDefParent(sourceEntry.defPath) : null;
      const targetDefParent = 'bind' in targetParentRef
        ? flatList.find(e => e.bind === targetParentRef.bind)?.defPath ?? null
        : null; // root

      if (sourceDefParent !== targetDefParent) {
        defMove = {
          sourcePath: sourceEntry.defPath!,
          targetParentPath: targetDefParent,
          targetIndex,
        };
      }
    }
  }

  return { sourceRef, targetParentRef, targetIndex, defMove };
}

function getDefParent(defPath: string): string | null {
  const lastDot = defPath.lastIndexOf('.');
  return lastDot === -1 ? null : defPath.substring(0, lastDot);
}
