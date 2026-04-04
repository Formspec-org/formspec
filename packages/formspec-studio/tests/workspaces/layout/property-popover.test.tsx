/** @filedesc Tests for PropertyPopover — Tier 3 overflow popover with dirty guard. */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PropertyPopover, type PropertyPopoverProps } from '../../../src/workspaces/layout/PropertyPopover';

function makeProps(overrides: Partial<PropertyPopoverProps> = {}): PropertyPopoverProps {
  return {
    open: true,
    anchorRef: { current: null },
    nodeProps: {},
    isContainer: true,
    onSetProp: vi.fn(),
    onSetStyle: vi.fn(),
    onStyleRemove: vi.fn(),
    onUnwrap: vi.fn(),
    onRemove: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

// ── Open/close ────────────────────────────────────────────────────────────

describe('PropertyPopover — visibility', () => {
  it('renders when open=true', () => {
    render(<PropertyPopover {...makeProps({ open: true })} />);
    expect(screen.getByTestId('property-popover')).toBeInTheDocument();
  });

  it('does not render when open=false', () => {
    render(<PropertyPopover {...makeProps({ open: false })} />);
    expect(screen.queryByTestId('property-popover')).toBeNull();
  });
});

// ── Accessibility inputs ──────────────────────────────────────────────────

describe('PropertyPopover — accessibility inputs', () => {
  it('renders aria-label input', () => {
    render(<PropertyPopover {...makeProps()} />);
    expect(screen.getByTestId('popover-aria-label')).toBeInTheDocument();
  });

  it('renders aria-role input', () => {
    render(<PropertyPopover {...makeProps()} />);
    expect(screen.getByTestId('popover-aria-role')).toBeInTheDocument();
  });

  it('populates aria-label from nodeProps.accessibility.description', () => {
    render(<PropertyPopover {...makeProps({ nodeProps: { accessibility: { description: 'My Label' } } })} />);
    expect(screen.getByTestId('popover-aria-label')).toHaveValue('My Label');
  });

  it('populates aria-role from nodeProps.accessibility.role', () => {
    render(<PropertyPopover {...makeProps({ nodeProps: { accessibility: { role: 'region' } } })} />);
    expect(screen.getByTestId('popover-aria-role')).toHaveValue('region');
  });

  it('commits aria-label on blur', () => {
    const onSetProp = vi.fn();
    render(<PropertyPopover {...makeProps({ onSetProp, nodeProps: {} })} />);
    const input = screen.getByTestId('popover-aria-label');
    fireEvent.change(input, { target: { value: 'Heading region' } });
    fireEvent.blur(input);
    expect(onSetProp).toHaveBeenCalledWith('accessibility', expect.objectContaining({ description: 'Heading region' }));
  });

  it('commits aria-role on blur', () => {
    const onSetProp = vi.fn();
    render(<PropertyPopover {...makeProps({ onSetProp, nodeProps: {} })} />);
    const input = screen.getByTestId('popover-aria-role');
    fireEvent.change(input, { target: { value: 'navigation' } });
    fireEvent.blur(input);
    expect(onSetProp).toHaveBeenCalledWith('accessibility', expect.objectContaining({ role: 'navigation' }));
  });
});

// ── Style overrides ───────────────────────────────────────────────────────

describe('PropertyPopover — style overrides', () => {
  it('renders "+ add" button for style overrides', () => {
    render(<PropertyPopover {...makeProps()} />);
    expect(screen.getByTestId('popover-style-add')).toBeInTheDocument();
  });

  it('renders existing style override rows', () => {
    render(<PropertyPopover {...makeProps({ nodeProps: { style: { margin: '8px', fontSize: '14px' } } })} />);
    expect(screen.getByTestId('style-row-margin')).toBeInTheDocument();
    expect(screen.getByTestId('style-row-fontSize')).toBeInTheDocument();
  });

  it('renders remove button for each style row', () => {
    render(<PropertyPopover {...makeProps({ nodeProps: { style: { margin: '8px' } } })} />);
    expect(screen.getByTestId('style-row-remove-margin')).toBeInTheDocument();
  });

  it('calls onStyleRemove when remove button clicked', () => {
    const onStyleRemove = vi.fn();
    render(<PropertyPopover {...makeProps({ nodeProps: { style: { margin: '8px' } }, onStyleRemove })} />);
    fireEvent.click(screen.getByTestId('style-row-remove-margin'));
    expect(onStyleRemove).toHaveBeenCalledWith('margin');
  });

  it('adds a new style row when + add clicked', () => {
    render(<PropertyPopover {...makeProps()} />);
    fireEvent.click(screen.getByTestId('popover-style-add'));
    expect(screen.getByTestId('style-new-key-input')).toBeInTheDocument();
    expect(screen.getByTestId('style-new-value-input')).toBeInTheDocument();
  });

  it('calls onSetStyle when new style entry committed', () => {
    const onSetStyle = vi.fn();
    render(<PropertyPopover {...makeProps({ onSetStyle })} />);
    fireEvent.click(screen.getByTestId('popover-style-add'));
    fireEvent.change(screen.getByTestId('style-new-key-input'), { target: { value: 'padding' } });
    fireEvent.change(screen.getByTestId('style-new-value-input'), { target: { value: '16px' } });
    fireEvent.click(screen.getByTestId('style-new-commit'));
    expect(onSetStyle).toHaveBeenCalledWith('padding', '16px');
  });
});

// ── CSS class input ───────────────────────────────────────────────────────

describe('PropertyPopover — CSS class', () => {
  it('renders css-class input', () => {
    render(<PropertyPopover {...makeProps()} />);
    expect(screen.getByTestId('popover-css-class')).toBeInTheDocument();
  });

  it('populates css-class from nodeProps.cssClass', () => {
    render(<PropertyPopover {...makeProps({ nodeProps: { cssClass: 'my-container' } })} />);
    expect(screen.getByTestId('popover-css-class')).toHaveValue('my-container');
  });

  it('commits css-class on blur', () => {
    const onSetProp = vi.fn();
    render(<PropertyPopover {...makeProps({ onSetProp })} />);
    const input = screen.getByTestId('popover-css-class');
    fireEvent.change(input, { target: { value: 'custom-class' } });
    fireEvent.blur(input);
    expect(onSetProp).toHaveBeenCalledWith('cssClass', 'custom-class');
  });
});

// ── Actions ───────────────────────────────────────────────────────────────

describe('PropertyPopover — actions', () => {
  it('renders Unwrap button for containers', () => {
    render(<PropertyPopover {...makeProps({ isContainer: true })} />);
    expect(screen.getByTestId('popover-unwrap')).toBeInTheDocument();
  });

  it('does not render Unwrap button for non-containers (fields)', () => {
    render(<PropertyPopover {...makeProps({ isContainer: false })} />);
    expect(screen.queryByTestId('popover-unwrap')).toBeNull();
  });

  it('calls onUnwrap when Unwrap clicked', () => {
    const onUnwrap = vi.fn();
    render(<PropertyPopover {...makeProps({ isContainer: true, onUnwrap })} />);
    fireEvent.click(screen.getByTestId('popover-unwrap'));
    expect(onUnwrap).toHaveBeenCalled();
  });

  it('renders Remove from Tree button for all', () => {
    render(<PropertyPopover {...makeProps({ isContainer: false })} />);
    expect(screen.getByTestId('popover-remove')).toBeInTheDocument();
  });

  it('calls onRemove when Remove from Tree clicked', () => {
    const onRemove = vi.fn();
    render(<PropertyPopover {...makeProps({ onRemove })} />);
    fireEvent.click(screen.getByTestId('popover-remove'));
    expect(onRemove).toHaveBeenCalled();
  });
});

// ── Dirty guard ───────────────────────────────────────────────────────────

describe('PropertyPopover — dirty guard', () => {
  it('closes on Escape when no inputs are dirty', () => {
    const onClose = vi.fn();
    render(<PropertyPopover {...makeProps({ onClose })} />);
    fireEvent.keyDown(screen.getByTestId('property-popover'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('shows dirty-guard confirm when Escape pressed with uncommitted input', () => {
    render(<PropertyPopover {...makeProps()} />);
    const input = screen.getByTestId('popover-css-class');
    fireEvent.change(input, { target: { value: 'unsaved' } });
    fireEvent.keyDown(screen.getByTestId('property-popover'), { key: 'Escape' });
    expect(screen.getByTestId('dirty-guard-confirm')).toBeInTheDocument();
  });

  it('dismisses via confirm discard', () => {
    const onClose = vi.fn();
    render(<PropertyPopover {...makeProps({ onClose })} />);
    const input = screen.getByTestId('popover-css-class');
    fireEvent.change(input, { target: { value: 'unsaved' } });
    fireEvent.keyDown(screen.getByTestId('property-popover'), { key: 'Escape' });
    fireEvent.click(screen.getByTestId('dirty-guard-discard'));
    expect(onClose).toHaveBeenCalled();
  });

  it('cancels discard — popover stays open and input retains draft', () => {
    const onClose = vi.fn();
    render(<PropertyPopover {...makeProps({ onClose })} />);
    const input = screen.getByTestId('popover-css-class');
    fireEvent.change(input, { target: { value: 'unsaved' } });
    fireEvent.keyDown(screen.getByTestId('property-popover'), { key: 'Escape' });
    fireEvent.click(screen.getByTestId('dirty-guard-cancel'));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByTestId('dirty-guard-confirm')).toBeNull();
    expect(screen.getByTestId('popover-css-class')).toHaveValue('unsaved');
  });

  it('rapid typing does not inflate dirty count — two changes to same field still reads as one dirty input', () => {
    render(<PropertyPopover {...makeProps()} />);
    const input = screen.getByTestId('popover-css-class');
    // Type twice — with integer counter this would inflate to 2 (both fire dirty=true without intervening false)
    fireEvent.change(input, { target: { value: 'a' } });
    fireEvent.change(input, { target: { value: 'ab' } });
    // Now blur (dirty=false) — with integer counter c goes 0→1→2 then 2-1=1, still thinks dirty
    fireEvent.blur(input);
    // After blur the input is committed — popover should close cleanly on Escape, no guard needed
    const onClose = vi.fn();
    const { rerender } = render(<PropertyPopover {...makeProps({ onClose })} />);
    const input2 = screen.getAllByTestId('popover-css-class')[1];
    fireEvent.change(input2, { target: { value: 'a' } });
    fireEvent.change(input2, { target: { value: 'ab' } });
    fireEvent.blur(input2);
    // After blur commits, the input is no longer dirty — Escape should close without guard
    fireEvent.keyDown(screen.getAllByTestId('property-popover')[1], { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
