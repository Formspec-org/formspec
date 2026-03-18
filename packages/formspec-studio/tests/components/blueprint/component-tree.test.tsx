import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectionProvider } from '../../../src/state/useSelection';
import { ComponentTree } from '../../../src/components/blueprint/ComponentTree';

const compDoc = {
  targetDefinition: { url: 'urn:test' },
  tree: {
    component: 'Stack', nodeId: 'root', children: [
      { component: 'Page', nodeId: 'node_1', children: [
        { component: 'TextInput', bind: 'name' },
        { component: 'TextInput', bind: 'email' },
      ]},
      { component: 'Button', nodeId: 'node_2' },
    ]
  },
};

function renderCompTree() {
  const project = createProject({ seed: {
    definition: { $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [] } as any,
    component: compDoc as any,
  }});
  return render(
    <ProjectProvider project={project}>
      <SelectionProvider>
        <ComponentTree />
      </SelectionProvider>
    </ProjectProvider>
  );
}

describe('ComponentTree', () => {
  it('renders component nodes', () => {
    renderCompTree();
    expect(screen.getByText(/Stack/i)).toBeInTheDocument();
    expect(screen.getByText(/Page/i)).toBeInTheDocument();
  });

  it('shows bind key on input nodes', () => {
    renderCompTree();
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('email')).toBeInTheDocument();
  });

  it('shows node type labels', () => {
    renderCompTree();
    expect(screen.getAllByText(/TextInput/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Button/)).toBeInTheDocument();
  });

  it('shows empty state when no tree', () => {
    const project = createProject({ seed: {
      definition: { $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [] } as any,
      component: { targetDefinition: { url: 'urn:test' } } as any,
    }});
    render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <ComponentTree />
        </SelectionProvider>
      </ProjectProvider>
    );
    expect(screen.getByText(/no component tree/i)).toBeInTheDocument();
  });
});
