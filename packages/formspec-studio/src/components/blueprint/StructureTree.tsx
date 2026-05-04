/** @filedesc Blueprint section rendering the definition item tree with inline add-item palette support. */
import { useEffect, useState, useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useDismiss,
  useFloating,
  useInteractions,
} from '@floating-ui/react';
import { buildDefLookup, type FormItem } from '@formspec-org/studio-core';
import { useDefinition } from '../../state/useDefinition';
import { useSelection } from '../../state/useSelection';
import { useProject } from '../../state/useProject';
import { useCanvasTargets } from '../../state/useCanvasTargets';
import { FieldIcon } from '../ui/FieldIcon';
import { AddItemPalette, type FieldTypeOption } from '../AddItemPalette';
import { EmptyBlueprintState } from '../shared/EmptyBlueprintState';
import { ConfirmDialog } from '../ConfirmDialog';
import { EditorContextMenu } from '../../workspaces/editor/EditorContextMenu';
import { WrapInGroupDialog } from '../../workspaces/editor/WrapInGroupDialog';
import type { ContextMenuItem } from '../ui/context-menu-utils';
let nextItemId = 1;
function uniqueKey(prefix: string): string {
  return `${prefix}${nextItemId++}`;
}

function collectSiblingKeys(items: FormItem[], targetParentPath?: string): Set<string> {
  if (!targetParentPath) {
    return new Set(items.map((item) => item.key));
  }

  const parts = targetParentPath.split('.');
  let currentItems = items;
  let currentNode: FormItem | undefined;

  for (const part of parts) {
    currentNode = currentItems.find((item) => item.key === part);
    currentItems = currentNode?.children ?? [];
  }

  return new Set((currentNode?.children ?? []).map((item) => item.key));
}

