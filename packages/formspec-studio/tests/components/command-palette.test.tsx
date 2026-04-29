import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createProject } from '@formspec-org/studio-core';
import { ProjectProvider } from '../../src/state/ProjectContext';
import { SelectionProvider, useSelection } from '../../src/state/useSelection';
import { CommandPalette } from '../../src/components/CommandPalette';

const paletteDef = {
  $formspec: '1.0', url: 'urn:test', version: '1.0.0',
  items: [
    { key: 'firstName', type: 'field', dataType: 'string', label: 'First Name' },
    { key: 'lastName', type: 'field', dataType: 'string', label: 'Last Name' },
    { key: 'age', type: 'field', dataType: 'integer', label: 'Age' },
  ],
  variables: [{ name: 'isAdult', expression: '$age >= 18' }],
  binds: [{ path: 'age', required: '$age >= 18' }],
  shapes: [{ id: 'adult-rule', target: 'age', severity: 'error', constraint: '$age >= 18', message: 'Invalid' }],
};

function SelectionProbe() {
  const { primaryKey } = useSelection();
  return <div data-testid="selected-key">{primaryKey || ''}</div>;
}

function renderPalette(open = true) {
  const project = createProject({ seed: { definition: paletteDef as any } });
  const onClose = vi.fn();
  const rendered = render(
    <ProjectProvider project={project}>
      <SelectionProvider>
        <CommandPalette open={open} onClose={onClose} />
        <SelectionProbe />
      </SelectionProvider>
    </ProjectProvider>
  );
  return {
    ...rendered,
    project,
    onClose,
    rerenderPalette(nextOpen: boolean) {
      rendered.rerender(
        <ProjectProvider project={project}>
          <SelectionProvider>
            <CommandPalette open={nextOpen} onClose={onClose} />
            <SelectionProbe />
          </SelectionProvider>
        </ProjectProvider>
      );
    },
  };
}

function setSearch(value: string) {
  const input = screen.getByPlaceholderText(/search/i);
  act(() => {
    (input as HTMLInputElement).value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  return input;
}

describe('CommandPalette', () => {
  it('shows search input when open', () => {
    renderPalette();
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it('shows items when typing', async () => {
    renderPalette();
    await act(async () => {
      setSearch('first');
    });
    expect(screen.getByText(/firstName/)).toBeInTheDocument();
  });

  it('shows all items with empty search', () => {
    renderPalette();
    expect(screen.getByText(/firstName/)).toBeInTheDocument();
    expect(screen.getByText(/lastName/)).toBeInTheDocument();
    expect(screen.getByText(/age/)).toBeInTheDocument();
  });

  it('shows bind and shape results when searching for rules', async () => {
    renderPalette();
    await act(async () => {
      setSearch('rule');
    });
    expect(screen.getByText(/adult-rule/i)).toBeInTheDocument();
    expect(screen.getByText(/required/i)).toBeInTheDocument();
  });

  it('shows variable results as informational rows', async () => {
    const { onClose } = renderPalette();
    await act(async () => {
      setSearch('isAdult');
    });
    expect(screen.getByText('isAdult')).toBeInTheDocument();
    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('supports keyboard navigation to select the highlighted result', async () => {
    renderPalette();
    const input = setSearch('name');
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(screen.getByTestId('selected-key')).toHaveTextContent('lastName');
  });

  it('clears the search input when reopened', async () => {
    const { rerenderPalette } = renderPalette(true);
    await act(async () => {
      setSearch('first');
    });
    rerenderPalette(false);
    rerenderPalette(true);
    expect(screen.getByPlaceholderText(/search/i)).toHaveValue('');
  });

  it('does not render when closed', () => {
    const project = createProject({ seed: { definition: paletteDef as any } });
    render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <CommandPalette open={false} onClose={vi.fn()} />
        </SelectionProvider>
      </ProjectProvider>
    );
    expect(screen.queryByPlaceholderText(/search/i)).not.toBeInTheDocument();
  });
});
