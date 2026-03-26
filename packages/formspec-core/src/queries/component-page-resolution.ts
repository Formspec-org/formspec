/** @filedesc Resolves page structure from the component tree (Stack > Page* hierarchy). */
import type { TreeNode } from '../handlers/tree-utils.js';
import type {
  ResolvedRegion,
  ResolvedPage,
  ResolvedPageStructure,
} from '../page-resolution.js';

/**
 * Collect all `bind` values from a node's subtree (depth-first).
 * Does not descend into Page nodes — those are handled at the top level.
 */
function collectBoundKeys(node: TreeNode): string[] {
  const keys: string[] = [];
  const stack: TreeNode[] = node.children ? [...node.children] : [];
  while (stack.length) {
    const n = stack.pop()!;
    if (n.bind) keys.push(n.bind);
    if (n.children) stack.push(...n.children);
  }
  // Reverse to restore document order (stack reverses depth-first traversal)
  return keys.reverse();
}

/**
 * Collect all `bind` values from a subtree that are NOT inside a Page node.
 * Called on the root's non-Page children to find unassigned items.
 */
function collectUnassignedBoundKeys(node: TreeNode): string[] {
  const keys: string[] = [];
  const stack: TreeNode[] = node.children ? [...node.children] : [];
  while (stack.length) {
    const n = stack.pop()!;
    if (n.component === 'Page') continue; // skip — pages handled separately
    if (n.bind) keys.push(n.bind);
    if (n.children) stack.push(...n.children);
  }
  return keys.reverse();
}

/**
 * Resolve page structure from the component tree.
 *
 * Walks the root node's direct children for `component: 'Page'` nodes.
 * Each Page's subtree is recursively searched for bound items (any node with a
 * `bind` property). Non-Page children of the root contribute unassigned items.
 *
 * @param tree - The root TreeNode (expected to be a Stack with nodeId 'root').
 * @param pageMode - The form's page mode ('single' | 'wizard' | 'tabs').
 * @param allItemKeys - All known definition item keys (used for `exists` checks
 *   and to identify keys absent from the tree entirely).
 */
export function resolvePageStructureFromTree(
  tree: TreeNode,
  pageMode: 'single' | 'wizard' | 'tabs',
  allItemKeys: string[],
): ResolvedPageStructure {
  const knownKeys = new Set(allItemKeys);
  const assignedKeys = new Set<string>();
  const itemPageMap: Record<string, string> = {};
  const pages: ResolvedPage[] = [];

  const rootChildren = tree.children ?? [];

  // Pass 1: process Page nodes
  for (const child of rootChildren) {
    if (child.component !== 'Page') continue;

    const pageId: string = (child.id as string) ?? (child.nodeId as string) ?? '';
    const title: string = (child.title as string) ?? '';

    // Build regions from all bound items within this Page.
    // Direct children with `bind` carry layout metadata (span, start, responsive).
    // Items nested inside non-bind containers (Grid, Columns) use default span=12.
    const regions: ResolvedRegion[] = [];
    const addRegion = (key: string, node?: TreeNode) => {
      const regionSpan = node && typeof node.span === 'number' ? node.span : 12;
      const region: ResolvedRegion = { key, span: regionSpan, exists: knownKeys.has(key) };
      if (node && typeof node.start === 'number') region.start = node.start;
      if (node?.responsive && typeof node.responsive === 'object') {
        region.responsive = node.responsive as Record<string, { span?: number; start?: number; hidden?: boolean }>;
      }
      regions.push(region);
      assignedKeys.add(key);
      itemPageMap[key] = pageId;
    };
    const walkPageChildren = (nodes: TreeNode[]) => {
      for (const n of nodes) {
        if (n.bind) {
          addRegion(n.bind, n);
          // Also associate deeply nested bound keys with this page
          for (const nested of collectBoundKeys(n)) {
            assignedKeys.add(nested);
            itemPageMap[nested] = pageId;
          }
        } else if (n.children) {
          walkPageChildren(n.children);
        }
      }
    };
    walkPageChildren(child.children ?? []);

    const resolvedPage: ResolvedPage = { id: pageId, title, regions };
    if (typeof child.description === 'string') {
      resolvedPage.description = child.description;
    }
    pages.push(resolvedPage);
  }

  // Pass 2: collect unassigned — bound keys in non-Page root children
  const unassignedFromTree: string[] = collectUnassignedBoundKeys(tree);

  // Pass 3: keys in allItemKeys not encountered in the tree at all
  const treeUnassigned = new Set(unassignedFromTree);
  const unassignedItems: string[] = [...unassignedFromTree];
  for (const key of allItemKeys) {
    if (!assignedKeys.has(key) && !treeUnassigned.has(key)) {
      unassignedItems.push(key);
    }
  }

  return {
    mode: pageMode,
    pages,
    diagnostics: [],
    unassignedItems,
    itemPageMap,
  };
}
