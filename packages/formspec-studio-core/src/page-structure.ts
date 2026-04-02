/** @filedesc Component-native page structure view for the Layout workspace. */
import type { FormItem, FormDefinition } from '@formspec-org/types';
import type { ComponentState } from '@formspec-org/core';
import { resolvePageStructure } from '@formspec-org/core';

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
  width: number;
  offset?: number;
  responsive: Record<string, {
    width?: number;
    offset?: number;
    hidden?: boolean;
  }>;
  itemType: 'field' | 'group' | 'display';
  childCount?: number;
  repeatable?: boolean;
  widgetHint?: string;
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
  itemPageMap: Record<string, string>;
  breakpointNames: string[];
  breakpointValues?: Record<string, number>;
  diagnostics: Array<{ severity: 'warning' | 'error'; message: string }>;
}

export type PageStructureViewInput = {
  definition: Pick<FormDefinition, 'formPresentation' | 'items'>;
  component?: Pick<ComponentState, 'tree'>;
  theme?: { breakpoints?: Record<string, number> };
};

function buildItemMaps(items: FormItem[]) {
  const labelMap = new Map<string, string>();
  const typeMap = new Map<string, 'field' | 'group' | 'display'>();
  const childCountMap = new Map<string, number>();
  const repeatableMap = new Map<string, boolean>();
  const widgetHintMap = new Map<string, string>();

  function walk(nodes: FormItem[]) {
    for (const item of nodes) {
      labelMap.set(item.key, item.label ?? item.key);
      typeMap.set(item.key, item.type as 'field' | 'group' | 'display');
      if (item.children) {
        childCountMap.set(item.key, item.children.length);
        walk(item.children);
      }
      if (item.repeatable) repeatableMap.set(item.key, true);
      if (item.presentation?.widgetHint) widgetHintMap.set(item.key, item.presentation.widgetHint);
    }
  }

  walk(items);
  return { labelMap, typeMap, childCountMap, repeatableMap, widgetHintMap };
}

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

export function resolveLayoutPageStructure(state: PageStructureViewInput): PageStructureView {
  const defItems = (state.definition.items ?? []) as FormItem[];
  const allKeys = collectAllKeys(defItems);
  const { labelMap, typeMap, childCountMap, repeatableMap, widgetHintMap } = buildItemMaps(defItems);
  const resolved = resolvePageStructure(
    { definition: state.definition, component: state.component },
    allKeys,
  );

  const pages: PageView[] = resolved.pages.map((page) => ({
    id: page.id,
    title: page.title,
    ...(page.description !== undefined && { description: page.description }),
    items: page.regions.map((region) => ({
      key: region.key,
      label: labelMap.get(region.key) ?? region.key,
      status: region.exists ? 'valid' : 'broken',
      width: region.span,
      ...(region.start !== undefined && { offset: region.start }),
      responsive: translateResponsive(region.responsive),
      itemType: typeMap.get(region.key) ?? 'field',
      ...(childCountMap.has(region.key) && { childCount: childCountMap.get(region.key) }),
      ...(repeatableMap.get(region.key) && { repeatable: true }),
      ...(widgetHintMap.has(region.key) && { widgetHint: widgetHintMap.get(region.key) }),
    })),
  }));

  const unassigned: PlaceableItem[] = resolved.unassignedItems.map((key) => ({
    key,
    label: labelMap.get(key) ?? key,
    itemType: typeMap.get(key) ?? 'field',
  }));

  return {
    mode: resolved.mode,
    pages,
    unassigned,
    itemPageMap: { ...resolved.itemPageMap },
    breakpointNames: state.theme?.breakpoints
      ? Object.keys(state.theme.breakpoints)
      : DEFAULT_BREAKPOINT_NAMES,
    breakpointValues: state.theme?.breakpoints ?? undefined,
    diagnostics: resolved.diagnostics.map((diagnostic) => ({
      severity: diagnostic.severity,
      message: diagnostic.message,
    })),
  };
}
