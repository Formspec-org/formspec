/** @filedesc FieldBlock inline definition label on layout canvas; description/hint open Editor. */
import type { ReactElement } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FieldBlock } from '../../../src/workspaces/layout/FieldBlock';
import { OpenDefinitionInEditorProvider } from '../../../src/state/OpenDefinitionInEditorContext';

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

function renderField(ui: ReactElement, openEditor = vi.fn()) {
  return render(
    <OpenDefinitionInEditorProvider value={openEditor}>{ui}</OpenDefinitionInEditorProvider>,
  );
}

describe('FieldBlock inline definition editing', () => {
  it('commits label via inline edit when selected', async () => {
    const onRename = vi.fn();
    const user = userEvent.setup();
    renderField(
      <FieldBlock
        {...base}
        selected
        onSelect={vi.fn()}
        onRenameDefinitionItem={onRename}
      />,
    );
    await user.click(screen.getByTestId('layout-field-email-label-edit'));
    const input = screen.getByRole('textbox', { name: /inline label/i });
    fireEvent.change(input, { target: { value: 'Work email' } });
    fireEvent.blur(input);
    expect(onRename).toHaveBeenCalledWith('email', 'Work email');
  });

  it('hides definition copy panel behind toggle when inline toolbar is shown', async () => {
    const user = userEvent.setup();
    renderField(
      <FieldBlock
        {...base}
        selected
        onSelect={vi.fn()}
        onRenameDefinitionItem={vi.fn()}
        onSetProp={vi.fn()}
        nodeProps={{ component: 'TextInput' }}
      />,
    );
    expect(screen.queryByTestId('layout-field-email-definition-copy')).toBeNull();
    await user.click(screen.getByTestId('layout-field-email-definition-copy-toggle'));
    expect(screen.getByTestId('layout-field-email-definition-copy')).toBeInTheDocument();
  });

  it('Edit in Editor calls navigation with bind path and field kind', async () => {
    const openEditor = vi.fn();
    const user = userEvent.setup();
    renderField(
      <FieldBlock
        {...base}
        selected
        description="Help text"
        onSelect={vi.fn()}
        onRenameDefinitionItem={vi.fn()}
      />,
      openEditor,
    );
    await user.click(screen.getByTestId('layout-field-email-edit-copy-in-editor'));
    expect(openEditor).toHaveBeenCalledWith('email', 'field');
  });
});
