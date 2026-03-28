/** @filedesc Shared authoring catalogs and tree helpers used by Studio and other clients. */
import type { FormBind, FormItem } from '@formspec-org/types';
import {
  COMPATIBILITY_MATRIX,
  COMPONENT_TO_HINT,
  KNOWN_COMPONENT_TYPES,
  SPEC_WIDGET_TO_COMPONENT,
} from '@formspec-org/types';

export interface DataTypeDisplay {
  icon: string;
  label: string;
  color: string;
}

export interface FieldTypeCatalogEntry {
  label: string;
  description: string;
  icon: string;
  color: string;
  itemType: 'field' | 'group' | 'display' | 'layout';
  component?: string;
  dataType?: string;
  extra?: Record<string, unknown>;
  category: string;
  keywords?: string[];
}

export interface FlatItem {
  path: string;
  item: FormItem;
  depth: number;
}

interface Shape {
  [key: string]: unknown;
}

export interface NormalizedBindEntry {
  path: string;
  entries: Record<string, string>;
}

export interface UnassignedItem {
  key: string;
  label: string;
  itemType: 'field' | 'group' | 'display';
}

const TYPE_MAP: Record<string, DataTypeDisplay> = {
  string: { icon: 'Aa', label: 'String', color: 'text-accent' },
  text: { icon: '¶', label: 'Long Text', color: 'text-accent' },
  integer: { icon: '#', label: 'Integer', color: 'text-green' },
  decimal: { icon: '#.#', label: 'Decimal', color: 'text-green' },
  boolean: { icon: '⊘', label: 'Boolean', color: 'text-logic' },
  date: { icon: 'D', label: 'Date', color: 'text-amber' },
  time: { icon: 'T', label: 'Time', color: 'text-amber' },
  dateTime: { icon: 'DT', label: 'DateTime', color: 'text-amber' },
  uri: { icon: '🔗', label: 'URI', color: 'text-accent' },
  choice: { icon: '◉', label: 'Choice', color: 'text-green' },
  multiChoice: { icon: '☑', label: 'Multi Choice', color: 'text-green' },
  attachment: { icon: '\u2191', label: 'File', color: 'text-muted' },
  money: { icon: '$', label: 'Money', color: 'text-amber' },
};

const ITEM_TYPE_WIDGETS: Record<string, string[]> = {
  group: ['Stack', 'Card', 'Accordion', 'Collapsible'],
  display: ['Text', 'Heading', 'Divider', 'Alert'],
};

