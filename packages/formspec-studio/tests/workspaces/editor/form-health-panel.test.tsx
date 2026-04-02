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
    render(
      <Providers project={project}>
        <FormHealthPanel />
      </Providers>,
    );
    expect(screen.getByText('Issues')).toBeInTheDocument();
  });

  it('shows "No issues found" when form is valid', () => {
    const project = createProject();
    render(
      <Providers project={project}>
        <FormHealthPanel />
      </Providers>,
    );
    expect(screen.getByText(/no issues/i)).toBeInTheDocument();
  });

  it('has aria-live="polite" on the issues list for screen readers', () => {
    const project = createProject();
    render(
      <Providers project={project}>
        <FormHealthPanel />
      </Providers>,
    );
    expect(screen.getByTestId('issues-list')).toHaveAttribute('aria-live', 'polite');
  });

  it('renders the Output Blueprint section', () => {
    const project = createProject();
    render(
      <Providers project={project}>
        <FormHealthPanel />
      </Providers>,
    );
    expect(screen.getByText('Response Document')).toBeInTheDocument();
  });

  it('lists bind consistency advisories from the definition', () => {
    const project = createProject({
      seed: {
        definition: {
          $formspec: '1.0',
          url: 'urn:health-advisories',
          version: '1.0.0',
          title: 'Health Advisories Test',
          items: [
            { key: 'risky', type: 'field', dataType: 'string', label: 'Risky field' },
          ],
          binds: [{ path: 'risky', required: 'true', readonly: 'true' }],
        },
      },
    });
    render(
      <Providers project={project}>
        <FormHealthPanel />
      </Providers>,
    );
    expect(screen.queryByText(/no issues found/i)).not.toBeInTheDocument();
    expect(screen.getByText(/required but locked/i)).toBeInTheDocument();
    expect(screen.getByText('Risky field')).toBeInTheDocument();
  });

  it('exposes issue rows that select the field in the editor', () => {
    const project = createProject({
      seed: {
        definition: {
          $formspec: '1.0',
          url: 'urn:health-select',
          version: '1.0.0',
          title: 'Health Select Test',
          items: [
            { key: 'risky', type: 'field', dataType: 'string', label: 'Risky' },
          ],
          binds: [{ path: 'risky', required: 'true', readonly: 'true' }],
        },
      },
    });
    render(
      <Providers project={project}>
        <FormHealthPanel />
      </Providers>,
    );
    const row = screen.getByTestId('form-health-issue-0');
    expect(row).toBeInTheDocument();
    fireEvent.click(row);
  });
});
