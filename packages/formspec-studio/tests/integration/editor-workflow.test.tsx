import { render, screen, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject, type Project } from 'formspec-studio-core';
import { ProjectProvider } from '../../src/state/ProjectContext';
import { SelectionProvider } from '../../src/state/useSelection';
import { EditorCanvas } from '../../src/workspaces/editor/EditorCanvas';

function renderEditor(project: Project) {
  return render(
    <ProjectProvider project={project}>
      <SelectionProvider>
        <EditorCanvas />
      </SelectionProvider>
    </ProjectProvider>
  );
}

describe('Editor Workflow', () => {
  it('add field → appears in canvas', () => {
    const project = createProject();
    renderEditor(project);

    act(() => {
      project.dispatch({
        type: 'definition.addItem',
        payload: { key: 'firstName', type: 'field', dataType: 'string' }
      });
    });

    expect(screen.getByTestId('field-firstName')).toBeInTheDocument();
  });

  it('add multiple fields → all appear', () => {
    const project = createProject();
    renderEditor(project);

    act(() => {
      project.dispatch({
        type: 'definition.addItem',
        payload: { key: 'first', type: 'field', dataType: 'string' }
      });
      project.dispatch({
        type: 'definition.addItem',
        payload: { key: 'last', type: 'field', dataType: 'string' }
      });
      project.dispatch({
        type: 'definition.addItem',
        payload: { key: 'age', type: 'field', dataType: 'integer' }
      });
    });

    expect(screen.getByTestId('field-first')).toBeInTheDocument();
    expect(screen.getByTestId('field-last')).toBeInTheDocument();
    expect(screen.getByTestId('field-age')).toBeInTheDocument();
  });

  it('add group with children → nested structure', () => {
    const project = createProject({
      seed: {
        definition: {
          $formspec: '1.0', url: 'urn:test', version: '1.0.0', title: 'Test',
          items: [
            { key: 'contact', type: 'group', label: 'Contact', children: [
              { key: 'email', type: 'field', dataType: 'string' },
            ]},
          ],
        } as any,
      },
    });
    renderEditor(project);

    expect(screen.getByText('Contact')).toBeInTheDocument();
    expect(screen.getByTestId('group-contact')).toBeInTheDocument();
    expect(screen.getByTestId('field-email')).toBeInTheDocument();
  });
});
