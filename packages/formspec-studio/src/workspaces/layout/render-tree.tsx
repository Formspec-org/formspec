/** @filedesc Recursive component tree renderer for the Layout canvas — pages as sections, layout containers as wrappers. */
import type { DefLookupEntry } from '../../lib/field-helpers';
import { PageSection } from './PageSection';
import { LayoutContainer } from './LayoutContainer';
import { FieldBlock } from './FieldBlock';
import { DisplayBlock } from './DisplayBlock';

interface CompNode {
  component: string;
  bind?: string;
  nodeId?: string;
  title?: string;
  _layout?: boolean;
  children?: CompNode[];
  [key: string]: unknown;
}

interface Item {
  key: string;
  type: string;
  dataType?: string;
  label?: string;
}

export interface LayoutRenderContext {
  defLookup: Map<string, DefLookupEntry>;
  bindKeyMap: Map<string, string>;
}

function resolveDefPath(
  key: string,
  defPathPrefix: string,
  ctx: LayoutRenderContext,
): string | null {
  const candidate = defPathPrefix ? `${defPathPrefix}.${key}` : key;
  if (ctx.defLookup.has(candidate)) return candidate;
  return ctx.bindKeyMap.get(key) ?? candidate;
}

export function renderLayoutTree(
  nodes: CompNode[],
  ctx: LayoutRenderContext,
  defPathPrefix: string,
): React.ReactNode[] {
  const result: React.ReactNode[] = [];

  for (const node of nodes) {
    // Page node — render as titled section
    if (node._layout && node.component === 'Page') {
      const children = node.children
        ? renderLayoutTree(node.children, ctx, defPathPrefix)
        : null;
      result.push(
        <PageSection
          key={node.nodeId ?? node.title ?? 'page'}
          title={(node.title as string) || 'Untitled Page'}
          pageId={node.nodeId ?? 'page'}
        >
          {children}
        </PageSection>,
      );
      continue;
    }

    // Layout container (Card, Grid, Panel, Stack, etc.) — not a Page
    if (node._layout) {
      const children = node.children
        ? renderLayoutTree(node.children, ctx, defPathPrefix)
        : null;
      result.push(
        <LayoutContainer
          key={`node:${node.nodeId}`}
          component={node.component}
          nodeId={node.nodeId!}
        >
          {children}
        </LayoutContainer>,
      );
      continue;
    }

    // Bound node — field or group
    if (node.bind) {
      const defPath = resolveDefPath(node.bind, defPathPrefix, ctx);
      const defEntry = defPath ? ctx.defLookup.get(defPath) : null;
      if (!defPath || !defEntry) continue;

      const item = defEntry.item as Item;

      if (item.type === 'group') {
        // Groups render their children recursively
        const children = node.children
          ? renderLayoutTree(node.children, ctx, defPath)
          : null;
        result.push(
          <LayoutContainer
            key={defPath}
            component={item.label || item.key}
            nodeId={item.key}
          >
            {children}
          </LayoutContainer>,
        );
        continue;
      }

      result.push(
        <FieldBlock
          key={defPath}
          itemKey={item.key}
          label={item.label}
          dataType={item.dataType}
        />,
      );
      continue;
    }

    // Display node (nodeId, no _layout, no bind)
    if (node.nodeId) {
      const defPath = resolveDefPath(node.nodeId, defPathPrefix, ctx);
      const defEntry = defPath ? ctx.defLookup.get(defPath) : null;
      const label = (defEntry?.item as Item | undefined)?.label
        || (node as { text?: string }).text
        || node.nodeId;
      result.push(
        <DisplayBlock
          key={defPath || node.nodeId}
          itemKey={node.nodeId}
          label={label}
          widgetHint={node.component !== 'Text' ? node.component : undefined}
        />,
      );
    }
  }

  return result;
}
