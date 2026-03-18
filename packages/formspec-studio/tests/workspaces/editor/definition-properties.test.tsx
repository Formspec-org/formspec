import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectionProvider } from '../../../src/state/useSelection';
import { ItemProperties } from '../../../src/workspaces/editor/ItemProperties';

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
          <ItemProperties />
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
});
