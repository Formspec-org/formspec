/** @filedesc Tests for LayoutDndProvider drop handler logic — asserts project API is used, not core.dispatch. */
import { describe, it, expect, vi } from 'vitest';
import { handleTrayDrop, handleTreeReorder, handleSpatialDrop, handleContainerDrop, handleDragEnd } from '../../../src/workspaces/layout/LayoutDndProvider';
import { createProject, type Project } from '@formspec-org/studio-core';

function makeProject() {
  const project = createProject();
  project.addField('email', 'Email', 'string');
  project.addField('name', 'Name', 'string');
  return project;
}

describe('handleTrayDrop — tray-to-canvas', () => {
  it('calls project.addItemToLayout (not a raw dispatch bypass) when unassigned item is dropped', () => {
    const project = makeProject();
    const addItemToLayout = vi.spyOn(project, 'addItemToLayout');

    handleTrayDrop(project, { key: 'email', label: 'Email', itemType: 'field' }, null);

    expect(addItemToLayout).toHaveBeenCalledOnce();
    expect(addItemToLayout).toHaveBeenCalledWith(
      expect.objectContaining({ itemType: 'field', key: 'email' }),
      undefined,
    );
  });

  it('passes activePageId to addItemToLayout when a page is active', () => {
    const project = makeProject();
    const pageId = project.addPage('Step 1').createdId!;
    const addItemToLayout = vi.spyOn(project, 'addItemToLayout');

    handleTrayDrop(project, { key: 'name', label: 'Name', itemType: 'field' }, pageId);

    expect(addItemToLayout).toHaveBeenCalledWith(
      expect.objectContaining({ itemType: 'field', key: 'name' }),
      pageId,
    );
  });

  it('passes undefined (not null) as pageId when no active page', () => {
    const project = makeProject();
    const addItemToLayout = vi.spyOn(project, 'addItemToLayout');

    handleTrayDrop(project, { key: 'email', label: 'Email', itemType: 'field' }, null);

    const call = addItemToLayout.mock.calls[0];
    // addItemToLayout uses pageId ?? 'root' — must receive undefined not null
    expect(call[1]).toBeUndefined();
  });
});

describe('handleSpatialDrop — spatial reorder into container at index', () => {
  it('calls project.moveComponentNodeToIndex with sourceRef, containerId, insertIndex', () => {
    const project = makeProject();
    const moveToIndex = vi.spyOn(project, 'moveComponentNodeToIndex').mockReturnValue({
      summary: 'ok',
      action: { helper: 'moveComponentNodeToIndex', params: {} },
      affectedPaths: [],
    });

    handleSpatialDrop(project, { bind: 'email' }, 'container-node-1', 2);

    expect(moveToIndex).toHaveBeenCalledOnce();
    expect(moveToIndex).toHaveBeenCalledWith({ bind: 'email' }, 'container-node-1', 2);
  });

  it('works with nodeId ref for layout nodes', () => {
    const project = makeProject();
    const moveToIndex = vi.spyOn(project, 'moveComponentNodeToIndex').mockReturnValue({
      summary: 'ok',
      action: { helper: 'moveComponentNodeToIndex', params: {} },
      affectedPaths: [],
    });

    handleSpatialDrop(project, { nodeId: 'node-abc' }, 'container-node-1', 0);

    expect(moveToIndex).toHaveBeenCalledWith({ nodeId: 'node-abc' }, 'container-node-1', 0);
  });

  it('accepts insertIndex 0 (insert before first child)', () => {
    const project = makeProject();
    const moveToIndex = vi.spyOn(project, 'moveComponentNodeToIndex').mockReturnValue({
      summary: 'ok',
      action: { helper: 'moveComponentNodeToIndex', params: {} },
      affectedPaths: [],
    });

    handleSpatialDrop(project, { bind: 'name' }, 'grid-1', 0);

    expect(moveToIndex).toHaveBeenCalledWith({ bind: 'name' }, 'grid-1', 0);
  });
});

describe('handleContainerDrop — drop onto container as last child', () => {
  it('calls project.moveComponentNodeToContainer with sourceRef and targetParent nodeId', () => {
    const project = makeProject();
    const moveToContainer = vi.spyOn(project, 'moveComponentNodeToContainer').mockReturnValue({
      summary: 'ok',
      action: { helper: 'moveComponentNodeToContainer', params: {} },
      affectedPaths: [],
    });

    handleContainerDrop(project, { bind: 'email' }, { nodeId: 'grid-container-1' });

    expect(moveToContainer).toHaveBeenCalledOnce();
    expect(moveToContainer).toHaveBeenCalledWith({ bind: 'email' }, { nodeId: 'grid-container-1' });
  });

  it('works with nodeId ref', () => {
    const project = makeProject();
    const moveToContainer = vi.spyOn(project, 'moveComponentNodeToContainer').mockReturnValue({
      summary: 'ok',
      action: { helper: 'moveComponentNodeToContainer', params: {} },
      affectedPaths: [],
    });

    handleContainerDrop(project, { nodeId: 'node-xyz' }, { nodeId: 'panel-1' });

    expect(moveToContainer).toHaveBeenCalledWith({ nodeId: 'node-xyz' }, { nodeId: 'panel-1' });
  });
});

