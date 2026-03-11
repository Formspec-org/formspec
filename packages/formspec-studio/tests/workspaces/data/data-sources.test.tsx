import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
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
});
