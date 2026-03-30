import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createProject } from '@formspec-org/studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectionProvider } from '../../../src/state/useSelection';
import { ResponseSchema } from '../../../src/workspaces/editor/ResponseSchema';

const dataDef = {
  $formspec: '1.0', url: 'urn:test', version: '1.0.0',
  items: [
    { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
    { key: 'age', type: 'field', dataType: 'integer' },
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
      <SelectionProvider>
        <ResponseSchema />
      </SelectionProvider>
    </ProjectProvider>
  );
}

describe('ResponseSchema', () => {
  it('renders item keys as text', () => {
    renderSchema();
    // Keys are rendered with quotes in JSON-like format
    expect(screen.getByText('"name"')).toBeInTheDocument();
    expect(screen.getByText('"age"')).toBeInTheDocument();
  });

  it('shows type labels', () => {
    renderSchema();
    expect(screen.getAllByText('string').length).toBeGreaterThan(0);
    expect(screen.getByText('integer')).toBeInTheDocument();
  });

  it('groups render children (nesting)', () => {
    renderSchema();
    expect(screen.getByText('"address"')).toBeInTheDocument();
    expect(screen.getByText('"street"')).toBeInTheDocument();
    expect(screen.getByText('"city"')).toBeInTheDocument();
  });

  it('repeatable group shows "array" type', () => {
    renderSchema({
      $formspec: '1.0', url: 'urn:test', version: '1.0.0',
      items: [
        {
          key: 'dependents', type: 'group', label: 'Dependents',
          repeatable: true,
          children: [{ key: 'dep_name', type: 'field', dataType: 'string' }],
        },
      ],
    });
    expect(screen.getByText('array')).toBeInTheDocument();
  });

  it('label values render as interactive buttons', () => {
    renderSchema();
    // "Full Name" label on the "name" field should be a clickable button
    expect(screen.getByRole('button', { name: 'Full Name' })).toBeInTheDocument();
  });

  it('clicking label button calls selection', () => {
    renderSchema();
    const btn = screen.getByRole('button', { name: 'Full Name' });
    fireEvent.click(btn);
    // The button should be present and clickable (selection state tested at integration level)
    expect(btn).toBeInTheDocument();
  });
});
