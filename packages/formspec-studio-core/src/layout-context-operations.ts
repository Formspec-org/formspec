/** @filedesc Layout-tier context menu planning and action execution for authored component trees. */
import type { Project } from './project.js';

export interface LayoutContextMenuState {
  x: number;
  y: number;
  kind: 'node' | 'canvas';
  nodeType?: 'field' | 'group' | 'display' | 'layout';
  nodeRef?: { bind?: string; nodeId?: string };
}

export interface LayoutContextMenuItem {
  label: string;
  action: string;
  separator?: boolean;
}

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

  items.push(
    { label: 'Wrap in Card', action: 'wrapInCard' },
    { label: 'Wrap in Stack', action: 'wrapInStack' },
    { label: 'Wrap in Grid', action: 'wrapInGrid' },
    { label: 'Wrap in Panel', action: 'wrapInPanel' },
    { label: 'Wrap in Accordion', action: 'wrapInAccordion' },
    { label: 'Wrap in Collapsible', action: 'wrapInCollapsible' },
    { label: 'Wrap in Conditional Group (data preserved)', action: 'wrapInConditionalGroup' },
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
  select: (key: string, type: 'field' | 'group' | 'display' | 'layout') => void;
  closeMenu: () => void;
}

export function executeLayoutAction({
  action,
  menu,
  project,
  deselect,
  select,
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
    case 'wrapInPanel':
    case 'wrapInAccordion':
    case 'wrapInCollapsible':
    case 'wrapInConditionalGroup': {
      const componentMap: Record<string, string> = {
        wrapInCard: 'Card',
        wrapInStack: 'Stack',
        wrapInGrid: 'Grid',
        wrapInPanel: 'Panel',
        wrapInAccordion: 'Accordion',
        wrapInCollapsible: 'Collapsible',
        wrapInConditionalGroup: 'ConditionalGroup',
      };
      const component = componentMap[action];
      const nodeRef = ref.bind ? { bind: ref.bind } : { nodeId: ref.nodeId! };
      const { createdId } = project.wrapComponentNode(nodeRef, component);
      if (createdId) {
        select(`__node:${createdId}`, 'layout');
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
      project.reorderComponentNode(ref, action === 'moveUp' ? 'up' : 'down');
      break;
    }
    case 'removeFromTree': {
      project.deleteComponentNode(ref);
      deselect();
      break;
    }
  }

  closeMenu();
}
