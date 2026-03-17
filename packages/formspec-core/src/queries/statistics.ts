/**
 * Pure query function for project complexity metrics.
 */
import type { FormItem } from 'formspec-types';
import { getCurrentComponentDocument } from '../component-documents.js';
import { allExpressions } from './expression-index.js';
import type { ProjectState, ProjectStatistics } from '../types.js';

/**
 * Compute form complexity metrics by walking the item tree.
 */
export function statistics(state: ProjectState): ProjectStatistics {
  let fieldCount = 0, groupCount = 0, displayCount = 0, maxNestingDepth = 0;

  const walk = (items: FormItem[], depth: number) => {
    for (const item of items) {
      if (item.type === 'field') fieldCount++;
      else if (item.type === 'group') groupCount++;
      else if (item.type === 'display') displayCount++;
      if (depth > maxNestingDepth) maxNestingDepth = depth;
      if (item.children) walk(item.children, depth + 1);
    }
  };
  walk(state.definition.items, 1);

  const def = state.definition;
  const expressionCount = allExpressions(state).length;

  let componentNodeCount = 0;
  const tree = getCurrentComponentDocument(state).tree as any;
  if (tree) {
    const queue = [tree];
    while (queue.length > 0) {
      const node = queue.shift()!;
      componentNodeCount += 1;
      if (Array.isArray(node.children)) queue.push(...node.children);
    }
  }

  let totalMappingRuleCount = 0;
  for (const m of Object.values(state.mappings)) {
    totalMappingRuleCount += (m.rules?.length ?? 0);
  }

  const screener = def.screener;
  const screenerActive = screener && screener.enabled !== false;

  return {
    fieldCount,
    groupCount,
    displayCount,
    maxNestingDepth,
    bindCount: def.binds?.length ?? 0,
    shapeCount: def.shapes?.length ?? 0,
    variableCount: def.variables?.length ?? 0,
    expressionCount,
    componentNodeCount,
    totalMappingRuleCount,
    mappingCount: Object.keys(state.mappings).length,
    screenerFieldCount: screenerActive ? screener.items.length : 0,
    screenerRouteCount: screenerActive ? screener.routes.length : 0,
  };
}
