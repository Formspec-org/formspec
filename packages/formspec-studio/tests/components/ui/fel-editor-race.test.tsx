import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FELEditor } from '../../../src/components/ui/FELEditor';

describe('FELEditor blur-to-save', () => {
  it('saves the current draft value on blur', async () => {
    const onSave = vi.fn();
    render(<FELEditor value="initial" onSave={onSave} />);

    const textarea = screen.getByDisplayValue('initial');
    fireEvent.change(textarea, { target: { value: 'updated' } });

    await act(async () => {
      fireEvent.blur(textarea);
      await new Promise(r => setTimeout(r, 200));
    });

    expect(onSave).toHaveBeenCalledWith('updated');
  });

  it('uses latest draft ref, not stale closure', async () => {
    const onSave = vi.fn();
    const { rerender } = render(<FELEditor value="initial" onSave={onSave} />);

    const textarea = screen.getByDisplayValue('initial');
    fireEvent.change(textarea, { target: { value: 'first' } });

    fireEvent.blur(textarea);

    await act(async () => {
      await new Promise(r => setTimeout(r, 200));
    });

    expect(onSave).toHaveBeenCalledWith('first');
  });
});