function uniqueSiblingKey(items: FormItem[], parentPath: string | undefined, prefix: string): string {
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
  onItemContextMenu,
}: {
  item: FormItem;
  depth: number;
  pathPrefix: string;
  onItemContextMenu: (e: ReactMouseEvent, fullPath: string, itemType: string) => void;
}) {
  const { primaryKeyForTab, select } = useSelection();
  const { scrollToTarget } = useCanvasTargets();
  const fullPath = pathPrefix ? `${pathPrefix}.${item.key}` : item.key;
  const isSelected = primaryKeyForTab('editor') === fullPath;

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
        className={`w-full flex items-center gap-1.5 rounded-[8px] px-2 py-1.5 text-left transition-all cursor-pointer focus-ring ${
          isSelected
            ? 'bg-accent/[0.08] text-accent font-medium border-l-2 border-accent'
            : 'text-ink/88 hover:bg-bg-default/45 border-l-2 border-transparent'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
        onContextMenu={(e) => onItemContextMenu(e, fullPath, item.type)}
      >
        <span className="shrink-0 w-4 flex justify-center">{icon}</span>
        <span className="truncate flex-1">{item.label || item.key}</span>
        {item.type === 'group' && item.children && (
          <span className="text-[11px] text-muted ml-auto font-mono">
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
          onItemContextMenu={onItemContextMenu}
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
      className="h-5 w-5 flex items-center justify-center rounded-[4px] text-muted hover:text-ink hover:bg-subtle transition-colors cursor-pointer leading-none focus-ring"
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

interface WrapGroupDraft {
  itemPath: string;
  itemLabel: string;
  key: string;
  label: string;
}

/** Right-click target: path + item type (position comes from Floating UI + pointer). */
interface RowContextMenu {
  path: string;
  type: string;
}

export function StructureTree() {
  const definition = useDefinition();
  const project = useProject();
  const { primaryKeyForTab, select, selectedKeysForTab, deselect, revealedPath, consumeRevealedPath } = useSelection();
  const { scrollToTarget } = useCanvasTargets();
  const items = (definition.items ?? []);

  useEffect(() => {
    if (!revealedPath) return;
    scrollToTarget(revealedPath);
    consumeRevealedPath();
  }, [revealedPath, scrollToTarget, consumeRevealedPath]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [rowMenu, setRowMenu] = useState<RowContextMenu | null>(null);
  const [pendingDeletePath, setPendingDeletePath] = useState<string | null>(null);
  const [wrapGroupDraft, setWrapGroupDraft] = useState<WrapGroupDraft | null>(null);
  const selectedKey = primaryKeyForTab('editor');
  const pointerRef = useRef({ x: 0, y: 0 });

  const menuOpen = rowMenu !== null;
  const { refs, floatingStyles, context } = useFloating({
    open: menuOpen,
    onOpenChange: (open) => {
      if (!open) setRowMenu(null);
    },
    strategy: 'fixed',
    placement: 'bottom-start',
    middleware: [offset({ mainAxis: 2, crossAxis: 0 }), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const dismiss = useDismiss(context);
  const { getFloatingProps } = useInteractions([dismiss]);

  useLayoutEffect(() => {
    if (!menuOpen) return;
    const { x, y } = pointerRef.current;
    refs.setReference({
      getBoundingClientRect() {
        return new DOMRect(x, y, 0, 0);
      },
    });
  }, [menuOpen, refs]);

  const contextMenuItems = useMemo<ContextMenuItem[]>(
    () => [
      { label: 'Duplicate', action: 'duplicate' },
      { label: 'Delete', action: 'delete' },
      { label: 'Move Up', action: 'moveUp' },
      { label: 'Move Down', action: 'moveDown' },
      { label: 'Wrap in Group', action: 'wrapInGroup' },
    ],
    [],
  );

  const onItemContextMenu = useCallback(
    (e: ReactMouseEvent, path: string, type: string) => {
      e.preventDefault();
      e.stopPropagation();
      const keys = selectedKeysForTab('editor');
      if (!keys.has(path)) {
        select(path, type, { tab: 'editor' });
      }
      pointerRef.current = { x: e.clientX, y: e.clientY };
      setRowMenu({ path, type });
    },
    [select, selectedKeysForTab],
  );

  const handleContextAction = useCallback(
    (action: string) => {
      const path = rowMenu?.path;
      if (!path) return;

      switch (action) {
        case 'duplicate': {
          const result = project.copyItem(path);
          const nextPath = result.affectedPaths[0];
          if (nextPath) {
            const nextItems = (project.state.definition.items ?? []);
            const nextType = buildDefLookup(nextItems).get(nextPath)?.item?.type ?? 'field';
            select(nextPath, nextType, { tab: 'editor' });
          }
          break;
        }
        case 'delete':
          setPendingDeletePath(path);
          break;
        case 'moveUp':
          project.reorderItem(path, 'up');
          break;
        case 'moveDown':
          project.reorderItem(path, 'down');
          break;
        case 'wrapInGroup': {
          const targetItem = buildDefLookup(items).get(path)?.item;
          const itemLabel =
            typeof targetItem?.label === 'string' && targetItem.label.trim()
              ? targetItem.label
              : path.split('.').pop() ?? path;
          setWrapGroupDraft({
            itemPath: path,
            itemLabel,
            key: '',
            label: '',
          });
          break;
        }
        default:
          break;
      }
      setRowMenu(null);
    },
    [rowMenu?.path, items, project, select],
  );

  const pendingDeleteLabel = useMemo(() => {
    if (!pendingDeletePath) return null;
    const deleteTarget = buildDefLookup(items).get(pendingDeletePath)?.item;
    return typeof deleteTarget?.label === 'string' && deleteTarget.label.trim()
      ? deleteTarget.label
      : pendingDeletePath.split('.').pop() ?? pendingDeletePath;
  }, [items, pendingDeletePath]);

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
              <h3 className="font-mono text-[11px] font-bold tracking-[0.15em] uppercase text-muted">
                Items
              </h3>
            </div>
            <AddButton onClick={() => setPaletteOpen(true)} title="Add item" />
          </div>

          <div className="flex flex-col gap-1 border-l border-border/55 pl-2">
            {items.length === 0 ? (
              <EmptyBlueprintState message="No items defined" />
            ) : (
              items.map((item) => (
                <TreeNode
                  key={item.key}
                  item={item}
                  depth={0}
                  pathPrefix=""
                  onItemContextMenu={onItemContextMenu}
                />
              ))
            )}
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={pendingDeletePath !== null}
        title={`Delete ${pendingDeleteLabel ?? 'item'}?`}
        description="This will remove the selected item from the form definition."
        confirmLabel="Confirm Delete"
        cancelLabel="Cancel Delete"
        onCancel={() => setPendingDeletePath(null)}
        onConfirm={() => {
          if (pendingDeletePath) {
            project.removeItem(pendingDeletePath);
            deselect();
          }
          setPendingDeletePath(null);
        }}
      />

      {wrapGroupDraft && (
        <WrapInGroupDialog
          draft={wrapGroupDraft}
          onCancel={() => setWrapGroupDraft(null)}
          onConfirm={(groupKey, groupLabel) => {
            const result = project.wrapItemsInGroup([wrapGroupDraft.itemPath], groupKey, groupLabel);
            const groupPath = result.affectedPaths?.[0];
            if (groupPath) {
              select(groupPath, 'group', { tab: 'editor' });
            }
            setWrapGroupDraft(null);
          }}
        />
      )}

      {rowMenu && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            className="z-[200]"
            {...getFloatingProps()}
          >
            <EditorContextMenu
              onAction={handleContextAction}
              onClose={() => setRowMenu(null)}
              items={contextMenuItems}
              testId="context-menu"
            />
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
