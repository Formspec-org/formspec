import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../src/state/ProjectContext';
import { ImportDialog } from '../../src/components/ImportDialog';

describe('ImportDialog', () => {
  it('shows import instructions when open', () => {
    const project = createProject();
    render(
      <ProjectProvider project={project}>
        <ImportDialog open={true} onClose={vi.fn()} />
      </ProjectProvider>
    );
    expect(screen.getByText(/import/i)).toBeInTheDocument();
  });

  it('shows artifact type options', () => {
    const project = createProject();
    render(
      <ProjectProvider project={project}>
        <ImportDialog open={true} onClose={vi.fn()} />
      </ProjectProvider>
    );
    expect(screen.getByText(/definition/i)).toBeInTheDocument();
    expect(screen.getByText(/component/i)).toBeInTheDocument();
    expect(screen.getByText(/theme/i)).toBeInTheDocument();
    expect(screen.getByText(/mapping/i)).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    const project = createProject();
    render(
      <ProjectProvider project={project}>
        <ImportDialog open={false} onClose={vi.fn()} />
      </ProjectProvider>
    );
    expect(screen.queryByText(/import/i)).not.toBeInTheDocument();
  });
});
