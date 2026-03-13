/**
 * Helpers for flattening the component tree into a list suitable for
 * the editor canvas, DnD, and range-select.
 *
 * The component tree mixes three node categories:
 *   - **bound** (has `bind`) → field or group from definition
 *   - **display** (has `nodeId`, no `_layout`) → display item from definition
 *   - **layout** (has `nodeId` + `_layout: true`) → presentation-only container
 *
 * Layout nodes are transparent to definition paths — they don't contribute
 * to the defPathPrefix when descended into.
 */

// ── Types ───────────────────────────────────────────────────────────

/** A component tree node (matches the shape from studio-core). */
interface CompNode {
  component: string;
  bind?: string;
  nodeId?: string;
  _layout?: boolean;
  children?: CompNode[];
  [key: string]: unknown;
}

/** A definition item (minimal shape needed here). */
interface DefItem {
  key: string;
  type: string;
  dataType?: string;
  children?: DefItem[];
  [key: string]: unknown;
}

/** Result of buildDefLookup — maps item paths to their definition item + context. */
export interface DefLookupEntry {
  item: DefItem;
  path: string;
  parentPath: string | null;
}

/** A flattened entry from the component tree, used by EditorCanvas and DnD. */
export interface TreeFlatEntry {
  /** defPath for bound nodes, '__node:<nodeId>' for layout nodes */
  id: string;
  /** The original component tree node */
  node: CompNode;
  /** Nesting depth (layout containers contribute depth) */
  depth: number;
  /** Whether this node has children that will render */
  hasChildren: boolean;
  /** Definition path for bound/display nodes, null for layout */
  defPath: string | null;
  /** Node category */
  category: 'field' | 'group' | 'display' | 'layout';
  /** Present for bound nodes */
  nodeId: string | undefined;
  /** Present for layout/display nodes */
  bind: string | undefined;
}

// ── Identity helpers ────────────────────────────────────────────────

const LAYOUT_PREFIX = '__node:';

/** Check if an ID is a layout node reference. */
export function isLayoutId(id: string): boolean {
  return id.startsWith(LAYOUT_PREFIX);
}

/** Extract the nodeId from a layout ID. Returns input unchanged if not a layout ID. */
export function nodeIdFromLayoutId(id: string): string {
  return id.startsWith(LAYOUT_PREFIX) ? id.slice(LAYOUT_PREFIX.length) : id;
}

/** Build a NodeRef (for component tree commands) from a flat entry. */
export function nodeRefFor(entry: Pick<TreeFlatEntry, 'bind' | 'nodeId'>): { bind: string } | { nodeId: string } {
  if (entry.bind) return { bind: entry.bind };
  return { nodeId: entry.nodeId! };
}

// ── buildDefLookup ──────────────────────────────────────────────────

/**
 * Build a flat lookup map from definition item paths to their items.
 * Recursively walks nested children, building dot-separated paths.
 */
export function buildDefLookup(items: DefItem[], prefix = '', parentPath: string | null = null): Map<string, DefLookupEntry> {
  const map = new Map<string, DefLookupEntry>();
  for (const item of items) {
    const path = prefix ? `${prefix}.${item.key}` : item.key;
    map.set(path, { item, path, parentPath });
    if (item.children) {
      for (const [k, v] of buildDefLookup(item.children, path, path)) {
        map.set(k, v);
      }
    }
  }
  return map;
}

// ── bindKeyMap ──────────────────────────────────────────────────────

/**
 * Build a secondary lookup from item key (bind value) to definition path.
 * Used when a bound node has been moved into a layout container at a
 * different tree level — the computed defPath won't match defLookup,
 * but the item's key still maps to the correct definition path.
 */
export function buildBindKeyMap(defLookup: Map<string, DefLookupEntry>): Map<string, string> {
  const map = new Map<string, string>();
  for (const [path, entry] of defLookup) {
    if (!map.has(entry.item.key)) {
      map.set(entry.item.key, path);
    }
  }
  return map;
}

// ── flattenComponentTree ────────────────────────────────────────────

/**
 * Walk the component tree and produce a flat list of entries for the canvas.
 *
 * - Bound nodes (fields/groups) advance the defPathPrefix.
 * - Layout nodes are transparent — they don't change the defPathPrefix.
 * - Display nodes (nodeId, no _layout) use the defPathPrefix for their defPath.
 */
export function flattenComponentTree(
  root: CompNode,
  defLookup: Map<string, DefLookupEntry>,
  bindKeyMap?: Map<string, string>,
): TreeFlatEntry[] {
  const result: TreeFlatEntry[] = [];

  function walk(nodes: CompNode[], depth: number, defPathPrefix: string): void {
    for (const node of nodes) {
      if (node._layout) {
        // Layout node — transparent to def paths
        const id = `${LAYOUT_PREFIX}${node.nodeId}`;
        const children = node.children ?? [];
        result.push({
          id,
          node,
          depth,
          hasChildren: children.length > 0,
          defPath: null,
          category: 'layout',
          nodeId: node.nodeId,
          bind: undefined,
        });
        walk(children, depth + 1, defPathPrefix);
      } else if (node.bind) {
        // Bound node — field or group
        let defPath = defPathPrefix ? `${defPathPrefix}.${node.bind}` : node.bind;
        let defEntry = defLookup.get(defPath);
        // Fallback: node may have been moved into a layout container at a
        // different tree level. Look up by bind key to find actual def path.
        if (!defEntry && bindKeyMap) {
          const altPath = bindKeyMap.get(node.bind);
          if (altPath) {
            defPath = altPath;
            defEntry = defLookup.get(altPath);
          }
        }
        const itemType = defEntry?.item.type;
        const isGroup = itemType === 'group';
        const children = node.children ?? [];
        result.push({
          id: defPath,
          node,
          depth,
          hasChildren: children.length > 0,
          defPath,
          category: isGroup ? 'group' : 'field',
          nodeId: undefined,
          bind: node.bind,
        });
        if (children.length > 0) {
          walk(children, depth + 1, defPath);
        }
      } else if (node.nodeId) {
        // Display node (nodeId without _layout)
        const defPath = defPathPrefix ? `${defPathPrefix}.${node.nodeId}` : node.nodeId;
        result.push({
          id: node.nodeId,
          node,
          depth,
          hasChildren: false,
          defPath,
          category: 'display',
          nodeId: node.nodeId,
          bind: undefined,
        });
      }
    }
  }

  walk(root.children ?? [], 0, '');
  return result;
}
