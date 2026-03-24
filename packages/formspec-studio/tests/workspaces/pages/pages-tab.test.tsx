import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { ActiveGroupProvider, useActiveGroup } from '../../../src/state/useActiveGroup';
import { PagesTab } from '../../../src/workspaces/pages/PagesTab';

const BASE_DEF = {
  items: [
    { key: 'name', type: 'field', dataType: 'string', label: 'Name' },
    { key: 'email', type: 'field', dataType: 'string', label: 'Email' },
    { key: 'phone', type: 'field', dataType: 'string', label: 'Phone' },
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
      <ActiveGroupProvider>
        <PagesTab />
      </ActiveGroupProvider>
    </ProjectProvider>,
  );

  return { ...result, project };
}

function pageCard(pageId: string) {
  return screen.getByTestId(`page-card-${pageId}`);
}

async function ensureExpanded(card: HTMLElement) {
  const toggle = within(card).getByRole('button', { name: /expand|collapse/i });
  if (toggle.getAttribute('aria-expanded') === 'false') {
    await act(async () => {
      fireEvent.click(toggle);
    });
  }
}

describe('PagesTab', () => {
  it('shows flow mode controls and starts in view mode', () => {
    renderPagesTab({
      definition: { formPresentation: { pageMode: 'wizard' } },
      theme: {
        pages: [{ id: 'p1', title: 'Step 1', regions: [] }],
      },
    });

    expect(screen.getByText('View mode')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Single' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wizard' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tabs' })).toBeInTheDocument();
  });

  it('single mode with no pages shows guidance', () => {
    renderPagesTab();
    expect(screen.getByText(/switch to wizard or tabs/i)).toBeInTheDocument();
  });

  it('single mode with existing pages shows dormant guidance and badge', () => {
    renderPagesTab({
      definition: { formPresentation: { pageMode: 'single' } },
      theme: {
        pages: [{ id: 'p1', title: 'Step 1', regions: [] }],
      },
    });

    expect(screen.getByText(/preserved but not active/i)).toBeInTheDocument();
    expect(within(pageCard('p1')).getByTestId('dormant-badge')).toHaveTextContent('Dormant');
  });

  it('dormant pages disable all action controls', async () => {
    renderPagesTab({
      definition: { formPresentation: { pageMode: 'single' } },
      theme: {
        pages: [
          { id: 'p1', title: 'Step 1', regions: [{ key: 'name', span: 12 }] },
          { id: 'p2', title: 'Step 2', regions: [] },
        ],
      },
    });

    const card = pageCard('p1');
    await ensureExpanded(card);

    expect(within(card).getByRole('button', { name: /move step 1 up/i })).toBeDisabled();
    expect(within(card).getByRole('button', { name: /move name up/i })).toBeDisabled();
    expect(within(card).getByRole('button', { name: /edit mode/i })).toBeDisabled();
    expect(within(card).getByRole('button', { name: /delete page/i })).toBeDisabled();
  });

  it('mode selector updates project flow mode', async () => {
    const { project } = renderPagesTab();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Wizard' }));
    });

    expect(project.definition.formPresentation?.pageMode).toBe('wizard');
  });

  it('add page creates and auto-expands a new card', async () => {
    renderPagesTab({
      definition: { formPresentation: { pageMode: 'wizard' } },
      theme: { pages: [{ id: 'p1', title: 'Existing', regions: [] }] },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /add page/i }));
    });

    expect(screen.getByRole('button', { expanded: true })).toBeInTheDocument();
  });

  it('inline title editing updates the page title', async () => {
    const { project } = renderPagesTab({
      definition: { formPresentation: { pageMode: 'wizard' } },
      theme: {
        pages: [{ id: 'p1', title: 'Original Title', regions: [] }],
      },
    });

    const card = pageCard('p1');
    await act(async () => {
      fireEvent.click(within(card).getByText('Original Title'));
    });

    const input = within(card).getByDisplayValue('Original Title');
    fireEvent.change(input, { target: { value: 'Updated Title' } });

    await act(async () => {
      fireEvent.blur(input);
    });

    expect((project.theme.pages as any[])[0].title).toBe('Updated Title');
  });

  it('inline description editing updates the page description', async () => {
    const { project } = renderPagesTab({
      definition: { formPresentation: { pageMode: 'wizard' } },
      theme: {
        pages: [{ id: 'p1', title: 'Step 1', regions: [] }],
      },
    });

    const card = pageCard('p1');
    await ensureExpanded(card);

    await act(async () => {
      fireEvent.click(within(card).getByRole('button', { name: /add description/i }));
    });

    const input = within(card).getByPlaceholderText(/description/i);
    fireEvent.change(input, { target: { value: 'Fill this out first' } });

    await act(async () => {
      fireEvent.blur(input);
    });

    expect((project.theme.pages as any[])[0].description).toBe('Fill this out first');
  });

  it('view mode can move an item to another page', async () => {
    const { project } = renderPagesTab({
      definition: { formPresentation: { pageMode: 'wizard' } },
      theme: {
        pages: [
          { id: 'p1', title: 'Step 1', regions: [{ key: 'name', span: 12 }] },
          { id: 'p2', title: 'Step 2', regions: [] },
        ],
      },
    });

    const card = pageCard('p1');
    await ensureExpanded(card);

    const moveSelect = within(card).getByLabelText(/move name to page/i);
    await act(async () => {
      fireEvent.change(moveSelect, { target: { value: 'p2' } });
    });

    expect(((project.theme.pages as any[])[0].regions ?? []).some((region: any) => region.key === 'name')).toBe(false);
    expect(((project.theme.pages as any[])[1].regions ?? []).some((region: any) => region.key === 'name')).toBe(true);
  });

  it('view mode can reorder items within the same page', async () => {
    const { project } = renderPagesTab({
      definition: { formPresentation: { pageMode: 'wizard' } },
      theme: {
        pages: [
          {
            id: 'p1',
            title: 'Step 1',
            regions: [
              { key: 'name', span: 12 },
              { key: 'email', span: 6 },
            ],
          },
        ],
      },
    });

    const card = pageCard('p1');
    await ensureExpanded(card);

    await act(async () => {
      fireEvent.click(within(card).getByRole('button', { name: /move email up/i }));
    });

    expect(((project.theme.pages as any[])[0].regions ?? []).map((region: any) => region.key)).toEqual(['email', 'name']);
  });

  it('shows unassigned items and quick-adds them to the expanded page', async () => {
    const { project } = renderPagesTab({
      definition: { formPresentation: { pageMode: 'wizard' } },
      theme: {
        pages: [{ id: 'p1', title: 'Step 1', regions: [{ key: 'email', span: 12 }] }],
      },
    });

    const card = pageCard('p1');
    await ensureExpanded(card);

    expect(screen.getByRole('region', { name: /unassigned items/i })).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(within(card).getByRole('button', { name: /add name to step 1/i }));
    });

    expect(((project.theme.pages as any[])[0].regions ?? []).some((region: any) => region.key === 'name')).toBe(true);
  });

  it('delete action is blocked for non-empty pages with an explanation', async () => {
    renderPagesTab({
      definition: { formPresentation: { pageMode: 'wizard' } },
      theme: {
        pages: [
          { id: 'p1', title: 'Step 1', regions: [{ key: 'name', span: 12 }] },
          { id: 'p2', title: 'Step 2', regions: [] },
        ],
      },
    });

    const card = pageCard('p1');
    await ensureExpanded(card);

    expect(within(card).getByText(/move every assigned item off this page before deleting/i)).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: /delete page/i })).toBeDisabled();
  });

  it('empty pages can be deleted after confirmation', async () => {
    const { project } = renderPagesTab({
      definition: { formPresentation: { pageMode: 'wizard' } },
      theme: {
        pages: [
          { id: 'p1', title: 'Step 1', regions: [] },
          { id: 'p2', title: 'Step 2', regions: [] },
        ],
      },
    });

    const card = pageCard('p2');
    await ensureExpanded(card);

    await act(async () => {
      fireEvent.click(within(card).getByRole('button', { name: /delete page/i }));
    });

    expect(within(card).getByText(/delete step 2 permanently/i)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(within(card).getByRole('button', { name: /^confirm delete$/i }));
    });

    expect((project.theme.pages as any[]).map((page: any) => page.id)).toEqual(['p1']);
  });

  it('delete is blocked when only one page exists', async () => {
    renderPagesTab({
      definition: { formPresentation: { pageMode: 'wizard' } },
      theme: {
        pages: [{ id: 'p1', title: 'Only Page', regions: [] }],
      },
    });

    const card = pageCard('p1');
    await ensureExpanded(card);

    expect(within(card).getByText(/keep at least one page/i)).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: /delete page/i })).toBeDisabled();
  });

  it('unassign returns an item to the unassigned pool', async () => {
    const { project } = renderPagesTab({
      definition: { formPresentation: { pageMode: 'wizard' } },
      theme: {
        pages: [
          { id: 'p1', title: 'Step 1', regions: [{ key: 'name', span: 12 }] },
          { id: 'p2', title: 'Step 2', regions: [] },
        ],
      },
    });

    const card = pageCard('p1');
    await ensureExpanded(card);

    const moveSelect = within(card).getByLabelText(/move name to page/i);
    await act(async () => {
      fireEvent.change(moveSelect, { target: { value: '__unassigned' } });
    });

    expect(((project.theme.pages as any[])[0].regions ?? []).some((r: any) => r.key === 'name')).toBe(false);
    expect(((project.theme.pages as any[])[1].regions ?? []).some((r: any) => r.key === 'name')).toBe(false);
  });

  it('entering edit mode shows the focus view and back returns to view mode', async () => {
    renderPagesTab({
      definition: { formPresentation: { pageMode: 'wizard' } },
      theme: {
        pages: [{ id: 'p1', title: 'Step 1', regions: [{ key: 'name', span: 12 }] }],
      },
    });

    const card = pageCard('p1');
    await ensureExpanded(card);

    await act(async () => {
      fireEvent.click(within(card).getByRole('button', { name: /edit mode/i }));
    });

    expect(screen.getByText('Edit mode')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Step 1')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /back to pages/i }));
    });

    expect(screen.getByText('View mode')).toBeInTheDocument();
    expect(pageCard('p1')).toBeInTheDocument();
  });
});

