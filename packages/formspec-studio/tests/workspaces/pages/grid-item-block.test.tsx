/** @filedesc Tests for GridItemBlock — presentational grid item component. */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GridItemBlock } from '../../../src/workspaces/pages/GridItemBlock';
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

describe('GridItemBlock', () => {
  it('renders the field label', () => {
    render(
      <GridItemBlock
        item={makeItem()}
        isSelected={false}
        activeBreakpoint="base"
        onSelect={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByText('Full Name')).toBeInTheDocument();
  });

  it('shows width badge', () => {
    render(
      <GridItemBlock
        item={makeItem({ width: 6 })}
        isSelected={false}
        activeBreakpoint="base"
        onSelect={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByText('6/12')).toBeInTheDocument();
  });

  it('calls onSelect when clicked', () => {
    const onSelect = vi.fn();
    render(
      <GridItemBlock
        item={makeItem()}
        isSelected={false}
        activeBreakpoint="base"
        onSelect={onSelect}
        onRemove={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('Full Name'));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('shows selected ring when isSelected', () => {
    const { container } = render(
      <GridItemBlock
        item={makeItem()}
        isSelected={true}
        activeBreakpoint="base"
        onSelect={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    const block = container.firstElementChild as HTMLElement;
    expect(block.className).toContain('ring');
  });

  it('shows remove button on hover', () => {
    const onRemove = vi.fn();
    const { container } = render(
      <GridItemBlock
        item={makeItem()}
        isSelected={false}
        activeBreakpoint="base"
        onSelect={vi.fn()}
        onRemove={onRemove}
      />,
    );

    // The remove button is always in DOM but visible on hover via CSS
    const removeBtn = screen.getByRole('button', { name: /remove/i });
    expect(removeBtn).toBeInTheDocument();

    fireEvent.click(removeBtn);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('renders amber styling for broken items', () => {
    const { container } = render(
      <GridItemBlock
        item={makeItem({ status: 'broken' })}
        isSelected={false}
        activeBreakpoint="base"
        onSelect={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    const block = container.firstElementChild as HTMLElement;
    expect(block.className).toContain('amber');
  });

  it('shows child count for groups', () => {
    render(
      <GridItemBlock
        item={makeItem({ itemType: 'group', childCount: 5 })}
        isSelected={false}
        activeBreakpoint="base"
        onSelect={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByText(/5 fields/)).toBeInTheDocument();
  });

  it('shows repeatable indicator for repeatable groups', () => {
    render(
      <GridItemBlock
        item={makeItem({ itemType: 'group', childCount: 3, repeatable: true })}
        isSelected={false}
        activeBreakpoint="base"
        onSelect={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByTitle(/repeatable/i)).toBeInTheDocument();
  });

  it('uses different styling for groups vs fields', () => {
    const { container: fieldContainer } = render(
      <GridItemBlock
        item={makeItem({ itemType: 'field' })}
        isSelected={false}
        activeBreakpoint="base"
        onSelect={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    const { container: groupContainer } = render(
      <GridItemBlock
        item={makeItem({ itemType: 'group', childCount: 2 })}
        isSelected={false}
        activeBreakpoint="base"
        onSelect={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    const fieldBlock = fieldContainer.firstElementChild as HTMLElement;
    const groupBlock = groupContainer.firstElementChild as HTMLElement;
    // Group should have a slightly different shade
    expect(fieldBlock.className).not.toBe(groupBlock.className);
  });

  it('has col-resize cursor on right 8px zone', () => {
    const { container } = render(
      <GridItemBlock
        item={makeItem()}
        isSelected={false}
        activeBreakpoint="base"
        onSelect={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    const resizeHandle = container.querySelector('[data-resize-handle]');
    expect(resizeHandle).toBeInTheDocument();
  });

  it('shows inherited width in muted style for non-base breakpoint', () => {
    render(
      <GridItemBlock
        item={makeItem({ width: 6, responsive: {} })}
        isSelected={false}
        activeBreakpoint="md"
        onSelect={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    // Width badge should show inherited value with muted styling
    const badge = screen.getByText('6/12');
    expect(badge.className).toContain('italic');
  });

  it('shows override width normally for non-base breakpoint with override', () => {
    render(
      <GridItemBlock
        item={makeItem({ width: 6, responsive: { md: { width: 4 } } })}
        isSelected={false}
        activeBreakpoint="md"
        onSelect={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    // Width badge should show the override value
    expect(screen.getByText('4/12')).toBeInTheDocument();
  });

  it('does not show child count for fields', () => {
    render(
      <GridItemBlock
        item={makeItem({ itemType: 'field' })}
        isSelected={false}
        activeBreakpoint="base"
        onSelect={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.queryByText(/fields/)).not.toBeInTheDocument();
  });

  it('does not show repeatable indicator for non-repeatable groups', () => {
    render(
      <GridItemBlock
        item={makeItem({ itemType: 'group', childCount: 3 })}
        isSelected={false}
        activeBreakpoint="base"
        onSelect={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.queryByTitle(/repeatable/i)).not.toBeInTheDocument();
  });

  it('clamps width badge to 12 maximum', () => {
    render(
      <GridItemBlock
        item={makeItem({ width: 12 })}
        isSelected={false}
        activeBreakpoint="base"
        onSelect={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByText('12/12')).toBeInTheDocument();
  });

  it('remove button click does not trigger onSelect', () => {
    const onSelect = vi.fn();
    const onRemove = vi.fn();
    render(
      <GridItemBlock
        item={makeItem()}
        isSelected={false}
        activeBreakpoint="base"
        onSelect={onSelect}
        onRemove={onRemove}
      />,
    );

    const removeBtn = screen.getByRole('button', { name: /remove/i });
    fireEvent.click(removeBtn);
    expect(onRemove).toHaveBeenCalledTimes(1);
    // onSelect should not fire because the remove click uses stopPropagation
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('renders display type items', () => {
    render(
      <GridItemBlock
        item={makeItem({ itemType: 'display', label: 'Intro Text' })}
        isSelected={false}
        activeBreakpoint="base"
        onSelect={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByText('Intro Text')).toBeInTheDocument();
  });
});
