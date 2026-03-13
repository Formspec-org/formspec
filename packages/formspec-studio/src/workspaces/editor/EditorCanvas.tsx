import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useDefinition } from '../../state/useDefinition';
import { useSelection } from '../../state/useSelection';
import { useActivePage } from '../../state/useActivePage';
import { useDispatch } from '../../state/useDispatch';
import { useProject } from '../../state/useProject';
import { useCanvasTargets } from '../../state/useCanvasTargets';
import { bindsFor, flatItems } from '../../lib/field-helpers';
import { pruneDescendants, sortForBatchDelete } from '../../lib/selection-helpers';
import { FieldBlock } from './FieldBlock';
import { GroupBlock } from './GroupBlock';
import { DisplayBlock } from './DisplayBlock';
import { PageTabs } from './PageTabs';
import { AddItemPalette, type FieldTypeOption } from '../../components/AddItemPalette';
import { EditorContextMenu } from './EditorContextMenu';
import { WorkspacePage, WorkspacePageSection } from '../../components/ui/WorkspacePage';

interface Item {
  key: string;
  type: string;
  dataType?: string;
  label?: string;
  hint?: string;
  repeatable?: boolean;
  minRepeat?: number;
  maxRepeat?: number;
  children?: Item[];
}

function renderItems(
  items: Item[],
  allBinds: Record<string, Record<string, string>> | undefined,
  primaryKey: string | null,
  selectedKeys: Set<string>,
  handleItemClick: (e: React.MouseEvent, path: string, type: string) => void,
  registerTarget: (path: string, element: HTMLElement | null) => void,
  depth: number,
  prefix: string,
): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  for (const item of items) {
    const path = prefix ? `${prefix}.${item.key}` : item.key;
    const isPrimary = primaryKey === path;
    const inSelection = selectedKeys.has(path) && !isPrimary;

    if (item.type === 'group') {
      nodes.push(
        <GroupBlock
          key={path}
          itemKey={item.key}
          itemPath={path}
          registerTarget={registerTarget}
          label={item.label}
          repeatable={item.repeatable}
          minRepeat={item.minRepeat}
          maxRepeat={item.maxRepeat}
          depth={depth}
          selected={isPrimary}
          isInSelection={inSelection}
          onSelect={(e) => handleItemClick(e, path, 'group')}
        >
          {item.children
            ? renderItems(item.children, allBinds, primaryKey, selectedKeys, handleItemClick, registerTarget, depth + 1, path)
            : null}
        </GroupBlock>
      );
    } else if (item.type === 'display') {
      nodes.push(
        <DisplayBlock
          key={path}
          itemKey={item.key}
          itemPath={path}
          registerTarget={registerTarget}
          label={item.label}
          depth={depth}
          selected={isPrimary}
          isInSelection={inSelection}
          onSelect={(e) => handleItemClick(e, path, 'display')}
        />
      );
    } else {
      nodes.push(
        <FieldBlock
          key={path}
          itemKey={item.key}
          itemPath={path}
          registerTarget={registerTarget}
          label={item.label}
          hint={item.hint}
          dataType={item.dataType}
          binds={bindsFor(allBinds, path)}
          depth={depth}
          selected={isPrimary}
          isInSelection={inSelection}
          onSelect={(e) => handleItemClick(e, path, item.type)}
        />
      );
    }
  }
  return nodes;
}

let nextItemId = 1;
function uniqueKey(prefix: string): string {
  return `${prefix}${nextItemId++}`;
}

interface ContextMenuState {
  x: number;
  y: number;
  kind: 'item' | 'canvas';
  path?: string;
  type?: string;
}

interface ItemLocation {
  path: string;
  parentPath: string | null;
  index: number;
  item: Item;
}

