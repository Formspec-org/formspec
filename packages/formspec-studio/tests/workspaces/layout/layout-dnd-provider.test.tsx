/** @filedesc Tests for layout DnD handler logic — asserts project API is used, not core.dispatch. */
import { describe, it, expect, vi } from 'vitest';
import {
  handleTrayDrop,
  handleSpatialDrop,
  handleContainerDrop,
  handleDragEnd,
  sortGroupToParentRef,
} from '../../../src/workspaces/layout/dnd/layout-dnd-utils';
import { LAYOUT_PDND_KIND } from '../../../src/workspaces/layout/dnd/layout-pdnd';
import { createProject, findParentOfNodeRef, type Project } from '@formspec-org/studio-core';

function makeProject() {
  const project = createProject();
  project.addField('email', 'Email', 'string');
  project.addField('name', 'Name', 'string');
  return project;
}

describe('handleTrayDrop — tray-to-canvas', () => {
  it('calls placeOnPage when the tray key already exists in the definition (unassigned)', () => {
    const project = makeProject();
    const placeOnPage = vi.spyOn(project, 'placeOnPage').mockReturnValue({
      summary: 'ok',
      action: { helper: 'placeOnPage', params: {} },
      affectedPaths: [],
    });
    const addItemToLayout = vi.spyOn(project, 'addItemToLayout');

    handleTrayDrop(project, { key: 'email', label: 'Email', itemType: 'field' }, null);

    expect(placeOnPage).toHaveBeenCalledOnce();
    expect(placeOnPage).toHaveBeenCalledWith('email', 'root');
    expect(addItemToLayout).not.toHaveBeenCalled();
  });

  it('passes activePageId to placeOnPage when the item exists and a page is active', () => {
    const project = makeProject();
    const pageId = project.addPage('Step 1').createdId!;
    const placeOnPage = vi.spyOn(project, 'placeOnPage').mockReturnValue({
      summary: 'ok',
      action: { helper: 'placeOnPage', params: {} },
      affectedPaths: [],
    });

    handleTrayDrop(project, { key: 'email', label: 'Email', itemType: 'field' }, pageId);

    expect(placeOnPage).toHaveBeenCalledWith('email', pageId);
  });

  it('calls addItemToLayout for keys not yet in the definition', () => {
    const project = makeProject();
    const addItemToLayout = vi.spyOn(project, 'addItemToLayout').mockReturnValue({
      summary: 'ok',
      action: { helper: 'addItemToLayout', params: {} },
      affectedPaths: [],
      createdId: 'phone',
    });

    handleTrayDrop(project, { key: 'phone', label: 'Phone', itemType: 'field' }, null);

    expect(addItemToLayout).toHaveBeenCalledWith(
      expect.objectContaining({ itemType: 'field', key: 'phone' }),
      undefined,
    );
  });
});

describe('handleSpatialDrop', () => {
  it('calls project.moveComponentNodeToIndex', () => {
    const project = makeProject();
    const moveToIndex = vi.spyOn(project, 'moveComponentNodeToIndex').mockReturnValue({
      summary: 'ok', action: { helper: 'moveComponentNodeToIndex', params: {} }, affectedPaths: [],
    });

    handleSpatialDrop(project, { bind: 'email' }, { nodeId: 'container-1' }, 2);

    expect(moveToIndex).toHaveBeenCalledWith({ bind: 'email' }, { nodeId: 'container-1' }, 2);
  });
});

describe('handleContainerDrop', () => {
  it('calls project.moveComponentNodeToContainer', () => {
    const project = makeProject();
    const moveToContainer = vi.spyOn(project, 'moveComponentNodeToContainer').mockReturnValue({
      summary: 'ok', action: { helper: 'moveComponentNodeToContainer', params: {} }, affectedPaths: [],
    });

    handleContainerDrop(project, { bind: 'email' }, { nodeId: 'grid-1' });

    expect(moveToContainer).toHaveBeenCalledWith({ bind: 'email' }, { nodeId: 'grid-1' });
  });
});

describe('sortGroupToParentRef', () => {
  it('maps bind: prefix to bind ref', () => {
    expect(sortGroupToParentRef('bind:participants')).toEqual({ bind: 'participants' });
  });

  it('maps plain ids to nodeId ref', () => {
    expect(sortGroupToParentRef('root')).toEqual({ nodeId: 'root' });
    expect(sortGroupToParentRef('page-uuid-1')).toEqual({ nodeId: 'page-uuid-1' });
  });

  it('returns null for empty string', () => {
    expect(sortGroupToParentRef('')).toBeNull();
  });
});

