/** @filedesc Blueprint section rendering the definition item tree with inline add-item palette support. */
import { useState, useCallback } from 'react';
import { useDefinition } from '../../state/useDefinition';
import { useSelection } from '../../state/useSelection';
import { useProject } from '../../state/useProject';
import { useCanvasTargets } from '../../state/useCanvasTargets';
import { FieldIcon } from '../ui/FieldIcon';
import { AddItemPalette, type FieldTypeOption } from '../AddItemPalette';

interface ItemNode {
  key: string;
  type: string;
  dataType?: string;
  label?: string;
  children?: ItemNode[];
  [k: string]: unknown;
}

let nextItemId = 1;
function uniqueKey(prefix: string): string {
  return `${prefix}${nextItemId++}`;
}

function collectSiblingKeys(items: ItemNode[], targetParentPath?: string): Set<string> {
  if (!targetParentPath) {
    return new Set(items.map((item) => item.key));
  }

  const parts = targetParentPath.split('.');
  let currentItems = items;
  let currentNode: ItemNode | undefined;

  for (const part of parts) {
    currentNode = currentItems.find((item) => item.key === part);
    currentItems = currentNode?.children ?? [];
  }

  return new Set((currentNode?.children ?? []).map((item) => item.key));
}

function uniqueSiblingKey(items: ItemNode[], parentPath: string | undefined, prefix: string): string {
  const siblingKeys = collectSiblingKeys(items, parentPath);
  let candidate = uniqueKey(prefix);
  while (siblingKeys.has(candidate)) {
    candidate = uniqueKey(prefix);
  }
  return candidate;
}

function TreeNode({
  item,
  depth,
  pathPrefix,
}: {
  item: ItemNode;
  depth: number;
  pathPrefix: string;
}) {
  const { selectedKeyForTab, select } = useSelection();
  const { scrollToTarget } = useCanvasTargets();
  const fullPath = pathPrefix ? `${pathPrefix}.${item.key}` : item.key;
  const isSelected = selectedKeyForTab('editor') === fullPath;

  const icon = item.type === 'field' ? (
    <FieldIcon dataType={item.dataType || 'string'} className="text-[10px]" />
  ) : item.type === 'group' ? (
    <span className="text-[10px] opacity-50">▦</span>
  ) : (
    <span className="text-[10px] opacity-50 text-accent font-bold">ℹ</span>
  );

  const handleClick = () => {
    select(fullPath, item.type, { tab: 'editor' });
    requestAnimationFrame(() => {
      scrollToTarget(fullPath);
    });
  };

  return (
    <div className="flex flex-col">
      <button
        type="button"
        data-testid={`tree-item-${fullPath}`}
        aria-current={isSelected ? 'true' : undefined}
        className={`w-full flex items-center gap-1.5 rounded-[8px] px-2 py-1.5 text-left transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
          isSelected
            ? 'bg-accent/[0.08] text-accent font-medium border-l-2 border-accent'
            : 'text-ink/88 hover:bg-bg-default/45 border-l-2 border-transparent'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
      >
        <span className="shrink-0 w-4 flex justify-center">{icon}</span>
        <span className="truncate flex-1">{item.label || item.key}</span>
        {item.type === 'group' && item.children && (
          <span className="text-[11px] text-muted/80 ml-auto font-mono">
            {item.children.length}
          </span>
        )}
      </button>
      {item.children?.map((child) => (
        <TreeNode
          key={child.key}
          item={child}
          depth={depth + 1}
          pathPrefix={fullPath}
        />
      ))}
    </div>
  );
}

function AddButton({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="h-5 w-5 flex items-center justify-center rounded-[4px] text-muted/85 hover:text-ink hover:bg-subtle transition-colors cursor-pointer leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
    >
      +
    </button>
  );
}

function parentPathForInsertion(project: ReturnType<typeof useProject>, selectedKey: string | null): string | undefined {
  if (!selectedKey) return undefined;
  const selected = project.itemAt(selectedKey);
  if (selected?.type === 'group') return selectedKey;
  if (!selectedKey.includes('.')) return undefined;
  return selectedKey.split('.').slice(0, -1).join('.') || undefined;
}

export function StructureTree() {
  const definition = useDefinition();
  const project = useProject();
  const { selectedKeyForTab, select } = useSelection();
  const items = (definition.items ?? []) as ItemNode[];
  const [paletteOpen, setPaletteOpen] = useState(false);
  const selectedKey = selectedKeyForTab('editor');

  const handleAddFromPalette = useCallback(
    (opt: FieldTypeOption) => {
      const parentPath = parentPathForInsertion(project, selectedKey);
      const key = uniqueSiblingKey(items, parentPath, opt.dataType ?? opt.itemType);
      let insertedPath = parentPath ? `${parentPath}.${key}` : key;

      if (opt.itemType === 'field') {
        const fieldType =
          typeof opt.extra?.registryDataType === 'string' ? opt.extra.registryDataType : (opt.dataType ?? 'string');
        const result = project.addField(key, opt.label, fieldType, {
          ...(parentPath ? { parentPath } : {}),
          ...(opt.extra as object | undefined),
        });
        insertedPath = result.affectedPaths[0] ?? insertedPath;
      } else if (opt.itemType === 'group') {
        const result = project.addGroup(insertedPath, opt.label);
        insertedPath = result.affectedPaths[0] ?? insertedPath;
      } else {
        const widgetHint = (opt.extra?.presentation as Record<string, unknown> | undefined)?.widgetHint as string | undefined;
        const kindMap: Record<string, 'heading' | 'paragraph' | 'banner' | 'divider'> = {
          Heading: 'heading',
          Divider: 'divider',
          Banner: 'banner',
        };
        const kind = widgetHint ? kindMap[widgetHint] ?? 'paragraph' : 'paragraph';
        const result = project.addContent(key, opt.label, kind, parentPath ? { parentPath } : undefined);
        insertedPath = result.affectedPaths[0] ?? insertedPath;
      }

      select(insertedPath, opt.itemType, { tab: 'editor' });
    },
    [items, project, select, selectedKey],
  );

  return (
    <>
      <AddItemPalette
        open={paletteOpen}
        scope="all"
        onClose={() => setPaletteOpen(false)}
        onAdd={handleAddFromPalette}
      />

      <div className="flex flex-col flex-1 overflow-y-auto space-y-3">
        <section aria-label="Items" className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-mono text-[11px] font-bold tracking-[0.15em] uppercase text-muted/85">
                Items
              </h3>
            </div>
            <AddButton onClick={() => setPaletteOpen(true)} title="Add item" />
          </div>

          <div className="flex flex-col gap-1 border-l border-border/55 pl-2">
            {items.length === 0 ? (
              <div className="px-2 py-1 text-[12px] text-muted italic">
                No items defined
              </div>
            ) : (
              items.map((item) => (
                <TreeNode
                  key={item.key}
                  item={item}
                  depth={0}
                  pathPrefix=""
                />
              ))
            )}
          </div>
        </section>
      </div>
    </>
  );
}
