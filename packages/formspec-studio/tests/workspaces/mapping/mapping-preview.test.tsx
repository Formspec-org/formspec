import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { MappingPreview } from '../../../src/workspaces/mapping/MappingPreview';

function renderPreview() {
  const project = createProject({ seed: {
    definition: { $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [] } as any,
    mapping: { direction: 'outbound', rules: [] },
  }});
  return render(<ProjectProvider project={project}><MappingPreview /></ProjectProvider>);
}

describe('MappingPreview', () => {
  it('shows direction toggle', () => {
    renderPreview();
    expect(screen.getByText(/outbound/i)).toBeInTheDocument();
  });

  it('shows input and output panels', () => {
    renderPreview();
    expect(screen.getByText(/input/i)).toBeInTheDocument();
    expect(screen.getByText(/output/i)).toBeInTheDocument();
  });
});
