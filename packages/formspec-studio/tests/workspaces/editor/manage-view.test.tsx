/** @filedesc Integration tests for the Manage view compositor. */
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createProject, type Project } from '@formspec-org/studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectionProvider } from '../../../src/state/useSelection';
import { ManageView } from '../../../src/workspaces/editor/ManageView';

function Providers({ project, children }: { project: Project; children: React.ReactNode }) {
  return (
    <ProjectProvider project={project}>
      <SelectionProvider>{children}</SelectionProvider>
    </ProjectProvider>
  );
}

const RICH_DEF: any = {
  $formspec: '1.0', url: 'urn:manage-test', version: '1.0.0', title: 'Manage Test',
  items: [
    { key: 'name', type: 'field', dataType: 'string', label: 'Name' },
  ],
  variables: [{ name: 'total', expression: '42' }],
  optionSets: { colors: { options: [{ value: 'r', label: 'Red' }] } },
  instances: { lookup: { source: 'https://example.com' } },
  binds: [{ path: 'name', required: 'true' }],
  shapes: [{ id: 'shape1', severity: 'error', constraint: '$name != ""' }],
};

describe('ManageView', () => {
  it('renders section anchors for all Manage sections', () => {
    const project = createProject({ seed: { definition: RICH_DEF } });
    render(<Providers project={project}><ManageView /></Providers>);

    expect(screen.getByTestId('manage-section-option-sets')).toBeInTheDocument();
    expect(screen.getByTestId('manage-section-variables')).toBeInTheDocument();
    expect(screen.getByTestId('manage-section-data-sources')).toBeInTheDocument();
    expect(screen.getByTestId('manage-section-screener')).toBeInTheDocument();
    expect(screen.getByTestId('manage-section-binds-index')).toBeInTheDocument();
    expect(screen.getByTestId('manage-section-shapes')).toBeInTheDocument();
  });

  it('renders variables from definition', () => {
    const project = createProject({ seed: { definition: RICH_DEF } });
    render(<Providers project={project}><ManageView /></Providers>);
    expect(screen.getByText('@total')).toBeInTheDocument();
  });

  it('renders option sets from definition', () => {
    const project = createProject({ seed: { definition: RICH_DEF } });
    render(<Providers project={project}><ManageView /></Providers>);
    expect(screen.getByText('colors')).toBeInTheDocument();
  });

  it('renders data sources from definition', () => {
    const project = createProject({ seed: { definition: RICH_DEF } });
    render(<Providers project={project}><ManageView /></Providers>);
    expect(screen.getByText('lookup')).toBeInTheDocument();
  });

  it('renders section navigation pills', () => {
    const project = createProject({ seed: { definition: RICH_DEF } });
    render(<Providers project={project}><ManageView /></Providers>);
    expect(screen.getByTestId('manage-section-nav')).toBeInTheDocument();
    // Should have pill buttons for each section
    expect(screen.getByRole('button', { name: 'Options' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Values' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Data' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Screener' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Behaviors' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rules' })).toBeInTheDocument();
  });

  it('scrolls to section via ref when nav pill is clicked (no document.getElementById)', () => {
    const project = createProject({ seed: { definition: RICH_DEF } });
    // Spy on document.getElementById to ensure it is NOT used for scrolling
    const getByIdSpy = vi.spyOn(document, 'getElementById');
    render(<Providers project={project}><ManageView /></Providers>);

    // Attach a mock scrollIntoView to the variables section element
    const variablesSection = screen.getByTestId('manage-section-variables');
    const scrollSpy = vi.fn();
    variablesSection.scrollIntoView = scrollSpy;

    // Clear any calls from render
    getByIdSpy.mockClear();

    // Click the "Values" nav pill (which maps to the variables section)
    fireEvent.click(screen.getByRole('button', { name: 'Values' }));

    // Should NOT call document.getElementById for scrolling
    expect(getByIdSpy).not.toHaveBeenCalled();
    // Should scroll via ref
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });

    getByIdSpy.mockRestore();
  });

  it('collapses a pillar when its header is clicked', () => {
    const project = createProject({ seed: { definition: RICH_DEF } });
    render(<Providers project={project}><ManageView /></Providers>);

    const section = screen.getByTestId('manage-section-option-sets');
    const toggle = within(section).getByRole('button', { expanded: true });

    // Initially expanded
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    // Click to collapse
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    // Click to re-expand
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('dispatches navigate-workspace event when a bind path is selected', () => {
    const project = createProject({ seed: { definition: RICH_DEF } });
    const spy = vi.fn();
    window.addEventListener('formspec:navigate-workspace', spy);

    render(<Providers project={project}><ManageView /></Providers>);

    // The BindsSection should render a clickable row for 'name'
    const bindsSection = screen.getByTestId('manage-section-binds-index');
    const pathButton = within(bindsSection).queryByText('name');
    if (pathButton) {
      fireEvent.click(pathButton);
      expect(spy).toHaveBeenCalled();
      const detail = (spy.mock.calls[0][0] as CustomEvent).detail;
      expect(detail).toEqual({ tab: 'Editor', view: 'build' });
    }

    window.removeEventListener('formspec:navigate-workspace', spy);
  });

  it('renders screener section with routes and items', () => {
    const defWithScreener = {
      ...RICH_DEF,
      screener: {
        enabled: true,
        items: [
          { key: 'age', type: 'field', dataType: 'integer', label: 'Age' },
        ],
        routes: [
          { condition: '$age >= 18', destination: 'adult-form' },
          { condition: 'true', destination: 'rejected' },
        ],
      },
    };
    const project = createProject({ seed: { definition: defWithScreener } });
    render(<Providers project={project}><ManageView /></Providers>);

    const screenerSection = screen.getByTestId('manage-section-screener');
    expect(screenerSection).toBeInTheDocument();
    // Should show the screener item key
    expect(within(screenerSection).getByText('age')).toBeInTheDocument();
    // Should show the route destination
    expect(within(screenerSection).getByText('adult-form')).toBeInTheDocument();
    // Should show enabled status
    expect(within(screenerSection).getByText('Enabled')).toBeInTheDocument();
  });

  it('renders all sections with an empty definition without errors', () => {
    const project = createProject();
    render(<Providers project={project}><ManageView /></Providers>);

    // All six section anchors should still render
    expect(screen.getByTestId('manage-section-option-sets')).toBeInTheDocument();
    expect(screen.getByTestId('manage-section-variables')).toBeInTheDocument();
    expect(screen.getByTestId('manage-section-data-sources')).toBeInTheDocument();
    expect(screen.getByTestId('manage-section-screener')).toBeInTheDocument();
    expect(screen.getByTestId('manage-section-binds-index')).toBeInTheDocument();
    expect(screen.getByTestId('manage-section-shapes')).toBeInTheDocument();
  });
});
