import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { InlineExpression } from '../../../src/components/ui/InlineExpression';

/** Helper: find the display chip by its title attribute (value is set as title). */
function getDisplayChip(value: string) {
  return screen.getByTitle(value);
}

describe('InlineExpression', () => {
  it('renders expression as styled text when not editing', () => {
    render(<InlineExpression value="$age >= 18" onSave={vi.fn()} />);
    expect(getDisplayChip('$age >= 18')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('click enters edit mode (shows textarea)', () => {
    render(<InlineExpression value="$age >= 18" onSave={vi.fn()} />);
    fireEvent.click(getDisplayChip('$age >= 18'));
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('$age >= 18');
  });

  it('escape cancels and reverts to original', () => {
    const onSave = vi.fn();
    render(<InlineExpression value="$age >= 18" onSave={onSave} />);
    fireEvent.click(getDisplayChip('$age >= 18'));
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '$age >= 21' } });
    fireEvent.keyDown(textarea, { key: 'Escape' });
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(getDisplayChip('$age >= 18')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('Cmd+Enter saves and calls onSave', () => {
    const onSave = vi.fn();
    render(<InlineExpression value="$age >= 18" onSave={onSave} />);
    fireEvent.click(getDisplayChip('$age >= 18'));
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '$age >= 21' } });
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });
    expect(onSave).toHaveBeenCalledWith('$age >= 21');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('blur saves and calls onSave', () => {
    vi.useFakeTimers();
    const onSave = vi.fn();
    render(<InlineExpression value="$age >= 18" onSave={onSave} />);
    fireEvent.click(getDisplayChip('$age >= 18'));
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '$age >= 21' } });
    fireEvent.blur(textarea);
    vi.advanceTimersByTime(250);
    expect(onSave).toHaveBeenCalledWith('$age >= 21');
    vi.useRealTimers();
  });

  it('onSave not called if value unchanged', () => {
    const onSave = vi.fn();
    render(<InlineExpression value="$age >= 18" onSave={onSave} />);
    fireEvent.click(getDisplayChip('$age >= 18'));
    fireEvent.blur(screen.getByRole('textbox'));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('textarea auto-focuses on edit mode', () => {
    render(<InlineExpression value="$age >= 18" onSave={vi.fn()} />);
    fireEvent.click(getDisplayChip('$age >= 18'));
    expect(screen.getByRole('textbox')).toHaveFocus();
  });

  it('shows placeholder when empty and not editing', () => {
    render(<InlineExpression value="" onSave={vi.fn()} placeholder="Click to add expression" />);
    expect(screen.getByText('Click to add expression')).toBeInTheDocument();
  });

  it('clicking placeholder enters edit mode', () => {
    render(<InlineExpression value="" onSave={vi.fn()} placeholder="Click to add expression" />);
    fireEvent.click(screen.getByText('Click to add expression'));
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('Ctrl+Enter also saves (non-Mac)', () => {
    const onSave = vi.fn();
    render(<InlineExpression value="old" onSave={onSave} />);
    fireEvent.click(getDisplayChip('old'));
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'new' } });
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });
    expect(onSave).toHaveBeenCalledWith('new');
  });

  it('renders syntax-highlighted tokens in display mode', () => {
    const { container } = render(<InlineExpression value="$field > 10" onSave={vi.fn()} />);
    const chip = getDisplayChip('$field > 10');
    // Path token should have green highlighting
    const spans = chip.querySelectorAll('span');
    const pathSpan = Array.from(spans).find(s => s.textContent?.includes('$field'));
    expect(pathSpan).toBeTruthy();
    expect(pathSpan!.className).toContain('text-green');
  });
});
