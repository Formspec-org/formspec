/** @filedesc Layout-tier context menu planning and action execution for authored component trees. */
import { resolveLayoutSelectionNodeRef } from './authoring-helpers.js';
import type { CompNode } from './layout-helpers.js';
import type { Project } from './project.js';

export interface LayoutContextMenuState {
  x: number;
  y: number;
  kind: 'node' | 'canvas';
  nodeType?: 'field' | 'group' | 'display' | 'layout';
  nodeRef?: { bind?: string; nodeId?: string };
  /**
   * Layout selection keys at menu open (def paths, `__node:id`, etc.).
   * When set, context actions apply to every key — not only `nodeRef`.
   */
  layoutTargetKeys?: string[];
  /** Mirrors `layoutTargetKeys.length` for menu chrome (e.g. hide move when multi-select). */
  selectionCount?: number;
  availablePages?: { id: string; title: string; isActive: boolean }[];
}

export interface LayoutContextMenuItem {
  label: string;
  action: string;
  separator?: boolean;
}

function flatRank(key: string, flatOrder: string[]): number {
  const i = flatOrder.indexOf(key);
  return i === -1 ? Number.POSITIVE_INFINITY : i;
}

/** Shallow-first — stable wrap order among siblings. */
function sortKeysByFlatOrderAsc(keys: string[], flatOrder: string[]): string[] {
  return [...keys].sort((a, b) => flatRank(a, flatOrder) - flatRank(b, flatOrder));
}

/** Deep/right-first — delete later DFS nodes first so indices stay valid. */
function sortKeysByFlatOrderDesc(keys: string[], flatOrder: string[]): string[] {
  return [...keys].sort((a, b) => flatRank(b, flatOrder) - flatRank(a, flatOrder));
}

/** Recover a canvas selection key from the DOM-derived node ref (legacy / tests). */
function selectionKeyFromNodeRef(ref: { bind?: string; nodeId?: string }): string {
  if (ref.bind) return ref.bind;
  if (ref.nodeId) return `__node:${ref.nodeId}`;
  return '';
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

  if (menu.availablePages && menu.availablePages.length > 1) {
    const pageItems = menu.availablePages
      .filter((p) => !p.isActive)
      .map((p) => ({
        label: `Move to ${p.title}`,
        action: `moveToPage:${p.id}`,
      }));
    if (pageItems.length > 0) {
      items.push({ separator: true, label: '', action: 'sep-pages-before' }, ...pageItems);
    }
  }

  const multi = (menu.selectionCount ?? menu.layoutTargetKeys?.length ?? 1) > 1;
  if (multi) {
    return items.filter((i) => i.action !== 'moveUp' && i.action !== 'moveDown');
  }

  return items;
}

export interface ExecuteLayoutActionOptions {
  action: string;
  menu: LayoutContextMenuState | null;
  project: Project;
  tree: CompNode | undefined;
  /** DFS order of layout row keys — batch delete/wrap use this for stable ordering. */
  layoutFlatOrder: string[];
  deselect: () => void;
  select: (key: string, type: 'field' | 'group' | 'display' | 'layout') => void;
  closeMenu: () => void;
}

export function executeLayoutAction({
  action,
  menu,
  project,
  tree,
  layoutFlatOrder,
  deselect,
  select,
  closeMenu,
}: ExecuteLayoutActionOptions): void {
  const keys =
    menu?.layoutTargetKeys && menu.layoutTargetKeys.length > 0
      ? menu.layoutTargetKeys
      : menu?.nodeRef
        ? [selectionKeyFromNodeRef(menu.nodeRef)].filter((k) => k !== '')
        : [];

  if (!menu || menu.kind === 'canvas' || keys.length === 0) {
    closeMenu();
    return;
  }

  const flat = layoutFlatOrder;

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
      const ordered = sortKeysByFlatOrderAsc(keys, flat);
      const refs = ordered.map((k) => resolveLayoutSelectionNodeRef(tree, k));
      let lastCreated: string | null = null;

      if (refs.length > 1 && project.wrapSiblingComponentNodes) {
        try {
          const { createdId } = project.wrapSiblingComponentNodes(refs, component);
          if (createdId) lastCreated = createdId;
        } catch {
          for (const key of ordered) {
            const ref = resolveLayoutSelectionNodeRef(tree, key);
            const { createdId } = project.wrapComponentNode(ref, component);
            if (createdId) lastCreated = createdId;
          }
        }
      } else {
        for (const key of ordered) {
          const ref = resolveLayoutSelectionNodeRef(tree, key);
          const { createdId } = project.wrapComponentNode(ref, component);
          if (createdId) lastCreated = createdId;
        }
      }

      if (lastCreated) {
        select(`__node:${lastCreated}`, 'layout');
      }
      break;
    }
    case 'unwrap': {
      const ordered = sortKeysByFlatOrderDesc(keys, flat);
      for (const key of ordered) {
        const ref = resolveLayoutSelectionNodeRef(tree, key);
        if ('nodeId' in ref && ref.nodeId) {
          project.unwrapLayoutNode(ref.nodeId);
        }
      }
      deselect();
      break;
    }
    case 'moveUp':
    case 'moveDown': {
      if (keys.length !== 1) break;
      const ref = resolveLayoutSelectionNodeRef(tree, keys[0]);
      project.reorderComponentNode(ref, action === 'moveUp' ? 'up' : 'down');
      break;
    }
    case 'removeFromTree': {
      const ordered = sortKeysByFlatOrderDesc(keys, flat);
      for (const key of ordered) {
        const ref = resolveLayoutSelectionNodeRef(tree, key);
        project.deleteComponentNode(ref);
      }
      deselect();
      break;
    }
  }

  closeMenu();
}
