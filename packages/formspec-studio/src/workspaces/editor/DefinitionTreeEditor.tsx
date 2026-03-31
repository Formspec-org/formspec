/** @filedesc Tree view of definition.items — pure Tier 1, no component tree awareness, no page filtering. */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useDefinition } from '../../state/useDefinition';
import { useProject } from '../../state/useProject';
import { useSelection } from '../../state/useSelection';
import {
  bindsFor,
  buildDefLookup,
  buildMissingPropertyActions,
  buildCategorySummaries,
  buildRowSummaries,
  buildStatusPills,
  type MissingPropertyAction,
  type RowStatusPill,
  type RowSummaryEntry,
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

import type { FormItem, FormBind } from '@formspec-org/types';

const EDITOR_TAB = 'editor';

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

/** Context menu items for the definition tree — no layout actions. */
const TREE_CONTEXT_MENU_ITEMS: ContextMenuItem[] = [
  { label: 'Duplicate', action: 'duplicate' },
  { label: 'Delete', action: 'delete' },
  { label: 'Move Up', action: 'moveUp' },
  { label: 'Move Down', action: 'moveDown' },
  { label: 'Wrap in Group', action: 'wrapInGroup' },
];

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
  indexCounter: { value: number },
  insideRepeatableGroup = false,
): React.ReactNode[] {
  return items.map((item) => {
    // Display items (content) belong in the layout workspace, not the definition tree.
    if (item.type === 'display') return null;

    const path = parentPath ? `${parentPath}.${item.key}` : item.key;
    const itemBinds = bindsFor(allBinds, path);
    const summaries = buildRowSummaries(item, itemBinds);
    const categorySummaries = buildCategorySummaries(item, itemBinds);
    const statusPills = buildStatusPills(itemBinds, item, {
      categorySummaries,
    });
    const resolvedLabel = typeof item.label === 'string' && item.label.trim() ? item.label : item.key;
    const missingActions = buildMissingPropertyActions(item, itemBinds, resolvedLabel);
    const sortIndex = indexCounter.value++;

    if (item.type === 'group') {
      return (
        <SortableItemWrapper key={path} id={path} index={sortIndex} group="def-tree">
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
            {item.children ? renderItemTree(item.children, allBinds, depth + 1, path, ctx, indexCounter, insideRepeatableGroup || item.repeatable === true) : null}
          </GroupNode>
        </SortableItemWrapper>
      );
    }

    return (
      <SortableItemWrapper key={path} id={path} index={sortIndex} group="def-tree">
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

export function DefinitionTreeEditor() {
  const definition = useDefinition();
  const project = useProject();
  const {
    selectedKeys, selectedKeyForTab, select, toggleSelect, rangeSelect,
    deselect, isSelected,
  } = useSelection();
  const [showPicker, setShowPicker] = useState(false);
  const [addParentPath, setAddParentPath] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [pendingDeletePath, setPendingDeletePath] = useState<string | null>(null);
  const [wrapGroupDraft, setWrapGroupDraft] = useState<WrapGroupDraft | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  const items = (definition?.items ?? []) as FormItem[];
  const allBinds = definition?.binds as FormBind[] | undefined;
  const selectedKey = selectedKeyForTab(EDITOR_TAB);

  const flatOrder = useMemo(() => collectFlatOrder(items, ''), [items]);

  const onItemClick = useCallback((e: React.MouseEvent, path: string, type: string) => {
    e.stopPropagation();
    // Ignore clicks inside form inputs (they have their own handlers)
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      return;
    }
    const opts = { tab: EDITOR_TAB };
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
  }, [toggleSelect, rangeSelect, select, deselect, isSelected, flatOrder]);

  const onItemContextMenu = useCallback((e: React.MouseEvent, path: string, type: string) => {
    e.preventDefault();
    e.stopPropagation();
    // Select the item if not already selected
    if (!selectedKeys.has(path)) {
      select(path, type, { tab: EDITOR_TAB });
    }
    const position = clampContextMenuPosition(e.clientX, e.clientY);
    setContextMenu({ ...position, kind: 'item', path, type });
  }, [selectedKeys, select]);

  const handleContextAction = useCallback((action: string) => {
    const path = contextMenu?.path;
    if (!path) return;

    switch (action) {
      case 'duplicate':
        project.copyItem(path);
        break;
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
  }, [contextMenu, project, items]);

  // Escape to deselect (only when context menu is not open)
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
    const onMouseDown = () => {
      setContextMenu(null);
    };
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
      if (nextKey && nextKey !== currentKey) {
        project.renameItem(path, nextKey);
        const parentPath = path.split('.').slice(0, -1).join('.');
        nextPath = parentPath ? `${parentPath}.${nextKey}` : nextKey;
      }
      project.updateItem(nextPath, { label: nextLabel || null });
      select(nextPath, buildDefLookup(items).get(path)?.item?.type ?? 'field', { tab: EDITOR_TAB });
    },
    onUpdateItem: (path, changes) => {
      project.updateItem(path, changes);
    },
    onUpdateRepeatSettings: (path, changes) => {
      project.updateItem(path, changes);
    },
    onItemClick,
    onItemContextMenu,
  }), [isSelected, onItemClick, onItemContextMenu, project, select, items]);

  const handleAddItem = useCallback((opt: FieldTypeOption) => {
    const key = uniqueKey(opt.dataType ?? opt.itemType);
    const insertedPath = addParentPath ? `${addParentPath}.${key}` : key;
    const insertedType = opt.itemType === 'display' || opt.itemType === 'layout' ? 'display' : opt.itemType === 'group' ? 'group' : 'field';

    if (opt.itemType === 'group') {
      project.addGroup(insertedPath, opt.label);
    } else if (opt.itemType === 'display' || opt.itemType === 'layout') {
      const widgetHint = (opt.extra?.presentation as Record<string, unknown> | undefined)?.widgetHint as string | undefined;
      const kind = widgetHint ? WIDGET_HINT_TO_KIND[widgetHint] : undefined;
      project.addContent(insertedPath, opt.label, kind);
    } else if (opt.itemType === 'field') {
      project.addField(key, opt.label, opt.dataType ?? 'string', addParentPath ? { parentPath: addParentPath } : undefined);
    }

    select(insertedPath, insertedType, { tab: EDITOR_TAB, focusInspector: true });
    setShowPicker(false);
    setAddParentPath(null);
  }, [addParentPath, project, select]);

  const tree = useMemo(
    () => renderItemTree(items, allBinds, 0, '', treeCtx, { value: 0 }),
    [items, allBinds, treeCtx],
  );

  return (
    <WorkspacePage maxWidth="max-w-none" className="w-full">
      <WorkspacePageSection padding="px-0" className="flex justify-center pt-3 pb-20">
        <div
          ref={surfaceRef}
          data-testid="definition-tree-surface"
          className="flex w-full max-w-[980px] flex-col gap-4 rounded-[22px] border border-border/65 bg-surface/96 px-4 py-4 shadow-[0_24px_70px_rgba(30,24,16,0.08)] backdrop-blur sm:px-5 md:px-6 md:py-5"
          onClick={(event) => {
            if (event.target === event.currentTarget) deselect();
          }}
        >
        <div className="flex flex-col gap-3 border-b border-border/65 pb-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60">
              Structure editor
            </div>
            <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-ink">
              {selectedSummary ? selectedSummary.label : 'Form structure'}
            </h1>
            <p
              aria-live="polite"
              aria-atomic="true"
              className="mt-1 text-[13px] leading-6 text-muted/90"
            >
              {selectedSummary
                ? `${selectedSummary.typeLabel} key ${selectedSummary.key} in ${selectedSummary.parentPath}. Edit details inline below.`
                : 'Select a group or field to edit it inline, or add new structure below.'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 self-start md:self-auto">
            <div className="rounded-full border border-border/70 bg-bg-default/55 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-ink/68">
              {selectedSummary?.typeLabel ?? 'Canvas'}
            </div>
            {selectedSummary && (
              <div className="rounded-full border border-accent/20 bg-accent/[0.06] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-accent/90">
                Active selection
              </div>
            )}
          </div>
        </div>
        <AddItemPalette
          open={showPicker}
          title={addTargetLabel}
          scope="editor"
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
              className="rounded-[16px] border border-dashed border-accent/25 bg-bg-default/60 px-5 py-8 text-center"
            >
              <div className="mx-auto max-w-md space-y-3">
                <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-muted/85">Editor</div>
                <h2 className="text-[22px] font-semibold tracking-tight text-ink">Start building your form</h2>
                <p className="text-[13px] leading-6 text-muted">
                  Add your first field or group to create the structure respondents will move through.
                </p>
              </div>
            </div>
          ) : (
            tree
          )}
        </EditorDndProvider>
        <button
          data-testid="add-item"
          className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-[10px] border border-dashed border-accent/25 bg-bg-default/75 py-3 font-mono text-[11.5px] uppercase tracking-[0.18em] text-accent/65 transition-colors cursor-pointer hover:border-accent/50 hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
          onClick={() => {
            setAddParentPath(null);
            setShowPicker(!showPicker);
          }}
        >
          + Add Item
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
            project.removeItem(pendingDeletePath);
            deselect();
          }
          setPendingDeletePath(null);
        }}
      />

      {wrapGroupDraft && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) setWrapGroupDraft(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Wrap ${wrapGroupDraft.itemLabel} in group`}
            className="w-full max-w-md rounded-xl border border-border bg-surface shadow-xl"
          >
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-[15px] font-semibold text-ink">
                Wrap {wrapGroupDraft.itemLabel} in group
              </h2>
            </div>
            <div className="space-y-4 px-5 py-4">
              <p className="text-[13px] leading-6 text-muted">
                Choose the new group key and label before wrapping the selected item.
              </p>
              <div className="space-y-2">
                <label className="block text-[12px] font-medium text-muted" htmlFor="wrap-group-key">
                  Group Key
                </label>
                <input
                  id="wrap-group-key"
                  type="text"
                  value={wrapGroupDraft.key}
                  onChange={(event) => {
                    const nextKey = event.currentTarget.value;
                    setWrapGroupDraft((current) => current ? { ...current, key: nextKey } : current);
                  }}
                  className="w-full rounded-[6px] border border-border/80 bg-surface px-3 py-2 text-[13px] font-mono outline-none transition-colors focus:border-accent"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[12px] font-medium text-muted" htmlFor="wrap-group-label">
                  Group Label
                </label>
                <input
                  id="wrap-group-label"
                  type="text"
                  value={wrapGroupDraft.label}
                  onChange={(event) => {
                    const nextLabel = event.currentTarget.value;
                    setWrapGroupDraft((current) => current ? { ...current, label: nextLabel } : current);
                  }}
                  className="w-full rounded-[6px] border border-border/80 bg-surface px-3 py-2 text-[13px] outline-none transition-colors focus:border-accent"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
              <button
                type="button"
                className="rounded-[6px] border border-border/80 bg-surface px-3 py-2 text-[11px] font-mono font-semibold uppercase tracking-[0.18em] text-ink transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                onClick={() => setWrapGroupDraft(null)}
              >
                Cancel Wrap
              </button>
              <button
                type="button"
                className="rounded-[6px] border border-accent/30 bg-accent/8 px-3 py-2 text-[11px] font-mono font-semibold uppercase tracking-[0.18em] text-accent transition-colors hover:bg-accent/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                onClick={() => {
                  if (!wrapGroupDraft?.key.trim()) return;
                  const result = project.wrapItemsInGroup(
                    [wrapGroupDraft.itemPath],
                    wrapGroupDraft.key.trim(),
                    wrapGroupDraft.label.trim() || 'Group',
                  );
                  const groupPath = result.affectedPaths?.[0];
                  if (groupPath) {
                    select(groupPath, 'group', { tab: EDITOR_TAB });
                  }
                  setWrapGroupDraft(null);
                }}
              >
                Create Group
              </button>
            </div>
          </div>
        </div>
      )}

      {contextMenu && (
        <div
          style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 50 }}
        >
          <EditorContextMenu
            onAction={handleContextAction}
            onClose={() => setContextMenu(null)}
            items={TREE_CONTEXT_MENU_ITEMS}
            testId="context-menu"
          />
        </div>
      )}
    </WorkspacePage>
  );
}
