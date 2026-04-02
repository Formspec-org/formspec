import { render, screen, act, fireEvent } from '@testing-library/react';
import { useEffect } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { createProject } from '@formspec-org/studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectionProvider, useSelection } from '../../../src/state/useSelection';
import { EditorPropertiesPanel } from '../../../src/workspaces/editor/properties/EditorPropertiesPanel';

const testDef = {
  $formspec: '1.0',
  url: 'urn:test',
  version: '1.0.0',
  title: 'My Form',
  status: 'draft',
  items: [],
};

function renderDefinitionProperties() {
  const project = createProject({ seed: { definition: testDef as any } });
  return {
    ...render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <EditorPropertiesPanel />
        </SelectionProvider>
      </ProjectProvider>
    ),
    project,
  };
}

function renderSelectedProperties(definition: any, path: string, type: string) {
  const project = createProject({ seed: { definition } });

  function SelectOnMount() {
    const { select } = useSelection();
    useEffect(() => {
      select(path, type, { tab: 'editor' });
    }, [select]);
    return null;
  }

  return {
    ...render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <SelectOnMount />
          <EditorPropertiesPanel />
        </SelectionProvider>
      </ProjectProvider>
    ),
    project,
  };
}

describe('DefinitionProperties', () => {
  it('calls project.setMetadata when title is changed', async () => {
    const { project } = renderDefinitionProperties();
    const spy = vi.spyOn(project, 'setMetadata');

    const titleInput = screen.getByLabelText(/title/i);
    expect(titleInput).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(titleInput, { target: { value: 'New Title' } });
      fireEvent.blur(titleInput);
    });

    // DefinitionProperties calls project.setMetadata({ title: value })
    expect(spy).toHaveBeenCalledWith({ title: 'New Title' });
  });

  it('sets title to null when cleared', async () => {
    const { project } = renderDefinitionProperties();
    const spy = vi.spyOn(project, 'setMetadata');

    const titleInput = screen.getByLabelText(/title/i);

    await act(async () => {
      fireEvent.change(titleInput, { target: { value: '' } });
      fireEvent.blur(titleInput);
    });

    // DefinitionProperties calls project.setMetadata({ title: null }) for empty string
    expect(spy).toHaveBeenCalledWith({ title: null });
  });

  it('title change actually updates the project state', async () => {
    const { project } = renderDefinitionProperties();

    const titleInput = screen.getByLabelText(/title/i);

    await act(async () => {
      fireEvent.change(titleInput, { target: { value: 'Updated Form Title' } });
      fireEvent.blur(titleInput);
    });

    // State should have changed if the correct command was dispatched
    expect(project.definition.title).toBe('Updated Form Title');
  });

  it('shows the selected item path in the inspector header', () => {
    renderSelectedProperties({
      ...testDef,
      items: [{
        key: 'applicant',
        type: 'group',
        label: 'Applicant',
        children: [
          { key: 'fullName', type: 'field', dataType: 'string', label: 'Full Name' },
        ],
      }],
    }, 'applicant.fullName', 'field');

    expect(screen.getByTestId('properties-selection-path')).toHaveTextContent('applicant / fullName');
  });
});
