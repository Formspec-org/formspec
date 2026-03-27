/** @filedesc Pure functions for building layout-tier context menu items and executing layout actions. */
import type { Project } from '@formspec-org/studio-core';

export interface LayoutContextMenuState {
  x: number;
  y: number;
  kind: 'node' | 'canvas';
  nodeType?: 'field' | 'group' | 'display' | 'layout';
  /** bind key for bound nodes, nodeId for layout wrapper nodes. */
  nodeRef?: { bind?: string; nodeId?: string };
}

export interface LayoutContextMenuItem {
  label: string;
  action: string;
  separator?: boolean;
}

/**
 * Build context menu items for the layout canvas.
 *
 * Only layout-tier actions — no definition-tier mutations
 * (no Wrap in Group, no Delete item, no Duplicate).
 */
export function buildLayoutContextMenuItems(
  menu: LayoutContextMenuState | null,
): LayoutContextMenuItem[] {
  if (!menu || menu.kind === 'canvas') return [];

  const items: LayoutContextMenuItem[] = [];

  if (menu.nodeType === 'layout') {
    items.push(
      { label: 'Unwrap', action: 'unwrap' },
      { label: 'Remove from Tree', action: 'removeFromTree' },
    );
    return items;
  }

  // Field, group, or display node
  items.push(
    { label: 'Wrap in Card', action: 'wrapInCard' },
    { label: 'Wrap in Stack', action: 'wrapInStack' },
    { label: 'Wrap in Grid', action: 'wrapInGrid' },
    { label: 'Wrap in Panel', action: 'wrapInPanel' },
    { label: 'Move Up', action: 'moveUp' },
    { label: 'Move Down', action: 'moveDown' },
    { label: 'Remove from Tree', action: 'removeFromTree', separator: true },
  );

  return items;
}

interface ExecuteLayoutActionOptions {
  action: string;
  menu: LayoutContextMenuState | null;
  project: Project;
  deselect: () => void;
  closeMenu: () => void;
}

export function executeLayoutAction({
  action,
  menu,
  project,
  deselect,
  closeMenu,
}: ExecuteLayoutActionOptions): void {
  if (!menu || menu.kind === 'canvas' || !menu.nodeRef) {
    closeMenu();
    return;
  }

  const ref = menu.nodeRef;

  switch (action) {
    case 'wrapInCard':
    case 'wrapInStack':
    case 'wrapInGrid':
    case 'wrapInPanel': {
      const componentMap: Record<string, 'Card' | 'Stack' | 'Grid' | 'Panel'> = {
        wrapInCard: 'Card',
        wrapInStack: 'Stack',
        wrapInGrid: 'Grid',
        wrapInPanel: 'Panel',
      };
      if (ref.bind) {
        project.wrapInLayoutComponent(ref.bind, componentMap[action]);
      } else if (ref.nodeId) {
        // Wrap a layout node — dispatch raw command
        (project as any).core.dispatch({
          type: 'component.wrapNode',
          payload: {
            node: { nodeId: ref.nodeId },
            wrapper: { component: componentMap[action] },
          },
        });
      }
      break;
    }
    case 'unwrap': {
      if (ref.nodeId) {
        project.unwrapLayoutNode(ref.nodeId);
      }
      deselect();
      break;
    }
    case 'moveUp':
    case 'moveDown': {
      (project as any).core.dispatch({
        type: 'component.reorderNode',
        payload: {
          node: ref,
          direction: action === 'moveUp' ? 'up' : 'down',
        },
      });
      break;
    }
    case 'removeFromTree': {
      (project as any).core.dispatch({
        type: 'component.deleteNode',
        payload: { node: ref },
      });
      deselect();
      break;
    }
  }

  closeMenu();
}
