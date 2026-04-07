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

const DROPDOWN_GAP = 4;

/**
 * Position a dropdown so its top-left sits below the anchor (or above if needed),
 * horizontally aligned with the anchor and at least as wide as `minMenuWidth` or the anchor.
 */
export function getAnchoredDropdownPosition(
  anchor: DOMRect,
  opts?: { minMenuWidth?: number; estimatedHeight?: number },
): { x: number; y: number; width: number } {
  const minMenuWidth = opts?.minMenuWidth ?? 180;
  const estimatedHeight = opts?.estimatedHeight ?? 220;
  const width = Math.max(minMenuWidth, anchor.width);

  let x = anchor.left;
  x = Math.min(Math.max(0, x), Math.max(0, window.innerWidth - width));

  let y = anchor.bottom + DROPDOWN_GAP;
  const roomBelow = window.innerHeight - y - DROPDOWN_GAP;
  if (roomBelow < estimatedHeight && anchor.top > estimatedHeight + DROPDOWN_GAP) {
    y = anchor.top - estimatedHeight - DROPDOWN_GAP;
  }
  y = Math.min(Math.max(DROPDOWN_GAP, y), Math.max(DROPDOWN_GAP, window.innerHeight - estimatedHeight));

  return { x, y, width };
}
