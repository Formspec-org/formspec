import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { ResponseSchema } from '../../../src/workspaces/data/ResponseSchema';

const dataDef = {
  $formspec: '1.0', url: 'urn:test', version: '1.0.0',
  items: [
    { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
    { key: 'address', type: 'group', label: 'Address', children: [
      { key: 'street', type: 'field', dataType: 'string' },
      { key: 'city', type: 'field', dataType: 'string' },
    ]},
  ],
};

function renderSchema(def?: any) {
  const project = createProject({ seed: { definition: def || dataDef } });
  return render(
    <ProjectProvider project={project}>
      <ResponseSchema />
    </ProjectProvider>
  );
}

describe('ResponseSchema', () => {
  it('renders table with key and type columns', () => {
    renderSchema();
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getAllByText('string').length).toBeGreaterThan(0);
  });

  it('shows groups with nesting', () => {
    renderSchema();
    expect(screen.getByText('address')).toBeInTheDocument();
    expect(screen.getByText('street')).toBeInTheDocument();
  });

  it('shows repeatable group type as array', () => {
    renderSchema({
      $formspec: '1.0',
      url: 'urn:test',
      version: '1.0.0',
      items: [
        {
          key: 'dependents',
          type: 'group',
          label: 'Dependents',
          repeatable: true,
          children: [{ key: 'name', type: 'field', dataType: 'string' }],
        },
      ],
    });
    expect(screen.getByText(/array/i)).toBeInTheDocument();
  });

  it('renders label values as interactive controls', () => {
    renderSchema();
    expect(screen.getByRole('button', { name: 'Full Name' })).toBeInTheDocument();
  });
});
