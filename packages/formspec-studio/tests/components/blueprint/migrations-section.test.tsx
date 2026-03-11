import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { MigrationsSection } from '../../../src/components/blueprint/MigrationsSection';

const migDef = {
  $formspec: '1.0', url: 'urn:test', version: '2.0.0',
  items: [],
  migrations: [
    {
      sourceVersion: '1.0.0',
      description: 'Rename field name to fullName',
      fieldMap: [
        { source: 'name', target: 'fullName', transform: 'rename' },
      ],
    },
  ],
};

describe('MigrationsSection', () => {
  it('renders migration entries', () => {
    const project = createProject({ seed: { definition: migDef as any } });
    render(<ProjectProvider project={project}><MigrationsSection /></ProjectProvider>);
    expect(screen.getByText(/1\.0\.0/)).toBeInTheDocument();
  });

  it('shows description', () => {
    const project = createProject({ seed: { definition: migDef as any } });
    render(<ProjectProvider project={project}><MigrationsSection /></ProjectProvider>);
    expect(screen.getByText(/rename field/i)).toBeInTheDocument();
  });

  it('shows field map rules', () => {
    const project = createProject({ seed: { definition: migDef as any } });
    render(<ProjectProvider project={project}><MigrationsSection /></ProjectProvider>);
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('fullName')).toBeInTheDocument();
  });

  it('shows empty state when no migrations', () => {
    const project = createProject();
    render(<ProjectProvider project={project}><MigrationsSection /></ProjectProvider>);
    expect(screen.getByText(/no migrations/i)).toBeInTheDocument();
  });
});
