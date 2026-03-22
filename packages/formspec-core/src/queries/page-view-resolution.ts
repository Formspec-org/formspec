/** @filedesc Behavioral page-view query — translates schema-native page structure to UI vocabulary. */
import type { FormItem, FormDefinition, ThemeDocument } from 'formspec-types';
import { resolvePageStructure } from '../page-resolution.js';

// ── Behavioral types ────────────────────────────────────────────────

/** What PagesTab sees — no schema vocabulary. */
export interface PageView {
  id: string;
  title: string;
  description?: string;
  items: PageItemView[];
}

export interface PageItemView {
  key: string;
  label: string;
  status: 'valid' | 'broken';
  width: number;             // 1-12, from Region.span
  offset?: number;           // from Region.start
  responsive: Record<string, {
    width?: number;
    offset?: number;
    hidden?: boolean;
  }>;
  itemType: 'field' | 'group' | 'display';
  childCount?: number;       // only set for groups
  repeatable?: boolean;      // only set for repeatable groups
}

export interface PlaceableItem {
  key: string;
  label: string;
  itemType: 'field' | 'group' | 'display';
}

export interface PageStructureView {
  mode: 'single' | 'wizard' | 'tabs';
  pages: PageView[];
  unassigned: PlaceableItem[];
  /** Maps each placed item key to the page ID it belongs to. */
  itemPageMap: Record<string, string>;
  breakpointNames: string[];
  breakpointValues?: Record<string, number>;
  diagnostics: Array<{ severity: 'warning' | 'error'; message: string }>;
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Walk the item tree depth-first, building lookup maps for labels, types, child counts, and repeatability. */
function buildItemMaps(items: FormItem[]) {
  const labelMap = new Map<string, string>();
  const typeMap = new Map<string, 'field' | 'group' | 'display'>();
  const childCountMap = new Map<string, number>();
  const repeatableMap = new Map<string, boolean>();

  function walk(nodes: FormItem[]) {
    for (const item of nodes) {
      labelMap.set(item.key, item.label ?? item.key);
      typeMap.set(item.key, item.type as 'field' | 'group' | 'display');
      if (item.children) {
        childCountMap.set(item.key, item.children.length);
        walk(item.children);
      }
      if (item.repeatable) {
        repeatableMap.set(item.key, true);
      }
    }
  }
  walk(items);
  return { labelMap, typeMap, childCountMap, repeatableMap };
}

/** Collect all top-level item keys (non-recursive — same set resolvePageStructure uses). */
function collectAllKeys(items: FormItem[]): string[] {
  const keys: string[] = [];
  function walk(nodes: FormItem[]) {
    for (const item of nodes) {
      keys.push(item.key);
      if (item.children) walk(item.children);
    }
  }
  walk(items);
  return keys;
}

/** Translate Region.responsive (schema: span/start/hidden) to PageItemView.responsive (behavioral: width/offset/hidden). */
function translateResponsive(
  raw?: Record<string, { span?: number; start?: number; hidden?: boolean }>,
): Record<string, { width?: number; offset?: number; hidden?: boolean }> {
  if (!raw) return {};
  const result: Record<string, { width?: number; offset?: number; hidden?: boolean }> = {};
  for (const [bp, overrides] of Object.entries(raw)) {
    const entry: { width?: number; offset?: number; hidden?: boolean } = {};
    if (overrides.span !== undefined) entry.width = overrides.span;
    if (overrides.start !== undefined) entry.offset = overrides.start;
    if (overrides.hidden !== undefined) entry.hidden = overrides.hidden;
    result[bp] = entry;
  }
  return result;
}

const DEFAULT_BREAKPOINT_NAMES = ['sm', 'md', 'lg'];

// ── Query function ──────────────────────────────────────────────────

/** Minimal input: only the document slices resolvePageView actually reads. */
export type PageViewInput = {
  definition: Pick<FormDefinition, 'formPresentation' | 'items'>;
  theme: Pick<ThemeDocument, 'pages'> & { breakpoints?: Record<string, number> };
};

/**
 * Resolves the page structure into behavioral types for the Pages UI.
 *
 * Pure function that wraps `resolvePageStructure` and translates schema vocabulary
 * (span, start, exists) to UI vocabulary (width, offset, status).
 */
export function resolvePageView(state: PageViewInput): PageStructureView {
  const defItems: FormItem[] = (state.definition.items ?? []) as FormItem[];
  const allKeys = collectAllKeys(defItems);
  const { labelMap, typeMap, childCountMap, repeatableMap } = buildItemMaps(defItems);

  const resolved = resolvePageStructure(
    { theme: state.theme as any, definition: state.definition },
    allKeys,
  );

  const pages: PageView[] = resolved.pages.map(p => ({
    id: p.id,
    title: p.title,
    ...(p.description !== undefined && { description: p.description }),
    items: p.regions.map(r => ({
      key: r.key,
      label: labelMap.get(r.key) ?? r.key,
      status: (r.exists ? 'valid' : 'broken') as 'valid' | 'broken',
      width: r.span,
      ...(r.start !== undefined && { offset: r.start }),
      responsive: translateResponsive(r.responsive),
      itemType: typeMap.get(r.key) ?? 'field',
      ...(childCountMap.has(r.key) && { childCount: childCountMap.get(r.key) }),
      ...(repeatableMap.get(r.key) && { repeatable: true }),
    })),
  }));

  // Placement map must match resolvePageStructure (includes propagation from
  // group regions to children). Do not rebuild from page.items only — that
  // breaks palette "placed elsewhere" state for nested fields.
  const itemPageMap: Record<string, string> = { ...resolved.itemPageMap };

  const unassigned: PlaceableItem[] = resolved.unassignedItems.map(key => ({
    key,
    label: labelMap.get(key) ?? key,
    itemType: typeMap.get(key) ?? 'field',
  }));

  const breakpointNames: string[] = state.theme.breakpoints
    ? Object.keys(state.theme.breakpoints)
    : DEFAULT_BREAKPOINT_NAMES;

  const diagnostics = resolved.diagnostics.map(d => ({
    severity: d.severity,
    message: d.message,
  }));

  return {
    mode: resolved.mode,
    pages,
    unassigned,
    itemPageMap,
    breakpointNames,
    breakpointValues: state.theme.breakpoints ?? undefined,
    diagnostics,
  };
}
