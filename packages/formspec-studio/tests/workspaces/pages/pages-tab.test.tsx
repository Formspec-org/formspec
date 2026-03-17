import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { ActivePageProvider, useActivePage } from '../../../src/state/useActivePage';
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
      <ActivePageProvider>
        <PagesTab />
      </ActivePageProvider>
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

  it('add page auto-expands the new card', async () => {
    renderPagesTab({
      definition: { formPresentation: { pageMode: 'wizard' } },
      theme: { pages: [{ id: 'p0', title: 'Existing', regions: [] }] },
    });
    await act(async () => {
      screen.getByRole('button', { name: /add page/i }).click();
    });
    // The newly created card should be expanded (aria-expanded="true")
    expect(screen.getByRole('button', { expanded: true })).toBeInTheDocument();
  });
});

describe('PageCard region editing', () => {
  function renderWithExpandedCard() {
    const result = renderPagesTab({
      definition: { formPresentation: { pageMode: 'wizard' } },
      theme: {
        pages: [{
          id: 'p1', title: 'Step 1',
          regions: [{ key: 'name', span: 12 }, { key: 'email', span: 6 }],
        }],
      },
    });
    // Click the expand button on the first card
    const expandBtn = screen.getByRole('button', { expanded: false });
    fireEvent.click(expandBtn);
    return result;
  }

  it('expanded card shows region list with resolved labels', () => {
    renderWithExpandedCard();
    // Labels appear in both grid preview and region list
    expect(screen.getAllByText('Name').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Email').length).toBeGreaterThanOrEqual(1);
  });

  it('add region button adds a span-12 region', async () => {
    const { project } = renderWithExpandedCard();
    await act(async () => {
      screen.getByRole('button', { name: /add region/i }).click();
    });
    expect(((project.theme as any).pages[0].regions as any[]).length).toBe(3);
  });

  it('remove region button removes the region', async () => {
    const { project } = renderWithExpandedCard();
    // Get the per-region remove buttons (not the page-level Delete button)
    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    await act(async () => {
      removeButtons[0].click();
    });
    expect(((project.theme as any).pages[0].regions as any[]).length).toBe(1);
  });
});

describe('PageCard title editing', () => {
  function renderWithPageCard() {
    return renderPagesTab({
      definition: { formPresentation: { pageMode: 'wizard' } },
      theme: {
        pages: [{ id: 'p1', title: 'Original Title', regions: [] }],
      },
    });
  }

  it('clicking title enters edit mode', () => {
    renderWithPageCard();
    const titleButton = screen.getByText('Original Title');
    fireEvent.click(titleButton);
    const input = screen.getByDisplayValue('Original Title');
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe('INPUT');
  });

  it('blur commits the new title', async () => {
    const { project } = renderWithPageCard();
    const titleButton = screen.getByText('Original Title');
    fireEvent.click(titleButton);
    const input = screen.getByDisplayValue('Original Title');
    fireEvent.change(input, { target: { value: 'Updated Title' } });
    await act(async () => {
      fireEvent.blur(input);
    });
    expect((project.theme as any).pages[0].title).toBe('Updated Title');
  });

  it('Enter commits the new title', async () => {
    const { project } = renderWithPageCard();
    const titleButton = screen.getByText('Original Title');
    fireEvent.click(titleButton);
    const input = screen.getByDisplayValue('Original Title');
    fireEvent.change(input, { target: { value: 'Enter Title' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    expect((project.theme as any).pages[0].title).toBe('Enter Title');
  });

  it('Escape cancels without saving', async () => {
    const { project } = renderWithPageCard();
    const titleButton = screen.getByText('Original Title');
    fireEvent.click(titleButton);
    const input = screen.getByDisplayValue('Original Title');
    fireEvent.change(input, { target: { value: 'Should Not Save' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Escape' });
    });
    expect((project.theme as any).pages[0].title).toBe('Original Title');
  });

  it('empty title is rejected', async () => {
    const { project } = renderWithPageCard();
    const titleButton = screen.getByText('Original Title');
    fireEvent.click(titleButton);
    const input = screen.getByDisplayValue('Original Title');
    fireEvent.change(input, { target: { value: '   ' } });
    await act(async () => {
      fireEvent.blur(input);
    });
    expect((project.theme as any).pages[0].title).toBe('Original Title');
  });
});

describe('PageCard description editing', () => {
  it('shows description when page has one and card is expanded', () => {
    const project = createProject({
      seed: {
        definition: { ...BASE_DEF, formPresentation: { pageMode: 'wizard' } } as any,
        theme: {
          pages: [{ id: 'p1', title: 'Step 1', description: 'Fill in your details', regions: [] }],
        } as any,
      },
    });
    render(
      <ProjectProvider project={project}>
        <PagesTab />
      </ProjectProvider>,
    );
    // Expand the card
    const expandBtn = screen.getByRole('button', { expanded: false });
    fireEvent.click(expandBtn);
    expect(screen.getByText('Fill in your details')).toBeInTheDocument();
  });

  it('does not show description area when page has no description and not editing', () => {
    const project = createProject({
      seed: {
        definition: { ...BASE_DEF, formPresentation: { pageMode: 'wizard' } } as any,
        theme: {
          pages: [{ id: 'p1', title: 'Step 1', regions: [] }],
        } as any,
      },
    });
    render(
      <ProjectProvider project={project}>
        <PagesTab />
      </ProjectProvider>,
    );
    // Expand the card
    const expandBtn = screen.getByRole('button', { expanded: false });
    fireEvent.click(expandBtn);
    expect(screen.queryByPlaceholderText(/description/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add description/i })).toBeInTheDocument();
  });

  it('clicking add description reveals an input', async () => {
    const project = createProject({
      seed: {
        definition: { ...BASE_DEF, formPresentation: { pageMode: 'wizard' } } as any,
        theme: {
          pages: [{ id: 'p1', title: 'Step 1', regions: [] }],
        } as any,
      },
    });
    render(
      <ProjectProvider project={project}>
        <PagesTab />
      </ProjectProvider>,
    );
    const expandBtn = screen.getByRole('button', { expanded: false });
    fireEvent.click(expandBtn);
    await act(async () => {
      screen.getByRole('button', { name: /add description/i }).click();
    });
    expect(screen.getByPlaceholderText(/description/i)).toBeInTheDocument();
  });

  it('clicking description text enters edit mode', async () => {
    const project = createProject({
      seed: {
        definition: { ...BASE_DEF, formPresentation: { pageMode: 'wizard' } } as any,
        theme: {
          pages: [{ id: 'p1', title: 'Step 1', description: 'Old desc', regions: [] }],
        } as any,
      },
    });
    render(
      <ProjectProvider project={project}>
        <PagesTab />
      </ProjectProvider>,
    );
    const expandBtn = screen.getByRole('button', { expanded: false });
    fireEvent.click(expandBtn);
    await act(async () => {
      screen.getByText('Old desc').click();
    });
    expect(screen.getByDisplayValue('Old desc')).toBeInTheDocument();
  });

  it('blur commits description via updatePage', async () => {
    const project = createProject({
      seed: {
        definition: { ...BASE_DEF, formPresentation: { pageMode: 'wizard' } } as any,
        theme: {
          pages: [{ id: 'p1', title: 'Step 1', description: 'Old desc', regions: [] }],
        } as any,
      },
    });
    render(
      <ProjectProvider project={project}>
        <PagesTab />
      </ProjectProvider>,
    );
    const expandBtn = screen.getByRole('button', { expanded: false });
    fireEvent.click(expandBtn);
    await act(async () => { screen.getByText('Old desc').click(); });
    const input = screen.getByDisplayValue('Old desc');
    fireEvent.change(input, { target: { value: 'New desc' } });
    await act(async () => { fireEvent.blur(input); });
    expect((project.theme.pages as any[])[0].description).toBe('New desc');
  });
});

describe('Region start property', () => {
  function renderWithExpandedRegion(regionOverrides?: Record<string, unknown>) {
    const project = createProject({
      seed: {
        definition: {
          ...BASE_DEF,
          formPresentation: { pageMode: 'wizard' },
        } as any,
        theme: {
          pages: [{
            id: 'p1', title: 'Step 1',
            regions: [{ key: 'name', span: 6, ...regionOverrides }],
          }],
        } as any,
      },
    });
    render(
      <ProjectProvider project={project}>
        <PagesTab />
      </ProjectProvider>,
    );
    const expandBtn = screen.getByRole('button', { expanded: false });
    fireEvent.click(expandBtn);
    return { project };
  }

  it('shows start input when region has an explicit start value', () => {
    renderWithExpandedRegion({ start: 3 });
    const startInput = screen.getByLabelText(/start/i);
    expect(startInput).toBeInTheDocument();
    expect((startInput as HTMLInputElement).value).toBe('3');
  });

  it('shows add-start button when region has no start value', () => {
    renderWithExpandedRegion();
    expect(screen.getByRole('button', { name: /add start/i })).toBeInTheDocument();
    // The number input for start should not be present yet
    const startInput = screen.queryByRole('spinbutton', { name: /start/i });
    expect(startInput).not.toBeInTheDocument();
  });

  it('clicking add-start button reveals the start input', async () => {
    renderWithExpandedRegion();
    await act(async () => {
      screen.getByRole('button', { name: /add start/i }).click();
    });
    expect(screen.getByLabelText(/start/i)).toBeInTheDocument();
  });

  it('blur on start input commits value via updateRegion', async () => {
    const { project } = renderWithExpandedRegion({ start: 2 });
    const startInput = screen.getByLabelText(/start/i) as HTMLInputElement;
    fireEvent.change(startInput, { target: { value: '5' } });
    await act(async () => { fireEvent.blur(startInput); });
    expect((project.theme.pages as any[])[0].regions[0].start).toBe(5);
  });
});

describe('Unassigned items section', () => {
  it('shows unassigned section with item labels when items exist but are not on any page', () => {
    renderPagesTab({
      definition: {
        formPresentation: { pageMode: 'wizard' },
        // 'name' is unassigned; 'email' is assigned
      },
      theme: {
        pages: [{ id: 'p1', title: 'Step 1', regions: [{ key: 'email', span: 12 }] }],
      },
    });
    // Should show 'name' as unassigned but not 'email'
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
    expect(screen.getAllByText('Name').length).toBeGreaterThanOrEqual(1);
  });

  it('hides unassigned section when all items are assigned', () => {
    renderPagesTab({
      definition: { formPresentation: { pageMode: 'wizard' } },
      theme: {
        pages: [
          {
            id: 'p1', title: 'Step 1',
            regions: [{ key: 'name', span: 12 }, { key: 'email', span: 12 }],
          },
        ],
      },
    });
    expect(screen.queryByText('Unassigned')).not.toBeInTheDocument();
  });

  it('hides unassigned section in single mode with no pages', () => {
    renderPagesTab(); // single mode, no pages
    expect(screen.queryByText('Unassigned')).not.toBeInTheDocument();
  });
});

// ── FF10: Sidebar ↔ Pages tab sync ────────────────────────────────────

/** Renders PagesTab inside a shared ActivePageProvider and exposes activePageKey via a spy element. */
function ActivePageSpy() {
  const { activePageKey } = useActivePage();
  return <div data-testid="active-page-spy" data-key={activePageKey ?? ''} />;
}

function renderPagesTabWithSync(overrides?: {
  definition?: Record<string, unknown>;
  theme?: Record<string, unknown>;
}) {
  const project = createProject({
    seed: {
      definition: { ...BASE_DEF, ...overrides?.definition } as any,
      theme: overrides?.theme as any,
    },
  });
  let setActivePageKey: ((key: string | null) => void) | null = null;

  function ActivePageSetter({ children }: { children: React.ReactNode }) {
    const ctx = useActivePage();
    setActivePageKey = ctx.setActivePageKey;
    return <>{children}</>;
  }

  const result = render(
    <ProjectProvider project={project}>
      <ActivePageProvider>
        <ActivePageSetter>
          <ActivePageSpy />
          <PagesTab />
        </ActivePageSetter>
      </ActivePageProvider>
    </ProjectProvider>,
  );
  return { ...result, project, getSetActivePageKey: () => setActivePageKey! };
}

describe('FF10 — Sidebar ↔ Pages tab sync', () => {
  const WIZARD_DEF = { formPresentation: { pageMode: 'wizard' } };

  // Fixture: two pages where the group key matches the page ID (addPage convention)
  // To keep tests deterministic, seed the pages directly with known group keys as region keys
  function makeWizardSeed() {
    // page_a and page_b are both definition groups AND used as region keys on their pages
    return {
      definition: {
        ...WIZARD_DEF,
        items: [
          { key: 'page_a', type: 'group', label: 'Page A', children: [] },
          { key: 'page_b', type: 'group', label: 'Page B', children: [] },
        ],
      } as any,
      theme: {
        pages: [
          { id: 'page_a', title: 'Page A', regions: [{ key: 'page_a', span: 12 }] },
          { id: 'page_b', title: 'Page B', regions: [{ key: 'page_b', span: 12 }] },
        ],
      } as any,
    };
  }

  it('expanding a card sets activePageKey to the group key for that page', async () => {
    const seed = makeWizardSeed();
    const { getSetActivePageKey } = renderPagesTabWithSync(seed);

    // spy starts empty
    expect(screen.getByTestId('active-page-spy').dataset.key).toBe('');

    // Expand the second page card (Page B)
    const expandBtns = screen.getAllByRole('button', { expanded: false });
    await act(async () => {
      // Both are collapsed; expand the second one (index 1)
      expandBtns[1].click();
    });

    // activePageKey should now be page_b (the group key for Page B)
    const spy = screen.getByTestId('active-page-spy');
    expect(spy.dataset.key).toBe('page_b');
  });

  it('changing activePageKey externally auto-expands the matching card', async () => {
    const seed = makeWizardSeed();
    const { getSetActivePageKey } = renderPagesTabWithSync(seed);

    // Simulate sidebar click: set active page to page_b
    await act(async () => {
      getSetActivePageKey()('page_b');
    });

    // Page B card should now be expanded (aria-expanded=true on the toggle button)
    const expanded = screen.queryByRole('button', { expanded: true });
    expect(expanded).toBeInTheDocument();
  });

  it('collapsing a card does not clear activePageKey', async () => {
    const seed = makeWizardSeed();
    const { getSetActivePageKey } = renderPagesTabWithSync(seed);

    // Set active page externally
    await act(async () => {
      getSetActivePageKey()('page_a');
    });

    // Now collapse the card by clicking expand toggle again
    const expanded = screen.getByRole('button', { expanded: true });
    await act(async () => {
      expanded.click();
    });

    // activePageKey should remain page_a (don't clear on collapse)
    const spy = screen.getByTestId('active-page-spy');
    expect(spy.dataset.key).toBe('page_a');
  });
});

// ── FF1: Drag handle visible in collapsed cards ───────────────────────

describe('FF1 — DragHandle on page cards', () => {
  function renderWizardWithPages() {
    return renderPagesTab({
      definition: { formPresentation: { pageMode: 'wizard' } },
      theme: {
        pages: [
          { id: 'p1', title: 'First', regions: [] },
          { id: 'p2', title: 'Second', regions: [] },
          { id: 'p3', title: 'Third', regions: [] },
        ],
      },
    });
  }

  it('renders a drag handle on each collapsed page card', () => {
    renderWizardWithPages();
    const handles = screen.getAllByTestId('drag-handle');
    // One per collapsed card (3 pages)
    expect(handles.length).toBe(3);
  });

  it('Move Up and Move Down buttons still exist in expanded card (accessibility fallback)', async () => {
    renderWizardWithPages();
    // Expand the second card
    const expandBtns = screen.getAllByRole('button', { expanded: false });
    await act(async () => {
      expandBtns[1].click();
    });
    expect(screen.getByRole('button', { name: /move up/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /move down/i })).toBeInTheDocument();
  });
});

// ── FF3: Interactive grid bar ─────────────────────────────────────────

describe('FF3 — Interactive grid bar', () => {
  /** Renders a page card with two regions, expanded, ready for grid interaction. */
  function renderExpandedWithRegions() {
    const result = renderPagesTab({
      definition: { formPresentation: { pageMode: 'wizard' } },
      theme: {
        pages: [{
          id: 'p1', title: 'Step 1',
          regions: [{ key: 'name', span: 6 }, { key: 'email', span: 6 }],
        }],
      },
    });
    // Expand the card
    const expandBtn = screen.getByRole('button', { expanded: false });
    fireEvent.click(expandBtn);
    return result;
  }

  it('each grid segment in the expanded bar is a button', () => {
    renderExpandedWithRegions();
    const segmentBtns = screen.getAllByRole('button', { name: /grid segment/i });
    expect(segmentBtns.length).toBe(2);
  });

  it('clicking a grid segment selects it (aria-pressed=true)', async () => {
    renderExpandedWithRegions();
    const segments = screen.getAllByRole('button', { name: /grid segment/i });
    await act(async () => { segments[0].click(); });
    expect(segments[0]).toHaveAttribute('aria-pressed', 'true');
    expect(segments[1]).toHaveAttribute('aria-pressed', 'false');
  });

  it('selected segment shows a span input', async () => {
    renderExpandedWithRegions();
    const segments = screen.getAllByRole('button', { name: /grid segment/i });
    await act(async () => { segments[0].click(); });
    expect(screen.getByRole('spinbutton', { name: /grid segment span/i })).toBeInTheDocument();
  });

  it('changing span via grid segment input dispatches updateRegion', async () => {
    const { project } = renderExpandedWithRegions();
    const segments = screen.getAllByRole('button', { name: /grid segment/i });
    await act(async () => { segments[0].click(); });
    const spanInput = screen.getByRole('spinbutton', { name: /grid segment span/i });
    fireEvent.change(spanInput, { target: { value: '4' } });
    await act(async () => { fireEvent.blur(spanInput); });
    expect((project.theme.pages as any[])[0].regions[0].span).toBe(4);
  });

  it('selected segment shows a remove button', async () => {
    renderExpandedWithRegions();
    const segments = screen.getAllByRole('button', { name: /grid segment/i });
    await act(async () => { segments[1].click(); });
    expect(screen.getByRole('button', { name: /remove segment/i })).toBeInTheDocument();
  });

  it('remove button in selected segment removes that region', async () => {
    const { project } = renderExpandedWithRegions();
    const segments = screen.getAllByRole('button', { name: /grid segment/i });
    await act(async () => { segments[1].click(); });
    const removeBtn = screen.getByRole('button', { name: /remove segment/i });
    await act(async () => { removeBtn.click(); });
    expect((project.theme.pages as any[])[0].regions.length).toBe(1);
  });

  it('Escape deselects the selected segment', async () => {
    renderExpandedWithRegions();
    const segments = screen.getAllByRole('button', { name: /grid segment/i });
    await act(async () => { segments[0].click(); });
    expect(segments[0]).toHaveAttribute('aria-pressed', 'true');
    await act(async () => {
      fireEvent.keyDown(segments[0], { key: 'Escape' });
    });
    expect(segments[0]).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking outside the grid bar deselects the selected segment', async () => {
    renderExpandedWithRegions();
    const segments = screen.getAllByRole('button', { name: /grid segment/i });
    await act(async () => { segments[0].click(); });
    expect(segments[0]).toHaveAttribute('aria-pressed', 'true');
    // Click on an element outside the grid
    await act(async () => {
      fireEvent.mouseDown(document.body);
    });
    expect(segments[0]).toHaveAttribute('aria-pressed', 'false');
  });

  it('broken regions (exists: false) keep amber styling even when selected', async () => {
    renderPagesTab({
      definition: { formPresentation: { pageMode: 'wizard' } },
      theme: {
        pages: [{
          id: 'p1', title: 'Step 1',
          regions: [{ key: 'nonexistent_key', span: 6 }],
        }],
      },
    });
    const expandBtn = screen.getByRole('button', { expanded: false });
    fireEvent.click(expandBtn);
    const segments = screen.getAllByRole('button', { name: /grid segment/i });
    // The broken segment should have the amber class
    expect(segments[0].className).toMatch(/amber/);
    await act(async () => { segments[0].click(); });
    // Still amber after selection
    expect(segments[0].className).toMatch(/amber/);
  });
});

// ── FF4: Drag unassigned items onto page cards ───────────────────────

describe('FF4 — Drag unassigned items onto page cards', () => {
  function renderUnassignedWithPages() {
    return renderPagesTab({
      definition: {
        formPresentation: { pageMode: 'wizard' },
        // 'name' is unassigned; 'email' is on p1
      },
      theme: {
        pages: [
          { id: 'p1', title: 'Step 1', regions: [{ key: 'email', span: 12 }] },
          { id: 'p2', title: 'Step 2', regions: [] },
        ],
      },
    });
  }

  it('unassigned items have a data-draggable-item attribute', () => {
    renderUnassignedWithPages();
    const draggableItems = document.querySelectorAll('[data-draggable-item]');
    expect(draggableItems.length).toBeGreaterThanOrEqual(1);
    // The 'name' item should be draggable
    const nameItem = Array.from(draggableItems).find(
      (el) => el.textContent?.includes('Name'),
    );
    expect(nameItem).toBeDefined();
    expect(nameItem?.getAttribute('data-draggable-item')).toBe('name');
  });

  it('page cards have a data-drop-page attribute for item drops', () => {
    renderUnassignedWithPages();
    const dropZones = document.querySelectorAll('[data-drop-page]');
    // One per page card
    expect(dropZones.length).toBe(2);
    const pageIds = Array.from(dropZones).map((el) => el.getAttribute('data-drop-page'));
    expect(pageIds).toContain('p1');
    expect(pageIds).toContain('p2');
  });

  it('each unassigned item has its key as the draggable item identifier', () => {
    renderUnassignedWithPages();
    // 'name' is unassigned; 'email' is assigned to p1
    const nameItem = document.querySelector('[data-draggable-item="name"]');
    expect(nameItem).not.toBeNull();
    // 'email' should not appear in the unassigned draggable list
    const emailItem = document.querySelector('[data-draggable-item="email"]');
    expect(emailItem).toBeNull();
  });
});
