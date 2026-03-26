/** @filedesc Main editor canvas with drag-and-drop, page tabs, context menu, and item palette. */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { DragDropProvider, DragOverlay } from '@dnd-kit/react';
import { PointerSensor, KeyboardSensor, PointerActivationConstraints } from '@dnd-kit/dom';
import { useDefinition } from '../../state/useDefinition';
import { useComponent } from '../../state/useComponent';
import { useSelection } from '../../state/useSelection';
import { useActiveGroup } from '../../state/useActiveGroup';
import { useProject } from '../../state/useProject';
import { useCanvasTargets } from '../../state/useCanvasTargets';
import { flattenComponentTree, buildDefLookup, buildBindKeyMap, type FlatEntry } from '../../lib/field-helpers';
import { GroupTabs } from './GroupTabs';
import { AddItemPalette, type FieldTypeOption } from '../../components/AddItemPalette';
import { EditorContextMenu } from './EditorContextMenu';
import { WorkspacePage, WorkspacePageSection } from '../../components/ui/WorkspacePage';
import { DropIndicator } from './dnd/DropIndicator';
import { DragOverlayContent } from './dnd/DragOverlayContent';
import { useCanvasDnd } from './dnd/use-canvas-dnd';
import { buildContextMenuItems, clampContextMenuPosition, executeContextAction, type ContextMenuState } from './canvas-operations';
import { renderTreeNodes } from './render-tree-nodes';

interface CompNode {
  component: string;
  bind?: string;
  nodeId?: string;
  _layout?: boolean;
  children?: CompNode[];
  [key: string]: unknown;
}

let nextItemId = 1;
function uniqueKey(prefix: string): string {
  return `${prefix}${nextItemId++}`;
}

/** Map widgetHint value to addContent kind parameter */
const WIDGET_HINT_TO_KIND: Record<string, 'heading' | 'paragraph' | 'divider'> = {
  Heading: 'heading',
  heading: 'heading',
  Paragraph: 'paragraph',
  paragraph: 'paragraph',
  Divider: 'divider',
  divider: 'divider',
};

