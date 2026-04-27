import { render, screen, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from '@formspec-org/studio-core';
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
  it('assistant variant omits intelligence summary chips', () => {
    const project = createProject({
      seed: {
        definition: {
          $formspec: '1.0',
          title: 'T',
          status: 'draft',
          items: [{ key: 'f1', type: 'field', label: 'F', dataType: 'string' }],
        } as any,
      },
    });
    render(
      <ProjectProvider project={project}>
        <StatusBar variant="assistant" />
      </ProjectProvider>,
    );
    expect(screen.getByText(/1 field/i)).toBeInTheDocument();
    expect(screen.queryByText(/Evidence /i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Layout drift/i)).not.toBeInTheDocument();
  });

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

  it('shows evidence and layout intelligence metrics', () => {
    renderStatusBar({
      $formspec: '1.0',
      url: 'urn:test',
      version: '1.0.0',
      items: [
        { key: 'ein', type: 'field', label: 'EIN', dataType: 'string' },
        { key: 'name', type: 'field', label: 'Legal name', dataType: 'string' },
      ],
      extensions: {
        'x-studio': {
          provenance: [
            { objectRef: 'items.ein', origin: 'evidence', confidence: 'high', reviewStatus: 'confirmed', sourceRefs: ['evidence.irs#p1'], patchRefs: [] },
            { objectRef: 'items.name', origin: 'manual', confidence: 'medium', reviewStatus: 'unreviewed' },
          ],
          patches: [
            { id: 'patch-1', source: 'ai', scope: 'spec', summary: 'Draft patch', affectedRefs: ['items.ein'], status: 'open' },
          ],
          layouts: [
            { id: 'mobile', name: 'Mobile', channel: 'Mobile', placements: [{ fieldRef: 'items.ein' }], hiddenFields: [], drift: [{ fieldRef: 'items.name', status: 'open' }] },
          ],
          evidence: {
            documents: [{ id: 'irs', name: 'IRS letter.pdf', mimeType: 'application/pdf', fieldRefs: ['items.ein'] }],
          },
        },
      },
    });

    expect(screen.getByText(/Evidence 1\/2/i)).toBeInTheDocument();
    expect(screen.getByText(/Provenance 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Patches open 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Layout drift 1/i)).toBeInTheDocument();
  });

  it('shows presentation mode when set', () => {
    renderStatusBar({
      $formspec: '1.0',
      url: 'urn:test',
      version: '1.0.0',
      items: [],
      formPresentation: { pageMode: 'wizard' },
    });
    expect(screen.getByText(/wizard/i)).toBeInTheDocument();
  });

  it('updates when definition changes', () => {
    const { project } = renderStatusBar();
    expect(screen.getByText(/0 fields/i)).toBeInTheDocument();

    act(() => {
      project.addField('name', 'Name', 'string');
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
