/** @filedesc Shared parameterized item list editor — used by both DefinitionTreeEditor and ScreenerItemEditor. */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSelection } from '../../state/useSelection';
import {
  bindsFor,
  buildDefLookup,
  buildMissingPropertyActions,
  buildCategorySummaries,
  buildRowSummaries,
  buildStatusPills,
} from '@formspec-org/studio-core';
import { WorkspacePage, WorkspacePageSection } from '../../components/ui/WorkspacePage';
import { AddItemPalette, type FieldTypeOption } from '../../components/AddItemPalette';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { EditorContextMenu } from './EditorContextMenu';
import { ItemRow } from './ItemRow';
import { GroupNode } from './GroupNode';
import { EditorDndProvider } from './EditorDndProvider';
import { SortableItemWrapper } from './dnd/SortableItemWrapper';
import { clampContextMenuPosition, type ContextMenuState, type ContextMenuItem } from '../../components/ui/context-menu-utils';
import { WrapInGroupDialog } from './WrapInGroupDialog';

import type { FormItem, FormBind } from '@formspec-org/types';

/** Map widgetHint to addContent kind parameter. */
const WIDGET_HINT_TO_KIND: Record<string, 'heading' | 'paragraph' | 'divider'> = {
  Heading: 'heading',
  heading: 'heading',
  Paragraph: 'paragraph',
  paragraph: 'paragraph',
  Divider: 'divider',
  divider: 'divider',
};

let nextItemId = 1;
function uniqueKey(prefix: string): string {
  return `${prefix}${nextItemId++}`;
}

export interface ItemListEditorConfig {
  /** Items to render. */
  items: FormItem[];
  /** Bind rules for items. */
  binds: FormBind[] | undefined;

  // --- Callbacks ---
  onAddField: (key: string, label: string, dataType: string, parentPath?: string) => void;
  onRemoveItem: (keyOrPath: string) => void;
  onUpdateItem: (keyOrPath: string, changes: Record<string, unknown>) => void;
  onReorderItem: (keyOrPath: string, direction: 'up' | 'down') => void;
  onRenameItem?: (keyOrPath: string, nextKey: string) => void;
  onCopyItem?: (keyOrPath: string) => void;
  onAddGroup?: (path: string, label: string) => void;
  onAddContent?: (path: string, label: string, kind?: 'heading' | 'paragraph' | 'divider') => void;
  onWrapInGroup?: (paths: string[], groupKey: string, groupLabel: string) => { affectedPaths?: string[] };
  onMoveItem?: (sourcePath: string, parentPath: string | undefined, targetIndex: number) => void;

  // --- Feature flags ---
  allowGroups: boolean;
  allowDisplayItems: boolean;
  allowCopy: boolean;
  allowRename: boolean;
  allowWrapInGroup: boolean;

  // --- Labels & IDs ---
  headerTitle: string;
  headerDescription: string;
  emptyStateTitle: string;
  emptyStateDescription: string;
  addButtonLabel: string;
  surfaceTestId: string;
  selectionTab: string;
}

interface WrapGroupDraft {
  itemPath: string;
  itemLabel: string;
  key: string;
  label: string;
}

interface TreeRenderContext {
  isSelected: (key: string) => boolean;
  onAddToGroup: (path: string) => void;
  onRenameIdentity: (path: string, nextKey: string, nextLabel: string) => void;
  onUpdateItem: (path: string, changes: Record<string, unknown>) => void;
  onUpdateRepeatSettings: (path: string, changes: { repeatable?: boolean; minRepeat?: number | null; maxRepeat?: number | null }) => void;
  onItemClick: (e: React.MouseEvent, path: string, type: string) => void;
  onItemContextMenu: (e: React.MouseEvent, path: string, type: string) => void;
}

