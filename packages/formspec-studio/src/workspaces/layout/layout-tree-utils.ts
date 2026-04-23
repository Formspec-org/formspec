import { isPlainObject } from '../shared/runtime-guards';
import type { CompNode, ContainerLayoutProps, DefLookupEntry } from '@formspec-org/studio-core';
import type { FormDefinition } from '@formspec-org/types';

/**
 * Wraps top-level groups in synthetic Page nodes when in 'wizard' or 'tabs' mode.
 */
export function synthesizePagedLayoutTree(nodes: CompNode[], definition: FormDefinition | null | undefined): CompNode[] {
  const formPresentation = isPlainObject(definition?.formPresentation) ? definition.formPresentation : undefined;
  const pageMode = formPresentation?.pageMode;
  if (pageMode !== 'wizard' && pageMode !== 'tabs') return nodes;

  const items = Array.isArray(definition?.items) ? definition.items : [];
  const topLevelGroupLabels = new Map<string, string>();
  for (const item of items) {
    if (!isPlainObject(item) || item.type !== 'group' || typeof item.key !== 'string') continue;
    topLevelGroupLabels.set(item.key, typeof item.label === 'string' && item.label.trim() ? item.label : item.key);
  }

  return nodes.map((node) => {
    if (node.component === 'Page') return node;
    if (typeof node.bind !== 'string') return node;
    const title = topLevelGroupLabels.get(node.bind);
    if (!title) return node;
    return {
      component: 'Page',
      nodeId: `layout-page-${node.bind}`,
      title,
      _layout: true,
      syntheticPage: true,
      groupPath: node.bind,
      children: [node],
    };
  });
}

export function resolveDefPathMaps(
  key: string,
  defPathPrefix: string,
  defLookup: Map<string, DefLookupEntry>,
  bindKeyMap: Map<string, string>,
  definitionItemPath?: string,
): string | null {
  const candidate = defPathPrefix ? `${defPathPrefix}.${key}` : key;
  if (defLookup.has(candidate)) return candidate;
  if (definitionItemPath && defLookup.has(definitionItemPath)) return definitionItemPath;
  return bindKeyMap.get(key) ?? candidate;
}

/** Parse column span from a style.gridColumn value like "span 2". */
export function parseColSpan(gridColumn: unknown): number {
  if (typeof gridColumn !== 'string') return 1;
  const m = gridColumn.match(/span\s+(\d+)/i);
  return m ? parseInt(m[1], 10) : 1;
}

/** Parse row span from a style.gridRow value like "span 2". */
export function parseRowSpan(gridRow: unknown): number {
  if (typeof gridRow !== 'string') return 1;
  const m = gridRow.match(/span\s+(\d+)/i);
  return m ? parseInt(m[1], 10) : 1;
}

export function buildContainerLayoutProps(node: CompNode): ContainerLayoutProps {
  return {
    columns: typeof node.columns === 'number' ? node.columns : undefined,
    gap: typeof node.gap === 'string' ? node.gap : undefined,
    direction: node.direction,
    wrap: node.wrap,
    align: node.align,
    elevation: typeof node.elevation === 'number' ? node.elevation : undefined,
    width: typeof node.width === 'string' ? node.width : undefined,
    position: node.position,
    title: node.title,
    defaultOpen: typeof node.defaultOpen === 'boolean' ? node.defaultOpen : undefined,
    nodeStyle: node.style,
  };
}

