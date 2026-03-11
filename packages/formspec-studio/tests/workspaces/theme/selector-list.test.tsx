import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectorList } from '../../../src/workspaces/theme/SelectorList';

const themeDoc = {
  targetDefinition: { url: 'urn:test' },
  selectors: [
    { match: { type: 'field', dataType: 'string' }, properties: { widget: 'textarea' } },
    { match: { type: 'field', dataType: 'integer' }, properties: { widget: 'slider' } },
  ],
};

describe('SelectorList', () => {
  it('renders selector cards', () => {
    const project = createProject({ seed: {
      definition: { $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [] } as any,
      theme: themeDoc
    }});
    render(<ProjectProvider project={project}><SelectorList /></ProjectProvider>);
    expect(screen.getByText(/string/)).toBeInTheDocument();
    expect(screen.getByText(/integer/)).toBeInTheDocument();
  });

  it('shows match criteria', () => {
    const project = createProject({ seed: {
      definition: { $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [] } as any,
      theme: themeDoc
    }});
    render(<ProjectProvider project={project}><SelectorList /></ProjectProvider>);
    expect(screen.getByText(/textarea/)).toBeInTheDocument();
  });
});