describe('handleTreeReorder — component tree reorder', () => {
  it('calls project.reorderComponentNode (not a raw dispatch bypass) for bound node reorder', () => {
    const project = makeProject();
    // reorderComponentNode needs the node to exist in the component tree
    // Spy and replace with noop to test dispatch path without needing real nodes
    const reorderComponentNode = vi.spyOn(project, 'reorderComponentNode').mockReturnValue({
      summary: 'ok',
      action: { helper: 'reorderComponentNode', params: {} },
      affectedPaths: [],
    });

    handleTreeReorder(project, { bind: 'email' }, { bind: 'name' }, 'down');

    expect(reorderComponentNode).toHaveBeenCalledOnce();
    expect(reorderComponentNode).toHaveBeenCalledWith({ bind: 'email' }, 'down');
  });

  it('calls reorderComponentNode with direction up', () => {
    const project = makeProject();
    const reorderComponentNode = vi.spyOn(project, 'reorderComponentNode').mockReturnValue({
      summary: 'ok',
      action: { helper: 'reorderComponentNode', params: {} },
      affectedPaths: [],
    });

    handleTreeReorder(project, { bind: 'name' }, { bind: 'email' }, 'up');

    expect(reorderComponentNode).toHaveBeenCalledWith({ bind: 'name' }, 'up');
  });

  it('calls reorderComponentNode with nodeId ref for layout nodes', () => {
    const project = makeProject();
    const reorderComponentNode = vi.spyOn(project, 'reorderComponentNode').mockReturnValue({
      summary: 'ok',
      action: { helper: 'reorderComponentNode', params: {} },
      affectedPaths: [],
    });

    handleTreeReorder(project, { nodeId: 'node-abc' }, { nodeId: 'node-xyz' }, 'down');

    expect(reorderComponentNode).toHaveBeenCalledWith({ nodeId: 'node-abc' }, 'down');
  });
});

// ── handleDragEnd routing — tests the onDragEnd dispatch logic in isolation ──
// These tests require a pure exported handleDragEnd(project, eventData, activePageId, selectFn).

