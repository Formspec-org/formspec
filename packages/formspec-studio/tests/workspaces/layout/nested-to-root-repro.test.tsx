/** @filedesc Reproduction test for Nested-to-Root move crash/failure. */
import { describe, it, expect, vi } from 'vitest';
import { handleDragEnd } from '../../../src/workspaces/layout/layout-dnd-utils';
import { createProject, type Project } from '@formspec-org/studio-core';

describe('REGRESSION: Move from nested container to root', () => {
  it('correctly moves a node from a stack back to the root page', () => {
    const definition = { 
      $formspec: '1.0', url: 'urn:repro', version: '1.0.0',
      items: [
        { key: 'stack1', type: 'group', label: 'Stack', children: [
          { key: 'field1', type: 'field', dataType: 'string', label: 'Field 1' }
        ]},
        { key: 'field2', type: 'field', dataType: 'string', label: 'Field 2' }
      ] 
    };
    const project = createProject({ seed: { definition: definition as any } });
    
    const moveToIndex = vi.spyOn(project, 'moveComponentNodeToIndex').mockReturnValue({
      summary: 'ok', action: { helper: 'moveComponentNodeToIndex', params: {} }, affectedPaths: [],
    });

    handleDragEnd(project, {
      canceled: false,
      source: { id: 'field:field1', data: { nodeRef: { bind: 'field1' }, type: 'tree-node' } },
      target: { id: 'field:field2', data: { nodeRef: { bind: 'field2' }, type: 'tree-node' } },
      sortable: { 
        group: 'root', // Target group
        index: 1,      // Target index
        initialGroup: 'bind:stack1', // Source group
        initialIndex: 0 
      },
    }, null, vi.fn());

    // Verify it calls moveToIndex with the root parent
    expect(moveToIndex).toHaveBeenCalledWith({ bind: 'field1' }, { nodeId: 'root' }, 1);
  });
});
