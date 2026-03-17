import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { PagesTab } from '../../../src/workspaces/pages/PagesTab';

const BASE_DEF = {
  items: [
    { key: 'name', type: 'field', dataType: 'string', label: 'Name' },
    { key: 'email', type: 'field', dataType: 'string', label: 'Email' },
  ],
};

function renderPagesTab(overrides?: {
  definition?: Record<string, unknown>;
  theme?: Record<string, unknown>;
}) {
  const project = createProject({
    seed: {
      definition: { ...BASE_DEF, ...overrides?.definition } as any,
      theme: overrides?.theme as any,
    },
  });
  const result = render(
    <ProjectProvider project={project}>
      <PagesTab />
    </ProjectProvider>,
  );
  return { ...result, project };
}

describe('PagesTab', () => {
  it('shows mode selector with Single, Wizard, Tabs', () => {
    renderPagesTab({
      definition: { formPresentation: { pageMode: 'wizard' } },
      theme: { pages: [{ id: 'p1', title: 'Step 1', regions: [] }] },
    });
    expect(screen.getByText('Single')).toBeInTheDocument();
    expect(screen.getByText('Wizard')).toBeInTheDocument();
    expect(screen.getByText('Tabs')).toBeInTheDocument();
  });

  it('does not render a PAGES heading', () => {
    renderPagesTab({
      definition: { formPresentation: { pageMode: 'wizard' } },
      theme: { pages: [{ id: 'p1', title: 'Step 1', regions: [] }] },
    });
    expect(screen.queryByRole('heading', { name: /pages/i })).not.toBeInTheDocument();
  });

  it('single mode with no pages shows empty state', () => {
    renderPagesTab();
    expect(screen.getByText(/switch to wizard or tabs/i)).toBeInTheDocument();
  });

  it('single mode with existing pages shows dormant info bar', () => {
    renderPagesTab({
      definition: { formPresentation: { pageMode: 'single' } },
      theme: { pages: [{ id: 'p1', title: 'Dormant Page', regions: [] }] },
    });
    expect(screen.getByText(/preserved but not active/i)).toBeInTheDocument();
    expect(screen.getByText('Dormant Page')).toBeInTheDocument();
  });

  it('wizard mode renders page cards with titles', () => {
    renderPagesTab({
      definition: { formPresentation: { pageMode: 'wizard' } },
      theme: {
        pages: [
          { id: 'p1', title: 'Step 1', regions: [{ key: 'name', span: 12 }] },
          { id: 'p2', title: 'Step 2', regions: [{ key: 'email', span: 6 }] },
        ],
      },
    });
    expect(screen.getByText('Step 1')).toBeInTheDocument();
    expect(screen.getByText('Step 2')).toBeInTheDocument();
  });

  it('mode selector dispatches setFlow', async () => {
    const { project } = renderPagesTab();
    await act(async () => {
      screen.getByText('Wizard').click();
    });
    expect((project.definition as any).formPresentation?.pageMode).toBe('wizard');
  });

  it('add page button creates a new page with default title', async () => {
    const { project } = renderPagesTab({
      definition: { formPresentation: { pageMode: 'wizard' } },
      theme: { pages: [{ id: 'p0', title: 'Existing', regions: [] }] },
    });
    await act(async () => {
      screen.getByRole('button', { name: /add page/i }).click();
    });
    expect((project.theme.pages as any[]).length).toBe(2);
  });
});
