/** @filedesc Tests for core-owned Layout workspace context menu planning and actions. */
import { describe, expect, it, vi } from 'vitest';
import {
  buildLayoutContextMenuItems,
  executeLayoutAction,
  type LayoutContextMenuState,
} from '../src/layout-context-operations';

describe('buildLayoutContextMenuItems', () => {
  it('does not include definition-tier actions for field nodes', () => {
    const menu: LayoutContextMenuState = { x: 100, y: 100, kind: 'node', nodeType: 'field' };
    const items = buildLayoutContextMenuItems(menu);
    const labels = items.map((item) => item.label.toLowerCase());
    const actions = items.map((item) => item.action);

    expect(labels).not.toContain('wrap in group');
    expect(actions).not.toContain('delete');
    expect(actions).not.toContain('deleteItem');
    expect(actions).not.toContain('duplicate');
  });

  it('does not include AI actions', () => {
    const menu: LayoutContextMenuState = { x: 100, y: 100, kind: 'node', nodeType: 'field' };
    const items = buildLayoutContextMenuItems(menu);
    expect(items.filter((item) => item.action.startsWith('ai:'))).toHaveLength(0);
  });

  it('includes wrap, move, and remove actions for field nodes', () => {
    const menu: LayoutContextMenuState = { x: 100, y: 100, kind: 'node', nodeType: 'field' };
    const actions = buildLayoutContextMenuItems(menu).map((item) => item.action);

    expect(actions).toContain('wrapInCard');
    expect(actions).toContain('wrapInStack');
    expect(actions).toContain('wrapInGrid');
    expect(actions).toContain('wrapInPanel');
    expect(actions).toContain('moveUp');
    expect(actions).toContain('moveDown');
    expect(actions).toContain('removeFromTree');
  });

  it('includes unwrap and remove actions for layout nodes only', () => {
    const menu: LayoutContextMenuState = { x: 100, y: 100, kind: 'node', nodeType: 'layout' };
    const actions = buildLayoutContextMenuItems(menu).map((item) => item.action);

    expect(actions).toContain('unwrap');
    expect(actions).toContain('removeFromTree');
    expect(actions).not.toContain('wrapInCard');
    expect(actions).not.toContain('wrapInStack');
  });

  it('uses the same non-layout actions for group and display nodes', () => {
    const groupMenu: LayoutContextMenuState = { x: 100, y: 100, kind: 'node', nodeType: 'group' };
    const displayMenu: LayoutContextMenuState = { x: 100, y: 100, kind: 'node', nodeType: 'display' };

    expect(buildLayoutContextMenuItems(groupMenu).map((item) => item.action)).toEqual(
      buildLayoutContextMenuItems(displayMenu).map((item) => item.action),
    );
  });

  it('returns empty for canvas or missing context', () => {
    expect(buildLayoutContextMenuItems({ x: 100, y: 100, kind: 'canvas' })).toEqual([]);
    expect(buildLayoutContextMenuItems(null)).toEqual([]);
  });

  it('marks remove-from-tree with a separator for non-layout nodes', () => {
    const menu: LayoutContextMenuState = { x: 100, y: 100, kind: 'node', nodeType: 'field' };
    const removeItem = buildLayoutContextMenuItems(menu).find((item) => item.action === 'removeFromTree');
    expect(removeItem?.separator).toBe(true);
  });
});

describe('executeLayoutAction', () => {
  it('closes immediately for canvas context', () => {
    let closed = false;
    executeLayoutAction({
      action: 'anything',
      menu: { x: 0, y: 0, kind: 'canvas' },
      project: {} as any,
      deselect: () => {},
      select: () => {},
      closeMenu: () => { closed = true; },
    });
    expect(closed).toBe(true);
  });

  it('calls deleteComponentNode on removeFromTree (not core.dispatch)', () => {
    const deleteComponentNode = vi.fn();
    const fakeProject = { deleteComponentNode };

    let deselected = false;
    executeLayoutAction({
      action: 'removeFromTree',
      menu: { x: 0, y: 0, kind: 'node', nodeType: 'field', nodeRef: { bind: 'test' } },
      project: fakeProject as any,
      deselect: () => { deselected = true; },
      select: () => {},
      closeMenu: () => {},
    });

    expect(deleteComponentNode).toHaveBeenCalledWith({ bind: 'test' });
    expect(deselected).toBe(true);
  });

  it('calls reorderComponentNode on moveUp/moveDown (not core.dispatch)', () => {
    const reorderComponentNode = vi.fn();
    const fakeProject = { reorderComponentNode };

    executeLayoutAction({
      action: 'moveUp',
      menu: { x: 0, y: 0, kind: 'node', nodeType: 'field', nodeRef: { bind: 'name' } },
      project: fakeProject as any,
      deselect: () => {},
      select: () => {},
      closeMenu: () => {},
    });

    expect(reorderComponentNode).toHaveBeenCalledWith({ bind: 'name' }, 'up');

    executeLayoutAction({
      action: 'moveDown',
      menu: { x: 0, y: 0, kind: 'node', nodeType: 'group', nodeRef: { nodeId: 'grp_1' } },
      project: fakeProject as any,
      deselect: () => {},
      select: () => {},
      closeMenu: () => {},
    });

    expect(reorderComponentNode).toHaveBeenCalledWith({ nodeId: 'grp_1' }, 'down');
  });

  it('calls wrapComponentNode for Grid and Panel (not core.dispatch)', () => {
    const wrapComponentNode = vi.fn(() => ({ createdId: 'node-abc' }));
    const fakeProject = { wrapComponentNode };

    let selected: { key: string; type: string } | null = null;
    executeLayoutAction({
      action: 'wrapInGrid',
      menu: { x: 0, y: 0, kind: 'node', nodeType: 'field', nodeRef: { bind: 'amount' } },
      project: fakeProject as any,
      deselect: () => {},
      select: (key, type) => { selected = { key, type }; },
      closeMenu: () => {},
    });

    expect(wrapComponentNode).toHaveBeenCalledWith({ bind: 'amount' }, 'Grid');
    expect(selected).toEqual({ key: '__node:node-abc', type: 'layout' });
  });

  it('calls wrapComponentNode for Card and Stack too (unified path)', () => {
    const wrapComponentNode = vi.fn(() => ({ createdId: 'node-xyz' }));
    const fakeProject = { wrapComponentNode };

    executeLayoutAction({
      action: 'wrapInCard',
      menu: { x: 0, y: 0, kind: 'node', nodeType: 'field', nodeRef: { bind: 'page1.name' } },
      project: fakeProject as any,
      deselect: () => {},
      select: () => {},
      closeMenu: () => {},
    });

    expect(wrapComponentNode).toHaveBeenCalledWith({ bind: 'page1.name' }, 'Card');
  });

  it('selects the created layout wrapper after wrapping a node', () => {
    let selected: { key: string; type: string } | null = null;
    const fakeProject = {
      wrapComponentNode: () => ({ createdId: 'node-123' }),
    };

    executeLayoutAction({
      action: 'wrapInCard',
      menu: { x: 0, y: 0, kind: 'node', nodeType: 'field', nodeRef: { bind: 'page1.name' } },
      project: fakeProject as any,
      deselect: () => {},
      select: (key, type) => { selected = { key, type }; },
      closeMenu: () => {},
    });

    expect(selected).toEqual({ key: '__node:node-123', type: 'layout' });
  });
});
