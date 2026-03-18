import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { ColorPalette } from '../../../src/workspaces/theme/ColorPalette';

function renderPalette(tokens?: Record<string, unknown>) {
  const project = createProject({
    seed: {
      definition: { $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [] } as any,
      theme: { tokens } as any,
    },
  });
  return {
    ...render(
      <ProjectProvider project={project}>
        <ColorPalette />
      </ProjectProvider>
    ),
    project,
  };
}

describe('ColorPalette', () => {
  it('renders color swatches for existing color.* tokens', () => {
    renderPalette({ 'color.primary': '#3b82f6', 'color.error': '#ef4444' });
    expect(screen.getByText('primary')).toBeInTheDocument();
    expect(screen.getByText('error')).toBeInTheDocument();
    // Hex values are in text inputs, not plain text
    expect(screen.getAllByDisplayValue('#3b82f6').length).toBeGreaterThan(0);
    expect(screen.getAllByDisplayValue('#ef4444').length).toBeGreaterThan(0);
  });

  it('color change dispatches theme.setToken', async () => {
    const { project } = renderPalette({ 'color.primary': '#3b82f6' });
    const colorInput = screen.getByLabelText('Pick color for primary');
    await act(async () => {
      fireEvent.input(colorInput, { target: { value: '#ff0000' } });
    });
    expect((project.export().theme as any).tokens['color.primary']).toBe('#ff0000');
  });

  it('hex edit dispatches on blur', async () => {
    const { project } = renderPalette({ 'color.primary': '#3b82f6' });
    // The text input for hex editing (not the native color picker)
    const hexInputs = screen.getAllByDisplayValue('#3b82f6');
    const hexInput = hexInputs.find(el => el.getAttribute('type') === 'text')!;
    await act(async () => {
      fireEvent.change(hexInput, { target: { value: '#00ff00' } });
      fireEvent.blur(hexInput);
    });
    expect((project.export().theme as any).tokens['color.primary']).toBe('#00ff00');
  });

  it('delete dispatches with value null', async () => {
    const { project } = renderPalette({ 'color.primary': '#3b82f6' });
    const deleteBtn = screen.getByRole('button', { name: /delete.*primary/i });
    await act(async () => {
      deleteBtn.click();
    });
    expect((project.export().theme as any).tokens['color.primary']).toBeUndefined();
  });

  it('add creates new color.* token', async () => {
    const { project } = renderPalette({});
    const addBtn = screen.getByRole('button', { name: /\+ new color/i });
    await act(async () => { addBtn.click(); });
    const nameInput = screen.getByPlaceholderText(/color name/i);
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'brand' } });
      fireEvent.keyDown(nameInput, { key: 'Enter' });
    });
    expect((project.export().theme as any).tokens['color.brand']).toBeDefined();
  });

  it('empty state when no color tokens', () => {
    renderPalette({ 'typography.fontFamily': 'Inter' });
    expect(screen.getByText(/no color tokens/i)).toBeInTheDocument();
  });

  it('ignores non-color tokens', () => {
    renderPalette({ 'color.primary': '#3b82f6', 'spacing.md': '16px' });
    expect(screen.getByText('primary')).toBeInTheDocument();
    expect(screen.queryByText('spacing.md')).not.toBeInTheDocument();
    expect(screen.queryByText('md')).not.toBeInTheDocument();
  });
});
