/** @filedesc Tests for the Layout workspace context menu — layout-tier actions only. */
import { describe, it, expect } from 'vitest';
import {
  buildLayoutContextMenuItems,
  executeLayoutAction,
  type LayoutContextMenuState,
} from '../../../src/workspaces/layout/layout-context-operations';

describe('buildLayoutContextMenuItems', () => {
  it('does NOT include wrap-in-group (definition-tier action)', () => {
    const menu: LayoutContextMenuState = {
      x: 100, y: 100, kind: 'node', nodeType: 'field',
    };
    const items = buildLayoutContextMenuItems(menu);
    const labels = items.map(i => i.label.toLowerCase());
    expect(labels).not.toContain('wrap in group');
  });

  it('does NOT include delete item (definition-tier action)', () => {
    const menu: LayoutContextMenuState = {
      x: 100, y: 100, kind: 'node', nodeType: 'field',
    };
    const items = buildLayoutContextMenuItems(menu);
    const actions = items.map(i => i.action);
    expect(actions).not.toContain('delete');
    expect(actions).not.toContain('deleteItem');
  });

  it('does NOT include duplicate (definition-tier action)', () => {
    const menu: LayoutContextMenuState = {
      x: 100, y: 100, kind: 'node', nodeType: 'field',
    };
    const items = buildLayoutContextMenuItems(menu);
    const actions = items.map(i => i.action);
    expect(actions).not.toContain('duplicate');
  });

  it('does NOT include AI actions', () => {
    const menu: LayoutContextMenuState = {
      x: 100, y: 100, kind: 'node', nodeType: 'field',
    };
    const items = buildLayoutContextMenuItems(menu);
    const aiActions = items.filter(i => i.action.startsWith('ai:'));
    expect(aiActions).toHaveLength(0);
  });

  it('includes layout wrap actions for field nodes', () => {
    const menu: LayoutContextMenuState = {
      x: 100, y: 100, kind: 'node', nodeType: 'field',
    };
    const items = buildLayoutContextMenuItems(menu);
    const actions = items.map(i => i.action);
    expect(actions).toContain('wrapInCard');
    expect(actions).toContain('wrapInStack');
    expect(actions).toContain('wrapInGrid');
    expect(actions).toContain('wrapInPanel');
  });

  it('includes move actions for field nodes', () => {
    const menu: LayoutContextMenuState = {
      x: 100, y: 100, kind: 'node', nodeType: 'field',
    };
    const items = buildLayoutContextMenuItems(menu);
    const actions = items.map(i => i.action);
    expect(actions).toContain('moveUp');
    expect(actions).toContain('moveDown');
  });

  it('includes unwrap and remove-from-tree for layout containers', () => {
    const menu: LayoutContextMenuState = {
      x: 100, y: 100, kind: 'node', nodeType: 'layout',
    };
    const items = buildLayoutContextMenuItems(menu);
    const actions = items.map(i => i.action);
    expect(actions).toContain('unwrap');
    expect(actions).toContain('removeFromTree');
  });

  it('does NOT include wrap actions for layout containers', () => {
    const menu: LayoutContextMenuState = {
      x: 100, y: 100, kind: 'node', nodeType: 'layout',
    };
    const items = buildLayoutContextMenuItems(menu);
    const actions = items.map(i => i.action);
    expect(actions).not.toContain('wrapInCard');
    expect(actions).not.toContain('wrapInStack');
  });

  it('includes remove-from-tree for field nodes', () => {
    const menu: LayoutContextMenuState = {
      x: 100, y: 100, kind: 'node', nodeType: 'field',
    };
    const items = buildLayoutContextMenuItems(menu);
    const actions = items.map(i => i.action);
    expect(actions).toContain('removeFromTree');
  });

  it('returns empty for canvas context', () => {
    const menu: LayoutContextMenuState = {
      x: 100, y: 100, kind: 'canvas',
    };
    const items = buildLayoutContextMenuItems(menu);
    expect(items.length).toBe(0);
  });

  it('returns empty when menu is null', () => {
    expect(buildLayoutContextMenuItems(null)).toEqual([]);
  });

  it('includes same actions for group nodes as field nodes', () => {
    const menu: LayoutContextMenuState = {
      x: 100, y: 100, kind: 'node', nodeType: 'group',
    };
    const items = buildLayoutContextMenuItems(menu);
    const actions = items.map(i => i.action);
    expect(actions).toContain('wrapInCard');
    expect(actions).toContain('removeFromTree');
    expect(actions).not.toContain('unwrap');
  });

  it('includes same actions for display nodes as field nodes', () => {
    const menu: LayoutContextMenuState = {
      x: 100, y: 100, kind: 'node', nodeType: 'display',
    };
    const items = buildLayoutContextMenuItems(menu);
    const actions = items.map(i => i.action);
    expect(actions).toContain('wrapInCard');
    expect(actions).toContain('removeFromTree');
  });

  it('places separator before remove-from-tree for non-layout nodes', () => {
    const menu: LayoutContextMenuState = {
      x: 100, y: 100, kind: 'node', nodeType: 'field',
    };
    const items = buildLayoutContextMenuItems(menu);
    const removeItem = items.find(i => i.action === 'removeFromTree');
    expect(removeItem?.separator).toBe(true);
  });
});

describe('executeLayoutAction', () => {
  it('calls closeMenu on canvas context', () => {
    let closed = false;
    executeLayoutAction({
      action: 'anything',
      menu: { x: 0, y: 0, kind: 'canvas' },
      project: {} as any,
      deselect: () => {},
      closeMenu: () => { closed = true; },
    });
    expect(closed).toBe(true);
  });

  it('calls closeMenu and deselect on removeFromTree', () => {
    let closed = false;
    let deselected = false;
    const dispatched: any[] = [];
    const fakeProject = {
      core: {
        dispatch: (cmd: any) => dispatched.push(cmd),
      },
    };
    executeLayoutAction({
      action: 'removeFromTree',
      menu: {
        x: 0, y: 0, kind: 'node', nodeType: 'field',
        nodeRef: { bind: 'test' },
      },
      project: fakeProject as any,
      deselect: () => { deselected = true; },
      closeMenu: () => { closed = true; },
    });
    expect(closed).toBe(true);
    expect(deselected).toBe(true);
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].type).toBe('component.deleteNode');
    expect(dispatched[0].payload.node).toEqual({ bind: 'test' });
  });
});
