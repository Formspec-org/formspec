/** @filedesc Ensures tree-node fallback does not move when the resolved parent has no matching child (index -1). */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@formspec-org/studio-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@formspec-org/studio-core')>();
  return {
    ...actual,
    findParentOfNodeRef: vi.fn(),
  };
});

import { handleDragEnd } from '../../../src/workspaces/layout/dnd/layout-dnd-utils';
import * as studioCore from '@formspec-org/studio-core';
import type { Project } from '@formspec-org/studio-core';

describe('handleDragEnd — tree-node fallback when child index is missing', () => {
  beforeEach(() => {
    vi.mocked(studioCore.findParentOfNodeRef).mockReturnValue({
      component: 'Stack',
      nodeId: 'root',
      children: [{ component: 'TextInput', bind: 'name' }],
    } as import('@formspec-org/studio-core').CompNode);
  });

  afterEach(() => {
    vi.mocked(studioCore.findParentOfNodeRef).mockReset();
  });

  it('does not call moveComponentNodeToIndex when target ref is not among parent.children', () => {
    const tree = { component: 'Stack', nodeId: 'root', children: [] };
    const moveToIndex = vi.fn();
    const project = {
      component: { tree },
      moveComponentNodeToIndex: moveToIndex,
      moveComponentNodeToContainer: vi.fn(),
    } as unknown as Project;

    handleDragEnd(
      project,
      {
        canceled: false,
        source: { id: 'field:email', data: { nodeRef: { bind: 'email' }, type: 'tree-node' } },
        target: { id: 'field:ghost', data: { nodeRef: { bind: 'ghost' }, type: 'tree-node' } },
      },
      null,
      vi.fn(),
    );

    expect(moveToIndex).not.toHaveBeenCalled();
  });
});
