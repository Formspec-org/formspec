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
  buildLayoutContextMenuItems,
  executeLayoutAction,
  isLayoutId,
  nodeIdFromLayoutId,
  resolveLayoutSelectionNodeRef,
  type CompNode,
  type ItemChanges,
  type LayoutContextMenuState,
} from '@formspec-org/studio-core';
import { WorkspacePage, WorkspacePageSection } from '../../components/ui/WorkspacePage';
import { AddItemPalette, type FieldTypeOption } from '../../components/AddItemPalette';
import { ModeSelector } from './ModeSelector';
import { LayoutStepNav } from './LayoutStepNav';
import { renderLayoutTree } from './render-tree';
import { UnassignedTray } from './UnassignedTray';
import { LayoutContextMenu } from './LayoutContextMenu';
import { LayoutDndProvider } from './LayoutDndProvider';
import { clampContextMenuPosition } from '../../components/ui/context-menu-utils';
import { LayoutThemeToggle } from './LayoutThemeToggle';
import { ThemeAuthoringOverlay } from './ThemeAuthoringOverlay';
import { ThemeOverridePopover } from './ThemeOverridePopover';
import { DirtyGuardConfirm } from './DirtyGuardConfirm';
import { FormspecPreviewHost } from '../preview/FormspecPreviewHost';
import { useOptionalLayoutMode } from './LayoutModeContext';
import { type LayoutMode } from './LayoutThemeToggle';
import { setThemeOverride, clearThemeOverride, setColumnSpan, setRowSpan, setStyleProperty, removeStyleProperty } from '@formspec-org/studio-core';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Layout mode + theme selection orchestration for the canvas header and theme overlay.
 */
