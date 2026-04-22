/** @filedesc Main Layout workspace canvas — renders the component tree with page sections, layout containers, and field/display blocks. */
import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { useDefinition } from '../../state/useDefinition';
import { useComponent } from '../../state/useComponent';
import { useProject } from '../../state/useProject';
import { useSelection } from '../../state/useSelection';
import { useLayoutPageStructure } from './useLayoutPageStructure';
import {
  buildDefLookup,
  buildBindKeyMap,
  isLayoutId,
  resolveLayoutSelectionNodeRef,
  type CompNode,
} from '@formspec-org/studio-core';
import { WorkspacePage, WorkspacePageSection } from '../../components/ui/WorkspacePage';
import { AddItemPalette, type FieldTypeOption } from '../../components/AddItemPalette';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ModeSelector } from './ModeSelector';
import { LayoutStepNav } from './LayoutStepNav';
import {
  collectLayoutFlatSelectionKeys,
  renderLayoutTree,
  type LayoutRowSelectEvent,
} from './render-tree';
import { UnassignedTray } from './UnassignedTray';
import { LayoutContextMenu } from './LayoutContextMenu';
import { LayoutDndProvider } from './LayoutDndProvider';
import { ThemeOverridePopover } from './ThemeOverridePopover';
import { useOptionalLayoutMode } from './LayoutModeContext';
import { useLayoutPreviewNav } from './LayoutPreviewNavContext';
import { setThemeOverride, clearThemeOverride } from '@formspec-org/studio-core';
import { isPlainObject } from '../shared/runtime-guards';
import { useLayoutCanvasContextMenu } from './useLayoutCanvasContextMenu';
import { useLayoutNodeOperations } from './useLayoutNodeOperations';
import { useLayoutAddOperations } from './useLayoutAddOperations';

function synthesizePagedLayoutTree(nodes: CompNode[], definition: ReturnType<typeof useDefinition>): CompNode[] {
  const formPresentation = isPlainObject(definition?.formPresentation) ? definition.formPresentation : undefined;
  const pageMode = formPresentation?.pageMode;
  if (pageMode !== 'wizard' && pageMode !== 'tabs') return nodes;

  const items = Array.isArray(definition?.items) ? definition.items : [];
  const topLevelGroupLabels = new Map<string, string>();
  for (const item of items) {
    if (!isPlainObject(item) || item.type !== 'group' || typeof item.key !== 'string') continue;
    topLevelGroupLabels.set(item.key, typeof item.label === 'string' && item.label.trim() ? item.label : item.key);
  }

  return nodes.map((node) => {
    if (node.component === 'Page') return node;
    if (typeof node.bind !== 'string') return node;
    const title = topLevelGroupLabels.get(node.bind);
    if (!title) return node;
    return {
      component: 'Page',
      nodeId: `layout-page-${node.bind}`,
      title,
      _layout: true,
      syntheticPage: true,
      groupPath: node.bind,
      children: [node],
    };
  });
}

