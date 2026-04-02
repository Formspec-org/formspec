/** @filedesc Tests for LayoutDndProvider drop handler logic — asserts project API is used, not core.dispatch. */
import { describe, it, expect, vi } from 'vitest';
import { handleTrayDrop, handleTreeReorder } from '../../../src/workspaces/layout/LayoutDndProvider';
import { createProject } from '@formspec-org/studio-core';

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
