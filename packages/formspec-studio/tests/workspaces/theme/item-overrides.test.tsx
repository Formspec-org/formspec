import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { ItemOverrides } from '../../../src/workspaces/theme/ItemOverrides';

const themeDoc = {
  targetDefinition: { url: 'urn:test' },
  items: {
    name: { widget: 'input', labelPosition: 'left' },
    email: { widget: 'email-input' },
  },
};

describe('ItemOverrides', () => {
  it('renders item override entries', () => {
    const project = createProject({ seed: {
      definition: { $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [] } as any,
      theme: themeDoc
    }});
    render(<ProjectProvider project={project}><ItemOverrides /></ProjectProvider>);
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('email')).toBeInTheDocument();
  });

  it('shows override properties', () => {
    const project = createProject({ seed: {
      definition: { $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [] } as any,
      theme: themeDoc
    }});
    render(<ProjectProvider project={project}><ItemOverrides /></ProjectProvider>);
    expect(screen.getAllByText(/input/).length).toBeGreaterThan(0);
  });
});