const FIELD_TYPE_CATALOG: FieldTypeCatalogEntry[] = [
  { label: 'Text', description: 'Short text — names, identifiers, free input', icon: 'Aa', color: 'text-accent', itemType: 'field', dataType: 'string', category: 'Text', keywords: ['string', 'text', 'name', 'label', 'input'] },
  { label: 'Integer', description: 'Whole numbers — counts, ages, quantities', icon: '#', color: 'text-green', itemType: 'field', dataType: 'integer', category: 'Number', keywords: ['int', 'number', 'whole', 'count', 'quantity'] },
  { label: 'Decimal', description: 'Numbers with decimal places — rates, percentages', icon: '#.#', color: 'text-green', itemType: 'field', dataType: 'decimal', category: 'Number', keywords: ['float', 'decimal', 'number', 'percent', 'rate'] },
  { label: 'Money', description: 'Currency amounts with formatting', icon: '$', color: 'text-amber', itemType: 'field', dataType: 'money', category: 'Number', keywords: ['currency', 'amount', 'price', 'cost', 'money'] },
  { label: 'Single Choice', description: 'Pick exactly one option from a list', icon: '◉', color: 'text-logic', itemType: 'field', dataType: 'choice', category: 'Choice', keywords: ['radio', 'select', 'pick', 'option', 'choice', 'dropdown'] },
  { label: 'Multiple Choice', description: 'Pick one or more options from a list', icon: '☑', color: 'text-logic', itemType: 'field', dataType: 'multiChoice', category: 'Choice', keywords: ['checkbox', 'multi', 'select', 'option', 'choice'] },
  { label: 'Yes / No', description: 'Boolean toggle — true or false', icon: '⊘', color: 'text-logic', itemType: 'field', dataType: 'boolean', category: 'Choice', keywords: ['bool', 'boolean', 'toggle', 'flag', 'switch', 'true', 'false'] },
  { label: 'Date', description: 'Calendar date — year, month, day', icon: 'D', color: 'text-amber', itemType: 'field', dataType: 'date', category: 'Date & Time', keywords: ['date', 'calendar', 'day', 'month', 'year'] },
  { label: 'Time', description: 'Time of day — hours and minutes', icon: 'T', color: 'text-amber', itemType: 'field', dataType: 'time', category: 'Date & Time', keywords: ['time', 'hour', 'minute', 'clock'] },
  { label: 'Date & Time', description: 'Combined timestamp — date plus time', icon: 'DT', color: 'text-amber', itemType: 'field', dataType: 'dateTime', category: 'Date & Time', keywords: ['datetime', 'timestamp', 'date', 'time'] },
  { label: 'File Upload', description: 'Attach a file, photo, or document', icon: '\u2191', color: 'text-muted', itemType: 'field', dataType: 'attachment', category: 'Media', keywords: ['file', 'upload', 'photo', 'image', 'attachment'] },
  { label: 'Link / URI', description: 'A web address or resource identifier', icon: '🔗', color: 'text-accent', itemType: 'field', dataType: 'uri', category: 'Text', keywords: ['uri', 'url', 'link', 'web', 'address'] },
  { label: 'Group', description: 'Container for a set of related fields', icon: '▦', color: 'text-muted', itemType: 'group', category: 'Structure', keywords: ['group', 'section', 'container', 'nest'] },
  { label: 'Repeatable Group', description: 'A group the respondent fills in multiple times', icon: '⟳▦', color: 'text-accent', itemType: 'group', extra: { repeatable: true }, category: 'Structure', keywords: ['repeat', 'repeatable', 'group', 'loop', 'multiple'] },
  { label: 'Text Block', description: 'Read-only text, instructions, or content', icon: 'ℹ', color: 'text-accent', itemType: 'display', category: 'Content', keywords: ['display', 'text', 'note', 'read-only', 'info', 'instruction'] },
  { label: 'Heading', description: 'Section heading or title', icon: 'H', color: 'text-accent', itemType: 'display', extra: { presentation: { widgetHint: 'Heading' } }, category: 'Content', keywords: ['heading', 'title', 'header', 'h1', 'h2'] },
  { label: 'Divider', description: 'Horizontal line to separate content', icon: '—', color: 'text-muted', itemType: 'display', extra: { presentation: { widgetHint: 'Divider' } }, category: 'Content', keywords: ['divider', 'separator', 'line', 'hr'] },
  { label: 'Spacer', description: 'Vertical space between items', icon: '↕', color: 'text-muted', itemType: 'display', extra: { presentation: { widgetHint: 'Spacer' } }, category: 'Content', keywords: ['spacer', 'space', 'gap', 'padding'] },
  { label: 'Card', description: 'Bordered container with optional title', icon: '▢', color: 'text-accent', itemType: 'layout', component: 'Card', category: 'Layout', keywords: ['card', 'box', 'container', 'panel'] },
  { label: 'Columns', description: 'Side-by-side column layout', icon: '▥', color: 'text-accent', itemType: 'layout', component: 'Columns', category: 'Layout', keywords: ['columns', 'grid', 'side', 'two', 'multi'] },
  { label: 'Collapsible', description: 'Expandable/collapsible section', icon: '▽', color: 'text-accent', itemType: 'layout', component: 'Collapsible', category: 'Layout', keywords: ['collapsible', 'accordion', 'expand', 'collapse', 'toggle'] },
  { label: 'Stack', description: 'Vertical or horizontal stack container', icon: '▤', color: 'text-accent', itemType: 'layout', component: 'Stack', category: 'Layout', keywords: ['stack', 'vertical', 'horizontal', 'list', 'column'] },
];

export interface DefLookupEntry {
  item: FormItem;
  path: string;
  parentPath: string | null;
}

