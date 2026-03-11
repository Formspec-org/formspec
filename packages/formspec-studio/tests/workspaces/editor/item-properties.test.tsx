import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createProject, type Project } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectionProvider, useSelection } from '../../../src/state/useSelection';
import { ItemProperties } from '../../../src/workspaces/editor/ItemProperties';

const testDef = {
  $formspec: '1.0', url: 'urn:test', version: '1.0.0',
  items: [
    { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
    { key: 'group1', type: 'group', label: 'Section', children: [
      { key: 'email', type: 'field', dataType: 'string' },
    ]},
  ],
  binds: [{ path: 'name', required: 'true' }],
};

function SelectAndInspect({ path, type }: { path: string; type: string }) {
  const { select } = useSelection();
  return (
    <>
      <button onClick={() => select(path, type)}>Select</button>
      <ItemProperties />
    </>
  );
}

function renderProps(project?: Project) {
  const p = project ?? createProject({ seed: { definition: testDef as any } });
  return {
    ...render(
      <ProjectProvider project={p}>
        <SelectionProvider>
          <SelectAndInspect path="name" type="field" />
        </SelectionProvider>
      </ProjectProvider>
    ),
    project: p,
  };
}

describe('ItemProperties', () => {
  it('shows empty state when nothing selected', () => {
    const project = createProject({ seed: { definition: testDef as any } });
    render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <ItemProperties />
        </SelectionProvider>
      </ProjectProvider>
    );
    expect(screen.getByText(/select an item/i)).toBeInTheDocument();
  });

  it('shows item details when selected', async () => {
    renderProps();
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByDisplayValue('name')).toBeInTheDocument();
    expect(screen.getByText(/string/i)).toBeInTheDocument();
  });

  it('dispatches rename on key change', async () => {
    const { project } = renderProps();
    const spy = vi.spyOn(project, 'dispatch');

    await act(async () => { screen.getByText('Select').click(); });

    const input = screen.getByDisplayValue('name');
    await act(async () => {
      // Simulate changing the key
      (input as HTMLInputElement).value = 'fullName';
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Should dispatch on blur
    await act(async () => {
      input.dispatchEvent(new Event('blur', { bubbles: true }));
    });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'definition.renameItem' })
    );
  });

  it('shows delete button', async () => {
    renderProps();
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  it('shows duplicate button', async () => {
    renderProps();
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByRole('button', { name: /duplicate/i })).toBeInTheDocument();
  });
});