describe('findParentOfNodeRef', () => {
  it('returns the parent of a bound field', () => {
    const parent = { component: 'Stack', nodeId: 'root', children: [{ component: 'TextInput', bind: 'x' }] };
    expect(findParentOfNodeRef(parent as any, { bind: 'x' })).toBe(parent);
  });

  it('returns null for the tree root', () => {
    const tree = { component: 'Stack', nodeId: 'root', children: [] } as any;
    expect(findParentOfNodeRef(tree, { nodeId: 'root' })).toBeNull();
  });

  it('returns undefined when not found', () => {
    const tree = { component: 'Stack', nodeId: 'root', children: [] } as any;
    expect(findParentOfNodeRef(tree, { bind: 'nope' })).toBeUndefined();
  });
});

// ── handleDragEnd routing ──

describe('handleDragEnd — static placement drops', () => {
  it('routes container-drop to moveComponentNodeToContainer', () => {
    const project = makeProject();
    const moveToContainer = vi.spyOn(project, 'moveComponentNodeToContainer').mockReturnValue({
      summary: 'ok', action: { helper: 'moveComponentNodeToContainer', params: {} }, affectedPaths: [],
    });

    handleDragEnd(project, {
      canceled: false,
      source: { id: 'field:email', data: { nodeRef: { bind: 'email' }, type: 'tree-node' } },
      target: { id: 'drop:node:card-1', data: { type: 'container-drop', nodeRef: { nodeId: 'card-1' } } },
    }, null, vi.fn());

    expect(moveToContainer).toHaveBeenCalledWith({ bind: 'email' }, { nodeId: 'card-1' });
  });

  it('skips when canceled', () => {
    const project = makeProject();
    const moveToContainer = vi.spyOn(project, 'moveComponentNodeToContainer');

    handleDragEnd(project, {
      canceled: true,
      source: { id: 'field:email', data: { nodeRef: { bind: 'email' }, type: 'tree-node' } },
      target: { id: 'drop:node:card-1', data: { type: 'container-drop', nodeRef: { nodeId: 'card-1' } } },
    }, null, vi.fn());

    expect(moveToContainer).not.toHaveBeenCalled();
  });
});

describe('handleDragEnd — sortable placement (reorder within/across containers)', () => {
  it('routes sortable placement with nodeId group to moveComponentNodeToIndex', () => {
    const project = makeProject();
    const moveToIndex = vi.spyOn(project, 'moveComponentNodeToIndex').mockReturnValue({
      summary: 'ok', action: { helper: 'moveComponentNodeToIndex', params: {} }, affectedPaths: [],
    });

    handleDragEnd(project, {
      canceled: false,
      source: { id: 'field:email', data: { nodeRef: { bind: 'email' }, type: 'tree-node' } },
      target: { id: 'field:email', data: { nodeRef: { bind: 'email' }, type: 'tree-node' } },
      sortable: { group: 'root', index: 0, initialGroup: 'root', initialIndex: 2 },
    }, null, vi.fn());

    expect(moveToIndex).toHaveBeenCalledWith({ bind: 'email' }, { nodeId: 'root' }, 0);
  });

  it('routes sortable placement with bind: group to moveComponentNodeToIndex', () => {
    const project = makeProject();
    const moveToIndex = vi.spyOn(project, 'moveComponentNodeToIndex').mockReturnValue({
      summary: 'ok', action: { helper: 'moveComponentNodeToIndex', params: {} }, affectedPaths: [],
    });

    handleDragEnd(project, {
      canceled: false,
      source: { id: 'field:email', data: { nodeRef: { bind: 'email' }, type: 'tree-node' } },
      target: { id: 'field:email', data: { nodeRef: { bind: 'email' }, type: 'tree-node' } },
      sortable: { group: 'bind:section', index: 1, initialGroup: 'root', initialIndex: 0 },
    }, null, vi.fn());

    expect(moveToIndex).toHaveBeenCalledWith({ bind: 'email' }, { bind: 'section' }, 1);
  });

  it('does not move when sortable placement is unchanged', () => {
    const project = makeProject();
    const moveToIndex = vi.spyOn(project, 'moveComponentNodeToIndex').mockReturnValue({
      summary: 'ok', action: { helper: 'moveComponentNodeToIndex', params: {} }, affectedPaths: [],
    });

    handleDragEnd(project, {
      canceled: false,
      source: { id: 'field:email', data: { nodeRef: { bind: 'email' }, type: 'tree-node' } },
      target: { id: 'field:email', data: { nodeRef: { bind: 'email' }, type: 'tree-node' } },
      sortable: { group: 'root', index: 1, initialGroup: 'root', initialIndex: 1 },
    }, null, vi.fn());

    expect(moveToIndex).not.toHaveBeenCalled();
  });

  it('prefers container-drop over sortable placement', () => {
    const project = makeProject();
    const moveToContainer = vi.spyOn(project, 'moveComponentNodeToContainer').mockReturnValue({
      summary: 'ok', action: { helper: 'moveComponentNodeToContainer', params: {} }, affectedPaths: [],
    });

    handleDragEnd(project, {
      canceled: false,
      source: { id: 'field:email', data: { nodeRef: { bind: 'email' }, type: 'tree-node' } },
      target: { id: 'drop:node:card-1', data: { type: 'container-drop', nodeRef: { nodeId: 'card-1' } } },
      sortable: { group: 'root', index: 0, initialGroup: 'root', initialIndex: 1 },
    }, null, vi.fn());

    expect(moveToContainer).toHaveBeenCalledOnce();
    expect(moveToContainer).toHaveBeenCalledWith({ bind: 'email' }, { nodeId: 'card-1' });
  });
});

