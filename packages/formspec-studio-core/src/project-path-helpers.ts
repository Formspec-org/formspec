/** @filedesc Shared path validation for authoring helpers (definition, mapping, etc.). */
import type { IProjectCore } from '@formspec-org/core';
import type { FormItem } from './types.js';
import { HelperError } from './helper-types.js';
import { editDistance } from './lib/object-utils.js';

export function findSimilarPaths(core: IProjectCore, path: string, maxDistance = 3): string[] {
  const allPaths = core.fieldPaths();
  const allItems = core.state.definition.items;
  const collectPaths = (items: FormItem[], prefix?: string): string[] => {
    const result: string[] = [];
    for (const item of items) {
      const fullPath = prefix ? `${prefix}.${item.key}` : item.key;
      result.push(fullPath);
      if (item.children?.length) {
        result.push(...collectPaths(item.children, fullPath));
      }
    }
    return result;
  };
  const allKnownPaths = [...new Set([...allPaths, ...collectPaths(allItems)])];

  return allKnownPaths
    .map(p => ({ path: p, dist: editDistance(path.toLowerCase(), p.toLowerCase()) }))
    .filter(({ dist }) => dist <= maxDistance && dist > 0)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 5)
    .map(({ path: p }) => p);
}

export function throwPathNotFound(core: IProjectCore, path: string): never {
  const similarPaths = findSimilarPaths(core, path);
  throw new HelperError('PATH_NOT_FOUND', `Item not found at path "${path}"`, {
    path,
    ...(similarPaths.length > 0 ? { similarPaths } : {}),
  });
}

export function requireItemPath(core: IProjectCore, path: string): void {
  if (!core.itemAt(path)) {
    throwPathNotFound(core, path);
  }
}
