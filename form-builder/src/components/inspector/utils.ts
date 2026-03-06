import type { FormspecBind, FormspecItem } from 'formspec-engine';
import type { FormspecComponentDocument, FormspecThemeDocument } from '../../state/project';
import type { GeneratedComponentNode } from '../../state/wiring';
import { findComponentNodeByPath, getLeafKey } from '../../state/wiring';

export function findItemByPath(items: FormspecItem[], path: string): FormspecItem | null {
  const segments = path.split('.').filter(Boolean);
  if (!segments.length) {
    return null;
  }

  let currentItems = items;
  for (let index = 0; index < segments.length; index += 1) {
    const key = segments[index];
    const item = currentItems.find((candidate) => candidate.key === key);
    if (!item) {
      return null;
    }
    if (index === segments.length - 1) {
      return item;
    }
    currentItems = item.children ?? [];
  }

  return null;
}

export function findBindByPath(binds: FormspecBind[] | undefined, path: string): FormspecBind | undefined {
  return binds?.find((bind) => bind.path === path);
}

export function getThemeItemPresentation(
  theme: FormspecThemeDocument,
  path: string
): Record<string, unknown> {
  const leafKey = getLeafKey(path);
  return (theme.items?.[leafKey] as Record<string, unknown>) ?? {};
}

export function getFieldString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function getFieldNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

export function getComponentResponsiveOverride(
  definitionItems: FormspecItem[],
  component: FormspecComponentDocument,
  path: string,
  breakpointName: string
): Record<string, unknown> {
  const node = getComponentNodeByPath(definitionItems, component, path);
  if (!node?.responsive || !breakpointName) {
    return {};
  }

  const override = node.responsive[breakpointName];
  return override && typeof override === 'object' ? override : {};
}

export function getComponentNodeByPath(
  definitionItems: FormspecItem[],
  component: FormspecComponentDocument,
  path: string
): GeneratedComponentNode | null {
  return findComponentNodeByPath(definitionItems, component.tree, path);
}