interface CompNode {
  component: string;
  bind?: string;
  nodeId?: string;
  _layout?: boolean;
  children?: CompNode[];
  [key: string]: unknown;
}

export interface FlatEntry {
  id: string;
  node: CompNode;
  depth: number;
  hasChildren: boolean;
  defPath: string | null;
  category: 'field' | 'group' | 'display' | 'layout';
  nodeId: string | undefined;
  bind: string | undefined;
}

const LAYOUT_PREFIX = '__node:';

function collectBoundKeys(nodes: CompNode[]): Set<string> {
  const keys = new Set<string>();
  for (const node of nodes) {
    if (node.bind) keys.add(node.bind);
    else if (node.nodeId && !node._layout) keys.add(node.nodeId);
    if (node.children) {
      for (const key of collectBoundKeys(node.children)) {
        keys.add(key);
      }
    }
  }
  return keys;
}

export function bindsFor(
  binds: FormBind[] | undefined | null,
  path: string,
): Record<string, string> {
  if (!binds) return {};
  const bind = binds.find((entry) => entry.path === path);
  if (!bind) return {};
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(bind)) {
    if (key !== 'path' && typeof value === 'string') {
      result[key] = value;
    }
  }
  return result;
}

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

export function shapesFor(shapes: Shape[] | undefined | null, path: string): Shape[] {
  if (!shapes) return [];
  return shapes.filter((shape) => {
    const targets = shape.targets;
    if (Array.isArray(targets)) return targets.includes(path);
    return shape.target === path;
  });
}

export function normalizeBindEntries(binds: unknown): NormalizedBindEntry[] {
  if (Array.isArray(binds)) {
    return binds.map((bind: any) => {
      const entries = Object.fromEntries(
        Object.entries(bind ?? {}).filter(([key, value]) => key !== 'path' && typeof value === 'string'),
      ) as Record<string, string>;
      return { path: bind.path ?? '', entries };
    });
  }

  return Object.entries((binds as Record<string, Record<string, string>>) ?? {}).map(([path, value]) => ({
    path,
    entries: Object.fromEntries(
      Object.entries(value ?? {}).filter(([, entryValue]) => typeof entryValue === 'string'),
    ) as Record<string, string>,
  }));
}

export function normalizeBindsView(binds: unknown, items: FormItem[] = []): Record<string, Record<string, unknown>> {
  const result: Record<string, Record<string, unknown>> = {};

  const lookup = buildDefLookup(items);
  for (const [path, entry] of lookup.entries()) {
    if (entry.item.prePopulate) {
      result[path] = { ...result[path], 'pre-populate': entry.item.prePopulate };
    }
  }

  for (const bind of normalizeBindEntries(binds)) {
    result[bind.path] = { ...result[bind.path], ...bind.entries };
  }

  return result;
}

export function computeUnassignedItems(
  items: FormItem[],
  treeChildren: CompNode[],
): UnassignedItem[] {
  const bound = collectBoundKeys(treeChildren);
  const unassigned: UnassignedItem[] = [];

  for (const item of items) {
    if (!bound.has(item.key)) {
      unassigned.push({
        key: item.key,
        label: item.label ?? item.key,
        itemType: item.type as 'field' | 'group' | 'display',
      });
    }
  }

  return unassigned;
}

export function dataTypeInfo(dataType: string): DataTypeDisplay {
  return TYPE_MAP[dataType] || { icon: '?', label: dataType, color: 'text-muted' };
}

export function countDefinitionFields(items: FormItem[]): number {
  let count = 0;
  for (const item of items) {
    if (item.type === 'field') count++;
    if (item.children) count += countDefinitionFields(item.children);
  }
  return count;
}

export function sanitizeIdentifier(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/_+$/, '');
}

export function compatibleWidgets(type: string, dataType?: string): string[] {
  if (type === 'field' && dataType) {
    return COMPATIBILITY_MATRIX[dataType] || [];
  }
  return ITEM_TYPE_WIDGETS[type] || [];
}

