/** @filedesc Shared context-menu types and positioning utility used by both Editor and Layout canvases. */

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
