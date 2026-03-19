/** @filedesc Tests for SelectionToolbar — width presets, custom input, offset, and breakpoint awareness. */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SelectionToolbar } from '../../../src/workspaces/pages/SelectionToolbar';
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

describe('SelectionToolbar', () => {
  it('renders width preset buttons', () => {
    render(
      <SelectionToolbar
        item={makeItem()}
        activeBreakpoint="base"
        onSetWidth={vi.fn()}
        onSetOffset={vi.fn()}
        onSetResponsive={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /full/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /half/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /third/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /quarter/i })).toBeInTheDocument();
  });

  it('calls onSetWidth for Full preset (12) in base breakpoint', () => {
    const onSetWidth = vi.fn();
    render(
      <SelectionToolbar
        item={makeItem({ width: 6 })}
        activeBreakpoint="base"
        onSetWidth={onSetWidth}
        onSetOffset={vi.fn()}
        onSetResponsive={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /full/i }));
    expect(onSetWidth).toHaveBeenCalledWith(12);
  });

  it('calls onSetWidth for Half preset (6)', () => {
    const onSetWidth = vi.fn();
    render(
      <SelectionToolbar
        item={makeItem({ width: 12 })}
        activeBreakpoint="base"
        onSetWidth={onSetWidth}
        onSetOffset={vi.fn()}
        onSetResponsive={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /half/i }));
    expect(onSetWidth).toHaveBeenCalledWith(6);
  });

  it('calls onSetWidth for Third preset (4)', () => {
    const onSetWidth = vi.fn();
    render(
      <SelectionToolbar
        item={makeItem()}
        activeBreakpoint="base"
        onSetWidth={onSetWidth}
        onSetOffset={vi.fn()}
        onSetResponsive={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /third/i }));
    expect(onSetWidth).toHaveBeenCalledWith(4);
  });

  it('calls onSetWidth for Quarter preset (3)', () => {
    const onSetWidth = vi.fn();
    render(
      <SelectionToolbar
        item={makeItem()}
        activeBreakpoint="base"
        onSetWidth={onSetWidth}
        onSetOffset={vi.fn()}
        onSetResponsive={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /quarter/i }));
    expect(onSetWidth).toHaveBeenCalledWith(3);
  });

  it('has custom width input', () => {
    render(
      <SelectionToolbar
        item={makeItem({ width: 8 })}
        activeBreakpoint="base"
        onSetWidth={vi.fn()}
        onSetOffset={vi.fn()}
        onSetResponsive={vi.fn()}
      />,
    );

    const input = screen.getByRole('spinbutton', { name: /custom width/i });
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue(8);
  });

  it('calls onSetWidth when custom width is changed and blurred', () => {
    const onSetWidth = vi.fn();
    render(
      <SelectionToolbar
        item={makeItem({ width: 6 })}
        activeBreakpoint="base"
        onSetWidth={onSetWidth}
        onSetOffset={vi.fn()}
        onSetResponsive={vi.fn()}
      />,
    );

    const input = screen.getByRole('spinbutton', { name: /custom width/i });
    fireEvent.change(input, { target: { value: '9' } });
    fireEvent.blur(input);
    expect(onSetWidth).toHaveBeenCalledWith(9);
  });

  it('does not call onSetWidth for invalid custom width (0)', () => {
    const onSetWidth = vi.fn();
    render(
      <SelectionToolbar
        item={makeItem({ width: 6 })}
        activeBreakpoint="base"
        onSetWidth={onSetWidth}
        onSetOffset={vi.fn()}
        onSetResponsive={vi.fn()}
      />,
    );

    const input = screen.getByRole('spinbutton', { name: /custom width/i });
    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.blur(input);
    expect(onSetWidth).not.toHaveBeenCalled();
  });

  it('does not call onSetWidth for invalid custom width (13)', () => {
    const onSetWidth = vi.fn();
    render(
      <SelectionToolbar
        item={makeItem({ width: 6 })}
        activeBreakpoint="base"
        onSetWidth={onSetWidth}
        onSetOffset={vi.fn()}
        onSetResponsive={vi.fn()}
      />,
    );

    const input = screen.getByRole('spinbutton', { name: /custom width/i });
    fireEvent.change(input, { target: { value: '13' } });
    fireEvent.blur(input);
    expect(onSetWidth).not.toHaveBeenCalled();
  });

  it('offset section is collapsed by default', () => {
    render(
      <SelectionToolbar
        item={makeItem()}
        activeBreakpoint="base"
        onSetWidth={vi.fn()}
        onSetOffset={vi.fn()}
        onSetResponsive={vi.fn()}
      />,
    );

    // Offset input should not be visible by default
    expect(screen.queryByRole('spinbutton', { name: /offset/i })).not.toBeInTheDocument();
    // But the toggle should be visible
    expect(screen.getByRole('button', { name: /offset/i })).toBeInTheDocument();
  });

  it('shows offset input when Offset toggle is clicked', () => {
    render(
      <SelectionToolbar
        item={makeItem()}
        activeBreakpoint="base"
        onSetWidth={vi.fn()}
        onSetOffset={vi.fn()}
        onSetResponsive={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /offset/i }));
    expect(screen.getByRole('spinbutton', { name: /offset/i })).toBeInTheDocument();
  });

  it('calls onSetOffset when offset value is changed', () => {
    const onSetOffset = vi.fn();
    render(
      <SelectionToolbar
        item={makeItem({ offset: 2 })}
        activeBreakpoint="base"
        onSetWidth={vi.fn()}
        onSetOffset={onSetOffset}
        onSetResponsive={vi.fn()}
      />,
    );

    // Offset is shown because item has an offset value
    fireEvent.click(screen.getByRole('button', { name: /offset/i }));
    const input = screen.getByRole('spinbutton', { name: /offset/i });
    fireEvent.change(input, { target: { value: '4' } });
    fireEvent.blur(input);
    expect(onSetOffset).toHaveBeenCalledWith(4);
  });

  // ── Breakpoint-aware behavior ──────────────────────────────────────

  it('calls onSetResponsive instead of onSetWidth for non-base breakpoint', () => {
    const onSetWidth = vi.fn();
    const onSetResponsive = vi.fn();
    render(
      <SelectionToolbar
        item={makeItem({ width: 6 })}
        activeBreakpoint="md"
        onSetWidth={onSetWidth}
        onSetOffset={vi.fn()}
        onSetResponsive={onSetResponsive}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /full/i }));
    expect(onSetWidth).not.toHaveBeenCalled();
    expect(onSetResponsive).toHaveBeenCalledWith('md', { width: 12 });
  });

  it('calls onSetResponsive for custom width in non-base breakpoint', () => {
    const onSetResponsive = vi.fn();
    render(
      <SelectionToolbar
        item={makeItem({ width: 6 })}
        activeBreakpoint="sm"
        onSetWidth={vi.fn()}
        onSetOffset={vi.fn()}
        onSetResponsive={onSetResponsive}
      />,
    );

    const input = screen.getByRole('spinbutton', { name: /custom width/i });
    fireEvent.change(input, { target: { value: '8' } });
    fireEvent.blur(input);
    expect(onSetResponsive).toHaveBeenCalledWith('sm', { width: 8 });
  });

  it('calls onSetResponsive for offset in non-base breakpoint', () => {
    const onSetResponsive = vi.fn();
    render(
      <SelectionToolbar
        item={makeItem({ width: 6 })}
        activeBreakpoint="lg"
        onSetWidth={vi.fn()}
        onSetOffset={vi.fn()}
        onSetResponsive={onSetResponsive}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /offset/i }));
    const input = screen.getByRole('spinbutton', { name: /offset/i });
    fireEvent.change(input, { target: { value: '3' } });
    fireEvent.blur(input);
    expect(onSetResponsive).toHaveBeenCalledWith('lg', { offset: 3 });
  });

  it('highlights the active width preset button', () => {
    render(
      <SelectionToolbar
        item={makeItem({ width: 6 })}
        activeBreakpoint="base"
        onSetWidth={vi.fn()}
        onSetOffset={vi.fn()}
        onSetResponsive={vi.fn()}
      />,
    );

    const halfBtn = screen.getByRole('button', { name: /half/i });
    // Half = width 6, should be visually active
    expect(halfBtn.getAttribute('aria-pressed')).toBe('true');
  });
});
