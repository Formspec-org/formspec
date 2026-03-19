/** @filedesc Tests for the PagesFocusView component. */
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { PagesFocusView } from '../../../src/workspaces/pages/PagesFocusView';

const BASE_DEF = {
  items: [
    { key: 'name', type: 'field', dataType: 'string', label: 'Name' },
    { key: 'email', type: 'field', dataType: 'string', label: 'Email' },
    { key: 'phone', type: 'field', dataType: 'string', label: 'Phone' },
  ],
  formPresentation: { pageMode: 'wizard' as const },
};

const MULTI_PAGE_THEME = {
  pages: [
    { id: 'p1', title: 'Step 1', regions: [{ key: 'name', span: 12 }] },
    { id: 'p2', title: 'Step 2', regions: [{ key: 'email', span: 6 }] },
    { id: 'p3', title: 'Step 3', regions: [{ key: 'phone', span: 4 }] },
  ],
};

function renderFocusView(overrides?: {
  pageId?: string;
  definition?: Record<string, unknown>;
  theme?: Record<string, unknown>;
  onBack?: () => void;
  onNavigate?: (pageId: string) => void;
}) {
  const project = createProject({
    seed: {
      definition: { ...BASE_DEF, ...overrides?.definition } as any,
      theme: (overrides?.theme ?? MULTI_PAGE_THEME) as any,
    },
  });
  const onBack = overrides?.onBack ?? vi.fn();
  const onNavigate = overrides?.onNavigate ?? vi.fn();

  const result = render(
    <ProjectProvider project={project}>
      <PagesFocusView
        pageId={overrides?.pageId ?? 'p1'}
        onBack={onBack}
        onNavigate={onNavigate}
      />
    </ProjectProvider>,
  );
  return { ...result, project, onBack, onNavigate };
}

describe('PagesFocusView', () => {
  it('renders the page title', () => {
    renderFocusView();
    expect(screen.getByDisplayValue('Step 1')).toBeInTheDocument();
  });

  it('back button calls onBack', async () => {
    const onBack = vi.fn();
    renderFocusView({ onBack });
    await act(async () => {
      screen.getByRole('button', { name: /back/i }).click();
    });
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('Escape with no selection calls onBack', async () => {
    const onBack = vi.fn();
    renderFocusView({ onBack });
    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('page navigation shows position indicator', () => {
    renderFocusView();
    // Should show "1 / 3" for first page of 3
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('next page button calls onNavigate with next page ID', async () => {
    const onNavigate = vi.fn();
    renderFocusView({ onNavigate });
    await act(async () => {
      screen.getByRole('button', { name: /next page/i }).click();
    });
    expect(onNavigate).toHaveBeenCalledWith('p2');
  });

  it('previous page button is disabled on first page', () => {
    renderFocusView();
    const prevBtn = screen.getByRole('button', { name: /previous page/i });
    expect(prevBtn).toBeDisabled();
  });

  it('next page button is disabled on last page', () => {
    renderFocusView({ pageId: 'p3' });
    const nextBtn = screen.getByRole('button', { name: /next page/i });
    expect(nextBtn).toBeDisabled();
  });

  it('page title is editable — blur commits', async () => {
    const { project } = renderFocusView();
    const titleInput = screen.getByDisplayValue('Step 1');
    fireEvent.change(titleInput, { target: { value: 'Updated Step' } });
    await act(async () => {
      fireEvent.blur(titleInput);
    });
    expect((project.theme.pages as any[])[0].title).toBe('Updated Step');
  });

  it('page title is editable — Enter commits', async () => {
    const { project } = renderFocusView();
    const titleInput = screen.getByDisplayValue('Step 1');
    fireEvent.change(titleInput, { target: { value: 'Enter Title' } });
    await act(async () => {
      fireEvent.keyDown(titleInput, { key: 'Enter' });
    });
    expect((project.theme.pages as any[])[0].title).toBe('Enter Title');
  });

  it('renders BreakpointBar', () => {
    renderFocusView();
    expect(screen.getByText('Base')).toBeInTheDocument();
  });

  it('renders GridCanvas', () => {
    renderFocusView();
    expect(document.querySelector('[data-grid-canvas]')).toBeInTheDocument();
  });

  it('shows dormant badge when mode is single', () => {
    renderFocusView({
      definition: { formPresentation: { pageMode: 'single' } },
    });
    expect(screen.getByText(/dormant/i)).toBeInTheDocument();
  });

  it('does not show dormant badge when mode is wizard', () => {
    renderFocusView();
    expect(screen.queryByText(/dormant/i)).not.toBeInTheDocument();
  });
});
