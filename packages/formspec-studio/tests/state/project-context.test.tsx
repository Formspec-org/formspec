import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../src/state/ProjectContext';
import { useProject } from '../../src/state/useProject';

function TestConsumer() {
  const project = useProject();
  return <div data-testid="has-project">{project ? 'yes' : 'no'}</div>;
}

describe('ProjectContext', () => {
  it('provides Project instance to children', () => {
    const project = createProject();
    render(
      <ProjectProvider project={project}>
        <TestConsumer />
      </ProjectProvider>
    );
    expect(screen.getByTestId('has-project')).toHaveTextContent('yes');
  });

  it('throws when useProject is called outside provider', () => {
    // Suppress React error boundary console output
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow();
    spy.mockRestore();
  });
});
