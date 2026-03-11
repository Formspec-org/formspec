import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectionProvider } from '../../../src/state/useSelection';
import { ComponentTree } from '../../../src/components/blueprint/ComponentTree';

const compDoc = {
  targetDefinition: { url: 'urn:test' },
  tree: {
    type: 'page', children: [
      { type: 'section', props: { title: 'Personal' }, children: [
        { type: 'text-input', props: { bind: 'name' } },
        { type: 'email-input', props: { bind: 'email' } },
      ]},
      { type: 'button', props: { label: 'Submit' } },
    ]
  },
};

function renderCompTree() {
  const project = createProject({ seed: {
    definition: { $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [] } as any,
    component: compDoc,
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
    expect(screen.getByText(/page/i)).toBeInTheDocument();
    expect(screen.getByText(/section/i)).toBeInTheDocument();
  });

  it('shows bind key on input nodes', () => {
    renderCompTree();
    // Bind keys appear as exact text in muted spans
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('email')).toBeInTheDocument();
  });

  it('shows node type labels', () => {
    renderCompTree();
    expect(screen.getByText(/text-input/)).toBeInTheDocument();
    expect(screen.getByText(/button/)).toBeInTheDocument();
  });

  it('shows empty state when no tree', () => {
    const project = createProject({ seed: {
      definition: { $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [] } as any,
      component: { targetDefinition: { url: 'urn:test' } },
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
