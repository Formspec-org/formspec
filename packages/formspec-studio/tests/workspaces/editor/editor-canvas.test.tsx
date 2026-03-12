import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectionProvider } from '../../../src/state/useSelection';
import { EditorCanvas } from '../../../src/workspaces/editor/EditorCanvas';

const testDef = {
  $formspec: '1.0', url: 'urn:test', version: '1.0.0',
  items: [
    { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
    { key: 'contact', type: 'group', label: 'Contact Info', children: [
      { key: 'email', type: 'field', dataType: 'string', label: 'Email' },
      { key: 'phone', type: 'field', dataType: 'string', label: 'Phone' },
    ]},
    { key: 'notice', type: 'display', label: 'Important Notice' },
  ],
  binds: {
    name: { required: 'true' },
    'contact.email': { calculate: '$name + "@example.com"' },
  },
};

function renderCanvas(def?: any) {
  const project = createProject({ seed: { definition: def || testDef } });
  return {
    ...render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <EditorCanvas />
        </SelectionProvider>
      </ProjectProvider>
    ),
    project,
  };
}

describe('EditorCanvas', () => {
  it('renders field blocks with labels', () => {
    renderCanvas();
    expect(screen.getByText('Full Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('renders group headers', () => {
    renderCanvas();
    expect(screen.getByText('Contact Info')).toBeInTheDocument();
  });

  it('renders display blocks', () => {
    renderCanvas();
    expect(screen.getByText('Important Notice')).toBeInTheDocument();
  });

  it('clicking a block selects it', async () => {
    renderCanvas();
    await act(async () => {
      (screen.getByText('Full Name').closest('[data-testid]') as HTMLElement)?.click();
    });
    // Selected block should have visual indicator
    const block = screen.getByText('Full Name').closest('[data-testid]');
    expect(block?.className).toContain('accent');
  });

  it('shows bind pills on fields', () => {
    renderCanvas();
    // name has required bind
    expect(screen.getByText('req')).toBeInTheDocument();
  });
});
