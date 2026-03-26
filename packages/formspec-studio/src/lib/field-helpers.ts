/** @filedesc Helpers for flattening item trees, resolving binds/shapes, widget compatibility, and editor-canvas utilities. */

import type { FormItem, FormBind } from 'formspec-types';
import {
  COMPATIBILITY_MATRIX,
  COMPONENT_TO_HINT,
  SPEC_WIDGET_TO_COMPONENT,
  KNOWN_COMPONENT_TYPES,
} from 'formspec-layout';

export interface FlatItem {
  path: string;
  item: FormItem;
  depth: number;
}

/** Flatten a nested item tree into a flat list with dot-paths. */
export function flatItems(items: FormItem[], prefix = '', depth = 0): FlatItem[] {
  const result: FlatItem[] = [];
  for (const item of items) {
    const path = prefix ? `${prefix}.${item.key}` : item.key;
    result.push({ path, item, depth });
    if (item.children) {
      result.push(...flatItems(item.children, path, depth + 1));
    }
  }
  return result;
}

/** Get bind properties for a field path from array-format binds. */
export function bindsFor(
  binds: FormBind[] | undefined | null,
  path: string
): Record<string, string> {
  if (!binds) return {};
  const bind = binds.find(b => b.path === path);
  if (!bind) return {};
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(bind)) {
    if (k !== 'path' && typeof v === 'string') {
      result[k] = v;
    }
  }
  return result;
}

interface Shape {
  [k: string]: unknown;
}

/** Get shapes that target a specific field path. */
export function shapesFor(shapes: Shape[] | undefined | null, path: string): Shape[] {
  if (!shapes) return [];
  return shapes.filter(s => {
    // Schema shapes use `target` (singular); legacy/UI shapes may use `targets` (array)
    const targets = s.targets;
    if (Array.isArray(targets)) return targets.includes(path);
    return s.target === path;
  });
}

interface DataTypeDisplay {
  icon: string;
  label: string;
  color: string;
}

const TYPE_MAP: Record<string, DataTypeDisplay> = {
  string: { icon: 'Aa', label: 'String', color: 'text-accent' },
  text: { icon: '¶', label: 'Long Text', color: 'text-accent' },
  integer: { icon: '#', label: 'Integer', color: 'text-green' },
  decimal: { icon: '#.#', label: 'Decimal', color: 'text-green' },
  boolean: { icon: '⊘', label: 'Boolean', color: 'text-logic' },
  date: { icon: '📅', label: 'Date', color: 'text-amber' },
  time: { icon: '🕐', label: 'Time', color: 'text-amber' },
  dateTime: { icon: '📅🕐', label: 'DateTime', color: 'text-amber' },
  choice: { icon: '◉', label: 'Choice', color: 'text-green' },
  select1: { icon: '◉', label: 'Select One', color: 'text-accent' },
  select: { icon: '☑', label: 'Select Many', color: 'text-accent' },
  attachment: { icon: '⬆', label: 'File', color: 'text-muted' },
  binary: { icon: '📎', label: 'Binary', color: 'text-muted' },
  geopoint: { icon: '📍', label: 'Geopoint', color: 'text-green' },
  barcode: { icon: '|||', label: 'Barcode', color: 'text-muted' },
  money: { icon: '$', label: 'Money', color: 'text-amber' },
};

/** Get display info for a data type. */
export function dataTypeInfo(dataType: string): DataTypeDisplay {
  return TYPE_MAP[dataType] || { icon: '?', label: dataType, color: 'text-muted' };
}

/**
 * Widget compatibility: which component types can render each item type + dataType.
 * Field-level entries are derived from formspec-layout's canonical COMPATIBILITY_MATRIX.
 * Group/display entries are local (they're UI-tier only).
 */
const ITEM_TYPE_WIDGETS: Record<string, string[]> = {
  group: ['Stack', 'Card', 'Accordion', 'Collapsible'],
  display: ['Text', 'Heading', 'Divider', 'Alert'],
};

/** Get compatible widget component names for a given item type and optional dataType. */
export function compatibleWidgets(type: string, dataType?: string): string[] {
  if (type === 'field' && dataType) {
    return COMPATIBILITY_MATRIX[dataType] || [];
  }
  return ITEM_TYPE_WIDGETS[type] || [];
}

/** Convert a concrete component type into the closest Tier 1 widgetHint token. */
export function widgetHintForComponent(component: string, dataType?: string): string {
  if (component === 'TextInput') {
    if (dataType === 'text') return 'textarea';
    if (dataType === 'date') return 'dateInput';
    if (dataType === 'dateTime') return 'dateTimeInput';
    if (dataType === 'time') return 'timeInput';
  }
  if (component === 'DatePicker') {
    if (dataType === 'time') return 'timePicker';
    if (dataType === 'dateTime') return 'dateTimePicker';
  }
  return COMPONENT_TO_HINT[component] || component;
}

function normalizeWidgetToken(widget: string): string {
  return widget.replace(/[\s_-]+/g, '').toLowerCase();
}

/** Convert a Tier 1 widgetHint token back into the component id used in the component tree. */
export function componentForWidgetHint(widgetHint?: string | null): string | null {
  if (!widgetHint) return null;
  if (widgetHint.startsWith('x-')) return widgetHint;
  // If it's already a known component name, return it
  if (KNOWN_COMPONENT_TYPES.has(widgetHint)) return widgetHint;
  return SPEC_WIDGET_TO_COMPONENT[normalizeWidgetToken(widgetHint)] || null;
}