describe('handleDragEnd routing — insert-slot drops', () => {
  it('routes insert-slot target to handleSpatialDrop (moveComponentNodeToIndex)', () => {
    const project = makeProject();
    const moveToIndex = vi.spyOn(project, 'moveComponentNodeToIndex').mockReturnValue({
      summary: 'ok', action: { helper: 'moveComponentNodeToIndex', params: {} }, affectedPaths: [],
    });

    // Simulate a dnd-kit event with insert-slot target type
    handleDragEnd(project, {
      canceled: false,
      source: { id: 'field:email', data: { nodeRef: { bind: 'email' }, type: 'tree-node', index: 0 } },
      target: { id: 'slot:grid-1:2', data: { type: 'insert-slot', containerId: 'grid-1', insertIndex: 2 } },
    }, null, vi.fn());

    expect(moveToIndex).toHaveBeenCalledWith({ bind: 'email' }, 'grid-1', 2);
  });

  it('routes container-drop target with nodeId to handleContainerDrop (moveComponentNodeToContainer)', () => {
    const project = makeProject();
    const moveToContainer = vi.spyOn(project, 'moveComponentNodeToContainer').mockReturnValue({
      summary: 'ok', action: { helper: 'moveComponentNodeToContainer', params: {} }, affectedPaths: [],
    });

    handleDragEnd(project, {
      canceled: false,
      source: { id: 'field:email', data: { nodeRef: { bind: 'email' }, type: 'tree-node', index: 0 } },
      target: { id: 'drop:node:card-1', data: { type: 'container-drop', nodeRef: { nodeId: 'card-1' } } },
    }, null, vi.fn());

    expect(moveToContainer).toHaveBeenCalledWith({ bind: 'email' }, { nodeId: 'card-1' });
  });

  it('routes container-drop target with bind (bound layout container) to handleContainerDrop', () => {
    const project = makeProject();
    const moveToContainer = vi.spyOn(project, 'moveComponentNodeToContainer').mockReturnValue({
      summary: 'ok', action: { helper: 'moveComponentNodeToContainer', params: {} }, affectedPaths: [],
    });

    handleDragEnd(project, {
      canceled: false,
      source: { id: 'field:email', data: { nodeRef: { bind: 'email' }, type: 'tree-node', index: 0 } },
      target: { id: 'drop:bind:participants', data: { type: 'container-drop', nodeRef: { bind: 'participants' } } },
    }, null, vi.fn());

    expect(moveToContainer).toHaveBeenCalledWith({ bind: 'email' }, { bind: 'participants' });
  });

  it('skips when event is canceled', () => {
    const project = makeProject();
    const moveToIndex = vi.spyOn(project, 'moveComponentNodeToIndex').mockReturnValue({
      summary: 'ok', action: { helper: 'moveComponentNodeToIndex', params: {} }, affectedPaths: [],
    });

    handleDragEnd(project, {
      canceled: true,
      source: { id: 'field:email', data: { nodeRef: { bind: 'email' }, type: 'tree-node', index: 0 } },
      target: { id: 'slot:grid-1:0', data: { type: 'insert-slot', containerId: 'grid-1', insertIndex: 0 } },
    }, null, vi.fn());

    expect(moveToIndex).not.toHaveBeenCalled();
  });

  it('falls back to linear reorder when no insert-slot or container-drop target', () => {
    const project = makeProject();
    const reorder = vi.spyOn(project, 'reorderComponentNode').mockReturnValue({
      summary: 'ok', action: { helper: 'reorderComponentNode', params: {} }, affectedPaths: [],
    });

    handleDragEnd(project, {
      canceled: false,
      source: { id: 'field:email', data: { nodeRef: { bind: 'email' }, type: 'tree-node', index: 2 } },
      target: { id: 'field:name', data: { nodeRef: { bind: 'name' }, type: 'tree-node', index: 0 } },
    }, null, vi.fn());

    // source.index (2) > target.index (0) → direction 'up'
    expect(reorder).toHaveBeenCalledWith({ bind: 'email' }, 'up');
  });

  it('adds a tray item and then moves it into the hit insert slot', () => {
    const project = makeProject();
    const addItemToLayout = vi.spyOn(project, 'addItemToLayout').mockReturnValue({
      summary: 'ok',
      action: { helper: 'addItemToLayout', params: {} },
      affectedPaths: [],
      createdId: 'email',
    });
    const moveToIndex = vi.spyOn(project, 'moveComponentNodeToIndex').mockReturnValue({
      summary: 'ok', action: { helper: 'moveComponentNodeToIndex', params: {} }, affectedPaths: [],
    });
    const selectFn = vi.fn();

    handleDragEnd(project, {
      canceled: false,
      source: {
        id: 'unassigned:email',
        data: { type: 'unassigned-item', key: 'email', label: 'Email', itemType: 'field' },
      },
      target: {
        id: 'slot:grid-main:1',
        data: { type: 'insert-slot', containerId: 'grid-main', insertIndex: 1 },
      },
    }, 'page-1', selectFn);

    expect(addItemToLayout).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'email', label: 'Email', itemType: 'field' }),
      'page-1',
    );
    expect(moveToIndex).toHaveBeenCalledWith({ bind: 'email' }, 'grid-main', 1);
    expect(selectFn).toHaveBeenCalledWith('email', 'field', { tab: 'layout' });
  });

  it('does not call moveComponentNodeToIndex when source is the same container as the insert-slot target (avoids circular move)', () => {
    const stackId = 'stack_main';
    const tree = {
      component: 'Stack',
      nodeId: 'root',
      _layout: true,
      children: [
        {
          component: 'Stack',
          nodeId: stackId,
          _layout: true,
          children: [{ component: 'TextInput', bind: 'email' }],
        },
      ],
    };
    const moveToIndex = vi.fn();
    const project = {
      component: { tree },
      moveComponentNodeToIndex: moveToIndex,
      reorderComponentNode: vi.fn(),
      moveComponentNodeToContainer: vi.fn(),
      addItemToLayout: vi.fn(),
    } as unknown as Project;

    handleDragEnd(project, {
      canceled: false,
      source: { id: `node:${stackId}`, data: { nodeRef: { nodeId: stackId }, type: 'tree-node', index: 0 } },
      target: { id: `slot:${stackId}-0`, data: { type: 'insert-slot', containerId: stackId, insertIndex: 0 } },
    }, null, vi.fn());

    expect(moveToIndex).not.toHaveBeenCalled();
  });
});