function renderItemTree(
  items: FormItem[],
  allBinds: FormBind[] | undefined,
  depth: number,
  parentPath: string,
  ctx: TreeRenderContext,
  insideRepeatableGroup = false,
): React.ReactNode[] {
  const sortGroup = parentPath || 'root';
  let siblingIndex = 0;

  return items.map((item) => {
    if (item.type === 'display') return null;

    const path = parentPath ? `${parentPath}.${item.key}` : item.key;
    const itemBinds = bindsFor(allBinds, path);
    const summaries = buildRowSummaries(item, itemBinds);
    const categorySummaries = buildCategorySummaries(item, itemBinds);
    const statusPills = buildStatusPills(itemBinds, item, { categorySummaries });
    const resolvedLabel = typeof item.label === 'string' && item.label.trim() ? item.label : item.key;
    const missingActions = buildMissingPropertyActions(item, itemBinds, resolvedLabel);
    const sortIndex = siblingIndex++;

    if (item.type === 'group') {
      return (
        <SortableItemWrapper key={path} id={path} index={sortIndex} group={sortGroup}>
          <GroupNode
            itemKey={item.key}
            itemPath={path}
            label={item.label}
            summaries={summaries}
            repeatable={item.repeatable}
            minRepeat={item.minRepeat}
            maxRepeat={item.maxRepeat}
            statusPills={statusPills}
            missingActions={missingActions}
            depth={depth}
            selected={ctx.isSelected(path)}
            item={item}
            binds={itemBinds}
            onUpdateItem={(changes) => ctx.onUpdateItem(path, changes)}
            onRenameIdentity={(nextKey, nextLabel) => ctx.onRenameIdentity(path, nextKey, nextLabel)}
            onUpdateRepeatSettings={(changes) => ctx.onUpdateRepeatSettings(path, changes)}
            onAddItem={(_, targetPath) => ctx.onAddToGroup(targetPath)}
            onClick={(e) => ctx.onItemClick(e, path, 'group')}
            onContextMenu={(e) => ctx.onItemContextMenu(e, path, 'group')}
          >
            {item.children ? renderItemTree(item.children, allBinds, depth + 1, path, ctx, insideRepeatableGroup || item.repeatable === true) : null}
          </GroupNode>
        </SortableItemWrapper>
      );
    }

    return (
      <SortableItemWrapper key={path} id={path} index={sortIndex} group={sortGroup}>
        <ItemRow
          itemKey={item.key}
          itemPath={path}
          itemType="field"
          label={item.label}
          categorySummaries={categorySummaries}
          dataType={item.dataType}
          widgetHint={item.presentation?.widgetHint}
          statusPills={statusPills}
          depth={depth}
          selected={ctx.isSelected(path)}
          item={item}
          binds={itemBinds}
          onUpdateItem={(changes) => ctx.onUpdateItem(path, changes)}
          insideRepeatableGroup={insideRepeatableGroup}
          onRenameIdentity={(nextKey, nextLabel) => ctx.onRenameIdentity(path, nextKey, nextLabel)}
          onClick={(e) => ctx.onItemClick(e, path, 'field')}
          onContextMenu={(e) => ctx.onItemContextMenu(e, path, 'field')}
        />
      </SortableItemWrapper>
    );
  });
}

/** Collect all item paths in definition order for range-select (excludes display items). */
function collectFlatOrder(items: FormItem[], parentPath: string): string[] {
  const result: string[] = [];
  for (const item of items) {
    if (item.type === 'display') continue;
    const path = parentPath ? `${parentPath}.${item.key}` : item.key;
    result.push(path);
    if (item.type === 'group' && item.children) {
      result.push(...collectFlatOrder(item.children, path));
    }
  }
  return result;
}

