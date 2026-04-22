/** @filedesc Context menu orchestration for the Layout canvas tree and page structure. */
import { useCallback, useMemo, useState } from 'react';
import {
  buildLayoutContextMenuItems,
  executeLayoutAction,
  type CompNode,
  type LayoutContextMenuState,
} from '@formspec-org/studio-core';
import { clampContextMenuPosition } from '../../components/ui/context-menu-utils';

export function useLayoutCanvasContextMenu(
  project: ReturnType<typeof import('../../state/useProject')['useProject']>,
  deselect: () => void,
  activePageId: string | null,
  materializePagedLayout: () => Map<string, string>,
  setActivePageId: (id: string) => void,
  selectLayoutNode: (key: string, type: 'field' | 'group' | 'display' | 'layout') => void,
  layoutSelectedKeys: Set<string>,
  layoutFlatOrder: string[],
  isMultiPage: boolean,
  pageNavItems: Array<{ id: string; title: string; groupPath?: string; pageId?: string }>,
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
    const layoutSelectKey =
      target.dataset.layoutSelectKey
      ?? layoutBind
      ?? (nodeId != null && nodeId !== '' ? `__node:${nodeId}` : null);
    let targetKeysForMenu: string[];
    if (layoutSelectKey && !layoutSelectedKeys.has(layoutSelectKey)) {
      const t = (nodeType ?? 'layout') as 'field' | 'group' | 'display' | 'layout';
      selectLayoutNode(layoutSelectKey, t);
      targetKeysForMenu = [layoutSelectKey];
    } else {
      targetKeysForMenu = Array.from(layoutSelectedKeys);
    }

    const clamped = clampContextMenuPosition(e.clientX, e.clientY);

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
      layoutTargetKeys: targetKeysForMenu,
      selectionCount: targetKeysForMenu.length,
      availablePages: isMultiPage ? pageNavItems.map(p => ({
        id: p.id,
        title: p.title,
        isActive: p.id === activePageId || p.pageId === activePageId
      })) : undefined,
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

    if (action.startsWith('moveToPage:')) {
      const targetNavId = action.split(':')[1];
      const targetPageId = pageIdMap.get(targetNavId) ?? targetNavId;
      const keys =
        contextMenu?.layoutTargetKeys && contextMenu.layoutTargetKeys.length > 0
          ? contextMenu.layoutTargetKeys
          : contextMenu?.nodeRef
            ? [contextMenu.nodeRef.bind ?? `__node:${contextMenu.nodeRef.nodeId}`].filter((k) => k !== '')
            : [];
      
      for (const key of keys) {
        if (!key.startsWith('__node:')) {
           project.placeOnPage(key, targetPageId);
        } else {
           const nodeId = key.split(':')[1];
           if (nodeId) {
             project.moveComponentNodeToContainer(
               { nodeId },
               { nodeId: targetPageId },
             );
           }
        }
      }
      closeMenu();
      return;
    }

    const tree = project.component.tree as CompNode | undefined;
    executeLayoutAction({
      action,
      menu: contextMenu,
      project,
      tree,
      layoutFlatOrder,
      deselect,
      select: selectLayoutNode,
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
