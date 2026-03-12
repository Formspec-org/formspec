import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectionProvider } from '../../../src/state/useSelection';
import { OptionSets } from '../../../src/workspaces/data/OptionSets';

const dataDef = {
  $formspec: '1.0', url: 'urn:test', version: '1.0.0',
  items: [
    { key: 'color', type: 'field', dataType: 'select1', optionSet: 'colors' },
  ],
  optionSets: {
    colors: { options: [
      { value: 'red', label: 'Red' },
      { value: 'blue', label: 'Blue' },
    ]},
  },
};

describe('OptionSets', () => {
  it('renders option set cards', () => {
    const project = createProject({ seed: { definition: dataDef as any } });
    render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <OptionSets />
        </SelectionProvider>
      </ProjectProvider>
    );
    expect(screen.getByText('colors')).toBeInTheDocument();
  });

  it('shows option values', () => {
    const project = createProject({ seed: { definition: dataDef as any } });
    render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <OptionSets />
        </SelectionProvider>
      </ProjectProvider>
    );
    expect(screen.getByText('Red')).toBeInTheDocument();
    expect(screen.getByText('Blue')).toBeInTheDocument();
  });

  it('shows used-by count', () => {
    const project = createProject({ seed: { definition: dataDef as any } });
    render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <OptionSets />
        </SelectionProvider>
      </ProjectProvider>
    );
    expect(screen.getByText(/used by 1/i)).toBeInTheDocument();
  });

  it('renders each option set card as an editable control', () => {
    const project = createProject({ seed: { definition: dataDef as any } });
    render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <OptionSets />
        </SelectionProvider>
      </ProjectProvider>
    );
    expect(screen.getByRole('button', { name: /colors/i })).toBeInTheDocument();
  });

  it('uses accessible contrast styling for option chips', () => {
    const project = createProject({ seed: { definition: dataDef as any } });
    render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <OptionSets />
        </SelectionProvider>
      </ProjectProvider>
    );
    expect(screen.getByText('Red')).toHaveClass(/text-(ink|surface|white)/);
  });
});
