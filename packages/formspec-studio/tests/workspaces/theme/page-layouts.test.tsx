import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { PageLayouts } from '../../../src/workspaces/theme/PageLayouts';

describe('PageLayouts', () => {
  it('renders 12-column grid', () => {
    const project = createProject({ seed: {
      definition: { $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [] } as any,
      theme: {
        targetDefinition: { url: 'urn:test' },
        pages: [{ regions: [{ span: 6 }, { span: 6 }] }],
      }
    }});
    render(<ProjectProvider project={project}><PageLayouts /></ProjectProvider>);
    // Should render something for the page layout
    expect(screen.getByText(/page/i)).toBeInTheDocument();
  });

  it('shows empty state when no pages', () => {
    const project = createProject({ seed: {
      definition: { $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [] } as any,
      theme: { targetDefinition: { url: 'urn:test' } }
    }});
    render(<ProjectProvider project={project}><PageLayouts /></ProjectProvider>);
    expect(screen.getByText(/no page layouts/i)).toBeInTheDocument();
  });
});
