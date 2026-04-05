/** @filedesc Recursive Layout canvas renderer for authored Page sections, layout containers, and bound nodes. Passes layout context (parentContainerType, parentGridColumns) to children. */
import type { CompNode, ContainerLayoutProps, DefLookupEntry } from '@formspec-org/studio-core';
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

type DisplayNode = CompNode & {
  label?: string;
  text?: string;
};

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
  onSetStyle?: (selectionKey: string, key: string, value: string) => void;
  /** Remove a style override from a component node. */
  onStyleRemove?: (selectionKey: string, key: string) => void;
  /** Resize a node's grid column span. */
  onResizeColSpan?: (selectionKey: string, newSpan: number) => void;
  /** Resize a node's grid row span. */
  onResizeRowSpan?: (selectionKey: string, newSpan: number) => void;
  /**
   * Persist display item body copy for Tier 1 definition `display` items (updates `label`, which
   * syncs to the component tree on rebuild). Layout-added notes use this — they are not on the Editor list.
   */
  onCommitDisplayLabel?: (defPath: string, text: string | null) => void;
  /** Rename key + sync label on a definition item (field or display), then re-select `nextPath`. */
  onRenameDefinitionItem?: (
    defPath: string,
    nextKey: string,
    nextLabel: string | null,
    kind: 'field' | 'display',
  ) => void;
  /** Partial definition item update (description, hint, …). */
  onUpdateDefinitionItem?: (defPath: string, changes: Record<string, unknown>) => void;
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

function nodePropsRecord(node: CompNode): Record<string, unknown> {
  return node as unknown as Record<string, unknown>;
}

function resolveContainerColumns(columns: CompNode['columns'] | undefined): number | undefined {
  return typeof columns === 'number' ? columns : undefined;
}

function resolveContainerGap(gap: CompNode['gap'] | undefined): string | undefined {
  return typeof gap === 'string' ? gap : undefined;
}

function resolveContainerWidth(width: CompNode['width'] | undefined): string | undefined {
  return typeof width === 'string' ? width : undefined;
}

function resolveContainerDefaultOpen(defaultOpen: CompNode['defaultOpen'] | undefined): boolean | undefined {
  return typeof defaultOpen === 'boolean' ? defaultOpen : undefined;
}

function buildContainerLayoutProps(node: CompNode): ContainerLayoutProps {
  return {
    columns: resolveContainerColumns(node.columns),
    gap: resolveContainerGap(node.gap),
    direction: node.direction,
    wrap: node.wrap,
    align: node.align,
    elevation: typeof node.elevation === 'number' ? node.elevation : undefined,
    width: resolveContainerWidth(node.width),
    position: node.position,
    title: node.title,
    defaultOpen: resolveContainerDefaultOpen(node.defaultOpen),
    nodeStyle: node.style,
  };
}

