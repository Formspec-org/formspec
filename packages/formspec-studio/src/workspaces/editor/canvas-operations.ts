/** @filedesc Pure functions for building context menu items and executing canvas CRUD actions. */
import { isLayoutId, nodeIdFromLayoutId, pruneDescendants } from '../../lib/field-helpers';
import type { Project } from 'formspec-studio-core';

interface Item {
  key: string;
  type: string;
  children?: Item[];
  [key: string]: unknown;
}

export interface ContextMenuState {
  x: number;
  y: number;
  kind: 'item' | 'canvas';
  path?: string;
  type?: string;
}

export interface ContextMenuItem {
  label: string;
  action: string;
  /** When true, render a visual divider before this item. */
  separator?: boolean;
}

interface ExecuteContextActionOptions {
  action: string;
  contextMenu: ContextMenuState | null;
  items: Item[];
  selectionCount: number;
  selectedKeys: Set<string>;
  project: Project;
  deselect: () => void;
  selectAndFocusInspector: (path: string, type: string) => void;
  showPicker: () => void;
  closeMenu: () => void;
}

export function clampContextMenuPosition(x: number, y: number) {
  const MENU_WIDTH = 160;
  // Conservative upper bound for the tallest possible menu (8 items × ~40px + padding).
  const MENU_HEIGHT = 360;
  const maxX = Math.max(0, window.innerWidth - MENU_WIDTH);
  const maxY = Math.max(0, window.innerHeight - MENU_HEIGHT);

  return {
    x: Math.min(Math.max(0, x), maxX),
    y: Math.min(Math.max(0, y), maxY),
  };
}

export function buildContextMenuItems(
  contextMenu: ContextMenuState | null,
  selectionCount: number,
): ContextMenuItem[] {
  if (!contextMenu || contextMenu.kind === 'canvas') {
    return [{ label: 'Add Item', action: 'addItem' }];
  }

  if (selectionCount > 1) {
    return [
      { label: `Delete ${selectionCount} items`, action: 'batchDelete' },
      { label: `Duplicate ${selectionCount} items`, action: 'batchDuplicate' },
      { label: 'Wrap in Group', action: 'wrapInGroup' },
    ];
  }

  if (contextMenu.type === 'layout') {
    return [
      { label: 'Unwrap', action: 'unwrap' },
      { label: 'Delete', action: 'deleteLayout' },
    ];
  }

  const structuralItems: ContextMenuItem[] = [
    { label: 'Duplicate', action: 'duplicate' },
    { label: 'Delete', action: 'delete' },
    { label: 'Move Up', action: 'moveUp' },
    { label: 'Move Down', action: 'moveDown' },
    { label: 'Wrap in Group', action: 'wrapInGroup' },
    { label: 'Wrap in Card', action: 'wrapInCard' },
    { label: 'Wrap in Stack', action: 'wrapInStack' },
    { label: 'Wrap in Collapsible', action: 'wrapInCollapsible' },
  ];

  const aiItems = buildAIActionItems(contextMenu.type, true);
  return [...structuralItems, ...aiItems];
}

// ── AI context actions ───────────────────────────────────────────────

/** Build AI action menu items appropriate for the given item type. */
function buildAIActionItems(itemType: string | undefined, withSeparator: boolean): ContextMenuItem[] {
  const items: ContextMenuItem[] = [];

  if (itemType === 'field') {
    items.push(
      { label: 'AI: Add validation', action: 'ai:addValidation', separator: withSeparator },
      { label: 'AI: Suggest options', action: 'ai:suggestOptions' },
      { label: 'AI: Generate description', action: 'ai:generateDescription' },
    );
  } else if (itemType === 'group') {
    items.push(
      { label: 'AI: Add validation', action: 'ai:addValidation', separator: withSeparator },
      { label: 'AI: Generate description', action: 'ai:generateDescription' },
    );
  } else if (itemType === 'display') {
    items.push(
      { label: 'AI: Generate description', action: 'ai:generateDescription', separator: withSeparator },
    );
  }

  return items;
}