describe('handleDragEnd — tree-node to tree-node fallback', () => {
  it('moves source to target index in shared parent', () => {
    const tree = {
      component: 'Stack', nodeId: 'root', _layout: true,
      children: [
        { component: 'TextInput', bind: 'name' },
        { component: 'TextInput', bind: 'email' },
      ],
    };
    const moveToIndex = vi.fn();
    const project = {
      component: { tree },
      moveComponentNodeToIndex: moveToIndex,
      moveComponentNodeToContainer: vi.fn(),
    } as unknown as Project;

    handleDragEnd(project, {
      canceled: false,
      source: { id: 'field:email', data: { nodeRef: { bind: 'email' }, type: 'tree-node' } },
      target: { id: 'field:name', data: { nodeRef: { bind: 'name' }, type: 'tree-node' } },
    }, null, vi.fn());

    expect(moveToIndex).toHaveBeenCalledWith({ bind: 'email' }, { nodeId: 'root' }, 0);
  });

  it('does not move when source equals target', () => {
    const tree = {
      component: 'Stack', nodeId: 'root', _layout: true,
      children: [{ component: 'TextInput', bind: 'email' }],
    };
    const moveToIndex = vi.fn();
    const project = {
      component: { tree },
      moveComponentNodeToIndex: moveToIndex,
      moveComponentNodeToContainer: vi.fn(),
    } as unknown as Project;

    handleDragEnd(project, {
      canceled: false,
      source: { id: 'field:email', data: { nodeRef: { bind: 'email' }, type: 'tree-node' } },
      target: { id: 'field:email', data: { nodeRef: { bind: 'email' }, type: 'tree-node' } },
    }, null, vi.fn());

    expect(moveToIndex).not.toHaveBeenCalled();
  });
});

describe('handleDragEnd — tray to tree-node spatial drop', () => {
  it('places existing item then moves it to the target index', () => {
    const tree = {
      component: 'Stack', nodeId: 'root', _layout: true,
      children: [{ component: 'TextInput', bind: 'name' }],
    };
    const moveToIndex = vi.fn();
    const placeOnPage = vi.fn().mockReturnValue({
      summary: 'ok', action: { helper: 'placeOnPage', params: {} }, affectedPaths: [],
    });
    const project = {
      component: { tree },
      moveComponentNodeToIndex: moveToIndex,
      placeOnPage: placeOnPage,
      itemAt: vi.fn().mockReturnValue({ key: 'email' }),
    } as unknown as Project;
    const selectFn = vi.fn();

    handleDragEnd(project, {
      canceled: false,
      source: {
        id: 'unassigned:email',
        data: { kind: LAYOUT_PDND_KIND, type: 'unassigned-item', key: 'email', label: 'Email', itemType: 'field' },
      },
      target: { id: 'field:name', data: { type: 'tree-node', nodeRef: { bind: 'name' } } },
    }, 'page-1', selectFn);

    expect(placeOnPage).toHaveBeenCalledWith('email', 'page-1');
    expect(moveToIndex).toHaveBeenCalledWith({ bind: 'email' }, { nodeId: 'root' }, 0);
    expect(selectFn).toHaveBeenCalledWith('email', 'field', { tab: 'layout' });
  });
});
