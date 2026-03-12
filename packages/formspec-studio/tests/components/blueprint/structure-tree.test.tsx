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
    // Check by test-id instead of text, as text might be label instead of key
    expect(screen.getByTestId('tree-item-name')).toBeInTheDocument();
    expect(screen.getByTestId('tree-item-contact.email')).toBeInTheDocument();
    expect(screen.getByTestId('tree-item-contact.phone')).toBeInTheDocument();
  });

  it('shows type icons', () => {
    renderTree();
    // Multiple string fields produce multiple Aa icons
    const icons = screen.getAllByText('Aa');
    expect(icons.length).toBeGreaterThanOrEqual(1);
  });

  it('shows labels', () => {
    renderTree();
    // Group label "Contact" appears twice (Pages and Items), use getAllByText
    expect(screen.getAllByText('Contact').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Full Name')).toBeInTheDocument();
  });

  it('selecting a node updates selection', async () => {
    renderTree();
    const node = screen.getByTestId('tree-item-name');
    await act(async () => {
      node.click();
    });
    // Node should have selected styling (bg-accent/10 text-accent)
    expect(node.className).toContain('text-accent');
  });
});