function useLayoutCanvasMode(
  layoutModeCtx: ReturnType<typeof useOptionalLayoutMode>,
  selectedLayoutKey: string | null,
) {
  const [localLayoutMode, setLocalLayoutMode] = useState<LayoutMode>('layout');
  const [localThemeSelectedKey, setLocalThemeSelectedKey] = useState<string | null>(null);
  const [localThemePopoverPosition, setLocalThemePopoverPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const layoutMode = layoutModeCtx?.layoutMode ?? localLayoutMode;
  const pendingLayoutMode = layoutModeCtx?.pendingLayoutMode ?? null;
  const themeSelectedKey = layoutModeCtx?.themeSelectedKey ?? localThemeSelectedKey;
  const setThemeSelectedKey = layoutModeCtx?.setThemeSelectedKey ?? setLocalThemeSelectedKey;
  const themePopoverPosition = layoutModeCtx?.themePopoverPosition ?? localThemePopoverPosition;
  const setThemePopoverPosition = layoutModeCtx?.setThemePopoverPosition ?? setLocalThemePopoverPosition;

  const previousLayoutModeRef = useRef<LayoutMode>(layoutMode);
  useEffect(() => {
    const wasThemeMode = previousLayoutModeRef.current === 'theme';
    if (!wasThemeMode && layoutMode === 'theme') {
      const canvasKey = selectedLayoutKey;
      setThemeSelectedKey(canvasKey);

      if (canvasKey) {
        const isNode = isLayoutId(canvasKey);
        const selector = isNode
          ? `[data-layout-node-id="${CSS.escape(nodeIdFromLayoutId(canvasKey))}"]`
          : `[data-layout-bind="${CSS.escape(canvasKey)}"]`;
        const element = document.querySelector(selector);
        if (element) {
          const rect = element.getBoundingClientRect();
          setThemePopoverPosition({
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height,
          });
          element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    }
    previousLayoutModeRef.current = layoutMode;
  }, [layoutMode, selectedLayoutKey, setThemePopoverPosition, setThemeSelectedKey]);

  const handleModeChange = (mode: LayoutMode) => {
    if (layoutModeCtx?.requestLayoutModeChange) {
      layoutModeCtx.requestLayoutModeChange(mode);
      return;
    }
    setLocalLayoutMode(mode);
  };

  const handleThemeFieldSelect = (itemKey: string, position: { x: number; y: number }) => {
    setThemeSelectedKey(itemKey);
    setThemePopoverPosition({ x: position.x + 12, y: position.y + 12 });
  };

  return {
    layoutMode,
    pendingLayoutMode,
    themeSelectedKey,
    setThemeSelectedKey,
    themePopoverPosition,
    setThemePopoverPosition,
    handleModeChange,
    handleThemeFieldSelect,
  };
}

/**
 * Context menu orchestration for the Layout canvas tree and page structure.
 */
function useLayoutCanvasContextMenu(
  project: ReturnType<typeof useProject>,
  deselect: () => void,
  activePageId: string | null,
  materializePagedLayout: () => Map<string, string>,
  setActivePageId: (id: string) => void,
  handleSelectNode: (key: string, type: 'field' | 'group' | 'display' | 'layout') => void,
) {
  const [contextMenu, setContextMenu] = useState<LayoutContextMenuState | null>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const target = (e.target as HTMLElement).closest<HTMLElement>(
      '[data-layout-node]',
    );
    if (!target) {
      setContextMenu({ x: e.clientX, y: e.clientY, kind: 'canvas' });
      return;
    }

    const nodeType = target.dataset.layoutNodeType as LayoutContextMenuState['nodeType'];
    const treeBind = target.dataset.layoutTreeBind;
    const layoutBind = target.dataset.layoutBind;
    const nodeId = target.dataset.layoutNodeId;
    const clamped = clampContextMenuPosition(e.clientX, e.clientY);

    // NodeRef for tree ops (wrap/move) must match TreeNode.bind / nodeId — not defPath (data-layout-bind).
    const nodeRef =
      nodeId != null && nodeId !== ''
        ? { nodeId }
        : treeBind != null && treeBind !== ''
          ? { bind: treeBind }
          : layoutBind != null && layoutBind !== ''
            ? { bind: layoutBind }
            : undefined;

    setContextMenu({
      ...clamped,
      kind: 'node',
      nodeType,
      nodeRef,
    });
  };

  const closeMenu = () => setContextMenu(null);

  const handleAction = (action: string) => {
    const pageIdMap = materializePagedLayout();
    if (activePageId) {
      const resolvedActivePageId = pageIdMap.get(activePageId);
      if (resolvedActivePageId && resolvedActivePageId !== activePageId) {
        setActivePageId(resolvedActivePageId);
      }
    }
    executeLayoutAction({
      action,
      menu: contextMenu,
      project,
      deselect,
      select: handleSelectNode,
      closeMenu,
    });
  };

  const menuItems = useMemo(
    () => buildLayoutContextMenuItems(contextMenu),
    [contextMenu],
  );

  return {
    contextMenu,
    menuItems,
    handleContextMenu,
    handleAction,
    closeMenu,
  };
}

/**
 * Custom hook grouping node mutation operations.
 */
function useLayoutNodeOperations(
  project: ReturnType<typeof useProject>,
  deselect: () => void,
) {
  const tree = project.component.tree as CompNode | undefined;
  const nodeRef = (selectionKey: string) => resolveLayoutSelectionNodeRef(tree, selectionKey);

  const handleSetNodeProp = (selectionKey: string, key: string, value: unknown) => {
    project.setLayoutNodeProp(selectionKey, key, value);
  };

  const handleUnwrapNode = (selectionKey: string) => {
    const nodeId = nodeIdFromLayoutId(selectionKey);
    project.unwrapLayoutNode(nodeId);
    deselect();
  };

  const handleRemoveNode = (selectionKey: string) => {
    const nodeId = nodeIdFromLayoutId(selectionKey);
    project.deleteLayoutNode(nodeId);
    deselect();
  };

  const handleStyleAdd = (selectionKey: string, key: string, value: string) => {
    setStyleProperty(project, nodeRef(selectionKey), key, value);
  };

  const handleStyleRemove = (selectionKey: string, key: string) => {
    removeStyleProperty(project, nodeRef(selectionKey), key);
  };

  const handleResizeColSpan = (selectionKey: string, newSpan: number) => {
    setColumnSpan(project, nodeRef(selectionKey), newSpan);
  };

  const handleResizeRowSpan = (selectionKey: string, newSpan: number) => {
    setRowSpan(project, nodeRef(selectionKey), newSpan);
  };

  return {
    handleSetNodeProp,
    handleUnwrapNode,
    handleRemoveNode,
    handleStyleAdd,
    handleStyleRemove,
    handleResizeColSpan,
    handleResizeRowSpan,
  };
}

/**
 * Custom hook grouping add/page operations.
 */
function useLayoutAddOperations(
  project: ReturnType<typeof useProject>,
  activePageId: string | null,
  isMultiPage: boolean,
  pageNavItems: Array<{ id: string; title: string; groupPath?: string; pageId?: string }>,
  materializePagedLayout: () => Map<string, string>,
  setActivePageId: (id: string) => void,
  handleSelectNode: (key: string, type: 'field' | 'group' | 'display' | 'layout') => void,
) {
  const handleAddContainer = (componentName: typeof CONTAINER_PRESETS[number]) => {
    const pageIdMap = materializePagedLayout();
    const resolvedActivePageId = activePageId ? (pageIdMap.get(activePageId) ?? activePageId) : null;
    const parentNodeId = isMultiPage ? (resolvedActivePageId ?? 'root') : 'root';
    const result = project.addLayoutNode(parentNodeId, componentName);
    if (result.createdId) {
      if (resolvedActivePageId && resolvedActivePageId !== activePageId) {
        setActivePageId(resolvedActivePageId);
      }
      handleSelectNode(`__node:${result.createdId}`, 'layout');
    }
  };

  const handleAddPage = () => {
    materializePagedLayout();
    const result = project.addPage(`Page ${pageNavItems.length + 1}`);
    if (result.createdId) {
      setActivePageId(result.createdId);
    }
  };

  const handleRenamePage = (pageId: string, title: string, groupPath?: string, componentPageId?: string) => {
    if (componentPageId) {
      project.renamePage(componentPageId, title);
    }
    if (groupPath) {
      project.updateItem(groupPath, { label: title });
    }
  };

  const handleAddItem = (option: FieldTypeOption) => {
    const pageIdMap = materializePagedLayout();
    const resolvedActivePageId = activePageId ? (pageIdMap.get(activePageId) ?? activePageId) : null;
    const pageId = isMultiPage ? (resolvedActivePageId ?? undefined) : undefined;
    const result = project.addItemToLayout({
      itemType: option.itemType,
      label: option.label,
      dataType: option.dataType,
      component: option.component,
      repeatable: option.extra?.repeatable === true,
      presentation: (option.extra?.presentation as Record<string, unknown> | undefined) ?? undefined,
    }, pageId);

    if (!result.createdId) return;

    if (resolvedActivePageId && resolvedActivePageId !== activePageId) {
      setActivePageId(resolvedActivePageId);
    }

    const selectionKey = option.itemType === 'layout' ? `__node:${result.createdId}` : result.createdId;
    const selectionType = option.itemType === 'layout'
      ? 'layout'
      : option.itemType === 'group'
        ? 'group'
        : option.itemType === 'display'
          ? 'display'
          : 'field';

    handleSelectNode(selectionKey, selectionType);
  };

  return {
    handleAddContainer,
    handleAddPage,
    handleRenamePage,
    handleAddItem,
  };
}

function synthesizePagedLayoutTree(nodes: CompNode[], definition: ReturnType<typeof useDefinition>): CompNode[] {
  const formPresentation = isRecord(definition?.formPresentation) ? definition.formPresentation : undefined;
  const pageMode = formPresentation?.pageMode;
  if (pageMode !== 'wizard' && pageMode !== 'tabs') return nodes;

  const items = Array.isArray(definition?.items) ? definition.items : [];
  const topLevelGroupLabels = new Map<string, string>();
  for (const item of items) {
    if (!isRecord(item) || item.type !== 'group' || typeof item.key !== 'string') continue;
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

// Ordered list of containers shown in the toolbar. Keep in sync with
// LAYOUT_CONTAINER_COMPONENTS in studio-core — ordering matters for display.
const CONTAINER_PRESETS = ['Card', 'Stack', 'Grid', 'Panel', 'Accordion', 'Collapsible', 'ConditionalGroup'] as const;

export function LayoutCanvas() {
  const definition = useDefinition();
  const component = useComponent();
  const project = useProject();
  const { deselect, select, selectedKeyForTab } = useSelection();
  const structure = useLayoutPageStructure();

  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const layoutModeCtx = useOptionalLayoutMode();
  const selectedLayoutKey = selectedKeyForTab('layout');

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
  const selectedKey = selectedKeyForTab('layout');

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
  const materialized = useRef(false);

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
      const result = project.addPage(page.title, undefined, page.id, { standalone: true });
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

  const visibleTreeChildren = useMemo(() => {
    if (!isMultiPage || !activePageId) {
      return pagedTreeChildren;
    }
    return pagedTreeChildren.filter(
      (node) => node._layout && node.component === 'Page' && node.nodeId === activePageId,
    );
  }, [activePageId, isMultiPage, pagedTreeChildren]);

  const handleSelectNode = (key: string, type: 'field' | 'group' | 'display' | 'layout') => {
    select(key, type, { tab: 'layout' });
  };

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
      select(nextPath, kind, { tab: 'layout' });
    },
    [project, select],
  );

  const handleUpdateDefinitionItem = useCallback(
    (defPath: string, changes: Record<string, unknown>) => {
      project.updateItem(defPath, changes as ItemChanges);
    },
    [project],
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
    handleSelectNode,
  );
  const { handleAddContainer, handleAddPage, handleRenamePage, handleAddItem } = addOps;

  const {
    layoutMode,
    pendingLayoutMode,
    themeSelectedKey,
    setThemeSelectedKey,
    themePopoverPosition,
    setThemePopoverPosition,
    handleModeChange,
    handleThemeFieldSelect,
  } = useLayoutCanvasMode(layoutModeCtx, selectedLayoutKey);

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
    handleSelectNode,
  );

  return (
    <LayoutDndProvider activePageId={activePageId}>
    <WorkspacePage maxWidth="max-w-[980px]" className="overflow-y-auto relative">
      <WorkspacePageSection
        padding="px-7"
        className="sticky top-0 z-20 border-b border-border/40 bg-bg-default/85 py-4 backdrop-blur-md"
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <ModeSelector mode={structure.mode} onSetMode={(mode) => project.setFlow(mode)} />
              <div className="w-px h-5 bg-border/40" />
              <LayoutThemeToggle activeMode={layoutMode} onModeChange={handleModeChange} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="layout-add-item"
                aria-label="Add item to layout"
                className="rounded-full border border-border/80 bg-surface px-3 py-1.5 text-[12px] font-semibold text-ink transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
                onClick={() => setPaletteOpen(true)}
              >
                + Item
              </button>
              {structure.mode !== 'single' && (
                <button
                  type="button"
                  data-testid="layout-add-page"
                  aria-label="Add page to layout"
                  className="rounded-full border border-border/80 bg-surface px-3 py-1.5 text-[12px] font-semibold text-ink transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
                  onClick={handleAddPage}
                >
                  + Page
                </button>
              )}
              <div className="relative group">
                <button
                  type="button"
                  data-testid="layout-add-container"
                  aria-label="Add layout container"
                  className="rounded-full border border-border/80 bg-surface px-3 py-1.5 text-[12px] font-semibold text-ink transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
                >
                  + Add Container
                </button>
                <div className="absolute right-0 top-full mt-1 hidden group-hover:flex group-focus-within:flex flex-col bg-surface border border-border/60 rounded shadow-lg py-1 min-w-[140px] z-50">
                  {CONTAINER_PRESETS.map((componentName) => (
                    <button
                      key={componentName}
                      type="button"
                      data-testid={`layout-add-${componentName.toLowerCase()}`}
                      className="px-3 py-1.5 text-[12px] text-ink hover:bg-subtle hover:text-accent transition-colors text-left"
                      onClick={() => {
                        handleAddContainer(componentName);
                      }}
                    >
                      {componentName}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {isMultiPage && (
            <LayoutStepNav
              pages={pageNavItems}
              activePageId={activePageId ?? pageNavItems[0]?.id ?? null}
              onSelectPage={setActivePageId}
              onRenamePage={handleRenamePage}
            />
          )}
        </div>
      </WorkspacePageSection>

      {layoutMode === 'theme' ? (
        <WorkspacePageSection className="py-0 flex-1 min-h-0 relative">
          <div className="relative w-full h-full min-h-[400px]">
            <FormspecPreviewHost width="100%" />
            <ThemeAuthoringOverlay
              onFieldSelect={handleThemeFieldSelect}
              selectedItemKey={themeSelectedKey}
            />
          </div>
          <ThemeOverridePopover
            open={!!themeSelectedKey}
            itemKey={themeSelectedKey ?? ''}
            position={themePopoverPosition}
            project={project}
            onClose={() => setThemeSelectedKey(null)}
            onSetOverride={(key, prop, value) => setThemeOverride(project, key, prop, value)}
            onClearOverride={(key, prop) => clearThemeOverride(project, key, prop)}
          />
        </WorkspacePageSection>
      ) : (
        <>
          <WorkspacePageSection className="space-y-3 py-4">
            <div onContextMenu={handleContextMenu}>
              {renderLayoutTree(visibleTreeChildren, {
                defLookup,
                bindKeyMap,
                selectedKey,
                onSelect: handleSelectNode,
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
                onUpdateDefinitionItem: handleUpdateDefinitionItem,
              }, '')}

              {visibleTreeChildren.length === 0 && (
                <p className="text-center text-[13px] text-muted py-8">
                  No layout content yet. Add items here or place existing definition items from the tray.
                </p>
              )}
            </div>
          </WorkspacePageSection>

          <WorkspacePageSection className="py-4">
            <UnassignedTray
              items={items}
              treeChildren={treeChildren}
              activePageId={activePageId}
              onPlaceItem={(item) => {
                if (!activePageId) return;
                project.placeOnPage(item.key, activePageId);
                handleSelectNode(item.key, item.itemType);
              }}
            />
          </WorkspacePageSection>
        </>
      )}

      {contextMenu && menuItems.length > 0 && (
        <div
          className="fixed z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <LayoutContextMenu
            items={menuItems}
            onAction={handleAction}
            onClose={closeMenu}
          />
        </div>
      )}

      {pendingLayoutMode && layoutModeCtx && (
        <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center pointer-events-none">
          <div className="relative h-0 w-[min(100vw-2rem,28rem)] pointer-events-auto">
            <DirtyGuardConfirm
              onDiscard={layoutModeCtx.confirmLayoutModeChange}
              onCancel={layoutModeCtx.cancelLayoutModeChange}
            />
          </div>
        </div>
      )}

      <AddItemPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onAdd={handleAddItem}
        title="Add To Layout"
      />
    </WorkspacePage>
    </LayoutDndProvider>
  );
}
