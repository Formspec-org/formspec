/** @filedesc Recursive Layout canvas renderer for authored Page sections, layout containers, and bound nodes. Passes layout context (parentContainerType, parentGridColumns) to children. */
import type { CompNode, DefLookupEntry } from '@formspec-org/studio-core';
import { LayoutPageSection } from './LayoutPageSection';
import { LayoutContainer } from './LayoutContainer';
import { FieldBlock, type LayoutContext } from './FieldBlock';
import { DisplayBlock } from './DisplayBlock';

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
  /** Write a property to a component node identified by selectionKey. */
  onSetNodeProp?: (selectionKey: string, key: string, value: unknown) => void;
  /** Unwrap a layout node (remove container, keep children). */
  onUnwrapNode?: (selectionKey: string) => void;
  /** Remove a layout node from the tree. */
  onRemoveNode?: (selectionKey: string) => void;
  /** Add a style override to a component node. */
  onStyleAdd?: (selectionKey: string, key: string, value: string) => void;
  /** Remove a style override from a component node. */
  onStyleRemove?: (selectionKey: string, key: string) => void;
  /** Resize a node's grid column span. */
  onResizeColSpan?: (selectionKey: string, newSpan: number) => void;
  /** Resize a node's grid row span. */
  onResizeRowSpan?: (selectionKey: string, newSpan: number) => void;
}

/** Layout context propagated from a parent container down to its children. */
interface ParentLayoutContext {
  parentContainerType: string | null;
  parentGridColumns: number;
}

const ROOT_CONTEXT: ParentLayoutContext = {
  parentContainerType: null,
  parentGridColumns: 0,
};

function resolveDefPath(
  key: string,
  defPathPrefix: string,
  ctx: LayoutRenderContext,
): string | null {
  const candidate = defPathPrefix ? `${defPathPrefix}.${key}` : key;
  if (ctx.defLookup.has(candidate)) return candidate;
  return ctx.bindKeyMap.get(key) ?? candidate;
}

/** Parse column span from a style.gridColumn value like "span 2". */
function parseColSpan(gridColumn: unknown): number {
  if (typeof gridColumn !== 'string') return 1;
  const m = gridColumn.match(/span\s+(\d+)/i);
  return m ? parseInt(m[1], 10) : 1;
}

/** Parse row span from a style.gridRow value like "span 2". */
function parseRowSpan(gridRow: unknown): number {
  if (typeof gridRow !== 'string') return 1;
  const m = gridRow.match(/span\s+(\d+)/i);
  return m ? parseInt(m[1], 10) : 1;
}

/** Render a LayoutContainer with shared props. */
function renderContainer(
  key: React.Key,
  node: CompNode,
  nodeType: 'layout' | 'group',
  selectionKey: string,
  ctx: LayoutRenderContext,
  children: React.ReactNode,
  extraProps?: Partial<{
    bind: string;
    bindPath: string;
    nodeId: string;
  }>,
) {
  return (
    <LayoutContainer
      key={key}
      component={node.component}
      nodeType={nodeType}
      bind={extraProps?.bind}
      bindPath={extraProps?.bindPath}
      nodeId={extraProps?.nodeId}
      selectionKey={selectionKey}
      selected={ctx.selectedKey === selectionKey}
      onSelect={() => ctx.onSelect(selectionKey, nodeType === 'layout' ? 'layout' : 'group')}
      columns={node.columns}
      gap={node.gap}
      direction={node.direction}
      wrap={node.wrap}
      align={node.align}
      elevation={node.elevation}
      width={node.width}
      position={node.position}
      title={node.title}
      defaultOpen={node.defaultOpen}
      nodeStyle={node.style}
      nodeProps={node as Record<string, unknown>}
      onSetProp={ctx.onSetNodeProp ? (k, v) => ctx.onSetNodeProp!(selectionKey, k, v) : undefined}
      onSetStyle={ctx.onStyleAdd ? (k, v) => ctx.onStyleAdd!(selectionKey, k, v) : undefined}
      onUnwrap={ctx.onUnwrapNode ? () => ctx.onUnwrapNode!(selectionKey) : undefined}
      onRemove={ctx.onRemoveNode ? () => ctx.onRemoveNode!(selectionKey) : undefined}
      onStyleRemove={ctx.onStyleRemove ? (k) => ctx.onStyleRemove!(selectionKey, k) : undefined}
    >
      {children}
    </LayoutContainer>
  );
}

