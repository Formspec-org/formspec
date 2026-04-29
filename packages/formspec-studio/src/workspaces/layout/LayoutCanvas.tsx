/** @filedesc Main Layout workspace canvas — renders the component tree with page sections, layout containers, and field/display blocks. */
import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { useDefinition } from '../../state/useDefinition';
import { useComponent } from '../../state/useComponent';
import { useProject } from '../../state/useProject';
import { useSelection } from '../../state/useSelection';
import { useLayoutPageStructure } from './useLayoutPageStructure';
import {
  buildDefLookup,
  buildBindKeyMap,
  getStudioIntelligence,
  type CompNode,
  type LayoutDocument,
} from '@formspec-org/studio-core';
import { WorkspacePage, WorkspacePageSection } from '../../components/ui/WorkspacePage';
import { AddItemPalette } from '../../components/AddItemPalette';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import {
  collectLayoutFlatSelectionKeys,
  renderLayoutTree,
  type LayoutRowSelectEvent,
} from './render-tree';
import { UnassignedTray } from './UnassignedTray';
import { LayoutContextMenu } from './LayoutContextMenu';
import { LayoutDndProvider } from './dnd/LayoutDndProvider';
import { ThemeOverridePopover } from './ThemeOverridePopover';
import { useOptionalLayoutMode } from './LayoutModeContext';
import { useLayoutPreviewNav } from './LayoutPreviewNavContext';
import { setThemeOverride, clearThemeOverride } from '@formspec-org/studio-core';
import { useLayoutCanvasContextMenu } from './useLayoutCanvasContextMenu';
import { useLayoutNodeOperations } from './useLayoutNodeOperations';
import { useLayoutAddOperations } from './useLayoutAddOperations';
import { useLayoutPageMaterializer } from './useLayoutPageMaterializer';
import { LayoutCanvasHeader } from './LayoutCanvasHeader';
import { synthesizePagedLayoutTree } from './layout-tree-utils';

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
    primaryKeyForTab,
    primaryTypeForTab,
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
  const intelligence = useMemo(() => getStudioIntelligence({ definition }), [definition]);

  const defLookup = useMemo(() => buildDefLookup(items), [items]);
  const bindKeyMap = useMemo(() => buildBindKeyMap(defLookup), [defLookup]);

  const treeChildren = tree?.children ?? [];
  const pagedTreeChildren = useMemo(
    () => synthesizePagedLayoutTree(treeChildren, definition),
    [definition, treeChildren],
  );

  const hasPages = pagedTreeChildren.some((node) => node.component === 'Page');
  const isMultiPage = structure.mode !== 'single' && hasPages;
  const layoutPrimaryKey = primaryKeyForTab('layout');
  const layoutPrimaryType = primaryTypeForTab('layout');
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

  const {
    materializePagedLayout,
    syncActivePageAfterMaterialize,
    resolvePageNavToComponentId,
  } = useLayoutPageMaterializer(project, pageNavItems, activePageId, setActivePageId);

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
      <LayoutCanvasHeader
        mode={structure.mode}
        onSetMode={(mode) => project.setFlow(mode)}
        isMultiPage={isMultiPage}
        showAddPageButton={structure.mode !== 'single' && !isMultiPage}
        onAddPage={handleAddPage}
        pageNavItems={pageNavItems}
        activePageId={activePageId}
        onSelectPage={setActivePageId}
        onRenamePage={handleRenamePage}
        onReorderPage={handlePageNavReorder}
        onMovePageToIndex={handlePageNavMoveToIndex}
        onRequestRemovePage={(navId) => setPendingRemovePageNavId(navId)}
      />
      <LayoutDocumentStrip layouts={intelligence.layouts} />

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

function LayoutDocumentStrip({ layouts }: { layouts: LayoutDocument[] }) {
  const openDrift = layouts.reduce((count, layout) => count + layout.drift.filter((entry) => entry.status === 'open').length, 0);

  return (
    <section className="border-b border-border/50 bg-surface/68 px-4 py-3" aria-label="Layout documents">
      <div className="mx-auto flex w-full max-w-[980px] flex-wrap items-center gap-2">
        <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Layout documents</span>
        {layouts.map((layout) => {
          const drift = layout.drift.filter((entry) => entry.status === 'open').length;
          return (
            <span
              key={layout.id}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] ${
                drift > 0
                  ? 'border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-200'
                  : 'border-border bg-bg-default/70 text-ink'
              }`}
              title={`${layout.channel} · ${layout.publishStatus ?? 'draft'}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${drift > 0 ? 'bg-amber-500' : 'bg-accent'}`} />
              <span className="font-medium">{layout.name}</span>
              <span className="font-mono text-[10px] text-muted">{layout.placements.filter((entry) => !entry.hidden).length} placed</span>
              {drift > 0 && <span className="font-mono text-[10px]">drift {drift}</span>}
            </span>
          );
        })}
        <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
          {openDrift === 0 ? 'in sync' : `${openDrift} open drift`}
        </span>
      </div>
    </section>
  );
}
