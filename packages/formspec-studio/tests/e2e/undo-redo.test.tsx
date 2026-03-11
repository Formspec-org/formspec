import { render, screen, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../src/state/ProjectContext';
import { SelectionProvider } from '../../src/state/useSelection';
import { EditorCanvas } from '../../src/workspaces/editor/EditorCanvas';

function renderWithProject() {
  const project = createProject();
  return {
    ...render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <EditorCanvas />
        </SelectionProvider>
      </ProjectProvider>
    ),
    project,
  };
}

describe('Undo/Redo', () => {
  it('dispatch → undo → verify rollback', () => {
    const { project } = renderWithProject();

    act(() => {
      project.dispatch({
        type: 'definition.addItem',
        payload: { key: 'test', type: 'field', dataType: 'string' }
      });
    });
    expect(screen.getByTestId('field-test')).toBeInTheDocument();

    act(() => { project.undo(); });
    expect(screen.queryByTestId('field-test')).not.toBeInTheDocument();
  });

  it('dispatch → undo → redo → verify restore', () => {
    const { project } = renderWithProject();

    act(() => {
      project.dispatch({
        type: 'definition.addItem',
        payload: { key: 'test', type: 'field', dataType: 'string' }
      });
    });
    expect(screen.getByTestId('field-test')).toBeInTheDocument();

    act(() => { project.undo(); });
    expect(screen.queryByTestId('field-test')).not.toBeInTheDocument();

    act(() => { project.redo(); });
    expect(screen.getByTestId('field-test')).toBeInTheDocument();
  });

  it('multiple dispatches → multiple undos', () => {
    const { project } = renderWithProject();

    act(() => {
      project.dispatch({ type: 'definition.addItem', payload: { key: 'a', type: 'field', dataType: 'string' } });
    });
    act(() => {
      project.dispatch({ type: 'definition.addItem', payload: { key: 'b', type: 'field', dataType: 'string' } });
    });

    expect(screen.getByTestId('field-a')).toBeInTheDocument();
    expect(screen.getByTestId('field-b')).toBeInTheDocument();

    act(() => { project.undo(); });
    expect(screen.getByTestId('field-a')).toBeInTheDocument();
    expect(screen.queryByTestId('field-b')).not.toBeInTheDocument();

    act(() => { project.undo(); });
    expect(screen.queryByTestId('field-a')).not.toBeInTheDocument();
  });
});
