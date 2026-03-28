/** @filedesc Recursive Layout canvas renderer for authored Page sections, layout containers, and bound nodes. */
import type { DefLookupEntry } from '@formspec-org/studio-core';
import { LayoutPageSection } from './LayoutPageSection';
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
  selectedKey: string | null;
  onSelect: (key: string, type: 'field' | 'group' | 'display' | 'layout') => void;
  activePageId: string | null;
  onSelectPage: (pageId: string) => void;
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
    // Authored Page node — render as a titled section in the Layout workspace.
    if (node._layout && node.component === 'Page') {
      const children = node.children
        ? renderLayoutTree(node.children, ctx, defPathPrefix)
        : null;
      result.push(
        <LayoutPageSection
          key={node.nodeId ?? node.title ?? 'page'}
          title={(node.title as string) || 'Untitled Page'}
          pageId={node.nodeId ?? 'page'}
          active={ctx.activePageId === (node.nodeId ?? 'page')}
          onSelect={ctx.onSelectPage}
        >
          {children}
        </LayoutPageSection>,
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
          nodeType="layout"
          nodeId={node.nodeId!}
          selected={ctx.selectedKey === `__node:${node.nodeId!}`}
          onSelect={() => ctx.onSelect(`__node:${node.nodeId!}`, 'layout')}
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
          nodeType="group"
          bind={item.key}
          bindPath={defPath}
          selected={ctx.selectedKey === defPath}
          onSelect={() => ctx.onSelect(defPath, 'group')}
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
          bindPath={defPath}
          selectionKey={defPath}
          label={item.label}
          dataType={item.dataType}
          selected={ctx.selectedKey === defPath}
          onSelect={(selectionKey) => ctx.onSelect(selectionKey, 'field')}
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
          selectionKey={defPath || node.nodeId}
          label={label}
          widgetHint={node.component !== 'Text' ? node.component : undefined}
          selected={ctx.selectedKey === (defPath || node.nodeId)}
          onSelect={(selectionKey) => ctx.onSelect(selectionKey, 'display')}
        />,
      );
    }
  }

  return result;
}
