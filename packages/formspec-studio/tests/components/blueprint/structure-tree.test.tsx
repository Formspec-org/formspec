import { render, screen, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectionProvider } from '../../../src/state/useSelection';
import { StructureTree } from '../../../src/components/blueprint/StructureTree';

const treeDef = {
  $formspec: '1.0', url: 'urn:test', version: '1.0.0',
  items: [
    { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
    { key: 'contact', type: 'group', label: 'Contact', children: [
      { key: 'email', type: 'field', dataType: 'string' },
      { key: 'phone', type: 'field', dataType: 'string' },
    ]},
    { key: 'notice', type: 'display', label: 'Notice' },
  ],
};

function renderTree() {
  const project = createProject({ seed: { definition: treeDef as any } });
  return render(
    <ProjectProvider project={project}>
      <SelectionProvider>
        <StructureTree />
      </SelectionProvider>
    </ProjectProvider>
  );
}

describe('StructureTree', () => {
  it('renders items as indented tree', () => {
    renderTree();
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('email')).toBeInTheDocument();
    expect(screen.getByText('phone')).toBeInTheDocument();
  });

  it('shows type icons', () => {
    renderTree();
    // Multiple string fields produce multiple Aa icons
    const icons = screen.getAllByText('Aa');
    expect(icons.length).toBeGreaterThanOrEqual(1);
  });

  it('shows group labels', () => {
    renderTree();
    expect(screen.getByText('Contact')).toBeInTheDocument();
  });

  it('selecting a node updates selection', async () => {
    renderTree();
    await act(async () => {
      screen.getByText('name').click();
    });
    // Node should have selected styling
    const node = screen.getByText('name').closest('[data-testid]');
    expect(node?.className).toContain('accent');
  });
});