export function renderLayoutTree(
  nodes: CompNode[],
  ctx: LayoutRenderContext,
  defPathPrefix: string,
  parentCtx: ParentLayoutContext = ROOT_CONTEXT,
): React.ReactNode[] {
  const result: React.ReactNode[] = [];

  for (const node of nodes) {
    // Authored Page node — render as a titled section in the Layout workspace.
    if (node._layout && node.component === 'Page') {
      const children = node.children
        ? renderLayoutTree(node.children, ctx, defPathPrefix, ROOT_CONTEXT)
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

    // Tier 3 display-only nodes (Heading, Divider) — _layout:true but no children
    if (node._layout && (node.component === 'Heading' || node.component === 'Divider')) {
      if (!node.nodeId) continue;
      const label = (node.component === 'Divider' ? (node.label as string) : (node.text as string)) || node.component;
      const displayLayoutCtx: LayoutContext | undefined = parentCtx.parentContainerType
        ? {
            parentContainerType: parentCtx.parentContainerType,
            parentGridColumns: parentCtx.parentGridColumns,
            currentColSpan: parseColSpan(node.style?.gridColumn),
            currentRowSpan: parseRowSpan(node.style?.gridRow),
          }
        : undefined;
      const nodeSelKey = `__node:${node.nodeId!}`;
      result.push(
        <DisplayBlock
          key={`node:${node.nodeId}`}
          itemKey={node.nodeId!}
          selectionKey={nodeSelKey}
          label={label}
          widgetHint={node.component}
          selected={ctx.selectedKey === nodeSelKey}
          onSelect={(selectionKey) => ctx.onSelect(selectionKey, 'layout')}
          layoutContext={displayLayoutCtx}
          nodeStyle={node.style as Record<string, unknown> | undefined}
          onResizeColSpan={ctx.onResizeColSpan ? (n) => ctx.onResizeColSpan!(nodeSelKey, n) : undefined}
          onResizeRowSpan={ctx.onResizeRowSpan ? (n) => ctx.onResizeRowSpan!(nodeSelKey, n) : undefined}
        />,
      );
      continue;
    }

    // Layout container (Card, Grid, Panel, Stack, Collapsible, Accordion, etc.)
    if (node._layout) {
      if (!node.nodeId) continue;
      const childCtx: ParentLayoutContext = {
        parentContainerType: node.component.toLowerCase(),
        parentGridColumns: node.columns ?? 2,
      };
      const children = node.children
        ? renderLayoutTree(node.children, ctx, defPathPrefix, childCtx)
        : null;
      const nodeSelKey = `__node:${node.nodeId!}`;
      result.push(
        renderContainer(`node:${node.nodeId}`, node, 'layout', nodeSelKey, ctx, children, { nodeId: node.nodeId! }),
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
        const childCtx: ParentLayoutContext = {
          parentContainerType: node.component.toLowerCase(),
          parentGridColumns: (node.columns as number | undefined) ?? 2,
        };
        const children = node.children
          ? renderLayoutTree(node.children, ctx, defPath, childCtx)
          : null;
        const groupSelKey = defPath;
        result.push(
          renderContainer(defPath, node, 'group', groupSelKey, ctx, children, {
            bind: item.key,
            bindPath: defPath,
          }),
        );
        continue;
      }

      const fieldLayoutCtx: LayoutContext | undefined = parentCtx.parentContainerType
        ? {
            parentContainerType: parentCtx.parentContainerType,
            parentGridColumns: parentCtx.parentGridColumns,
            currentColSpan: parseColSpan(node.style?.gridColumn),
            currentRowSpan: parseRowSpan(node.style?.gridRow),
          }
        : undefined;

      result.push(
        <FieldBlock
          key={defPath}
          itemKey={item.key}
          bindPath={defPath}
          selectionKey={defPath}
          label={item.label}
          dataType={item.dataType}
          itemType={item.type}
          selected={ctx.selectedKey === defPath}
          onSelect={(selectionKey) => ctx.onSelect(selectionKey, 'field')}
          layoutContext={fieldLayoutCtx}
          nodeStyle={node.style}
          nodeProps={node as Record<string, unknown>}
          onSetProp={ctx.onSetNodeProp ? (k, v) => ctx.onSetNodeProp!(defPath, k, v) : undefined}
          onSetStyle={ctx.onStyleAdd ? (k, v) => ctx.onStyleAdd!(defPath, k, v) : undefined}
          onResizeColSpan={ctx.onResizeColSpan ? (n) => ctx.onResizeColSpan!(defPath, n) : undefined}
          onResizeRowSpan={ctx.onResizeRowSpan ? (n) => ctx.onResizeRowSpan!(defPath, n) : undefined}
          onRemove={ctx.onRemoveNode ? () => ctx.onRemoveNode!(defPath) : undefined}
          onStyleRemove={ctx.onStyleRemove ? (k) => ctx.onStyleRemove!(defPath, k) : undefined}
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
      const displayLayoutCtx2: LayoutContext | undefined = parentCtx.parentContainerType
        ? {
            parentContainerType: parentCtx.parentContainerType,
            parentGridColumns: parentCtx.parentGridColumns,
            currentColSpan: parseColSpan(node.style?.gridColumn),
            currentRowSpan: parseRowSpan(node.style?.gridRow),
          }
        : undefined;
      const displaySelKey = defPath || node.nodeId;
      result.push(
        <DisplayBlock
          key={displaySelKey}
          itemKey={node.nodeId}
          selectionKey={displaySelKey}
          label={label}
          widgetHint={node.component !== 'Text' ? node.component : undefined}
          selected={ctx.selectedKey === displaySelKey}
          onSelect={(selectionKey) => ctx.onSelect(selectionKey, 'display')}
          layoutContext={displayLayoutCtx2}
          nodeStyle={node.style as Record<string, unknown> | undefined}
          onResizeColSpan={ctx.onResizeColSpan ? (n) => ctx.onResizeColSpan!(displaySelKey, n) : undefined}
          onResizeRowSpan={ctx.onResizeRowSpan ? (n) => ctx.onResizeRowSpan!(displaySelKey, n) : undefined}
        />,
      );
    }
  }

  return result;
}