function ActivePageSpy() {
  const { activeGroupKey } = useActiveGroup();
  return <div data-testid="active-page-spy" data-key={activeGroupKey ?? ''} />;
}

describe('PagesTab active-page sync', () => {
  it('external active page changes expand the matching card', async () => {
    const project = createProject({
      seed: {
        definition: {
          ...BASE_DEF,
          formPresentation: { pageMode: 'wizard' },
        } as any,
        theme: {
          pages: [
            { id: 'p1', title: 'Step 1', regions: [{ key: 'name', span: 12 }] },
            { id: 'p2', title: 'Step 2', regions: [{ key: 'email', span: 12 }] },
          ],
        } as any,
      },
    });

    let setActiveGroupKey: ((key: string | null) => void) | null = null;

    function ActiveGroupSetter({ children }: { children: React.ReactNode }) {
      const ctx = useActiveGroup();
      setActiveGroupKey = ctx.setActiveGroupKey;
      return <>{children}</>;
    }

    render(
      <ProjectProvider project={project}>
        <ActiveGroupProvider>
          <ActiveGroupSetter>
            <ActivePageSpy />
            <PagesTab />
          </ActiveGroupSetter>
        </ActiveGroupProvider>
      </ProjectProvider>,
    );

    await act(async () => {
      setActiveGroupKey?.('email');
    });

    expect(screen.getByTestId('active-page-spy').dataset.key).toBe('email');
    expect(within(pageCard('p2')).getByRole('button', { expanded: true })).toBeInTheDocument();
  });
});
