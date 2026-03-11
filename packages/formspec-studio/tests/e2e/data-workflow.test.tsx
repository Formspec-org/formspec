import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../src/state/ProjectContext';
import { SelectionProvider } from '../../src/state/useSelection';
import { DataTab } from '../../src/workspaces/data/DataTab';

function renderData(def: any) {
  const project = createProject({ seed: { definition: def } });
  return render(
    <ProjectProvider project={project}>
      <SelectionProvider>
        <DataTab />
      </SelectionProvider>
    </ProjectProvider>
  );
}

describe('Data Workflow', () => {
  it('renders response schema from definition items', () => {
    renderData({
      $formspec: '1.0', url: 'urn:test', version: '1.0.0', title: 'Test',
      items: [
        { key: 'name', type: 'field', dataType: 'string' },
        { key: 'age', type: 'field', dataType: 'integer' },
      ],
    });
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('age')).toBeInTheDocument();
  });

  it('renders complex nested schema', () => {
    renderData({
      $formspec: '1.0', url: 'urn:test', version: '1.0.0', title: 'Test',
      items: [
        { key: 'personal', type: 'group', label: 'Personal', children: [
          { key: 'first', type: 'field', dataType: 'string' },
          { key: 'last', type: 'field', dataType: 'string' },
        ]},
        { key: 'contact', type: 'group', label: 'Contact', children: [
          { key: 'email', type: 'field', dataType: 'string' },
        ]},
      ],
    });
    expect(screen.getByText('personal')).toBeInTheDocument();
    expect(screen.getByText('contact')).toBeInTheDocument();
    expect(screen.getByText('first')).toBeInTheDocument();
    expect(screen.getByText('email')).toBeInTheDocument();
  });
});
