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

/** Get bind entries for a specific field path (object-keyed format). */
export function bindsFor(
  binds: Record<string, Record<string, string>> | undefined | null,
  path: string
): Record<string, string> {
  if (!binds) return {};
  return binds[path] || {};
}

interface AnyBind {
  path: string;
  [k: string]: unknown;
}

/** Get bind properties for a field path from array-format binds. */
export function arrayBindsFor(
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
  integer: { icon: '#', label: 'Integer', color: 'text-green' },
  decimal: { icon: '#.#', label: 'Decimal', color: 'text-green' },
  boolean: { icon: '\u2298', label: 'Boolean', color: 'text-logic' },
  date: { icon: '\uD83D\uDCC5', label: 'Date', color: 'text-amber' },
  time: { icon: '\uD83D\uDD50', label: 'Time', color: 'text-amber' },
  dateTime: { icon: '\uD83D\uDCC5\uD83D\uDD50', label: 'DateTime', color: 'text-amber' },
  select1: { icon: '\u25C9', label: 'Select One', color: 'text-accent' },
  select: { icon: '\u2611', label: 'Select Many', color: 'text-accent' },
  binary: { icon: '\uD83D\uDCCE', label: 'Binary', color: 'text-muted' },
  geopoint: { icon: '\uD83D\uDCCD', label: 'Geopoint', color: 'text-green' },
  barcode: { icon: '|||', label: 'Barcode', color: 'text-muted' },
  money: { icon: '$', label: 'Money', color: 'text-amber' },
};

/** Get display info for a data type. */
export function dataTypeInfo(dataType: string): DataTypeDisplay {
  return TYPE_MAP[dataType] || { icon: '?', label: dataType, color: 'text-muted' };
}
