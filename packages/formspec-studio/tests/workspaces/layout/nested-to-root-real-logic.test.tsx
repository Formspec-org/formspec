/** @filedesc Reproduction test for Nested-to-Root move crash/failure using REAL project logic. */
import { describe, it, expect, vi } from 'vitest';
import { handleDragEnd } from '../../../src/workspaces/layout/layout-dnd-utils';
import { createProject } from '@formspec-org/studio-core';

describe('REAL LOGIC REGRESSION: Move from nested container to root', () => {
  it('does not throw when moving a node from a stack back to the root page using real studio-core logic', async () => {
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
    
    // Ensure WASM/engine is initialized if needed, though studio-core usually handles it or uses JS fallback for simple moves.
    // Actually moveComponentNodeToIndex is a pure tree manipulation.

    expect(() => {
      handleDragEnd(project, {
        canceled: false,
        source: { id: 'field:field1', data: { nodeRef: { bind: 'field1' }, type: 'tree-node' } },
        target: { id: 'field:field2', data: { nodeRef: { bind: 'field2' }, type: 'tree-node' } },
        sortable: { 
          group: 'root', 
          index: 1,      
          initialGroup: 'bind:stack1', 
          initialIndex: 0 
        },
      }, null, vi.fn());
    }).not.toThrow();

    const tree = project.component.tree as any;
    // expect field1 to be at root index 1 (after field2?) 
    // Wait, the test setup had field2 at index 1 originally (stack1 at 0).
    // If we move to index 1, field1 should follow field2? 
    // Actually stack1 was at 0, field2 at 1. Move field1 to 1.
    // Result: stack1 (0), field1 (1), field2 (2).
    
    expect(tree.children[1].bind).toBe('field1');
    expect(tree.children[0].children.length).toBe(0);
  });
});
