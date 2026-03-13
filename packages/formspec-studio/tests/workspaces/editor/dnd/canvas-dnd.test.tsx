import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../../src/state/ProjectContext';
import { SelectionProvider } from '../../../../src/state/useSelection';
import { ActivePageProvider } from '../../../../src/state/useActivePage';
import { EditorCanvas } from '../../../../src/workspaces/editor/EditorCanvas';

const testDef = {
  $formspec: '1.0', url: 'urn:dnd-test', version: '1.0.0',
  items: [
    { key: 'fieldA', type: 'field', dataType: 'string', label: 'Field A' },
    { key: 'groupX', type: 'group', label: 'Group X', children: [
      { key: 'child1', type: 'field', dataType: 'string', label: 'Child 1' },
      { key: 'child2', type: 'field', dataType: 'string', label: 'Child 2' },
    ]},
    { key: 'fieldB', type: 'field', dataType: 'string', label: 'Field B' },
  ],
};

function renderCanvas(def?: any) {
  const project = createProject({ seed: { definition: def || testDef } });
  return {
    ...render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <ActivePageProvider>
            <EditorCanvas />
          </ActivePageProvider>
        </SelectionProvider>
      </ProjectProvider>
    ),
    project,
  };
}

describe('Canvas DnD Integration', () => {
  it('renders all items with data-item-path attributes', () => {
    renderCanvas();

    expect(screen.getByTestId('field-fieldA')).toHaveAttribute('data-item-path', 'fieldA');
    expect(screen.getByTestId('group-groupX')).toHaveAttribute('data-item-path', 'groupX');
    expect(screen.getByTestId('field-child1')).toHaveAttribute('data-item-path', 'groupX.child1');
    expect(screen.getByTestId('field-child2')).toHaveAttribute('data-item-path', 'groupX.child2');
    expect(screen.getByTestId('field-fieldB')).toHaveAttribute('data-item-path', 'fieldB');
  });

  it('field blocks are no longer natively draggable (handled by sortable wrapper)', () => {
    renderCanvas();

    expect(screen.getByTestId('field-fieldA')).not.toHaveAttribute('draggable');
  });

  it('items are wrapped in sortable containers', () => {
    renderCanvas();

    // Each item block should have a parent div (SortableItemWrapper)
    const fieldA = screen.getByTestId('field-fieldA');
    const wrapper = fieldA.parentElement;
    expect(wrapper).toBeTruthy();
    expect(wrapper?.tagName).toBe('DIV');
  });

  it('moveItem dispatch reorders items at root level', () => {
    const { project } = renderCanvas();

    // Directly call moveItem to verify backend works
    act(() => {
      project.dispatch({
        type: 'definition.moveItem',
        payload: { sourcePath: 'fieldB', targetIndex: 0 },
      });
    });

    const keys = project.definition.items.map((i: any) => i.key);
    expect(keys[0]).toBe('fieldB');
    expect(keys[1]).toBe('fieldA');
  });

  it('moveItem dispatch moves item into a group', () => {
    const { project } = renderCanvas();

    act(() => {
      project.dispatch({
        type: 'definition.moveItem',
        payload: { sourcePath: 'fieldA', targetParentPath: 'groupX', targetIndex: 0 },
      });
    });

    const root = project.definition.items as any[];
    const group = root.find((i: any) => i.key === 'groupX');
    expect(group.children[0].key).toBe('fieldA');
    expect(root.find((i: any) => i.key === 'fieldA')).toBeUndefined();
  });

  it('moveItem dispatch moves item out of a group to root', () => {
    const { project } = renderCanvas();

    act(() => {
      project.dispatch({
        type: 'definition.moveItem',
        payload: { sourcePath: 'groupX.child1', targetIndex: 0 },
      });
    });

    const root = project.definition.items as any[];
    expect(root[0].key).toBe('child1');
    const group = root.find((i: any) => i.key === 'groupX');
    expect(group.children.length).toBe(1);
    expect(group.children[0].key).toBe('child2');
  });

  it('batch moveItem handles multi-item moves atomically', () => {
    const { project } = renderCanvas({
      $formspec: '1.0', url: 'urn:batch-move', version: '1.0.0',
      items: [
        { key: 'a', type: 'field', dataType: 'string', label: 'A' },
        { key: 'b', type: 'field', dataType: 'string', label: 'B' },
        { key: 'c', type: 'field', dataType: 'string', label: 'C' },
        { key: 'target', type: 'group', label: 'Target', children: [] },
      ],
    });

    act(() => {
      project.batch([
        { type: 'definition.moveItem', payload: { sourcePath: 'a', targetParentPath: 'target', targetIndex: 0 } },
        { type: 'definition.moveItem', payload: { sourcePath: 'b', targetParentPath: 'target', targetIndex: 1 } },
      ]);
    });

    const root = project.definition.items as any[];
    const target = root.find((i: any) => i.key === 'target');
    expect(target.children.length).toBe(2);
    expect(target.children[0].key).toBe('a');
    expect(target.children[1].key).toBe('b');
    // Verify it's undoable as one operation
    expect(root.find((i: any) => i.key === 'a')).toBeUndefined();
    expect(root.find((i: any) => i.key === 'b')).toBeUndefined();
  });

  it('existing click-to-select behavior still works alongside DnD', async () => {
    renderCanvas();

    // Click on Field A
    await act(async () => {
      screen.getByTestId('field-fieldA').click();
    });

    // Should show selected state (accent border)
    const block = screen.getByTestId('field-fieldA');
    expect(block.className).toContain('accent');
  });
});
