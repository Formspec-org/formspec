/** @filedesc Unit tests for OptionsModal component. */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { OptionsModal } from '../../../src/components/ui/OptionsModal';

const baseProps = {
  open: true,
  itemLabel: 'Favorite color',
  itemPath: '/items/favorite_color',
  options: [
    { value: 'red', label: 'Red' },
    { value: 'blue', label: 'Blue', keywords: ['sky', 'ocean'] },
  ],
  onUpdateOptions: vi.fn(),
  onClose: vi.fn(),
};

function renderModal(overrides: Partial<typeof baseProps> = {}) {
  const props = { ...baseProps, onUpdateOptions: vi.fn(), onClose: vi.fn(), ...overrides };
  const result = render(<OptionsModal {...props} />);
  return { ...result, props };
}

describe('OptionsModal', () => {
  it('does not render when open is false', () => {
    renderModal({ open: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders dialog with option inputs when open', () => {
    renderModal();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    // Should have value + label inputs for each option
    expect(screen.getByLabelText('Option 1 value')).toHaveValue('red');
    expect(screen.getByLabelText('Option 1 label')).toHaveValue('Red');
    expect(screen.getByLabelText('Option 2 value')).toHaveValue('blue');
    expect(screen.getByLabelText('Option 2 label')).toHaveValue('Blue');
  });

  it('calls onUpdateOptions when option value is changed', () => {
    const { props } = renderModal();
    const input = screen.getByLabelText('Option 1 value');
    fireEvent.change(input, { target: { value: 'green' } });
    expect(props.onUpdateOptions).toHaveBeenCalledWith([
      { value: 'green', label: 'Red' },
      { value: 'blue', label: 'Blue', keywords: ['sky', 'ocean'] },
    ]);
  });

  it('calls onUpdateOptions when "Add option" is clicked', () => {
    const { props } = renderModal();
    const addButton = screen.getByLabelText('Add option to Favorite color');
    fireEvent.click(addButton);
    expect(props.onUpdateOptions).toHaveBeenCalledWith([
      { value: 'red', label: 'Red' },
      { value: 'blue', label: 'Blue', keywords: ['sky', 'ocean'] },
      { value: '', label: '' },
    ]);
  });

  it('calls onUpdateOptions when "Remove" is clicked', () => {
    const { props } = renderModal();
    const removeButton = screen.getByLabelText('Remove option 1 from Favorite color');
    fireEvent.click(removeButton);
    expect(props.onUpdateOptions).toHaveBeenCalledWith([
      { value: 'blue', label: 'Blue', keywords: ['sky', 'ocean'] },
    ]);
  });

  it('calls onClose when "Done" button is clicked', () => {
    const { props } = renderModal();
    const doneButton = screen.getByRole('button', { name: 'Done' });
    fireEvent.click(doneButton);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape is pressed', () => {
    const { props } = renderModal();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('has role="dialog" and aria-modal="true"', () => {
    renderModal();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('calls onClose when backdrop is clicked', () => {
    const { props } = renderModal();
    // The backdrop is the fixed overlay — click it directly
    const backdrop = screen.getByRole('dialog').parentElement!;
    fireEvent.click(backdrop);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('displays keywords input with formatted value', () => {
    renderModal();
    const keywordsInput = screen.getByLabelText('Option 2 search keywords');
    expect(keywordsInput).toHaveValue('sky, ocean');
  });
});