/** Build a pre-filled prompt for the given AI action and item path. */
export function buildAIActionPrompt(action: string, itemPath: string): string {
  switch (action) {
    case 'ai:addValidation':
      return `Add appropriate validation rules to the field "${itemPath}". Consider the field name and suggest constraints like required, pattern, min/max length, or custom constraint expressions.`;
    case 'ai:suggestOptions':
      return `Suggest appropriate option values for the field "${itemPath}". Based on the field name and context, generate a list of relevant choices.`;
    case 'ai:generateDescription':
      return `Generate a helpful description or help text for the item "${itemPath}". The description should guide the user on what information to provide.`;
    default:
      return '';
  }
}

/** Dispatch a formspec:ai-action custom event. */
function dispatchAIAction(action: string, itemPath: string): void {
  const prompt = buildAIActionPrompt(action, itemPath);
  if (!prompt) return;
  window.dispatchEvent(
    new CustomEvent('formspec:ai-action', {
      detail: { action, itemPath, prompt },
    }),
  );
}

export function executeContextAction({
  action,
  contextMenu,
  selectionCount,
  selectedKeys,
  project,
  deselect,
  selectAndFocusInspector,
  showPicker,
  closeMenu,
}: ExecuteContextActionOptions): void {
  if (!contextMenu) return;

  if (contextMenu.kind === 'canvas') {
    if (action === 'addItem') {
      showPicker();
    }
    closeMenu();
    return;
  }

  const path = contextMenu.path;
  if (!path) return;

  if (selectionCount > 1) {
    switch (action) {
      case 'batchDelete': {
        const pruned = pruneDescendants(selectedKeys);
        project.batchDeleteItems(pruned);
        deselect();
        break;
      }
      case 'batchDuplicate': {
        const pruned = pruneDescendants(selectedKeys);
        project.batchDuplicateItems(pruned);
        break;
      }
      case 'wrapInGroup': {
        const pruned = pruneDescendants(selectedKeys);
        if (pruned.length === 0) break;
        const result = project.wrapItemsInGroup(pruned, 'Group');
        deselect();
        // affectedPaths[0] is the new group path
        const groupPath = result.affectedPaths?.[0];
        if (groupPath) {
          selectAndFocusInspector(groupPath, 'group');
        }
        break;
      }
    }

    closeMenu();
    return;
  }

  if (isLayoutId(path)) {
    const nodeId = nodeIdFromLayoutId(path);
    if (action === 'unwrap') {
      project.unwrapLayoutNode(nodeId);
      deselect();
    }
    if (action === 'deleteLayout') {
      project.deleteLayoutNode(nodeId);
      deselect();
    }
    closeMenu();
    return;
  }

  switch (action) {
    case 'duplicate':
      project.copyItem(path);
      break;
    case 'delete':
      project.removeItem(path);
      break;
    case 'moveUp':
      project.reorderItem(path, 'up');
      break;
    case 'moveDown':
      project.reorderItem(path, 'down');
      break;
    case 'wrapInGroup': {
      const result = project.wrapItemsInGroup([path], 'Group');
      // affectedPaths[0] is the new group path
      const groupPath = result.affectedPaths?.[0];
      if (groupPath) {
        selectAndFocusInspector(groupPath, 'group');
      }
      break;
    }
    case 'wrapInCard':
    case 'wrapInStack':
    case 'wrapInCollapsible': {
      const componentMap: Record<string, 'Card' | 'Stack' | 'Collapsible'> = {
        wrapInCard: 'Card',
        wrapInStack: 'Stack',
        wrapInCollapsible: 'Collapsible',
      };
      const result = project.wrapInLayoutComponent(path, componentMap[action]);
      const wrapperNodeId = result.createdId;
      if (wrapperNodeId) {
        selectAndFocusInspector(`__node:${wrapperNodeId}`, 'layout');
      }
      break;
    }
    case 'ai:addValidation':
    case 'ai:suggestOptions':
    case 'ai:generateDescription':
      dispatchAIAction(action, path);
      break;
  }

  closeMenu();
}
