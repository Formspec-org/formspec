import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectionProvider } from '../../../src/state/useSelection';
import { DataSources } from '../../../src/workspaces/data/DataSources';

const dataDef = {
  $formspec: '1.0', url: 'urn:test', version: '1.0.0',
  items: [],
  instances: [
    { name: 'counties', source: 'https://api.example.com/counties' },
    { name: 'states', source: 'https://api.example.com/states' },
  ],
};

function renderDS(def?: any) {
  const project = createProject({ seed: { definition: def || dataDef } });
  return {
    ...render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <DataSources />
        </SelectionProvider>
      </ProjectProvider>
    ),
    project,
  };
}

describe('DataSources', () => {
  it('renders instance cards', () => {
    renderDS();
    expect(screen.getByText('counties')).toBeInTheDocument();
    expect(screen.getByText('states')).toBeInTheDocument();
  });

  it('shows source URL', () => {
    renderDS();
    expect(screen.getByText(/api.example.com\/counties/)).toBeInTheDocument();
  });

  it('shows empty state when no instances', () => {
    renderDS({ $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [] });
    expect(screen.getByText(/no data sources/i)).toBeInTheDocument();
  });

  it('adds a data source via prompt flow', async () => {
    const { project } = renderDS({ $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [] });
    const spy = vi.spyOn(project, 'dispatch');
    const promptSpy = vi.spyOn(window, 'prompt')
      .mockReturnValueOnce('counties')
      .mockReturnValueOnce('https://api.example.com/counties');

    await act(async () => {
      screen.getByRole('button', { name: /add data source/i }).click();
    });

    expect(spy).toHaveBeenCalledWith({
      type: 'definition.addInstance',
      payload: { name: 'counties', source: 'https://api.example.com/counties' },
    });
    promptSpy.mockRestore();
  });

});
