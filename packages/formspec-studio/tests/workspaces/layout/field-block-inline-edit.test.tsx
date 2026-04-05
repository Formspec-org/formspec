/** @filedesc FieldBlock inline definition identity and summary editing (layout canvas). */
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FieldBlock } from '../../../src/workspaces/layout/FieldBlock';

vi.mock('@dnd-kit/react', () => ({
  useDraggable: () => ({ ref: () => {}, isDragging: false }),
}));

const base = {
  itemKey: 'email',
  bindPath: 'email',
  selectionKey: 'email',
  label: 'Email',
  dataType: 'string',
};

describe('FieldBlock inline definition editing', () => {
  it('commits label via inline edit when selected', async () => {
    const onRename = vi.fn();
    const onUpdate = vi.fn();
    const user = userEvent.setup();
    render(
      <FieldBlock
        {...base}
        selected
        onSelect={vi.fn()}
        onRenameDefinitionItem={onRename}
        onUpdateDefinitionItem={onUpdate}
      />,
    );
    await user.click(screen.getByTestId('layout-field-email-label-edit'));
    const input = screen.getByRole('textbox', { name: /inline label/i });
    fireEvent.change(input, { target: { value: 'Work email' } });
    fireEvent.blur(input);
    expect(onRename).toHaveBeenCalledWith('email', 'Work email');
  });

  it('commits description when inline summary is blurred', async () => {
    const onRename = vi.fn();
    const onUpdate = vi.fn();
    const user = userEvent.setup();
    render(
      <FieldBlock
        {...base}
        selected
        description="Old"
        onSelect={vi.fn()}
        onRenameDefinitionItem={onRename}
        onUpdateDefinitionItem={onUpdate}
      />,
    );
    await user.click(screen.getByRole('button', { name: /edit description/i }));
    const ta = screen.getByRole('textbox', { name: /inline description/i });
    await user.clear(ta);
    await user.type(ta, 'New copy');
    fireEvent.blur(ta);
    expect(onUpdate).toHaveBeenCalledWith({ description: 'New copy' });
  });
});
