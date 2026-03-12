import { useState, useEffect, useRef, useCallback } from 'react';
import { useDefinition } from '../../state/useDefinition';
import { useSelection } from '../../state/useSelection';
import { useActivePage } from '../../state/useActivePage';
import { useDispatch } from '../../state/useDispatch';
import { useCanvasTargets } from '../../state/useCanvasTargets';
import { bindsFor } from '../../lib/field-helpers';
import { FieldBlock } from './FieldBlock';
import { GroupBlock } from './GroupBlock';
import { DisplayBlock } from './DisplayBlock';
import { PageTabs } from './PageTabs';
import { AddItemPalette, type FieldTypeOption } from '../../components/AddItemPalette';
import { EditorContextMenu } from './EditorContextMenu';

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
  selectedKey: string | null,
  select: (key: string, type: string) => void,
  registerTarget: (path: string, element: HTMLElement | null) => void,
  depth: number,
  prefix: string,
): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  for (const item of items) {
    const path = prefix ? `${prefix}.${item.key}` : item.key;
    const isSelected = selectedKey === path;

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
          selected={isSelected}
          onSelect={() => select(path, 'group')}
        >
          {item.children
            ? renderItems(item.children, allBinds, selectedKey, select, registerTarget, depth + 1, path)
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
          selected={isSelected}
          onSelect={() => select(path, 'display')}
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
          selected={isSelected}
          onSelect={() => select(path, item.type)}
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
  const { selectedKey, select, selectAndFocusInspector, deselect } = useSelection();
  const { activePageKey, setActivePageKey } = useActivePage();
  const dispatch = useDispatch();
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

  const handleAddItem = (opt: FieldTypeOption) => {
    const key = uniqueKey(opt.dataType ?? opt.itemType);
    const activeGroup = hasPaged ? topLevelGroups[activePageIndex] : null;
    const itemPath = activeGroup ? `${activeGroup.key}.${key}` : key;
    dispatch({
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
    selectAndFocusInspector(itemPath, opt.itemType);
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

  const handleContextAction = (action: string) => {
    if (!contextMenu) return;
    if (contextMenu.kind === 'canvas') {
      if (action === 'addItem') setShowPicker(true);
      setContextMenu(null);
      return;
    }
    const path = contextMenu.path;
    if (!path) return;
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
        dispatch({
          type: 'definition.addItem',
          payload: {
            key: wrapperKey,
            type: 'group',
            label: 'Group',
            ...(location.parentPath ? { parentPath: location.parentPath } : {}),
            insertIndex: location.index,
          },
        });
        const targetParentPath = location.parentPath ? `${location.parentPath}.${wrapperKey}` : wrapperKey;
        dispatch({
          type: 'definition.moveItem',
          payload: { sourcePath: path, targetParentPath, targetIndex: 0 },
        });
        break;
      }
    }
    setContextMenu(null);
  };

  const formTitle = (definition as any)?.title;
  const formUrl = (definition as any)?.url;
  const formVersion = (definition as any)?.version;
  const formPresentation = (definition as any)?.formPresentation || {};
  const defaultCurrency = formPresentation.defaultCurrency;

  return (
    <div
      className="flex flex-col min-h-full max-w-[660px] mx-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) deselect();
      }}
      onContextMenu={handleContextMenu}
    >
      {/* Form metadata header */}
      {(formTitle || formUrl) && (
        <div className="px-7 pt-4 pb-3 border-b border-border bg-surface shrink-0">
          <div className="font-ui text-[15px] font-semibold tracking-tight text-ink leading-snug truncate">
            {formTitle || 'Untitled Form'}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 font-mono text-[10.5px] text-muted overflow-hidden">
            {formUrl && <span className="truncate min-w-0">{formUrl}</span>}
            {formVersion && <><span className="opacity-40 shrink-0">·</span><span className="shrink-0">v{formVersion}</span></>}
            {pageMode && <><span className="opacity-40 shrink-0">·</span><span className="shrink-0">{pageMode}</span></>}
            {defaultCurrency && <><span className="opacity-40 shrink-0">·</span><span className="shrink-0">{defaultCurrency}</span></>}
          </div>
        </div>
      )}

      {/* Page tabs — only when in paged mode */}
      {hasPaged && (
        <div className="px-7 border-b border-border bg-surface">
          <PageTabs activePageKey={activePageKey} onPageChange={setActivePageKey} />
        </div>
      )}

      {/* Items list */}
      <div className="flex flex-col gap-1 px-7 pt-3 pb-20">
        <AddItemPalette
          open={showPicker}
          onClose={() => setShowPicker(false)}
          onAdd={handleAddItem}
        />
        {renderItems(displayItems, allBinds, selectedKey, select, registerCanvasTarget, 0, '')}
      <button
          data-testid="add-item"
          className="fixed bottom-3 left-3 right-3 z-10 flex items-center justify-center gap-1.5 rounded-[4px] border border-dashed border-border bg-surface py-2.5 font-mono text-[11.5px] text-muted shadow-sm transition-colors cursor-pointer hover:border-accent/50 hover:text-ink sm:static sm:mt-3 sm:w-full sm:bg-transparent sm:shadow-none"
          onClick={() => setShowPicker(!showPicker)}
        >
          + Add Item
        </button>
      </div>

      {contextMenu && (
        <div
          ref={contextMenuRef}
          style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 50 }}
        >
          <EditorContextMenu
            onAction={handleContextAction}
            onClose={() => setContextMenu(null)}
            items={contextMenu.kind === 'canvas'
              ? [{ label: 'Add Item', action: 'addItem' }]
              : undefined}
            testId={contextMenu.kind === 'canvas' ? 'canvas-context-menu' : 'context-menu'}
          />
        </div>
      )}
    </div>
  );
}