export function EditorCanvas() {
  const definition = useDefinition();
  const {
    selectedKeys, primaryKey, selectionCount,
    select, toggleSelect, rangeSelect,
    selectAndFocusInspector, deselect,
  } = useSelection();
  const { activeGroupKey, setActiveGroupKey } = useActiveGroup();
  const project = useProject();
  const { registerTarget } = useCanvasTargets();
  const [showPicker, setShowPicker] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const items = definition?.items ?? [];
  const allBinds = definition?.binds as Array<{ path: string; [k: string]: unknown }> | undefined;
  const component = useComponent();
  const tree = component?.tree as CompNode | undefined;

  const pageMode = definition?.formPresentation?.pageMode;
  const isPaged = pageMode === 'wizard' || pageMode === 'tabs';
  const topLevelGroups = items.filter((i) => i.type === 'group');
  const rootItems = items.filter((i) => i.type !== 'group');
  const hasPaged = isPaged && topLevelGroups.length > 0;

  useEffect(() => {
    if (!hasPaged) {
      if (activeGroupKey !== null) setActiveGroupKey(null);
      return;
    }
    const hasActiveGroup = topLevelGroups.some((group) => group.key === activeGroupKey);
    if (!hasActiveGroup) {
      setActiveGroupKey(topLevelGroups[0]?.key ?? null);
    }
  }, [activeGroupKey, hasPaged, setActiveGroupKey, topLevelGroups]);

  // Derive numeric index from shared activeGroupKey
  const activeGroupIndex = hasPaged
    ? Math.max(0, topLevelGroups.findIndex((g) => g.key === activeGroupKey))
    : 0;
  const displayItems = hasPaged
    ? [...rootItems, topLevelGroups[activeGroupIndex]].filter(Boolean)
    : items;

  // Build definition lookup for the component tree renderer
  const defLookup = useMemo(
    () => buildDefLookup(displayItems),
    [displayItems],
  );

  // Secondary lookup: bind key → full def path (for fields inside layout containers)
  const bindKeyMap = useMemo(
    () => buildBindKeyMap(defLookup),
    [defLookup],
  );

  // Determine which tree nodes to render (filter for paged mode)
  const displayTreeNodes: CompNode[] = useMemo(() => {
    if (!tree?.children) return [];

    // The reconciler may build a structural wrapper when theme pages exist.
    // In that case tree.children are Page structural nodes (nodeId, no bind, no _layout)
    // that are not in defLookup. Flatten through them to get the actual content nodes.
    const flattenStructural = (nodes: CompNode[]): CompNode[] => {
      const result: CompNode[] = [];
      for (const node of nodes) {
        if (node._layout || node.bind) {
          result.push(node);
        } else if (node.nodeId && !defLookup.has(node.nodeId)) {
          // Structural wrapper (Page node) — unwrap to children
          result.push(...flattenStructural(node.children ?? []));
        } else {
          result.push(node);
        }
      }
      return result;
    };
    const flatChildren = flattenStructural(tree.children);

    if (!hasPaged) return flatChildren;
    // In paged mode, show root items (non-groups) + the active page group
    const activeGroup = topLevelGroups[activeGroupIndex];
    return flatChildren.filter((node: CompNode) => {
      if (node._layout) return true; // always show layout wrappers
      if (node.bind) {
        const defEntry = defLookup.get(node.bind);
        if (!defEntry) return false;
        const item = defEntry.item;
        if (item.type === 'group') return activeGroup && item.key === activeGroup.key;
        return true; // root-level non-group items
      }
      if (node.nodeId) return true; // display nodes
      return false;
    });
  }, [tree, hasPaged, topLevelGroups, activeGroupIndex, defLookup]);

  // Flat ordering from component tree for range-select and DnD
  const treeFlatEntries: FlatEntry[] = useMemo(
    () => tree ? flattenComponentTree({ ...tree, children: displayTreeNodes }, defLookup, bindKeyMap) : [],
    [tree, displayTreeNodes, defLookup, bindKeyMap],
  );
  const flatOrder = useMemo(
    () => treeFlatEntries.map(e => e.id),
    [treeFlatEntries],
  );

  const flatIndexMap = useMemo(
    () => new Map(treeFlatEntries.map((entry, index) => [entry.id, index])),
    [treeFlatEntries],
  );

  const {
    activeId,
    overTarget,
    onDragStart,
    onDragMove,
    onDragOver,
    onDragEnd,
  } = useCanvasDnd({
    flatList: treeFlatEntries,
    selectedKeys,
    select,
    project,
  });

  // Look up the active item for the drag overlay
  const activeItem = activeId ? treeFlatEntries.find(e => e.id === activeId) : null;

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
    if (opt.itemType === 'layout') {
      // Layout items are component-tree-only (no definition entry)
      const result = project.addLayoutNode('root', opt.component!);
      const nodeId = result.createdId;
      if (nodeId) {
        selectAndFocusInspector(`__node:${nodeId}`, 'layout');
      }
      setShowPicker(false);
      return;
    }

    const key = uniqueKey(opt.dataType ?? opt.itemType);
    const activeGroup = hasPaged ? topLevelGroups[activeGroupIndex] : null;
    const parentPath = activeGroup ? activeGroup.key : undefined;
    const fullPath = parentPath ? `${parentPath}.${key}` : key;

    if (opt.itemType === 'group') {
      project.addGroup(fullPath, opt.label);
      selectAndFocusInspector(fullPath, 'group');
    } else if (opt.itemType === 'display') {
      const widgetHint = (opt.extra?.presentation as Record<string, unknown> | undefined)?.widgetHint as string | undefined;
      const kind = widgetHint ? WIDGET_HINT_TO_KIND[widgetHint] : undefined;
      project.addContent(fullPath, opt.label, kind);
      selectAndFocusInspector(fullPath, 'display');
    } else {
      // field
      project.addField(fullPath, opt.label, opt.dataType ?? 'string');
      selectAndFocusInspector(fullPath, 'field');
    }

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

  const handleContextAction = useCallback((action: string) => {
    executeContextAction({
      action,
      contextMenu,
      items,
      selectionCount,
      selectedKeys,
      project,
      deselect,
      selectAndFocusInspector,
      showPicker: () => setShowPicker(true),
      closeMenu: () => setContextMenu(null),
    });
  }, [contextMenu, items, selectionCount, selectedKeys, project, deselect, selectAndFocusInspector]);

  const contextMenuItems = useMemo(
    () => buildContextMenuItems(contextMenu, selectionCount),
    [contextMenu, selectionCount],
  );

  const formTitle = definition?.title;
  const formUrl = definition?.url;
  const formVersion = definition?.version;
  const formPresentation = definition?.formPresentation || {};
  const defaultCurrency = formPresentation.defaultCurrency;

  return (
    <WorkspacePage
      maxWidth="max-w-full"
      onClick={(e: React.MouseEvent) => {
        if (e.target === e.currentTarget) deselect();
      }}
      onContextMenu={handleContextMenu}
    >
      {/* Form metadata header — full width */}
      {(formTitle || formUrl) && (
        <div className="pt-4 pb-3 px-7 border-b border-border bg-surface shrink-0">
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

      {/* Group tabs — full width, no wrapping */}
      {hasPaged && (
        <div className="px-7 border-b border-border bg-surface">
          <GroupTabs activeGroupKey={activeGroupKey} onGroupChange={setActiveGroupKey} />
        </div>
      )}

      {/* Items list — guttered with max-width */}
      <WorkspacePageSection className="relative flex flex-col gap-1 pt-3 pb-20 max-w-[660px] mx-auto w-full">
        <AddItemPalette
          open={showPicker}
          onClose={() => setShowPicker(false)}
          onAdd={handleAddItem}
        />
        <DragDropProvider
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          sensors={() => [
            PointerSensor.configure({
              activationConstraints: [
                new PointerActivationConstraints.Distance({ value: 5 }),
              ],
            }),
            KeyboardSensor,
          ]}
        >
          {renderTreeNodes(displayTreeNodes, {
            defLookup,
            bindKeyMap,
            allBinds,
            primaryKey,
            selectedKeys,
            handleItemClick,
            registerTarget: registerCanvasTarget,
            flatIndexMap,
          }, 0, '')}
          {overTarget && (
            <DropIndicator targetPath={overTarget.path} position={overTarget.position} />
          )}
          <DragOverlay>
            {activeItem ? (
              <DragOverlayContent
                label={(activeItem.node.text as string) || (activeItem.defPath && defLookup.get(activeItem.defPath)?.item.label) || activeItem.id}
                itemType={activeItem.category}
                extraCount={selectionCount > 1 ? selectionCount - 1 : undefined}
              />
            ) : null}
          </DragOverlay>
        </DragDropProvider>
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
