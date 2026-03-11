import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../src/state/ProjectContext';
import { SelectionProvider } from '../../src/state/useSelection';
import { EditorCanvas } from '../../src/workspaces/editor/EditorCanvas';

describe('Import/Export', () => {
  it('import definition → renders in editor', () => {
    const importedDef = {
      $formspec: '1.0',
      url: 'urn:formspec:imported',
      version: '2.0.0',
      title: 'Imported Form',
      items: [
        { key: 'applicant', type: 'group', label: 'Applicant Info', children: [
          { key: 'firstName', type: 'field', dataType: 'string', label: 'First Name' },
          { key: 'lastName', type: 'field', dataType: 'string', label: 'Last Name' },
          { key: 'dob', type: 'field', dataType: 'date', label: 'Date of Birth' },
        ]},
        { key: 'income', type: 'field', dataType: 'money', label: 'Annual Income' },
        { key: 'disclaimer', type: 'display', label: 'Terms and Conditions' },
      ],
      binds: {
        'applicant.firstName': { required: 'true' },
        'applicant.lastName': { required: 'true' },
        income: { required: 'true' },
      },
    };

    const project = createProject({ seed: { definition: importedDef as any } });
    render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <EditorCanvas />
        </SelectionProvider>
      </ProjectProvider>
    );

    // Verify structure renders
    expect(screen.getByText('Applicant Info')).toBeInTheDocument();
    expect(screen.getByText('First Name')).toBeInTheDocument();
    expect(screen.getByText('Last Name')).toBeInTheDocument();
    expect(screen.getByText('Date of Birth')).toBeInTheDocument();
    expect(screen.getByText('Annual Income')).toBeInTheDocument();
    expect(screen.getByText('Terms and Conditions')).toBeInTheDocument();
  });

  it('export matches import', () => {
    const originalDef = {
      $formspec: '1.0', url: 'urn:test', version: '1.0.0', title: 'Test',
      items: [
        { key: 'name', type: 'field', dataType: 'string' },
        { key: 'age', type: 'field', dataType: 'integer' },
      ],
    };

    const project = createProject({ seed: { definition: originalDef as any } });

    // The exported state should contain the same definition
    const state = project.state;
    expect(state.definition.items).toHaveLength(2);
    expect(state.definition.items[0].key).toBe('name');
    expect(state.definition.items[1].key).toBe('age');
  });
});
