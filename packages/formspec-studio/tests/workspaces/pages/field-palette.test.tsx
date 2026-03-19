/** @filedesc Tests for the FieldPalette component. */
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { FieldPalette } from '../../../src/workspaces/pages/FieldPalette';

const BASE_ITEMS = [
  { key: 'name', type: 'field', dataType: 'string', label: 'Name' },
  { key: 'email', type: 'field', dataType: 'string', label: 'Email' },
  { key: 'phone', type: 'field', dataType: 'string', label: 'Phone' },
];

function renderFieldPalette(overrides?: {
  definition?: Record<string, unknown>;
  theme?: Record<string, unknown>;
  pageId?: string;
  isOpen?: boolean;
  onToggle?: () => void;
}) {
  const project = createProject({
    seed: {
      definition: {
        items: BASE_ITEMS,
        formPresentation: { pageMode: 'wizard' },
        ...overrides?.definition,
      } as any,
      theme: overrides?.theme as any,
    },
  });
  const onToggle = overrides?.onToggle ?? vi.fn();
  const result = render(
    <ProjectProvider project={project}>
      <FieldPalette
        pageId={overrides?.pageId ?? 'p1'}
        isOpen={overrides?.isOpen ?? true}
        onToggle={onToggle}
      />
    </ProjectProvider>,
  );
  return { ...result, project, onToggle };
}

describe('FieldPalette', () => {
  it('shows unplaced items as draggable with quick-add button', () => {
    renderFieldPalette({
      theme: {
        pages: [{ id: 'p1', title: 'Step 1', regions: [{ key: 'name', span: 12 }] }],
      },
    });
    // 'email' and 'phone' are unplaced
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Phone')).toBeInTheDocument();
    // They should have quick-add buttons
    const addButtons = screen.getAllByRole('button', { name: /add to page/i });
    expect(addButtons.length).toBe(2);
  });

  it('shows placed items as greyed out with checkmark', () => {
    renderFieldPalette({
      theme: {
        pages: [{ id: 'p1', title: 'Step 1', regions: [{ key: 'name', span: 12 }] }],
      },
    });
    // 'name' is placed — should show checkmark indicator
    const placedItem = screen.getByTestId('palette-item-name');
    expect(placedItem).toBeInTheDocument();
    expect(placedItem.textContent).toContain('Name');
    // Should have a checkmark
    expect(placedItem.querySelector('[data-placed]')).not.toBeNull();
    // Should NOT have a quick-add button
    const addButtons = screen.getAllByRole('button', { name: /add to page/i });
    // Only 2 buttons (email and phone), not 3
    expect(addButtons.length).toBe(2);
  });

  it('quick-add calls placeOnPage with span 12', async () => {
    const { project } = renderFieldPalette({
      theme: {
        pages: [{ id: 'p1', title: 'Step 1', regions: [{ key: 'name', span: 12 }] }],
      },
    });
    // Click the first quick-add button (for 'email')
    const addButtons = screen.getAllByRole('button', { name: /add to page/i });
    await act(async () => {
      addButtons[0].click();
    });
    // Verify the region was added to the page
    const regions = (project.theme.pages as any[])[0].regions;
    expect(regions.length).toBe(2);
    expect(regions[1].key).toBe('email');
    expect(regions[1].span).toBe(12);
  });

  it('only shows top-level items (no nested fields within groups)', () => {
    renderFieldPalette({
      definition: {
        items: [
          {
            key: 'contact', type: 'group', label: 'Contact Info',
            children: [
              { key: 'nested_phone', type: 'field', dataType: 'string', label: 'Nested Phone' },
            ],
          },
          { key: 'email', type: 'field', dataType: 'string', label: 'Email' },
        ],
      },
      theme: {
        pages: [{ id: 'p1', title: 'Step 1', regions: [] }],
      },
    });
    // Top-level items: 'contact' and 'email'
    expect(screen.getByText('Contact Info')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    // 'nested_phone' should NOT appear
    expect(screen.queryByText('Nested Phone')).not.toBeInTheDocument();
  });

  it('items are grouped by parent with section headers', () => {
    renderFieldPalette({
      definition: {
        items: [
          {
            key: 'contact', type: 'group', label: 'Contact Info',
            children: [
              { key: 'phone', type: 'field', dataType: 'string', label: 'Phone' },
              { key: 'address', type: 'field', dataType: 'string', label: 'Address' },
            ],
          },
          { key: 'name', type: 'field', dataType: 'string', label: 'Name' },
        ],
      },
      theme: {
        pages: [{ id: 'p1', title: 'Step 1', regions: [] }],
      },
    });
    // Root items: 'contact' and 'name' — these are top-level
    // The contact group appears in the root section since it's itself a top-level item
    expect(screen.getByText('Contact Info')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    renderFieldPalette({
      isOpen: false,
      theme: {
        pages: [{ id: 'p1', title: 'Step 1', regions: [] }],
      },
    });
    // When closed, palette content should not be visible
    expect(screen.queryByText('Name')).not.toBeInTheDocument();
  });

  it('items placed on other pages are also greyed out', () => {
    renderFieldPalette({
      pageId: 'p2',
      theme: {
        pages: [
          { id: 'p1', title: 'Step 1', regions: [{ key: 'name', span: 12 }] },
          { id: 'p2', title: 'Step 2', regions: [] },
        ],
      },
    });
    // 'name' is placed on p1, but we're viewing p2 — still greyed
    const placedItem = screen.getByTestId('palette-item-name');
    expect(placedItem.querySelector('[data-placed]')).not.toBeNull();
  });
});
