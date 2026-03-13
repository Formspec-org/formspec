/**
 * Pure helper functions for multi-select operations.
 * Used by both the context menu (now) and drag-and-drop (later).
 */

/** Remove paths whose ancestors are also in the set. */
export function pruneDescendants(paths: Set<string>): string[] {
  const result: string[] = [];
  for (const p of paths) {
    let hasAncestor = false;
    for (const other of paths) {
      if (other !== p && p.startsWith(other + '.')) {
        hasAncestor = true;
        break;
      }
    }
    if (!hasAncestor) result.push(p);
  }
  return result;
}

/** Sort paths deepest-first (most dots first) for safe batch delete. */
export function sortForBatchDelete(paths: string[]): string[] {
  return [...paths].sort((a, b) => {
    const depthA = a.split('.').length;
    const depthB = b.split('.').length;
    return depthB - depthA;
  });
}

interface MoveCommand {
  type: 'definition.moveItem';
  payload: { sourcePath: string; targetParentPath: string; targetIndex: number };
}

/**
 * Build batch move commands for moving paths into a target group.
 * Filters out the target itself and prunes descendants.
 */
export function buildBatchMoveCommands(
  paths: Set<string>,
  targetGroupPath: string,
): MoveCommand[] {
  // Remove the target itself and any descendants of the target
  const filtered = new Set<string>();
  for (const p of paths) {
    if (p === targetGroupPath || p.startsWith(targetGroupPath + '.')) continue;
    filtered.add(p);
  }
  const pruned = pruneDescendants(filtered);
  return pruned.map((sourcePath, index) => ({
    type: 'definition.moveItem' as const,
    payload: { sourcePath, targetParentPath: targetGroupPath, targetIndex: index },
  }));
}
