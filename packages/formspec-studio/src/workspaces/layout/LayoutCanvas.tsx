/** @filedesc Main Layout workspace canvas — renders the component tree with page sections, layout containers, and field/display blocks. */
import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
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
import { FormspecPreviewHost } from '../preview/FormspecPreviewHost';
import { useOptionalLayoutMode } from './LayoutModeContext';
import { type LayoutMode } from './LayoutThemeToggle';
import { setThemeOverride, clearThemeOverride, setColumnSpan } from '@formspec-org/studio-core';

interface CompNode {
  component: string;
  bind?: string;
  nodeId?: string;
  title?: string;
  syntheticPage?: boolean;
  groupPath?: string;
  _layout?: boolean;
  children?: CompNode[];
  [key: string]: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
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

  const [contextMenu, setContextMenu] = useState<LayoutContextMenuState | null>(null);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [localLayoutMode, setLocalLayoutMode] = useState<LayoutMode>('layout');
  // Per-mode selection: layout mode tracks its own key, theme mode tracks its own
  const [themeSelectedKey, setThemeSelectedKey] = useState<string | null>(null);
  const [themePopoverPosition, setThemePopoverPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const layoutModeCtx = useOptionalLayoutMode();
  const layoutMode = layoutModeCtx?.layoutMode ?? localLayoutMode;

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

  const materializePagedLayout = useCallback(() => {
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
  }, [pageNavItems, project]);

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

  const handleSelectNode = useCallback((key: string, type: 'field' | 'group' | 'display' | 'layout') => {
    select(key, type, { tab: 'layout' });
  }, [select]);

  const handleSetNodeProp = useCallback((selectionKey: string, key: string, value: unknown) => {
    project.setLayoutNodeProp(selectionKey, key, value);
  }, [project]);

  const handleUnwrapNode = useCallback((selectionKey: string) => {
    const nodeId = nodeIdFromLayoutId(selectionKey);
    project.unwrapLayoutNode(nodeId);
    deselect();
  }, [project, deselect]);

  const handleRemoveNode = useCallback((selectionKey: string) => {
    const nodeId = nodeIdFromLayoutId(selectionKey);
    project.deleteLayoutNode(nodeId);
    deselect();
  }, [project, deselect]);

  const handleStyleAdd = useCallback((selectionKey: string, key: string, value: string) => {
    const current = project.componentFor(
      nodeIdFromLayoutId(selectionKey),
    ) as Record<string, unknown> | undefined;
    const currentStyle = (current?.style as Record<string, unknown>) ?? {};
    project.setLayoutNodeProp(selectionKey, 'style', { ...currentStyle, [key]: value });
  }, [project]);

  const handleStyleRemove = useCallback((selectionKey: string, key: string) => {
    const current = project.componentFor(
      nodeIdFromLayoutId(selectionKey),
    ) as Record<string, unknown> | undefined;
    const currentStyle = { ...(current?.style as Record<string, unknown>) ?? {} };
    delete currentStyle[key];
    project.setLayoutNodeProp(selectionKey, 'style', currentStyle);
  }, [project]);

  const handleResizeColSpan = useCallback((selectionKey: string, newSpan: number) => {
    const ref = isLayoutId(selectionKey)
      ? { nodeId: nodeIdFromLayoutId(selectionKey) }
      : { bind: selectionKey };
    setColumnSpan(project, ref, newSpan);
  }, [project]);

  const handleAddContainer = useCallback((componentName: typeof CONTAINER_PRESETS[number]) => {
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
  }, [activePageId, handleSelectNode, isMultiPage, materializePagedLayout, project]);

  const handleAddPage = useCallback(() => {
    materializePagedLayout();
    const result = project.addPage(`Page ${pageNavItems.length + 1}`);
    if (result.createdId) {
      setActivePageId(result.createdId);
    }
  }, [materializePagedLayout, pageNavItems.length, project]);

  const handleRenamePage = useCallback((pageId: string, title: string, groupPath?: string, componentPageId?: string) => {
    if (componentPageId) {
      project.renamePage(componentPageId, title);
    }
    if (groupPath) {
      project.updateItem(groupPath, { label: title });
    }
  }, [project]);

  const handleAddItem = useCallback((option: FieldTypeOption) => {
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
  }, [activePageId, handleSelectNode, isMultiPage, materializePagedLayout, project]);

  const handleModeChange = useCallback((mode: LayoutMode) => {
    if (mode === 'theme') {
      // Transfer canvas selection to theme mode
      const canvasKey = selectedKeyForTab('layout');
      setThemeSelectedKey(canvasKey);
    }
    // When switching back to layout, existing layout tab selection is preserved
    setLocalLayoutMode(mode);
    layoutModeCtx?.setLayoutMode(mode);
  }, [selectedKeyForTab, layoutModeCtx]);

  const handleThemeFieldSelect = useCallback((itemKey: string, position: { x: number; y: number }) => {
    setThemeSelectedKey(itemKey);
    setThemePopoverPosition({ x: position.x + 12, y: position.y + 12 });
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const target = (e.target as HTMLElement).closest<HTMLElement>(
      '[data-layout-node]',
    );
    if (!target) {
      setContextMenu({ x: e.clientX, y: e.clientY, kind: 'canvas' });
      return;
    }

    const nodeType = target.dataset.layoutNodeType as LayoutContextMenuState['nodeType'];
    const bind = target.dataset.layoutBind;
    const nodeId = target.dataset.layoutNodeId;
    const clamped = clampContextMenuPosition(e.clientX, e.clientY);

    setContextMenu({
      ...clamped,
      kind: 'node',
      nodeType,
      nodeRef: bind ? { bind } : nodeId ? { nodeId } : undefined,
    });
  }, []);

  const closeMenu = useCallback(() => setContextMenu(null), []);

  const handleAction = useCallback((action: string) => {
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
  }, [activePageId, closeMenu, contextMenu, deselect, handleSelectNode, materializePagedLayout, project]);

  const menuItems = useMemo(
    () => buildLayoutContextMenuItems(contextMenu),
    [contextMenu],
  );

  return (
    <LayoutDndProvider activePageId={activePageId}>
    <WorkspacePage maxWidth="max-w-[980px]" className="overflow-y-auto">
      <WorkspacePageSection
        padding="px-7"
        className="sticky top-0 z-20 border-b border-border/40 bg-bg-default/85 py-4 backdrop-blur-md"
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <ModeSelector mode={structure.mode} onSetMode={(mode) => project.setFlow(mode)} />
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
              <div
                aria-label="Add layout container"
                className="flex flex-wrap items-center gap-2"
              >
                {CONTAINER_PRESETS.map((componentName) => (
                  <button
                    key={componentName}
                    type="button"
                    data-testid={`layout-add-${componentName.toLowerCase()}`}
                    className="rounded-full border border-border/80 bg-surface px-3 py-1.5 text-[12px] font-semibold text-ink transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
                    onClick={() => handleAddContainer(componentName)}
                  >
                    + {componentName}
                  </button>
                ))}
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
                onStyleAdd: handleStyleAdd,
                onStyleRemove: handleStyleRemove,
                onResizeColSpan: handleResizeColSpan,
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
