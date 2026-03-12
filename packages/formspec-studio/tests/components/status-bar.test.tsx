import { render, screen, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../src/state/ProjectContext';
import { StatusBar } from '../../src/components/StatusBar';

function renderStatusBar(seedDef?: Record<string, unknown>) {
  const project = createProject(seedDef ? { seed: { definition: seedDef as any } } : undefined);
  return { ...render(
    <ProjectProvider project={project}>
      <StatusBar />
    </ProjectProvider>
  ), project };
}

describe('StatusBar', () => {
  it('shows formspec version', () => {
    renderStatusBar();
    expect(screen.getByText(/formspec 1\.0/i)).toBeInTheDocument();
  });

  it('shows definition status badge', () => {
    renderStatusBar({
      $formspec: '1.0',
      url: 'urn:test',
      version: '1.0.0',
      status: 'draft',
      items: [],
    });
    expect(screen.getByText(/draft/i)).toBeInTheDocument();
  });

  it('shows field count', () => {
    renderStatusBar({
      $formspec: '1.0',
      url: 'urn:test',
      version: '1.0.0',
      items: [
        { key: 'f1', type: 'field', dataType: 'string' },
        { key: 'f2', type: 'field', dataType: 'integer' },
      ],
    });
    expect(screen.getByText(/2 fields/i)).toBeInTheDocument();
  });

  it('shows bind count', () => {
    renderStatusBar({
      $formspec: '1.0',
      url: 'urn:test',
      version: '1.0.0',
      items: [{ key: 'f1', type: 'field', dataType: 'string' }],
      binds: { f1: { required: 'true' } },
    });
    expect(screen.getByText(/1 bind/i)).toBeInTheDocument();
  });

  it('shows shape count', () => {
    renderStatusBar({
      $formspec: '1.0',
      url: 'urn:test',
      version: '1.0.0',
      items: [],
      shapes: [{ name: 's1', severity: 'error', constraint: '1 = 1' }],
    });
    expect(screen.getByText(/1 shape/i)).toBeInTheDocument();
  });

  it('shows presentation mode when set', () => {
    renderStatusBar({
      $formspec: '1.0',
      url: 'urn:test',
      version: '1.0.0',
      items: [],
      presentation: { pageMode: 'wizard' },
    });
    expect(screen.getByText(/wizard/i)).toBeInTheDocument();
  });

  it('updates when definition changes', () => {
    const { project } = renderStatusBar();
    expect(screen.getByText(/0 fields/i)).toBeInTheDocument();

    act(() => {
      project.dispatch({
        type: 'definition.addItem',
        payload: { key: 'name', type: 'field', dataType: 'string' }
      });
    });

    expect(screen.getByText(/1 field/i)).toBeInTheDocument();
  });

  it('renders the definition URL as a hyperlink', () => {
    renderStatusBar({
      $formspec: '1.0',
      url: 'https://example.com/forms/lease',
      version: '1.0.0',
      items: [],
    });
    expect(screen.getByRole('link', { name: 'https://example.com/forms/lease' })).toHaveAttribute(
      'href',
      'https://example.com/forms/lease'
    );
  });
});