function findItemLocation(items: Item[], targetPath: string, prefix = ''): ItemLocation | null {
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const path = prefix ? `${prefix}.${item.key}` : item.key;
    if (path === targetPath) {
      return { path, parentPath: prefix || null, index, item };
    }
    if (item.children?.length) {
      const nested = findItemLocation(item.children, targetPath, path);
      if (nested) return nested;
    }
  }
  return null;
}

function clampContextMenuPosition(x: number, y: number) {
  const MENU_WIDTH = 160;
  const MENU_HEIGHT = 190;
  const maxX = Math.max(0, window.innerWidth - MENU_WIDTH);
  const maxY = Math.max(0, window.innerHeight - MENU_HEIGHT);
  return {
    x: Math.min(Math.max(0, x), maxX),
    y: Math.min(Math.max(0, y), maxY),
  };
}

export function EditorCanvas() {
  const definition = useDefinition();
  const {
    selectedKeys, primaryKey, selectionCount,
    select, toggleSelect, rangeSelect,
    selectAndFocusInspector, deselect,
  } = useSelection();
  const { activePageKey, setActivePageKey } = useActivePage();
  const dispatch = useDispatch();
  const project = useProject();
  const { registerTarget } = useCanvasTargets();
  const [showPicker, setShowPicker] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const items: Item[] = (definition?.items as Item[]) || [];
  const allBinds = definition?.binds as Record<string, Record<string, string>> | undefined;

  const pageMode = (definition as any)?.formPresentation?.pageMode;
  const isPaged = pageMode === 'wizard' || pageMode === 'tabs';
  const topLevelGroups = items.filter((i) => i.type === 'group');
  const rootItems = items.filter((i) => i.type !== 'group');
  const hasPaged = isPaged && topLevelGroups.length > 0;

  useEffect(() => {
    if (!hasPaged) {
      if (activePageKey !== null) setActivePageKey(null);
      return;
    }
    const hasActivePage = topLevelGroups.some((group) => group.key === activePageKey);
    if (!hasActivePage) {
      setActivePageKey(topLevelGroups[0]?.key ?? null);
    }
  }, [activePageKey, hasPaged, setActivePageKey, topLevelGroups]);

  // Derive numeric index from shared activePageKey
  const activePageIndex = hasPaged
    ? Math.max(0, topLevelGroups.findIndex((g) => g.key === activePageKey))
    : 0;
  const displayItems: Item[] = hasPaged
    ? [...rootItems, topLevelGroups[activePageIndex]].filter(Boolean)
    : items;

  // Flat ordering for range-select (shift+click)
  const flatOrder = useMemo(
    () => flatItems(displayItems as any).map(f => f.path),
    [displayItems],
  );

  const handleItemClick = useCallback((e: React.MouseEvent, path: string, type: string) => {
    if (e.metaKey || e.ctrlKey) {
      toggleSelect(path, type);
    } else if (e.shiftKey) {
      rangeSelect(path, type, flatOrder);
    } else {
      select(path, type);
    }
  }, [toggleSelect, rangeSelect, select, flatOrder]);

  const handleAddItem = (opt: FieldTypeOption) => {
    const key = uniqueKey(opt.dataType ?? opt.itemType);
    const activeGroup = hasPaged ? topLevelGroups[activePageIndex] : null;
    const result = dispatch({
      type: 'definition.addItem',
      payload: {
        key,
        type: opt.itemType,
        dataType: opt.dataType,
        label: opt.label,
        ...(activeGroup ? { parentPath: activeGroup.key } : {}),
        ...opt.extra,
      },
    });
    const insertedPath = result.insertedPath ?? (activeGroup ? `${activeGroup.key}.${key}` : key);
    selectAndFocusInspector(insertedPath, opt.itemType);
    setShowPicker(false);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    const target = e.target as Element;
    const block = target.closest<HTMLElement>('[data-item-path]');
    e.preventDefault();
    const position = clampContextMenuPosition(e.clientX, e.clientY);
    if (!block) {
      setContextMenu({ ...position, kind: 'canvas' });
      return;
    }
    const itemPath = block.dataset.itemPath;
    const itemType = block.dataset.itemType;
    if (!itemPath || !itemType) {
      setContextMenu({ ...position, kind: 'canvas' });
      return;
    }
    // Right-click on item not in selection → clear and select just that item
    if (!selectedKeys.has(itemPath)) {
      select(itemPath, itemType);
    }
    setContextMenu({ ...position, kind: 'item', path: itemPath, type: itemType });
  };

  const registerCanvasTarget = useCallback((path: string, element: HTMLElement | null) => {
    registerTarget(path, element);
  }, [registerTarget]);

  // Close context menu on outside click or Escape
  useEffect(() => {
    if (!contextMenu) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    const onMouseDown = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onMouseDown);
    };
  }, [contextMenu]);

  // Escape to deselect (only when context menu is not open)
  useEffect(() => {
    if (contextMenu) return; // context menu's own Escape handler takes priority
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') deselect();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [contextMenu, deselect]);

  const handleContextAction = (action: string) => {
    if (!contextMenu) return;
    if (contextMenu.kind === 'canvas') {
      if (action === 'addItem') setShowPicker(true);
      setContextMenu(null);
      return;
    }
    const path = contextMenu.path;
    if (!path) return;

    // Batch operations when multiple items selected
    if (selectionCount > 1) {
      switch (action) {
        case 'batchDelete': {
          const pruned = pruneDescendants(selectedKeys);
          const sorted = sortForBatchDelete(pruned);
          project.batch(sorted.map(p => ({ type: 'definition.deleteItem', payload: { path: p } })));
          deselect();
          break;
        }
        case 'batchDuplicate': {
          const pruned = pruneDescendants(selectedKeys);
          const sorted = sortForBatchDelete(pruned);
          project.batch(sorted.map(p => ({ type: 'definition.duplicateItem', payload: { path: p } })));
          break;
        }
        case 'wrapInGroup': {
          // Find common parent of all selected items
          const pruned = pruneDescendants(selectedKeys);
          if (pruned.length === 0) break;
          // Use the first item's parent as the insertion point
          const firstLocation = findItemLocation(items, pruned[0]);
          if (!firstLocation) break;
          const wrapperKey = uniqueKey('group');
          const addResult = dispatch({
            type: 'definition.addItem',
            payload: {
              key: wrapperKey,
              type: 'group',
              label: 'Group',
              ...(firstLocation.parentPath ? { parentPath: firstLocation.parentPath } : {}),
              insertIndex: firstLocation.index,
            },
          });
          const targetParentPath = addResult.insertedPath
            ?? (firstLocation.parentPath ? `${firstLocation.parentPath}.${wrapperKey}` : wrapperKey);
          // Move each item into the new group — use batch for atomic undo
          project.batch(pruned.map((p, i) => ({
            type: 'definition.moveItem',
            payload: { sourcePath: p, targetParentPath, targetIndex: i },
          })));
          deselect();
          break;
        }
      }
      setContextMenu(null);
      return;
    }

    // Single-item operations
    switch (action) {
      case 'duplicate':
        dispatch({ type: 'definition.duplicateItem', payload: { path } });
        break;
      case 'delete':
        dispatch({ type: 'definition.deleteItem', payload: { path } });
        break;
      case 'moveUp':
        dispatch({ type: 'definition.reorderItem', payload: { path, direction: 'up' } });
        break;
      case 'moveDown':
        dispatch({ type: 'definition.reorderItem', payload: { path, direction: 'down' } });
        break;
      case 'wrapInGroup': {
        const location = findItemLocation(items, path);
        if (!location) break;
        const wrapperKey = uniqueKey('group');
        const addResult = dispatch({
          type: 'definition.addItem',
          payload: {
            key: wrapperKey,
            type: 'group',
            label: 'Group',
            ...(location.parentPath ? { parentPath: location.parentPath } : {}),
            insertIndex: location.index,
          },
        });
        const targetParentPath = addResult.insertedPath
          ?? (location.parentPath ? `${location.parentPath}.${wrapperKey}` : wrapperKey);
        dispatch({
          type: 'definition.moveItem',
          payload: { sourcePath: path, targetParentPath, targetIndex: 0 },
        });
        break;
      }
    }
    setContextMenu(null);
  };

  // Build context menu items based on selection state
  const contextMenuItems = (() => {
    if (!contextMenu || contextMenu.kind === 'canvas') {
      return [{ label: 'Add Item', action: 'addItem' }];
    }
    if (selectionCount > 1) {
      return [
        { label: `Delete ${selectionCount} items`, action: 'batchDelete' },
        { label: `Duplicate ${selectionCount} items`, action: 'batchDuplicate' },
        { label: 'Wrap in Group', action: 'wrapInGroup' },
      ];
    }
    return undefined; // default single-item menu
  })();

  const formTitle = (definition as any)?.title;
  const formUrl = (definition as any)?.url;
  const formVersion = (definition as any)?.version;
  const formPresentation = (definition as any)?.formPresentation || {};
  const defaultCurrency = formPresentation.defaultCurrency;

  return (
    <WorkspacePage
      onClick={(e: React.MouseEvent) => {
        if (e.target === e.currentTarget) deselect();
      }}
      onContextMenu={handleContextMenu}
    >
      {/* Form metadata header */}
      {(formTitle || formUrl) && (
        <WorkspacePageSection className="pt-4 pb-3 border-b border-border bg-surface shrink-0">
          <div className="font-ui text-[15px] font-semibold tracking-tight text-ink leading-snug truncate">
            {formTitle || 'Untitled Form'}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 font-mono text-[10.5px] text-muted overflow-hidden">
            {formUrl && <span className="truncate min-w-0">{formUrl}</span>}
            {formVersion && <><span className="opacity-40 shrink-0">·</span><span className="shrink-0">v{formVersion}</span></>}
            {pageMode && <><span className="opacity-40 shrink-0">·</span><span className="shrink-0">{pageMode}</span></>}
            {defaultCurrency && <><span className="opacity-40 shrink-0">·</span><span className="shrink-0">{defaultCurrency}</span></>}
          </div>
        </WorkspacePageSection>
      )}

      {/* Page tabs — only when in paged mode */}
      {hasPaged && (
        <WorkspacePageSection className="border-b border-border bg-surface">
          <PageTabs activePageKey={activePageKey} onPageChange={setActivePageKey} />
        </WorkspacePageSection>
      )}

      {/* Items list */}
      <WorkspacePageSection className="flex flex-col gap-1 pt-3 pb-20">
        <AddItemPalette
          open={showPicker}
          onClose={() => setShowPicker(false)}
          onAdd={handleAddItem}
        />
        {renderItems(displayItems, allBinds, primaryKey, selectedKeys, handleItemClick, registerCanvasTarget, 0, '')}
        <button
          data-testid="add-item"
          className="fixed bottom-3 left-3 right-3 z-10 flex items-center justify-center gap-1.5 rounded-[4px] border border-dashed border-border bg-surface py-2.5 font-mono text-[11.5px] text-muted shadow-sm transition-colors cursor-pointer hover:border-accent/50 hover:text-ink sm:static sm:mt-3 sm:w-full sm:bg-transparent sm:shadow-none"
          onClick={() => setShowPicker(!showPicker)}
        >
          + Add Item
        </button>
      </WorkspacePageSection>

      {contextMenu && (
        <div
          ref={contextMenuRef}
          style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 50 }}
        >
          <EditorContextMenu
            onAction={handleContextAction}
            onClose={() => setContextMenu(null)}
            items={contextMenuItems}
            testId={contextMenu.kind === 'canvas' ? 'canvas-context-menu' : 'context-menu'}
          />
        </div>
      )}
    </WorkspacePage>
  );
}