/** Help text for property labels, derived from schema descriptions. */
export const propertyHelp: Record<string, string> = {
  key: 'Stable identifier for this item. Must be unique across the entire Definition.',
  label: 'Primary human-readable label displayed when rendering the item.',
  type: "Item type: 'field' captures data, 'group' is a structural container, 'display' is read-only content.",
  dataType: 'The value type of this field. Determines JSON representation, valid operations, and default widget.',
  description: 'Human-readable help text. Shown on demand (e.g., tooltip or help icon).',
  hint: 'Short instructional text displayed alongside the input (e.g., below the label or as placeholder guidance).',
  widgetHint: 'Preferred UI control. Incompatible or unrecognized values are ignored; processor uses its default widget.',
  initialValue: 'Value assigned when a new Response is created. May be a literal or an expression prefixed with "=". Evaluated once — not reactively re-evaluated.',
  precision: 'Number of decimal places. Implementations should round or constrain input to this precision.',
  currency: 'ISO 4217 currency code for this money field (e.g., USD, EUR).',
  prefix: 'Display prefix rendered before the input (e.g., "$"). Does not appear in stored data.',
  suffix: 'Display suffix rendered after the input (e.g., "%", "kg"). Does not appear in stored data.',
  semanticType: 'Domain meaning annotation (e.g., "us-gov:ein", "ietf:email"). Metadata only — does not affect validation.',
  repeatable: 'When true, this group represents a one-to-many collection. Users can add/remove instances.',
  minRepeat: 'Minimum number of repetitions. Processor pre-populates this many empty instances on creation.',
  maxRepeat: 'Maximum number of repetitions. Absent means unbounded.',
  options: 'Valid values for choice or multiChoice fields.',
  prePopulate: 'Loads a value from a secondary instance at Response creation. Takes precedence over initialValue when both are present.',
  instance: 'Name of the secondary instance to read from (must match a key in "instances").',
  path: 'Dot-notation path within the instance to read the value from.',
  editable: 'When false, the field is locked (readonly) after pre-population.',
};

// ── Migrated from tree-helpers.ts ──────────────────────────────────

/** A component tree node (matches the shape from studio-core). */
interface CompNode {
  component: string;
  bind?: string;
  nodeId?: string;
  _layout?: boolean;
  children?: CompNode[];
  [key: string]: unknown;
}

/** Result of buildDefLookup — maps item paths to their definition item + context. */
export interface DefLookupEntry {
  item: FormItem;
  path: string;
  parentPath: string | null;
}

/** A flattened entry from the component tree, used by EditorCanvas and DnD. */
export interface FlatEntry {
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
export function nodeRefFor(entry: Pick<FlatEntry, 'bind' | 'nodeId'>): { bind: string } | { nodeId: string } {
  if (entry.bind) return { bind: entry.bind };
  return { nodeId: entry.nodeId! };
}

/**
 * Build a flat lookup map from definition item paths to their items.
 * Recursively walks nested children, building dot-separated paths.
 */
export function buildDefLookup(items: FormItem[], prefix = '', parentPath: string | null = null): Map<string, DefLookupEntry> {
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

/**
 * Build a secondary lookup from item key (bind value) to definition path.
 * Used when a bound node has been moved into a layout container at a
 * different tree level.
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
): FlatEntry[] {
  const result: FlatEntry[] = [];

  function walk(nodes: CompNode[], depth: number, defPathPrefix: string): void {
    for (const node of nodes) {
      if (node._layout) {
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
        let defPath = defPathPrefix ? `${defPathPrefix}.${node.bind}` : node.bind;
        let defEntry = defLookup.get(defPath);
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
        let defPath = defPathPrefix ? `${defPathPrefix}.${node.nodeId}` : node.nodeId;
        if (!defLookup.get(defPath) && bindKeyMap) {
          const altPath = bindKeyMap.get(node.nodeId);
          if (altPath) defPath = altPath;
        }
        result.push({
          id: defPath,
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

// ── Migrated from selection-helpers.ts ─────────────────────────────

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

// ── Migrated from humanize.ts ──────────────────────────────────────

/** Convert a FEL field reference to a human-readable label. */
function humanizeRef(ref: string): string {
  const name = ref.replace(/^\$/, '');
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, c => c.toUpperCase())
    .trim();
}

/** Convert a value literal to human-readable form. */
function humanizeValue(val: string): string {
  if (val === 'true') return 'Yes';
  if (val === 'false') return 'No';
  return val;
}

const OP_MAP: Record<string, string> = {
  '=': 'is',
  '!=': 'is not',
  '>': 'is greater than',
  '>=': 'is at least',
  '<': 'is less than',
  '<=': 'is at most',
};

/**
 * Attempt to convert a FEL expression to a human-readable string.
 * Only handles simple `$ref op value` patterns. Returns the raw expression
 * for anything more complex.
 */
export function humanizeFEL(expression: string): string {
  const trimmed = expression.trim();

  const match = trimmed.match(/^(\$\w+)\s*(!=|>=|<=|=|>|<)\s*(.+)$/);
  if (!match) return trimmed;

  const [, ref, op, value] = match;
  const humanOp = OP_MAP[op];
  if (!humanOp) return trimmed;

  return `${humanizeRef(ref)} ${humanOp} ${humanizeValue(value.trim())}`;
}
