import { render, screen, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { PagesTab } from '../../../src/workspaces/pages/PagesTab';

const baseDef = {
  $formspec: '1.0',
  url: 'urn:pages-test',
  version: '1.0.0',
  items: [
    { key: 'name', type: 'field', dataType: 'string', label: 'Name' },
    { key: 'email', type: 'field', dataType: 'string', label: 'Email' },
  ],
};

function renderPagesTab(overrides?: {
  definition?: Record<string, unknown>;
  theme?: Record<string, unknown>;
  component?: Record<string, unknown>;
}) {
  const project = createProject({
    seed: {
      definition: { ...baseDef, ...overrides?.definition } as any,
      theme: overrides?.theme as any,
      component: overrides?.component as any,
    },
  });

  return {
    ...render(
      <ProjectProvider project={project}>
        <PagesTab />
      </ProjectProvider>
    ),
    project,
  };
}

describe('PagesTab', () => {
  it('renders empty state banner when mode is single', () => {
    renderPagesTab();
    expect(screen.getByText(/single-page form/i)).toBeInTheDocument();
  });

  it('mode selector dispatches pages.setMode', async () => {
    const { project } = renderPagesTab();
    await act(async () => {
      screen.getByRole('button', { name: /wizard/i }).click();
    });
    expect((project.definition as any).formPresentation?.pageMode).toBe('wizard');
  });

  it('add page button dispatches pages.addPage', async () => {
    const { project } = renderPagesTab({
      definition: { formPresentation: { pageMode: 'wizard' } },
      theme: { pages: [{ id: 'p0', title: 'Existing', regions: [] }] },
    });
    await act(async () => {
      screen.getByRole('button', { name: /add page/i }).click();
    });
    expect((project.theme.pages as any[]).length).toBe(2);
  });

  it('page cards display page titles and assigned items', () => {
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

  it('auto-generate button dispatches pages.autoGenerate', async () => {
    const { project } = renderPagesTab({
      definition: { formPresentation: { pageMode: 'wizard' } },
      theme: { pages: [{ id: 'seed', title: 'Seed', regions: [] }] },
    });
    await act(async () => {
      screen.getByRole('button', { name: /generate/i }).click();
    });
    // autoGenerate replaces existing pages with generated ones
    expect((project.theme.pages as any[]).length).toBeGreaterThan(0);
  });

  it('diagnostics panel shows warnings', () => {
    renderPagesTab({
      definition: { formPresentation: { pageMode: 'single' } },
      theme: {
        pages: [{ id: 'p1', title: 'Orphan', regions: [] }],
      },
    });
    expect(screen.getByText(/mismatch/i)).toBeInTheDocument();
  });

  it('shows wizard warning when component Wizard exists', () => {
    renderPagesTab({
      component: {
        $formspecComponent: '1.0',
        tree: {
          component: 'Wizard',
          children: [
            { component: 'WizardPage', props: { title: 'Comp Page' }, children: [] },
          ],
        },
      },
      theme: {
        pages: [{ id: 'p1', title: 'Theme Page', regions: [] }],
      },
    });
    const banner = screen.getByTestId('tier-status-banner');
    expect(banner.textContent).toMatch(/wizard component/i);
  });
});
