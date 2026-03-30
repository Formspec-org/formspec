/** @filedesc Unit tests for the Form Health panel (right rail). */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject, type Project } from '@formspec-org/studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectionProvider } from '../../../src/state/useSelection';
import { FormHealthPanel } from '../../../src/workspaces/editor/FormHealthPanel';

function Providers({ project, children }: { project: Project; children: React.ReactNode }) {
  return (
    <ProjectProvider project={project}>
      <SelectionProvider>{children}</SelectionProvider>
    </ProjectProvider>
  );
}

describe('FormHealthPanel', () => {
  it('renders Issues section by default', () => {
    const project = createProject();
    render(<Providers project={project}><FormHealthPanel /></Providers>);
    expect(screen.getByText('Issues')).toBeInTheDocument();
  });

  it('renders Response Inspector section (collapsed)', () => {
    const project = createProject();
    render(<Providers project={project}><FormHealthPanel /></Providers>);
    expect(screen.getByRole('button', { name: /response inspector/i })).toBeInTheDocument();
  });

  it('renders Simulation section (collapsed)', () => {
    const project = createProject();
    render(<Providers project={project}><FormHealthPanel /></Providers>);
    expect(screen.getByRole('button', { name: /simulation/i })).toBeInTheDocument();
  });

  it('shows "No issues found" when form is valid', () => {
    const project = createProject();
    render(<Providers project={project}><FormHealthPanel /></Providers>);
    expect(screen.getByText(/no issues/i)).toBeInTheDocument();
  });

  it('has aria-live="polite" on the issues list for screen readers', () => {
    const project = createProject();
    render(<Providers project={project}><FormHealthPanel /></Providers>);
    expect(screen.getByTestId('issues-list')).toHaveAttribute('aria-live', 'polite');
  });

  it('expands Response Inspector when clicked', () => {
    const project = createProject();
    render(<Providers project={project}><FormHealthPanel /></Providers>);
    fireEvent.click(screen.getByRole('button', { name: /response inspector/i }));
    expect(screen.getByTestId('response-inspector-content')).toBeVisible();
  });

  it('expands Simulation when clicked', () => {
    const project = createProject();
    render(<Providers project={project}><FormHealthPanel /></Providers>);
    fireEvent.click(screen.getByRole('button', { name: /simulation/i }));
    expect(screen.getByTestId('simulation-content')).toBeVisible();
  });

  it('collapses Response Inspector on second click', () => {
    const project = createProject();
    render(<Providers project={project}><FormHealthPanel /></Providers>);
    const trigger = screen.getByRole('button', { name: /response inspector/i });

    // Expand
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('response-inspector-content')).toBeVisible();

    // Collapse
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('response-inspector-content')).not.toBeVisible();
  });

  it('sets aria-expanded correctly on collapsible sections', () => {
    const project = createProject();
    render(<Providers project={project}><FormHealthPanel /></Providers>);

    // Initially collapsed
    const responseTrigger = screen.getByRole('button', { name: /response inspector/i });
    const simulationTrigger = screen.getByRole('button', { name: /simulation/i });
    expect(responseTrigger).toHaveAttribute('aria-expanded', 'false');
    expect(simulationTrigger).toHaveAttribute('aria-expanded', 'false');
  });
});
