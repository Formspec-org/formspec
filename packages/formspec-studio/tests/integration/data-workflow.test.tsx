import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from '@formspec-org/studio-core';
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

const baseDef = {
  $formspec: '1.0', url: 'urn:test', version: '1.0.0', title: 'Test',
};

describe('DataTab', () => {
  it('renders all three pillars when filter is "all"', () => {
    renderData({
      ...baseDef,
      items: [{ key: 'name', type: 'field', dataType: 'string' }],
      optionSets: { colors: { options: [{ value: 'red', label: 'Red' }] } },
      instances: { api: { source: 'https://api.example.com' } },
    });
    // Pillar titles are rendered as h3 headings
    expect(screen.getByText('Submission Structure')).toBeInTheDocument();
    expect(screen.getByText('Lookup Tables')).toBeInTheDocument();
    expect(screen.getByText('External Sources')).toBeInTheDocument();
  });

  it('section filter buttons work — clicking Sources hides other pillars', () => {
    renderData({
      ...baseDef,
      items: [{ key: 'name', type: 'field', dataType: 'string' }],
    });
    fireEvent.click(screen.getByRole('button', { name: /^sources$/i }));
    expect(screen.getByText('External Sources')).toBeInTheDocument();
    expect(screen.queryByText('Submission Structure')).not.toBeInTheDocument();
    expect(screen.queryByText('Lookup Tables')).not.toBeInTheDocument();
  });

  it('renders response schema item keys from definition', () => {
    renderData({
      ...baseDef,
      items: [
        { key: 'name', type: 'field', dataType: 'string' },
        { key: 'age', type: 'field', dataType: 'integer' },
      ],
    });
    // OutputBlueprint renders keys with quotes: "name"
    expect(screen.getByText('"name"')).toBeInTheDocument();
    expect(screen.getByText('"age"')).toBeInTheDocument();
  });

  it('nested groups render children', () => {
    renderData({
      ...baseDef,
      items: [
        {
          key: 'personal', type: 'group', label: 'Personal', children: [
            { key: 'first', type: 'field', dataType: 'string' },
            { key: 'last', type: 'field', dataType: 'string' },
          ],
        },
        {
          key: 'contact', type: 'group', label: 'Contact', children: [
            { key: 'email', type: 'field', dataType: 'string' },
          ],
        },
      ],
    });
    expect(screen.getByText('"personal"')).toBeInTheDocument();
    expect(screen.getByText('"contact"')).toBeInTheDocument();
    expect(screen.getByText('"first"')).toBeInTheDocument();
    expect(screen.getByText('"email"')).toBeInTheDocument();
  });
});