/** Render a LayoutContainer with shared props. */
function renderContainer(
  key: React.Key,
  node: CompNode,
  nodeType: 'layout' | 'group',
  selectionKey: string,
  ctx: LayoutRenderContext,
  children: React.ReactNode,
  layoutProps: ContainerLayoutProps,
  collisionPriority: number,
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
      layoutProps={layoutProps}
      nodeProps={nodePropsRecord(node)}
      onSetProp={ctx.onSetNodeProp ? (k, v) => ctx.onSetNodeProp!(selectionKey, k, v) : undefined}
      onSetStyle={ctx.onSetStyle ? (k, v) => ctx.onSetStyle!(selectionKey, k, v) : undefined}
      onUnwrap={ctx.onUnwrapNode ? () => ctx.onUnwrapNode!(selectionKey) : undefined}
      onRemove={ctx.onRemoveNode ? () => ctx.onRemoveNode!(selectionKey) : undefined}
      onStyleRemove={ctx.onStyleRemove ? (k) => ctx.onStyleRemove!(selectionKey, k) : undefined}
      collisionPriority={collisionPriority}
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
  containerDepth = 0,
): React.ReactNode[] {
  const result: React.ReactNode[] = [];

  for (const node of nodes) {
    // Authored Page node — render as a titled section in the Layout workspace.
    if (node._layout && node.component === 'Page') {
      const children = node.children
        ? renderLayoutTree(node.children, ctx, defPathPrefix, ROOT_CONTEXT, containerDepth)
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
      const displayNode = node as DisplayNode;
      const label = (node.component === 'Divider' ? displayNode.label : displayNode.text) || node.component;
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
        parentGridColumns: resolveContainerColumns(node.columns) ?? 2,
      };
      const children = node.children
        ? renderLayoutTree(node.children, ctx, defPathPrefix, childCtx, containerDepth + 1)
        : null;
      const nodeSelKey = `__node:${node.nodeId!}`;
      result.push(
        renderContainer(
          `node:${node.nodeId}`,
          node,
          'layout',
          nodeSelKey,
          ctx,
          children,
          buildContainerLayoutProps(node),
          containerDepth * 10,
          { nodeId: node.nodeId! },
        ),
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
          parentGridColumns: resolveContainerColumns(node.columns) ?? 2,
        };
        const children = node.children
          ? renderLayoutTree(node.children, ctx, defPath, childCtx, containerDepth + 1)
          : null;
        const groupSelKey = defPath;
        result.push(
          renderContainer(
            defPath,
            node,
            'group',
            groupSelKey,
            ctx,
            children,
            buildContainerLayoutProps(node),
            containerDepth * 10,
            {
              bind: item.key,
              bindPath: defPath,
            },
          ),
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

      const groupPathPrefix = defPath.includes('.')
        ? `${defPath.slice(0, defPath.lastIndexOf('.'))}.`
        : null;
      const itemRec = item as unknown as Record<string, unknown>;
      const description = typeof itemRec.description === 'string' ? itemRec.description : null;
      const hint = typeof itemRec.hint === 'string' ? itemRec.hint : null;

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
          groupPathPrefix={groupPathPrefix}
          description={description}
          hint={hint}
          onRenameDefinitionItem={
            ctx.onRenameDefinitionItem && ctx.onUpdateDefinitionItem
              ? (nextKey, nextLabel) =>
                  ctx.onRenameDefinitionItem!(defPath, nextKey, nextLabel, 'field')
              : undefined
          }
          onUpdateDefinitionItem={
            ctx.onUpdateDefinitionItem
              ? (changes) => ctx.onUpdateDefinitionItem!(defPath, changes)
              : undefined
          }
          layoutContext={fieldLayoutCtx}
          nodeStyle={node.style}
          nodeProps={nodePropsRecord(node)}
          onSetProp={ctx.onSetNodeProp ? (k, v) => ctx.onSetNodeProp!(defPath, k, v) : undefined}
          onSetStyle={ctx.onSetStyle ? (k, v) => ctx.onSetStyle!(defPath, k, v) : undefined}
          onSetColumnSpan={ctx.onResizeColSpan ? (n) => ctx.onResizeColSpan!(defPath, n) : undefined}
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
      const displayNode = node as DisplayNode;
      const label = (defEntry?.item as Item | undefined)?.label
        || displayNode.text
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
      const defItem = defEntry?.item as Item | undefined;
      const isDefinitionDisplay = defItem?.type === 'display' && !!defPath;
      const displayGroupPrefix =
        defPath && defPath.includes('.')
          ? `${defPath.slice(0, defPath.lastIndexOf('.'))}.`
          : null;
      const defRec = defItem ? (defItem as unknown as Record<string, unknown>) : null;
      const displayDescription =
        defRec && typeof defRec.description === 'string' ? defRec.description : null;
      const displayHint = defRec && typeof defRec.hint === 'string' ? defRec.hint : null;
      result.push(
        <DisplayBlock
          key={displaySelKey}
          itemKey={node.nodeId}
          selectionKey={displaySelKey}
          label={label}
          widgetHint={node.component !== 'Text' ? node.component : undefined}
          selected={ctx.selectedKey === displaySelKey}
          onSelect={(selectionKey) => ctx.onSelect(selectionKey, 'display')}
          groupPathPrefix={displayGroupPrefix}
          description={displayDescription}
          hint={displayHint}
          onRenameDefinitionItem={
            isDefinitionDisplay && ctx.onRenameDefinitionItem && ctx.onUpdateDefinitionItem && defPath
              ? (nextKey, nextLabel) =>
                  ctx.onRenameDefinitionItem!(defPath, nextKey, nextLabel, 'display')
              : undefined
          }
          onUpdateDefinitionItem={
            defPath && ctx.onUpdateDefinitionItem
              ? (changes) => ctx.onUpdateDefinitionItem!(defPath, changes)
              : undefined
          }
          layoutContext={displayLayoutCtx2}
          nodeStyle={node.style as Record<string, unknown> | undefined}
          onResizeColSpan={ctx.onResizeColSpan ? (n) => ctx.onResizeColSpan!(displaySelKey, n) : undefined}
          onResizeRowSpan={ctx.onResizeRowSpan ? (n) => ctx.onResizeRowSpan!(displaySelKey, n) : undefined}
          onCommitDisplayLabel={
            isDefinitionDisplay && ctx.onCommitDisplayLabel
              ? (text) => ctx.onCommitDisplayLabel!(defPath!, text)
              : undefined
          }
        />,
      );
    }
  }

  return result;
}
