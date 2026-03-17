import {
  COMPATIBILITY_MATRIX,
  COMPONENT_TO_HINT,
  SPEC_WIDGET_TO_COMPONENT,
  KNOWN_COMPONENT_TYPES,
} from 'formspec-layout';

interface AnyItem {
  key: string;
  type: string;
  dataType?: string;
  children?: AnyItem[];
  [k: string]: unknown;
}

interface FlatItem {
  path: string;
  item: AnyItem;
  depth: number;
}

/** Flatten a nested item tree into a flat list with dot-paths. */
export function flatItems(items: AnyItem[], prefix = '', depth = 0): FlatItem[] {
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

interface AnyBind {
  path: string;
  [k: string]: unknown;
}

/** Get bind properties for a field path from array-format binds. */
export function bindsFor(
  binds: AnyBind[] | undefined | null,
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
  name: string;
  severity: string;
  constraint: string;
  targets?: string[];
  [k: string]: unknown;
}

/** Get shapes that target a specific field path. */
export function shapesFor(shapes: Shape[] | undefined | null, path: string): Shape[] {
  if (!shapes) return [];
  return shapes.filter(s => s.targets?.includes(path));
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