export function getFieldTypeCatalog(): FieldTypeCatalogEntry[] {
  return FIELD_TYPE_CATALOG.map((entry) => ({
    ...entry,
    ...(entry.extra ? { extra: structuredClone(entry.extra) } : {}),
    ...(entry.keywords ? { keywords: [...entry.keywords] } : {}),
  }));
}

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

export function componentForWidgetHint(widgetHint?: string | null): string | null {
  if (!widgetHint) return null;
  if (widgetHint.startsWith('x-')) return widgetHint;
  if (KNOWN_COMPONENT_TYPES.has(widgetHint)) return widgetHint;
  return SPEC_WIDGET_TO_COMPONENT[normalizeWidgetToken(widgetHint)] || null;
}

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

export function buildDefLookup(
  items: FormItem[],
  prefix = '',
  parentPath: string | null = null,
): Map<string, DefLookupEntry> {
  const map = new Map<string, DefLookupEntry>();
  for (const item of items) {
    const path = prefix ? `${prefix}.${item.key}` : item.key;
    map.set(path, { item, path, parentPath });
    if (item.children) {
      for (const [key, value] of buildDefLookup(item.children, path, path)) {
        map.set(key, value);
      }
    }
  }
  return map;
}

export function buildBindKeyMap(defLookup: Map<string, DefLookupEntry>): Map<string, string> {
  const map = new Map<string, string>();
  for (const [path, entry] of defLookup) {
    if (!map.has(entry.item.key)) {
      map.set(entry.item.key, path);
    }
  }
  return map;
}

export function pruneDescendants(paths: Set<string>): string[] {
  const result: string[] = [];
  for (const path of paths) {
    let hasAncestor = false;
    for (const other of paths) {
      if (other !== path && path.startsWith(other + '.')) {
        hasAncestor = true;
        break;
      }
    }
    if (!hasAncestor) result.push(path);
  }
  return result;
}

export function sortForBatchDelete(paths: string[]): string[] {
  return [...paths].sort((a, b) => b.split('.').length - a.split('.').length);
}

export function isLayoutId(id: string): boolean {
  return id.startsWith(LAYOUT_PREFIX);
}

export function nodeIdFromLayoutId(id: string): string {
  return id.startsWith(LAYOUT_PREFIX) ? id.slice(LAYOUT_PREFIX.length) : id;
}

export function nodeRefFor(entry: Pick<FlatEntry, 'bind' | 'nodeId'>): { bind: string } | { nodeId: string } {
  if (entry.bind) return { bind: entry.bind };
  return { nodeId: entry.nodeId! };
}

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

export function findComponentNodeById(
  node: Record<string, unknown> | undefined,
  nodeId: string,
): Record<string, unknown> | null {
  if (!node) return null;
  if (node.nodeId === nodeId) return node;
  const children = Array.isArray(node.children) ? (node.children as Record<string, unknown>[]) : [];
  for (const child of children) {
    const found = findComponentNodeById(child, nodeId);
    if (found) return found;
  }
  return null;
}

interface MoveCommand {
  type: 'definition.moveItem';
  payload: { sourcePath: string; targetParentPath: string; targetIndex: number };
}

export function buildBatchMoveCommands(
  paths: Set<string>,
  targetGroupPath: string,
): MoveCommand[] {
  const filtered = new Set<string>();
  for (const path of paths) {
    if (path === targetGroupPath || path.startsWith(targetGroupPath + '.')) continue;
    filtered.add(path);
  }
  const pruned = pruneDescendants(filtered);
  return pruned.map((sourcePath, index) => ({
    type: 'definition.moveItem' as const,
    payload: { sourcePath, targetParentPath: targetGroupPath, targetIndex: index },
  }));
}

function humanizeRef(ref: string): string {
  const name = ref.replace(/^\$/, '');
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}

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

export function humanizeFEL(expression: string): string {
  const trimmed = expression.trim();
  const match = trimmed.match(/^(\$\w+)\s*(!=|>=|<=|=|>|<)\s*(.+)$/);
  if (!match) return trimmed;

  const [, ref, op, value] = match;
  const humanOp = OP_MAP[op];
  if (!humanOp) return trimmed;

  return `${humanizeRef(ref)} ${humanOp} ${humanizeValue(value.trim())}`;
}
