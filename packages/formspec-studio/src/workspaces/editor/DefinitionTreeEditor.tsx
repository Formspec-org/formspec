/** @filedesc Tree view of definition.items — pure Tier 1, no component tree awareness, no page filtering. */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDefinition } from '../../state/useDefinition';
import { useProject } from '../../state/useProject';
import { useSelection } from '../../state/useSelection';
import { bindsFor } from '../../lib/field-helpers';
import { WorkspacePage, WorkspacePageSection } from '../../components/ui/WorkspacePage';
import { AddItemPalette, type FieldTypeOption } from '../../components/AddItemPalette';
import { EditorContextMenu } from './EditorContextMenu';
import { ItemRow } from './ItemRow';
import { GroupNode } from './GroupNode';
import { EditorDndProvider } from './EditorDndProvider';
import { SortableItemWrapper } from './dnd/SortableItemWrapper';
import { clampContextMenuPosition, type ContextMenuState, type ContextMenuItem } from './canvas-operations';

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

interface TreeRenderContext {
  isSelected: (key: string) => boolean;
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
): React.ReactNode[] {
  return items.map((item) => {
    const path = parentPath ? `${parentPath}.${item.key}` : item.key;
    const itemBinds = bindsFor(allBinds, path);
    const sortIndex = indexCounter.value++;

    if (item.type === 'group') {
      return (
        <SortableItemWrapper key={path} id={path} index={sortIndex} group="def-tree">
          <GroupNode
            itemKey={item.key}
            label={item.label}
            repeatable={item.repeatable}
            minRepeat={item.minRepeat}
            maxRepeat={item.maxRepeat}
            depth={depth}
            selected={ctx.isSelected(path)}
            onClick={(e) => ctx.onItemClick(e, path, 'group')}
            onContextMenu={(e) => ctx.onItemContextMenu(e, path, 'group')}
          >
            {item.children ? renderItemTree(item.children, allBinds, depth + 1, path, ctx, indexCounter) : null}
          </GroupNode>
        </SortableItemWrapper>
      );
    }

    const itemType = item.type === 'display' ? 'display' : 'field';
    return (
      <SortableItemWrapper key={path} id={path} index={sortIndex} group="def-tree">
        <ItemRow
          itemKey={item.key}
          itemType={itemType}
          label={item.label}
          dataType={item.dataType}
          widgetHint={item.presentation?.widgetHint}
          binds={itemBinds}
          depth={depth}
          selected={ctx.isSelected(path)}
          onClick={(e) => ctx.onItemClick(e, path, itemType)}
          onContextMenu={(e) => ctx.onItemContextMenu(e, path, itemType)}
        />
      </SortableItemWrapper>
    );
  });
}

/** Collect all item paths in definition order for range-select. */
function collectFlatOrder(items: FormItem[], parentPath: string): string[] {
  const result: string[] = [];
  for (const item of items) {
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
    selectedKeys, select, toggleSelect, rangeSelect,
    selectAndFocusInspector, deselect, isSelected,
  } = useSelection();
  const [showPicker, setShowPicker] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const items = (definition?.items ?? []) as FormItem[];
  const allBinds = definition?.binds as FormBind[] | undefined;

  const flatOrder = useMemo(() => collectFlatOrder(items, ''), [items]);

  const onItemClick = useCallback((e: React.MouseEvent, path: string, type: string) => {
    e.stopPropagation();
    const opts = { tab: EDITOR_TAB };
    if (e.metaKey || e.ctrlKey) {
      toggleSelect(path, type, opts);
    } else if (e.shiftKey) {
      rangeSelect(path, type, flatOrder, opts);
    } else {
      select(path, type, opts);
    }
  }, [toggleSelect, rangeSelect, select, flatOrder]);

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
        project.removeItem(path);
        deselect();
        break;
      case 'moveUp':
        project.reorderItem(path, 'up');
        break;
      case 'moveDown':
        project.reorderItem(path, 'down');
        break;
      case 'wrapInGroup': {
        const result = project.wrapItemsInGroup([path], 'Group');
        const groupPath = result.affectedPaths?.[0];
        if (groupPath) {
          selectAndFocusInspector(groupPath, 'group', { tab: EDITOR_TAB });
        }
        break;
      }
    }
    setContextMenu(null);
  }, [contextMenu, project, deselect, selectAndFocusInspector]);

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

  const treeCtx: TreeRenderContext = useMemo(() => ({
    isSelected,
    onItemClick,
    onItemContextMenu,
  }), [isSelected, onItemClick, onItemContextMenu]);

  const handleAddItem = useCallback((opt: FieldTypeOption) => {
    const key = uniqueKey(opt.dataType ?? opt.itemType);

    if (opt.itemType === 'group') {
      project.addGroup(key, opt.label);
    } else if (opt.itemType === 'display') {
      const widgetHint = (opt.extra?.presentation as Record<string, unknown> | undefined)?.widgetHint as string | undefined;
      const kind = widgetHint ? WIDGET_HINT_TO_KIND[widgetHint] : undefined;
      project.addContent(key, opt.label, kind);
    } else if (opt.itemType === 'field') {
      project.addField(key, opt.label, opt.dataType ?? 'string');
    }

    setShowPicker(false);
  }, [project]);

  const tree = useMemo(
    () => renderItemTree(items, allBinds, 0, '', treeCtx, { value: 0 }),
    [items, allBinds, treeCtx],
  );

  return (
    <WorkspacePage>
      <WorkspacePageSection className="flex flex-col gap-0.5 pt-3 pb-20">
        <AddItemPalette
          open={showPicker}
          onClose={() => setShowPicker(false)}
          onAdd={handleAddItem}
        />
        <EditorDndProvider items={items}>
          {tree}
        </EditorDndProvider>
        <button
          data-testid="add-item"
          className="mt-3 flex items-center justify-center gap-1.5 rounded border border-dashed border-border bg-surface py-2 font-mono text-[11.5px] text-muted transition-colors cursor-pointer hover:border-accent/50 hover:text-ink"
          onClick={() => setShowPicker(!showPicker)}
        >
          + Add Item
        </button>
      </WorkspacePageSection>

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
