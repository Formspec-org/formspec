import { bindsFor } from '../../lib/field-helpers';
import type { DefLookupEntry, FlatEntry } from '../../lib/tree-helpers';
import { FieldBlock } from './FieldBlock';
import { GroupBlock } from './GroupBlock';
import { DisplayBlock } from './DisplayBlock';
import { LayoutBlock } from './LayoutBlock';
import { SortableItemWrapper } from './dnd/SortableItemWrapper';

interface Item {
  key: string;
  type: string;
  dataType?: string;
  label?: string;
  hint?: string;
  repeatable?: boolean;
  minRepeat?: number;
  maxRepeat?: number;
}

interface CompNode {
  component: string;
  bind?: string;
  nodeId?: string;
  _layout?: boolean;
  children?: CompNode[];
  [key: string]: unknown;
}

export interface RenderContext {
  defLookup: Map<string, DefLookupEntry>;
  bindKeyMap: Map<string, string>;
  allBinds?: Array<{ path: string; [k: string]: unknown }>;
  primaryKey: string | null;
  selectedKeys: Set<string>;
  handleItemClick: (event: React.MouseEvent, path: string, type: string) => void;
  registerTarget: (path: string, element: HTMLElement | null) => void;
  flatIndexMap: Map<string, number>;
}

function resolveDefPath(
  key: string,
  defPathPrefix: string,
  defLookup: Map<string, DefLookupEntry>,
  bindKeyMap: Map<string, string>,
): string | null {
  const candidate = defPathPrefix ? `${defPathPrefix}.${key}` : key;
  if (defLookup.has(candidate)) return candidate;
  return bindKeyMap.get(key) ?? candidate;
}

function selectionProps(id: string, context: RenderContext) {
  const isPrimary = context.primaryKey === id;
  return {
    isPrimary,
    inSelection: context.selectedKeys.has(id) && !isPrimary,
    flatIndex: context.flatIndexMap.get(id) ?? 0,
  };
}

export function renderTreeNodes(
  nodes: CompNode[],
  context: RenderContext,
  depth: number,
  defPathPrefix: string,
): React.ReactNode[] {
  const result: React.ReactNode[] = [];

  for (const node of nodes) {
    if (node._layout) {
      const layoutId = `__node:${node.nodeId}`;
      const { isPrimary, inSelection, flatIndex } = selectionProps(layoutId, context);
      const children = node.children
        ? renderTreeNodes(node.children, context, depth + 1, defPathPrefix)
        : null;

      result.push(
        <SortableItemWrapper key={layoutId} id={layoutId} index={flatIndex}>
          <LayoutBlock
            nodeId={node.nodeId!}
            component={node.component}
            layoutId={layoutId}
            registerTarget={context.registerTarget}
            depth={depth}
            selected={isPrimary}
            isInSelection={inSelection}
            onSelect={(event) => context.handleItemClick(event, layoutId, 'layout')}
          >
            {children}
          </LayoutBlock>
        </SortableItemWrapper>,
      );
      continue;
    }

    if (node.bind) {
      const defPath = resolveDefPath(node.bind, defPathPrefix, context.defLookup, context.bindKeyMap);
      const defEntry = defPath ? context.defLookup.get(defPath) : null;
      if (!defPath || !defEntry) continue;

      const item = defEntry.item as Item;
      const { isPrimary, inSelection, flatIndex } = selectionProps(defPath, context);

      if (item.type === 'group') {
        const children = node.children
          ? renderTreeNodes(node.children, context, depth + 1, defPath)
          : null;

        result.push(
          <SortableItemWrapper key={defPath} id={defPath} index={flatIndex}>
            <GroupBlock
              itemKey={item.key}
              itemPath={defPath}
              registerTarget={context.registerTarget}
              label={item.label}
              repeatable={item.repeatable}
              minRepeat={item.minRepeat}
              maxRepeat={item.maxRepeat}
              depth={depth}
              selected={isPrimary}
              isInSelection={inSelection}
              onSelect={(event) => context.handleItemClick(event, defPath, 'group')}
            >
              {children}
            </GroupBlock>
          </SortableItemWrapper>,
        );
        continue;
      }

      result.push(
        <SortableItemWrapper key={defPath} id={defPath} index={flatIndex}>
          <FieldBlock
            itemKey={item.key}
            itemPath={defPath}
            registerTarget={context.registerTarget}
            label={item.label}
            hint={item.hint}
            dataType={item.dataType}
            binds={bindsFor(context.allBinds, defPath)}
            depth={depth}
            selected={isPrimary}
            isInSelection={inSelection}
            onSelect={(event) => context.handleItemClick(event, defPath, item.type)}
          />
        </SortableItemWrapper>,
      );
      continue;
    }

    if (!node.nodeId) continue;

    const defPath = resolveDefPath(node.nodeId, defPathPrefix, context.defLookup, context.bindKeyMap);
    const defEntry = defPath ? context.defLookup.get(defPath) : null;
    const label = (defEntry?.item as Item | undefined)?.label || (node as { text?: string }).text || node.nodeId;
    const { isPrimary, inSelection, flatIndex } = selectionProps(defPath!, context);

    result.push(
      <SortableItemWrapper key={defPath} id={defPath!} index={flatIndex}>
        <DisplayBlock
          itemKey={node.nodeId}
          itemPath={defPath!}
          registerTarget={context.registerTarget}
          label={label}
          depth={depth}
          selected={isPrimary}
          isInSelection={inSelection}
          onSelect={(event) => context.handleItemClick(event, defPath!, 'display')}
          widgetHint={node.component !== 'Text' ? node.component : undefined}
        />
      </SortableItemWrapper>,
    );
  }

  return result;
}