export function ItemListEditor({ config }: { config: ItemListEditorConfig }) {
  const {
    items,
    binds: allBinds,
    onAddField,
    onRemoveItem,
    onUpdateItem: configOnUpdateItem,
    onReorderItem,
    onRenameItem,
    onCopyItem,
    onAddGroup,
    onAddContent,
    onWrapInGroup,
    allowGroups,
    allowCopy,
    allowRename,
    allowWrapInGroup,
    headerTitle,
    headerDescription,
    emptyStateTitle,
    emptyStateDescription,
    addButtonLabel,
    surfaceTestId,
    selectionTab,
  } = config;

  const {
    selectedKeys, primaryKeyForTab, select, toggleSelect, rangeSelect,
    deselect, isSelected,
  } = useSelection();
  const [showPicker, setShowPicker] = useState(false);
  const [addParentPath, setAddParentPath] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [pendingDeletePath, setPendingDeletePath] = useState<string | null>(null);
  const [wrapGroupDraft, setWrapGroupDraft] = useState<WrapGroupDraft | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  const selectedKey = primaryKeyForTab(selectionTab);
  const flatOrder = useMemo(() => collectFlatOrder(items, ''), [items]);

  // Build context menu items based on feature flags
  const contextMenuItems = useMemo<ContextMenuItem[]>(() => {
    const menuItems: ContextMenuItem[] = [];
    if (allowCopy) menuItems.push({ label: 'Duplicate', action: 'duplicate' });
    menuItems.push({ label: 'Delete', action: 'delete' });
    menuItems.push({ label: 'Move Up', action: 'moveUp' });
    menuItems.push({ label: 'Move Down', action: 'moveDown' });
    if (allowWrapInGroup) menuItems.push({ label: 'Wrap in Group', action: 'wrapInGroup' });
    return menuItems;
  }, [allowCopy, allowWrapInGroup]);

  const onItemClick = useCallback((e: React.MouseEvent, path: string, type: string) => {
    e.stopPropagation();
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
    const opts = { tab: selectionTab };
    if (e.metaKey || e.ctrlKey) {
      toggleSelect(path, type, opts);
    } else if (e.shiftKey) {
      rangeSelect(path, type, flatOrder, opts);
    } else {
      if (isSelected(path)) {
        deselect();
      } else {
        select(path, type, opts);
      }
    }
  }, [selectionTab, toggleSelect, rangeSelect, select, deselect, isSelected, flatOrder]);

  const onItemContextMenu = useCallback((e: React.MouseEvent, path: string, type: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedKeys.has(path)) {
      select(path, type, { tab: selectionTab });
    }
    const position = clampContextMenuPosition(e.clientX, e.clientY);
    setContextMenu({ ...position, kind: 'item', path, type });
  }, [selectedKeys, select, selectionTab]);

  const handleContextAction = useCallback((action: string) => {
    const path = contextMenu?.path;
    if (!path) return;

    switch (action) {
      case 'duplicate':
        onCopyItem?.(path);
        break;
      case 'delete':
        setPendingDeletePath(path);
        break;
      case 'moveUp':
        onReorderItem(path, 'up');
        break;
      case 'moveDown':
        onReorderItem(path, 'down');
        break;
      case 'wrapInGroup': {
        const targetItem = buildDefLookup(items).get(path)?.item;
        const itemLabel = typeof targetItem?.label === 'string' && targetItem.label.trim()
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
    }
    setContextMenu(null);
  }, [contextMenu, items, onCopyItem, onReorderItem]);

  // Escape to deselect
  useEffect(() => {
    if (contextMenu) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') deselect();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [contextMenu, deselect]);

  // Close context menu on outside click or Escape
  useEffect(() => {
    if (!contextMenu) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    const onMouseDown = () => setContextMenu(null);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onMouseDown);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!selectedKey) return;
    const surface = surfaceRef.current;
    if (!surface) return;
    const escapedPath = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
      ? CSS.escape(selectedKey)
      : selectedKey.replace(/["\\]/g, '\\$&');
    const selectedElement = surface.querySelector<HTMLElement>(`[data-editor-path="${escapedPath}"]`);
    if (!selectedElement) return;
    requestAnimationFrame(() => {
      selectedElement.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    });
  }, [selectedKey]);

  const addTargetLabel = useMemo(() => {
    if (!addParentPath) return 'Add Item';
    const parentItem = buildDefLookup(items).get(addParentPath)?.item;
    const parentLabel = typeof parentItem?.label === 'string' && parentItem.label.trim() ? parentItem.label : addParentPath.split('.').pop();
    return `Add Item to ${parentLabel}`;
  }, [addParentPath, items]);

  const pendingDeleteLabel = useMemo(() => {
    if (!pendingDeletePath) return null;
    const deleteTarget = buildDefLookup(items).get(pendingDeletePath)?.item;
    return typeof deleteTarget?.label === 'string' && deleteTarget.label.trim()
      ? deleteTarget.label
      : pendingDeletePath.split('.').pop() ?? pendingDeletePath;
  }, [items, pendingDeletePath]);

  const selectedSummary = useMemo(() => {
    if (!selectedKey) return null;
    const selectedEntry = buildDefLookup(items).get(selectedKey)?.item;
    if (!selectedEntry) return null;
    const typeLabel = selectedEntry.type === 'group'
      ? 'Group'
      : selectedEntry.type === 'display'
        ? 'Content'
        : 'Field';
    const label = typeof selectedEntry.label === 'string' && selectedEntry.label.trim()
      ? selectedEntry.label
      : selectedEntry.key;
    const key = selectedEntry.key;
    const parentPath = selectedKey.includes('.') ? selectedKey.split('.').slice(0, -1).join(' / ') : 'Root';
    return { typeLabel, label, key, parentPath };
  }, [items, selectedKey]);

  const treeCtx: TreeRenderContext = useMemo(() => ({
    isSelected,
    onAddToGroup: (path: string) => {
      setAddParentPath(path);
      setShowPicker(true);
    },
    onRenameIdentity: (path: string, nextKey: string, nextLabel: string) => {
      const currentKey = path.split('.').pop() ?? path;
      let nextPath = path;
      if (allowRename && onRenameItem && nextKey && nextKey !== currentKey) {
        onRenameItem(path, nextKey);
        const parentPath = path.split('.').slice(0, -1).join('.');
        nextPath = parentPath ? `${parentPath}.${nextKey}` : nextKey;
      }
      configOnUpdateItem(nextPath, { label: nextLabel || null });
      select(nextPath, buildDefLookup(items).get(path)?.item?.type ?? 'field', { tab: selectionTab });
    },
    onUpdateItem: (path, changes) => {
      configOnUpdateItem(path, changes);
    },
    onUpdateRepeatSettings: (path, changes) => {
      configOnUpdateItem(path, changes);
    },
    onItemClick,
    onItemContextMenu,
  }), [isSelected, onItemClick, onItemContextMenu, configOnUpdateItem, allowRename, onRenameItem, select, items, selectionTab]);

  const handleAddItem = useCallback((opt: FieldTypeOption) => {
    const key = uniqueKey(opt.dataType ?? opt.itemType);
    const insertedPath = addParentPath ? `${addParentPath}.${key}` : key;
    const insertedType = opt.itemType === 'display' || opt.itemType === 'layout' ? 'display' : opt.itemType === 'group' ? 'group' : 'field';

    if (opt.itemType === 'group' && onAddGroup) {
      onAddGroup(insertedPath, opt.label);
    } else if ((opt.itemType === 'display' || opt.itemType === 'layout') && onAddContent) {
      const widgetHint = (opt.extra?.presentation as Record<string, unknown> | undefined)?.widgetHint as string | undefined;
      const kind = widgetHint ? WIDGET_HINT_TO_KIND[widgetHint] : undefined;
      onAddContent(insertedPath, opt.label, kind);
    } else if (opt.itemType === 'field') {
      const fieldType =
        typeof opt.extra?.registryDataType === 'string' ? opt.extra.registryDataType : (opt.dataType ?? 'string');
      onAddField(key, opt.label, fieldType, addParentPath ?? undefined);
    }

    select(insertedPath, insertedType, { tab: selectionTab, focusInspector: true });
    setShowPicker(false);
    setAddParentPath(null);
  }, [addParentPath, onAddField, onAddGroup, onAddContent, select, selectionTab]);

  const tree = useMemo(
    () => renderItemTree(items, allBinds, 0, '', treeCtx),
    [items, allBinds, treeCtx],
  );

  const paletteScope = 'editor';

  return (
    <WorkspacePage maxWidth="max-w-none" className="w-full">
      <WorkspacePageSection padding="px-0" className="flex justify-center pt-8 pb-32">
        <div
          ref={surfaceRef}
          data-testid={surfaceTestId}
          className="flex w-full max-w-[1020px] flex-col gap-6 rounded border border-border bg-surface p-4 sm:p-6 md:p-8 transition-all duration-200"
          onClick={(event) => {
            if (event.target === event.currentTarget) deselect();
          }}
        >
          <div className="flex flex-col gap-4 border-b border-border/10 pb-6 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0 space-y-1">
              <h1 className="text-[20px] font-bold tracking-tight text-ink font-display leading-tight">
                {selectedSummary ? selectedSummary.label : headerTitle}
              </h1>
              <p
                aria-live="polite"
                aria-atomic="true"
                className="text-[12px] leading-normal text-muted max-w-2xl"
              >
                {selectedSummary
                  ? `${selectedSummary.typeLabel} key ${selectedSummary.key} in ${selectedSummary.parentPath}`
                  : headerDescription}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 self-start md:self-auto">
              <div className="rounded-sm border border-border bg-subtle px-2 py-0.5 text-[9px] font-bold uppercase tracking-normal text-muted">
                {selectedSummary?.typeLabel ?? 'Canvas'}
              </div>
              {selectedSummary && (
                <div className="rounded-sm border border-accent/20 bg-accent/5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-normal text-accent animate-onboarding-enter">
                  Selected
                </div>
              )}
            </div>
          </div>

          <AddItemPalette
            open={showPicker}
            title={addTargetLabel}
            scope={paletteScope}
            onClose={() => {
              setShowPicker(false);
              setAddParentPath(null);
            }}
            onAdd={handleAddItem}
          />
          <EditorDndProvider items={items}>
            {items.length === 0 ? (
              <div
                data-testid="editor-empty-state"
                 className="rounded border border-dashed border-border bg-subtle p-8 text-center"
              >
                <div className="mx-auto max-w-md space-y-4">
                  <div className="text-[9px] font-bold tracking-normal text-muted uppercase">Empty Canvas</div>
                   <h2 className="text-[16px] font-bold tracking-tight text-ink font-display">{emptyStateTitle}</h2>
                  <p className="text-[12px] leading-normal text-muted opacity-60">
                    {emptyStateDescription}
                  </p>
                </div>
              </div>
            ) : (
              tree
            )}
          </EditorDndProvider>
          <button
            data-testid="add-item"
             className="group/add mt-6 flex min-h-[52px] items-center justify-center gap-2.5 rounded-md border-2 border-dashed border-border bg-subtle py-3 text-[12px] font-bold text-muted transition-all cursor-pointer hover:border-accent/40 hover:bg-accent/5 hover:text-accent"
            onClick={() => {
              setAddParentPath(null);
              setShowPicker(!showPicker);
            }}
          >
             <div className="flex h-7 w-7 items-center justify-center rounded bg-surface border border-border text-accent shadow-sm group-hover/add:bg-accent group-hover/add:text-surface group-hover/add:border-accent transition-all duration-200">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
            {addButtonLabel}
          </button>

        </div>
      </WorkspacePageSection>

      <ConfirmDialog
        open={pendingDeletePath !== null}
        title={`Delete ${pendingDeleteLabel ?? 'item'}?`}
        description="This will remove the selected item from the form definition."
        confirmLabel="Confirm Delete"
        cancelLabel="Cancel Delete"
        onCancel={() => setPendingDeletePath(null)}
        onConfirm={() => {
          if (pendingDeletePath) {
            onRemoveItem(pendingDeletePath);
            deselect();
          }
          setPendingDeletePath(null);
        }}
      />

      {allowWrapInGroup && wrapGroupDraft && (
        <WrapInGroupDialog
          draft={wrapGroupDraft}
          onCancel={() => setWrapGroupDraft(null)}
          onConfirm={(key, label) => {
            if (!onWrapInGroup) return;
            const result = onWrapInGroup(
              [wrapGroupDraft.itemPath],
              key,
              label,
            );
            const groupPath = result.affectedPaths?.[0];
            if (groupPath) {
              select(groupPath, 'group', { tab: selectionTab });
            }
            setWrapGroupDraft(null);
          }}
        />
      )}

      {contextMenu && (
        <div
          style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 50 }}
        >
          <EditorContextMenu
            onAction={handleContextAction}
            onClose={() => setContextMenu(null)}
            items={contextMenuItems}
            testId="context-menu"
          />
        </div>
      )}
    </WorkspacePage>
  );
}
