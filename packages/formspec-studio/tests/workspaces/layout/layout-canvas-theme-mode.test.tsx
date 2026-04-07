/** @filedesc LayoutCanvas chrome — flow mode selector and tree; theme authoring is in the blueprint sidebar (no in-canvas Layout/Theme toggle). */
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createProject, type Project } from '@formspec-org/studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectionProvider } from '../../../src/state/useSelection';
import { ActiveGroupProvider } from '../../../src/state/useActiveGroup';
import { LayoutCanvas } from '../../../src/workspaces/layout/LayoutCanvas';

function renderLayout(project: Project) {
  return {
    project,
    ...render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <ActiveGroupProvider>
            <LayoutCanvas />
          </ActiveGroupProvider>
        </SelectionProvider>
      </ProjectProvider>,
    ),
  };
}

function makeProject(definition: any): Project {
  return createProject({ seed: { definition } });
}

describe('LayoutCanvas', () => {
  it('renders the flow mode tablist (Single / Wizard / Tabs)', () => {
    const project = makeProject({ $formspec: '1.0', url: 'urn:t', version: '1.0.0', items: [] });
    renderLayout(project);
    expect(screen.getByTestId('mode-selector')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Single' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Wizard' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Tabs' })).toBeInTheDocument();
  });

  it('does not render the legacy Layout/Theme workspace radiogroup on the canvas', () => {
    const project = makeProject({ $formspec: '1.0', url: 'urn:t', version: '1.0.0', items: [] });
    renderLayout(project);
    expect(screen.queryByTestId('layout-theme-toggle')).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Theme' })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Layout' })).not.toBeInTheDocument();
  });

  it('shows field rows from the layout tree when items exist', () => {
    const project = makeProject({
      $formspec: '1.0',
      url: 'urn:t',
      version: '1.0.0',
      items: [{ key: 'name', type: 'field', dataType: 'string', label: 'Full Name' }],
    });
    renderLayout(project);
    expect(screen.getByText('Full Name')).toBeInTheDocument();
    expect(screen.getByTestId('layout-field-name')).toBeInTheDocument();
  });

  it('selects a field row when clicked', () => {
    const project = makeProject({
      $formspec: '1.0',
      url: 'urn:t',
      version: '1.0.0',
      items: [{ key: 'email', type: 'field', dataType: 'string', label: 'Email' }],
    });
    renderLayout(project);
    const fieldBlock = screen.getByTestId('layout-field-email');
    fireEvent.click(fieldBlock);
    expect(fieldBlock).toHaveAttribute('aria-pressed', 'true');
  });

  it('switches flow mode when a Wizard tab is chosen', async () => {
    const project = makeProject({ $formspec: '1.0', url: 'urn:t', version: '1.0.0', items: [] });
    const setFlow = vi.spyOn(project, 'setFlow');
    renderLayout(project);
    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'Wizard' }));
    });
    expect(setFlow).toHaveBeenCalledWith('wizard');
    setFlow.mockRestore();
  });
});
