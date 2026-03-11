import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../src/state/ProjectContext';
import { SelectionProvider } from '../../src/state/useSelection';
import { CommandPalette } from '../../src/components/CommandPalette';

const paletteDef = {
  $formspec: '1.0', url: 'urn:test', version: '1.0.0',
  items: [
    { key: 'firstName', type: 'field', dataType: 'string', label: 'First Name' },
    { key: 'lastName', type: 'field', dataType: 'string', label: 'Last Name' },
    { key: 'age', type: 'field', dataType: 'integer', label: 'Age' },
  ],
  variables: [{ name: 'isAdult', expression: '$age >= 18' }],
};

function renderPalette() {
  const project = createProject({ seed: { definition: paletteDef as any } });
  const onClose = vi.fn();
  return {
    ...render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <CommandPalette open={true} onClose={onClose} />
        </SelectionProvider>
      </ProjectProvider>
    ),
    onClose,
  };
}

describe('CommandPalette', () => {
  it('shows search input when open', () => {
    renderPalette();
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it('shows items when typing', async () => {
    renderPalette();
    const input = screen.getByPlaceholderText(/search/i);
    await act(async () => {
      (input as HTMLInputElement).value = 'first';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(screen.getByText(/firstName/)).toBeInTheDocument();
  });

  it('shows all items with empty search', () => {
    renderPalette();
    expect(screen.getByText(/firstName/)).toBeInTheDocument();
    expect(screen.getByText(/lastName/)).toBeInTheDocument();
    expect(screen.getByText(/age/)).toBeInTheDocument();
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
