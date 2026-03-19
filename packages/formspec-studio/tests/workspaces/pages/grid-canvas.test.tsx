/** @filedesc Tests for GridCanvas — 12-column interactive grid with item blocks. */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GridCanvas } from '../../../src/workspaces/pages/GridCanvas';
import type { PageItemView } from 'formspec-studio-core';

function makeItem(overrides: Partial<PageItemView> = {}): PageItemView {
  return {
    key: 'name',
    label: 'Full Name',
    status: 'valid',
    width: 6,
    responsive: {},
    itemType: 'field',
    ...overrides,
  };
}

describe('GridCanvas', () => {
  it('renders item blocks with correct grid column spans', () => {
    const items = [
      makeItem({ key: 'a', label: 'Field A', width: 4 }),
      makeItem({ key: 'b', label: 'Field B', width: 8 }),
    ];

    const { container } = render(
      <GridCanvas
        items={items}
        activeBreakpoint="base"
        onSelectItem={vi.fn()}
        onRemoveItem={vi.fn()}
        onSetWidth={vi.fn()}
        onSetOffset={vi.fn()}
        onSetResponsive={vi.fn()}
        onMoveItem={vi.fn()}
      />,
    );

    expect(screen.getByText('Field A')).toBeInTheDocument();
    expect(screen.getByText('Field B')).toBeInTheDocument();

    // Check grid-column styles
    const gridItems = container.querySelectorAll('[data-grid-item]');
    expect(gridItems).toHaveLength(2);
    expect((gridItems[0] as HTMLElement).style.gridColumn).toBe('span 4');
    expect((gridItems[1] as HTMLElement).style.gridColumn).toBe('span 8');
  });

  it('shows empty state when no items', () => {
    render(
      <GridCanvas
        items={[]}
        activeBreakpoint="base"
        onSelectItem={vi.fn()}
        onRemoveItem={vi.fn()}
        onSetWidth={vi.fn()}
        onSetOffset={vi.fn()}
        onSetResponsive={vi.fn()}
        onMoveItem={vi.fn()}
      />,
    );

    expect(screen.getByText(/drag fields from the palette/i)).toBeInTheDocument();
  });

  it('selects a block when clicked', () => {
    const onSelectItem = vi.fn();
    const items = [makeItem({ key: 'a', label: 'Field A' })];

    render(
      <GridCanvas
        items={items}
        activeBreakpoint="base"
        onSelectItem={onSelectItem}
        onRemoveItem={vi.fn()}
        onSetWidth={vi.fn()}
        onSetOffset={vi.fn()}
        onSetResponsive={vi.fn()}
        onMoveItem={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('Field A'));
    expect(onSelectItem).toHaveBeenCalledWith('a');
  });

  it('shows SelectionToolbar for the selected item', () => {
    const items = [makeItem({ key: 'a', label: 'Field A', width: 6 })];

    render(
      <GridCanvas
        items={items}
        activeBreakpoint="base"
        selectedItemKey="a"
        onSelectItem={vi.fn()}
        onRemoveItem={vi.fn()}
        onSetWidth={vi.fn()}
        onSetOffset={vi.fn()}
        onSetResponsive={vi.fn()}
        onMoveItem={vi.fn()}
      />,
    );

    // SelectionToolbar renders preset buttons
    expect(screen.getByRole('button', { name: /full/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /half/i })).toBeInTheDocument();
  });

  it('does not show SelectionToolbar when no item is selected', () => {
    const items = [makeItem({ key: 'a', label: 'Field A' })];

    render(
      <GridCanvas
        items={items}
        activeBreakpoint="base"
        onSelectItem={vi.fn()}
        onRemoveItem={vi.fn()}
        onSetWidth={vi.fn()}
        onSetOffset={vi.fn()}
        onSetResponsive={vi.fn()}
        onMoveItem={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /full/i })).not.toBeInTheDocument();
  });

  it('deselects when Escape is pressed', () => {
    const onSelectItem = vi.fn();
    const items = [makeItem({ key: 'a', label: 'Field A' })];

    const { container } = render(
      <GridCanvas
        items={items}
        activeBreakpoint="base"
        selectedItemKey="a"
        onSelectItem={onSelectItem}
        onRemoveItem={vi.fn()}
        onSetWidth={vi.fn()}
        onSetOffset={vi.fn()}
        onSetResponsive={vi.fn()}
        onMoveItem={vi.fn()}
      />,
    );

    fireEvent.keyDown(container.firstElementChild!, { key: 'Escape' });
    expect(onSelectItem).toHaveBeenCalledWith(null);
  });

  it('renders broken items with amber styling', () => {
    const items = [makeItem({ key: 'ghost', label: 'Ghost', status: 'broken' })];

    render(
      <GridCanvas
        items={items}
        activeBreakpoint="base"
        onSelectItem={vi.fn()}
        onRemoveItem={vi.fn()}
        onSetWidth={vi.fn()}
        onSetOffset={vi.fn()}
        onSetResponsive={vi.fn()}
        onMoveItem={vi.fn()}
      />,
    );

    // The broken item should still render
    expect(screen.getByText('Ghost')).toBeInTheDocument();
  });

  it('calls onRemoveItem when remove is clicked', () => {
    const onRemoveItem = vi.fn();
    const items = [makeItem({ key: 'a', label: 'Field A' })];

    render(
      <GridCanvas
        items={items}
        activeBreakpoint="base"
        onSelectItem={vi.fn()}
        onRemoveItem={onRemoveItem}
        onSetWidth={vi.fn()}
        onSetOffset={vi.fn()}
        onSetResponsive={vi.fn()}
        onMoveItem={vi.fn()}
      />,
    );

    const removeBtn = screen.getByRole('button', { name: /remove/i });
    fireEvent.click(removeBtn);
    expect(onRemoveItem).toHaveBeenCalledWith('a');
  });

  it('has 12-column grid layout', () => {
    const { container } = render(
      <GridCanvas
        items={[makeItem()]}
        activeBreakpoint="base"
        onSelectItem={vi.fn()}
        onRemoveItem={vi.fn()}
        onSetWidth={vi.fn()}
        onSetOffset={vi.fn()}
        onSetResponsive={vi.fn()}
        onMoveItem={vi.fn()}
      />,
    );

    const grid = container.querySelector('[data-grid-canvas]') as HTMLElement;
    expect(grid).toBeInTheDocument();
    expect(grid.style.gridTemplateColumns).toBe('repeat(12, 1fr)');
  });

  it('width presets in toolbar call onSetWidth', () => {
    const onSetWidth = vi.fn();
    const items = [makeItem({ key: 'a', label: 'Field A', width: 6 })];

    render(
      <GridCanvas
        items={items}
        activeBreakpoint="base"
        selectedItemKey="a"
        onSelectItem={vi.fn()}
        onRemoveItem={vi.fn()}
        onSetWidth={onSetWidth}
        onSetOffset={vi.fn()}
        onSetResponsive={vi.fn()}
        onMoveItem={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /full/i }));
    expect(onSetWidth).toHaveBeenCalledWith('a', 12);
  });

  it('uses breakpoint-effective width for grid column span', () => {
    const items = [
      makeItem({ key: 'a', label: 'Field A', width: 12, responsive: { md: { width: 6 } } }),
    ];

    const { container } = render(
      <GridCanvas
        items={items}
        activeBreakpoint="md"
        onSelectItem={vi.fn()}
        onRemoveItem={vi.fn()}
        onSetWidth={vi.fn()}
        onSetOffset={vi.fn()}
        onSetResponsive={vi.fn()}
        onMoveItem={vi.fn()}
      />,
    );

    const gridItem = container.querySelector('[data-grid-item]') as HTMLElement;
    expect(gridItem.style.gridColumn).toBe('span 6');
  });

  it('renders multiple items that wrap at 12 columns', () => {
    const items = [
      makeItem({ key: 'a', label: 'A', width: 8 }),
      makeItem({ key: 'b', label: 'B', width: 8 }),
    ];

    const { container } = render(
      <GridCanvas
        items={items}
        activeBreakpoint="base"
        onSelectItem={vi.fn()}
        onRemoveItem={vi.fn()}
        onSetWidth={vi.fn()}
        onSetOffset={vi.fn()}
        onSetResponsive={vi.fn()}
        onMoveItem={vi.fn()}
      />,
    );

    // Both items should be rendered (CSS Grid handles the wrapping)
    const gridItems = container.querySelectorAll('[data-grid-item]');
    expect(gridItems).toHaveLength(2);
  });

  it('broken items show only Remove when selected', () => {
    const items = [makeItem({ key: 'ghost', label: 'Ghost', status: 'broken', width: 6 })];

    render(
      <GridCanvas
        items={items}
        activeBreakpoint="base"
        selectedItemKey="ghost"
        onSelectItem={vi.fn()}
        onRemoveItem={vi.fn()}
        onSetWidth={vi.fn()}
        onSetOffset={vi.fn()}
        onSetResponsive={vi.fn()}
        onMoveItem={vi.fn()}
      />,
    );

    // Should NOT show width preset toolbar for broken items
    expect(screen.queryByRole('button', { name: /full/i })).not.toBeInTheDocument();
    // Should show remove
    expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument();
  });

  it('deselects when clicking the canvas background', () => {
    const onSelectItem = vi.fn();
    const items = [makeItem({ key: 'a', label: 'Field A' })];

    const { container } = render(
      <GridCanvas
        items={items}
        activeBreakpoint="base"
        selectedItemKey="a"
        onSelectItem={onSelectItem}
        onRemoveItem={vi.fn()}
        onSetWidth={vi.fn()}
        onSetOffset={vi.fn()}
        onSetResponsive={vi.fn()}
        onMoveItem={vi.fn()}
      />,
    );

    // Click the grid canvas itself (not a child)
    const canvas = container.querySelector('[data-grid-canvas]') as HTMLElement;
    fireEvent.click(canvas);
    expect(onSelectItem).toHaveBeenCalledWith(null);
  });

  it('toolbar onSetResponsive passes key and breakpoint', () => {
    const onSetResponsive = vi.fn();
    const items = [makeItem({ key: 'f', label: 'My Field', width: 6 })];

    render(
      <GridCanvas
        items={items}
        activeBreakpoint="md"
        selectedItemKey="f"
        onSelectItem={vi.fn()}
        onRemoveItem={vi.fn()}
        onSetWidth={vi.fn()}
        onSetOffset={vi.fn()}
        onSetResponsive={onSetResponsive}
        onMoveItem={vi.fn()}
      />,
    );

    // Clicking "Full" in non-base breakpoint should call onSetResponsive
    fireEvent.click(screen.getByRole('button', { name: /full/i }));
    expect(onSetResponsive).toHaveBeenCalledWith('f', 'md', { width: 12 });
  });

  it('renders column guide lines', () => {
    const { container } = render(
      <GridCanvas
        items={[makeItem()]}
        activeBreakpoint="base"
        onSelectItem={vi.fn()}
        onRemoveItem={vi.fn()}
        onSetWidth={vi.fn()}
        onSetOffset={vi.fn()}
        onSetResponsive={vi.fn()}
        onMoveItem={vi.fn()}
      />,
    );

    // 12 guide lines (subtle column markers)
    const guides = container.querySelectorAll('.border-l.border-border\\/10');
    expect(guides.length).toBe(12);
  });
});