export function LayoutCanvas() {
  const definition = useDefinition();
  const component = useComponent();
  const project = useProject();
  const {
    deselect,
    select,
    toggleSelect,
    rangeSelect,
    isSelectedForTab,
    selectedKeysForTab,
    selectedKeyForTab,
    selectedTypeForTab,
  } = useSelection();
  const structure = useLayoutPageStructure();

  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [pendingRemovePageNavId, setPendingRemovePageNavId] = useState<string | null>(null);
  const layoutModeCtx = useOptionalLayoutMode();
  const { setPreviewPageIndex, setHighlightFieldPath } = useLayoutPreviewNav();
  const themeSelectedKey = layoutModeCtx?.themeSelectedKey ?? null;
  const setThemeSelectedKey = layoutModeCtx?.setThemeSelectedKey ?? (() => {});
  const themePopoverPosition = layoutModeCtx?.themePopoverPosition ?? { x: 0, y: 0 };

  const items = definition?.items ?? [];
  const tree = component?.tree as CompNode | undefined;

  const defLookup = useMemo(() => buildDefLookup(items), [items]);
  const bindKeyMap = useMemo(() => buildBindKeyMap(defLookup), [defLookup]);

  const treeChildren = tree?.children ?? [];
  const pagedTreeChildren = useMemo(
    () => synthesizePagedLayoutTree(treeChildren, definition),
    [definition, treeChildren],
  );

  const hasPages = pagedTreeChildren.some((node) => node.component === 'Page');
  const isMultiPage = structure.mode !== 'single' && hasPages;
  const layoutPrimaryKey = selectedKeyForTab('layout');
  const layoutPrimaryType = selectedTypeForTab('layout');
  const layoutSelectedKeys = selectedKeysForTab('layout');

  const pageNavItems = useMemo(
    () => pagedTreeChildren
      .filter((node) => node.component === 'Page' && typeof node.nodeId === 'string')
      .map((node) => {
        const firstBoundChild = node.children?.find((child) => typeof child.bind === 'string');
        return {
          id: node.nodeId!,
          title: (typeof node.title === 'string' && node.title.trim()) ? node.title : node.nodeId!,
          groupPath: typeof node.groupPath === 'string' ? node.groupPath : firstBoundChild?.bind,
          pageId: node.syntheticPage === true ? undefined : node.nodeId!,
        };
      }),
    [pagedTreeChildren],
  );

  // Track whether synthetic pages have already been materialized into real
  // component-doc pages.  After the first materialization the synthetic list
  // is empty, so subsequent calls are no-ops — the ref lets us skip the
  // filter + loop entirely on every subsequent user interaction.
  const materialized = useRef<boolean>(false);

  // Reset the flag when the page nav items change (e.g. new synthetic pages
  // appear after a definition change).
  useEffect(() => { materialized.current = false; }, [pageNavItems]);

  const materializePagedLayout = () => {
    const pageIdMap = new Map<string, string>();
    if (materialized.current) return pageIdMap;

    const syntheticPages = pageNavItems.filter((page) => !page.pageId && page.groupPath);
    if (syntheticPages.length === 0) {
      materialized.current = true;
      return pageIdMap;
    }

    for (const page of syntheticPages) {
      const result = project.addPage(page.title, undefined, page.id);
      const createdPageId = result.createdId!;
      project.placeOnPage(page.groupPath!, createdPageId);
      pageIdMap.set(page.id, createdPageId);
    }

    materialized.current = true;
    return pageIdMap;
  };

  useEffect(() => {
    if (pageNavItems.length === 0) {
      setActivePageId(null);
      return;
    }

    if (!activePageId || !pageNavItems.some((page) => page.id === activePageId)) {
      setActivePageId(pageNavItems[0]?.id ?? null);
    }
  }, [activePageId, pageNavItems]);

  useEffect(() => {
    return () => {
      setPreviewPageIndex(null);
      setHighlightFieldPath(null);
    };
  }, [setPreviewPageIndex, setHighlightFieldPath]);

  useEffect(() => {
    if (!isMultiPage || !activePageId) {
      setPreviewPageIndex(null);
      return;
    }
    const idx = pageNavItems.findIndex((p) => p.id === activePageId);
    setPreviewPageIndex(idx >= 0 ? idx : 0);
  }, [activePageId, isMultiPage, pageNavItems, setPreviewPageIndex]);

  useEffect(() => {
    const key = layoutPrimaryKey;
    const type = layoutPrimaryType;
    if (!key || key.startsWith('__node:')) {
      setHighlightFieldPath(null);
      return;
    }
    if (type === 'field' || type === 'display') {
      setHighlightFieldPath(key);
      return;
    }
    setHighlightFieldPath(null);
  }, [layoutPrimaryKey, layoutPrimaryType, setHighlightFieldPath]);

  const visibleTreeChildren = useMemo(() => {
    if (!isMultiPage || !activePageId) {
      return pagedTreeChildren;
    }
    return pagedTreeChildren.filter(
      (node) => node._layout && node.component === 'Page' && node.nodeId === activePageId,
    );
  }, [activePageId, isMultiPage, pagedTreeChildren]);

  const selectLayoutNode = useCallback(
    (key: string, type: 'field' | 'group' | 'display' | 'layout') => {
      select(key, type, { tab: 'layout' });
    },
    [select],
  );

  const layoutFlatOrder = useMemo(
    () =>
      collectLayoutFlatSelectionKeys(
        visibleTreeChildren,
        defLookup,
        bindKeyMap,
        activePageId,
        '',
        !isMultiPage,
      ),
    [visibleTreeChildren, defLookup, bindKeyMap, activePageId, isMultiPage],
  );

  const handleLayoutRowSelect = useCallback(
    (ev: LayoutRowSelectEvent | null, key: string, type: 'field' | 'group' | 'display' | 'layout') => {
      const opts = { tab: 'layout' as const };
      if (ev && 'metaKey' in ev && (ev.metaKey || ev.ctrlKey)) {
        toggleSelect(key, type, opts);
      } else if (ev && 'shiftKey' in ev && ev.shiftKey) {
        rangeSelect(key, type, layoutFlatOrder, opts);
      } else if (isSelectedForTab('layout', key)) {
        deselect();
      } else {
        select(key, type, opts);
      }
    },
    [deselect, isSelectedForTab, layoutFlatOrder, rangeSelect, select, toggleSelect],
  );

  const isLayoutRowSelected = useCallback(
    (key: string) => isSelectedForTab('layout', key),
    [isSelectedForTab],
  );

  const handleRenameDefinitionItem = useCallback(
    (defPath: string, nextKey: string, nextLabel: string | null, kind: 'field' | 'display') => {
      const currentKey = defPath.split('.').pop() ?? defPath;
      let nextPath = defPath;
      if (nextKey !== currentKey) {
        project.renameItem(defPath, nextKey);
        const parentPath = defPath.split('.').slice(0, -1).join('.');
        nextPath = parentPath ? `${parentPath}.${nextKey}` : nextKey;
      }
      project.updateItem(nextPath, {
        label: nextLabel === null || nextLabel === '' ? null : nextLabel,
      });
      selectLayoutNode(nextPath, kind);
    },
    [project, selectLayoutNode],
  );

  const nodeOps = useLayoutNodeOperations(project, deselect);
  const { handleSetNodeProp, handleUnwrapNode, handleRemoveNode, handleStyleAdd, handleStyleRemove, handleResizeColSpan, handleResizeRowSpan } = nodeOps;

  const addOps = useLayoutAddOperations(
    project,
    activePageId,
    isMultiPage,
    pageNavItems,
    materializePagedLayout,
    setActivePageId,
    selectLayoutNode,
  );
  const { handleAddPage, handleRenamePage, handleAddItem } = addOps;

  const resolvePageNavToComponentId = useCallback(
    (navId: string, pageIdMap: Map<string, string>) => {
      const entry = pageNavItems.find((p) => p.id === navId);
      if (!entry) return null;
      return entry.pageId ?? pageIdMap.get(entry.id) ?? entry.id;
    },
    [pageNavItems],
  );

  const syncActivePageAfterMaterialize = useCallback(
    (pageIdMap: Map<string, string>) => {
      if (!activePageId || pageIdMap.size === 0) return;
      const mapped = pageIdMap.get(activePageId);
      if (mapped && mapped !== activePageId) {
        setActivePageId(mapped);
      }
    },
    [activePageId],
  );

  const handlePageNavReorder = useCallback(
    (navId: string, direction: 'up' | 'down') => {
      const pageIdMap = materializePagedLayout();
      syncActivePageAfterMaterialize(pageIdMap);
      const compId = resolvePageNavToComponentId(navId, pageIdMap);
      if (!compId) return;
      project.reorderPage(compId, direction);
    },
    [materializePagedLayout, project, resolvePageNavToComponentId, syncActivePageAfterMaterialize],
  );

  const handlePageNavMoveToIndex = useCallback(
    (navId: string, targetIndex: number) => {
      const pageIdMap = materializePagedLayout();
      syncActivePageAfterMaterialize(pageIdMap);
      const compId = resolvePageNavToComponentId(navId, pageIdMap);
      if (!compId) return;
      project.movePageToIndex(compId, targetIndex);
    },
    [materializePagedLayout, project, resolvePageNavToComponentId, syncActivePageAfterMaterialize],
  );

  const handleRequestRemovePage = useCallback((navId: string) => {
    setPendingRemovePageNavId(navId);
  }, []);

  const handleConfirmRemovePage = useCallback(() => {
    if (!pendingRemovePageNavId || pageNavItems.length <= 1) {
      setPendingRemovePageNavId(null);
      return;
    }
    const navId = pendingRemovePageNavId;
    const idx = pageNavItems.findIndex((p) => p.id === navId);
    const neighbor = idx > 0 ? pageNavItems[idx - 1] : pageNavItems[idx + 1];
    const pageIdMap = materializePagedLayout();
    syncActivePageAfterMaterialize(pageIdMap);
    const compId = resolvePageNavToComponentId(navId, pageIdMap);
    setPendingRemovePageNavId(null);
    if (!compId) return;
    const wasActive = activePageId === navId;
    project.removePage(compId);
    deselect();
    if (wasActive && neighbor) {
      setActivePageId(neighbor.id);
    }
  }, [
    activePageId,
    deselect,
    pageNavItems,
    pendingRemovePageNavId,
    project,
    resolvePageNavToComponentId,
    syncActivePageAfterMaterialize,
    materializePagedLayout,
  ]);

  const {
    contextMenu,
    menuItems,
    handleContextMenu,
    handleAction,
    closeMenu,
  } = useLayoutCanvasContextMenu(
    project,
    deselect,
    activePageId,
    materializePagedLayout,
    setActivePageId,
    selectLayoutNode,
    layoutSelectedKeys,
    layoutFlatOrder,
    isMultiPage,
    pageNavItems,
  );

  return (
    <LayoutDndProvider activePageId={activePageId}>
    <div className="flex min-h-full w-full flex-col">
      <div className="sticky top-0 z-20 w-full shrink-0 border-b border-border/40 bg-bg-default/85 py-4 backdrop-blur-md">
        <div className="mx-auto w-full max-w-[980px] px-7">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <ModeSelector mode={structure.mode} onSetMode={(mode) => project.setFlow(mode)} />
              </div>
              {structure.mode !== 'single' && !isMultiPage ? (
                <button
                  type="button"
                  data-testid="layout-add-page"
                  aria-label="Add page to layout"
                  className="min-h-11 rounded-full border border-transparent px-3 py-2 text-[12px] font-medium text-muted transition-colors hover:border-border/60 hover:bg-bg-default/50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
                  onClick={handleAddPage}
                >
                  + Page
                </button>
              ) : null}
            </div>
            {isMultiPage && (
              <LayoutStepNav
                pages={pageNavItems}
                activePageId={activePageId ?? pageNavItems[0]?.id ?? null}
                onSelectPage={setActivePageId}
                onRenamePage={handleRenamePage}
                onReorderPage={handlePageNavReorder}
                onMovePageToIndex={handlePageNavMoveToIndex}
                onRequestRemovePage={handleRequestRemovePage}
                trailing={
                  <button
                    type="button"
                    data-testid="layout-add-page"
                    aria-label="Add page to layout"
                    className="min-h-11 rounded-full border border-transparent px-3 py-2 text-[12px] font-medium text-muted transition-colors hover:border-border/60 hover:bg-bg-default/50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
                    onClick={handleAddPage}
                  >
                    + Page
                  </button>
                }
              />
            )}
          </div>
        </div>
      </div>

    <div className="min-h-0 flex-1 overflow-y-auto relative w-full">
    <WorkspacePage maxWidth="max-w-[980px]" className="relative">
      <>
        <WorkspacePageSection className="space-y-3 py-4">
            <div
              onContextMenu={handleContextMenu}
              onKeyDown={(e) => {
                if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
                  const target = (e.target as HTMLElement).closest<HTMLElement>('[data-layout-node]');
                  if (!target) return;
                  const rect = target.getBoundingClientRect();
                  handleContextMenu({
                    preventDefault: () => {},
                    clientX: rect.left + rect.width / 2,
                    clientY: rect.top + rect.height / 2,
                    target: e.target,
                  } as React.MouseEvent);
                  e.preventDefault();
                }
              }}
            >
              {renderLayoutTree(
                visibleTreeChildren,
                {
                  defLookup,
                  bindKeyMap,
                  isSelected: isLayoutRowSelected,
                  layoutPrimaryKey,
                  onSelect: handleLayoutRowSelect,
                  activePageId,
                  onSelectPage: setActivePageId,
                  onSetNodeProp: handleSetNodeProp,
                  onUnwrapNode: handleUnwrapNode,
                  onRemoveNode: handleRemoveNode,
                  onSetStyle: handleStyleAdd,
                  onStyleRemove: handleStyleRemove,
                  onResizeColSpan: handleResizeColSpan,
                  onResizeRowSpan: handleResizeRowSpan,
                  onCommitDisplayLabel: (defPath, text) => {
                    project.updateItem(defPath, { label: text });
                  },
                  onRenameDefinitionItem: handleRenameDefinitionItem,
                },
                '',
                undefined,
                0,
                !isMultiPage,
                'root',
              )}

              {visibleTreeChildren.length === 0 && (
                <p className="text-center text-[13px] text-muted py-8">
                  No layout content yet. Use add below or place existing definition items from the tray.
                </p>
              )}
            </div>
          <button
            type="button"
            data-testid="layout-add-item"
            aria-label="Add item to layout"
            aria-expanded={paletteOpen}
            className="mt-3 flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-dashed border-accent/25 bg-bg-default/75 py-3 font-mono text-[11.5px] uppercase tracking-[0.18em] text-accent/65 transition-colors hover:border-accent/50 hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
            onClick={() => {
              setPaletteOpen((open) => !open);
            }}
          >
            Add to layout
          </button>
        </WorkspacePageSection>

        <WorkspacePageSection className="py-4">
            <UnassignedTray
              items={items}
              treeChildren={treeChildren}
              activePageId={activePageId}
              onPlaceItem={(item) => {
                if (!activePageId) return;
                project.placeOnPage(item.key, activePageId);
                selectLayoutNode(item.key, item.itemType);
              }}
            />
        </WorkspacePageSection>
      </>

      <ThemeOverridePopover
        open={!!themeSelectedKey}
        itemKey={themeSelectedKey ?? ''}
        position={themePopoverPosition}
        project={project}
        onClose={() => setThemeSelectedKey(null)}
        onSetOverride={(key, prop, value) => setThemeOverride(project, key, prop, value)}
        onClearOverride={(key, prop) => clearThemeOverride(project, key, prop)}
      />

      {contextMenu && menuItems.length > 0 && (
        <>
          <div
            className="fixed inset-0 z-50"
            onClick={closeMenu}
            onContextMenu={(e) => {
              e.preventDefault();
              closeMenu();
            }}
          />
          <div
            className="fixed z-[51]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <LayoutContextMenu
              items={menuItems}
              onAction={handleAction}
              onClose={closeMenu}
            />
          </div>
        </>
      )}

      <AddItemPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onAdd={handleAddItem}
        title="Add To Layout"
        scope="layout"
      />

      <ConfirmDialog
        open={pendingRemovePageNavId !== null}
        title={`Remove page “${pageNavItems.find((p) => p.id === pendingRemovePageNavId)?.title ?? ''}”?`}
        description="The page surface is removed. Definition items on this page stay in the project and appear in the unassigned tray until you place them again."
        confirmLabel="Remove page"
        cancelLabel="Cancel"
        onCancel={() => setPendingRemovePageNavId(null)}
        onConfirm={handleConfirmRemovePage}
      />
    </WorkspacePage>
    </div>
    </div>
    </LayoutDndProvider>
  );
}
