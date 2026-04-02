import { render, screen, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from '@formspec-org/studio-core';
import { ProjectProvider } from '../../src/state/ProjectContext';
import { SelectionProvider } from '../../src/state/useSelection';
import { DefinitionTreeEditor } from '../../src/workspaces/editor/DefinitionTreeEditor';

function renderWithProject() {
  const project = createProject();
  return {
    ...render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <DefinitionTreeEditor />
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
      project.addField('test', 'Test', 'string');
    });
    expect(screen.getByTestId('field-test')).toBeInTheDocument();

    act(() => { project.undo(); });
    expect(screen.queryByTestId('field-test')).not.toBeInTheDocument();
  });

  it('dispatch → undo → redo → verify restore', () => {
    const { project } = renderWithProject();

    act(() => {
      project.addField('test', 'Test', 'string');
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
      project.addField('a', 'A', 'string');
    });
    act(() => {
      project.addField('b', 'B', 'string');
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
