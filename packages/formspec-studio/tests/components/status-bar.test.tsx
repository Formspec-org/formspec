import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
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
    expect(screen.queryByText(/Documents linked/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Layout warnings/i)).not.toBeInTheDocument();
  });

  it('shows formspec version', () => {
    renderStatusBar();
    expect(screen.getByText(/FS\s*1\.0/)).toBeInTheDocument();
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

  it('shows default chips: status, fields, healthy, ask ai', () => {
    renderStatusBar({
      $formspec: '1.0',
      url: 'urn:test',
      version: '1.0.0',
      items: [{ key: 'f1', type: 'field', dataType: 'string' }],
    });
    expect(screen.getByText(/draft/i)).toBeInTheDocument();
    expect(screen.getByText(/1 field/i)).toBeInTheDocument();
    expect(screen.getByTestId('health-chip')).toBeInTheDocument();
    expect(screen.getByText(/Ask AI/i)).toBeInTheDocument();
  });

  it('shows renamed metrics behind the more menu', async () => {
    renderStatusBar({
      $formspec: '1.0',
      url: 'urn:test',
      version: '1.0.0',
      items: [
        { key: 'ein', type: 'field', label: 'EIN', dataType: 'string' },
        { key: 'name', type: 'field', label: 'Legal name', dataType: 'string' },
      ],
      binds: { f1: { required: 'true' } },
      shapes: [{ name: 's1', severity: 'error', constraint: '1 = 1' }],
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

    const moreBtn = screen.getByLabelText(/more metrics/i);
    await userEvent.click(moreBtn);

    expect(screen.getByText(/Data connections/i)).toBeInTheDocument();
    expect(screen.getByText(/Cross-field rules/i)).toBeInTheDocument();
    expect(screen.getByText(/Documents linked/i)).toBeInTheDocument();
    expect(screen.getByText(/AI changes/i)).toBeInTheDocument();
    expect(screen.getByText(/Layout drift/i)).toBeInTheDocument();
  });

  it('health chip shows warnings when issues exist', () => {
    renderStatusBar({
      $formspec: '1.0',
      url: 'urn:test',
      version: '1.0.0',
      items: [],
      extensions: {
        'x-studio': {
          layouts: [
            { id: 'mobile', name: 'Mobile', channel: 'Mobile', placements: [], hiddenFields: [], drift: [{ fieldRef: 'items.name', status: 'open' }] },
          ],
        },
      },
    });
    expect(screen.getByTestId('health-chip')).toHaveTextContent(/1 warning/i);
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
    expect(screen.getByRole('link', { name: 'example.com/forms/lease' })).toHaveAttribute(
      'href',
      'https://example.com/forms/lease'
    );
  });

  it('calls onAskAI prop when Ask AI button clicked', () => {
    const onAskAI = vi.fn();
    render(
      <ProjectProvider project={createProject()}>
        <StatusBar onAskAI={onAskAI} />
      </ProjectProvider>,
    );

    screen.getByText('Ask AI').click();
    expect(onAskAI).toHaveBeenCalledOnce();
  });
});
