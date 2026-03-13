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
  it('dispatches definition.setDefinitionProperty (not definition.setProperty) when title is changed', async () => {
    const { project } = renderDefinitionProperties();
    const spy = vi.spyOn(project, 'dispatch');

    const titleInput = screen.getByLabelText(/title/i);
    expect(titleInput).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(titleInput, { target: { value: 'New Title' } });
      fireEvent.blur(titleInput);
    });

    // Must dispatch the correct command — definition.setDefinitionProperty
    expect(spy).toHaveBeenCalledWith({
      type: 'definition.setDefinitionProperty',
      payload: { property: 'title', value: 'New Title' },
    });

    // Must NOT dispatch the wrong (non-existent) command definition.setProperty
    const wrongCalls = spy.mock.calls.filter(
      (call) => call[0]?.type === 'definition.setProperty'
    );
    expect(wrongCalls).toHaveLength(0);
  });

  it('sets title to null when cleared', async () => {
    const { project } = renderDefinitionProperties();
    const spy = vi.spyOn(project, 'dispatch');

    const titleInput = screen.getByLabelText(/title/i);

    await act(async () => {
      fireEvent.change(titleInput, { target: { value: '' } });
      fireEvent.blur(titleInput);
    });

    expect(spy).toHaveBeenCalledWith({
      type: 'definition.setDefinitionProperty',
      payload: { property: 'title', value: null },
    });
  });

  it('title change actually updates the project state', async () => {
    const { project } = renderDefinitionProperties();

    const titleInput = screen.getByLabelText(/title/i);

    await act(async () => {
      fireEvent.change(titleInput, { target: { value: 'Updated Form Title' } });
      fireEvent.blur(titleInput);
    });

    // State should have changed if the correct command was dispatched
    expect((project.definition as any).title).toBe('Updated Form Title');
  });
});
