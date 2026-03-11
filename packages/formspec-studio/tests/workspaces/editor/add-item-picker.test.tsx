import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AddItemPicker } from '../../../src/workspaces/editor/AddItemPicker';

describe('AddItemPicker', () => {
  it('shows item type options', () => {
    render(<AddItemPicker onAdd={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/field/i)).toBeInTheDocument();
    expect(screen.getByText(/group/i)).toBeInTheDocument();
    expect(screen.getByText(/display/i)).toBeInTheDocument();
  });

  it('calls onAdd with type when a non-field type is clicked', async () => {
    const onAdd = vi.fn();
    render(<AddItemPicker onAdd={onAdd} onClose={vi.fn()} />);
    await act(async () => {
      screen.getByText(/group/i).click();
    });
    expect(onAdd).toHaveBeenCalledWith('group', undefined);
  });

  it('shows data type choices when field is selected', async () => {
    render(<AddItemPicker onAdd={vi.fn()} onClose={vi.fn()} />);
    await act(async () => {
      screen.getByText(/field/i).click();
    });
    expect(screen.getByText(/string/i)).toBeInTheDocument();
    expect(screen.getByText(/integer/i)).toBeInTheDocument();
    expect(screen.getByText(/boolean/i)).toBeInTheDocument();
  });

  it('calls onAdd with field type and data type', async () => {
    const onAdd = vi.fn();
    render(<AddItemPicker onAdd={onAdd} onClose={vi.fn()} />);
    await act(async () => {
      screen.getByText(/field/i).click();
    });
    await act(async () => {
      screen.getByText(/string/i).click();
    });
    expect(onAdd).toHaveBeenCalledWith('field', 'string');
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    render(<AddItemPicker onAdd={vi.fn()} onClose={onClose} />);
    await act(async () => {
      screen.getByRole('button', { name: /close/i }).click();
    });
    expect(onClose).toHaveBeenCalled();
  });
});
