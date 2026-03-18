import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { AllTokens } from '../../../src/workspaces/theme/AllTokens';

function renderAllTokens(tokens?: Record<string, unknown>) {
  const project = createProject({
    seed: {
      definition: { $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [] } as any,
      theme: { tokens } as any,
    },
  });
  return {
    ...render(
      <ProjectProvider project={project}>
        <AllTokens />
      </ProjectProvider>
    ),
    project,
  };
}

describe('AllTokens', () => {
  it('renders all tokens grouped by prefix', () => {
    renderAllTokens({ 'color.primary': '#3b82f6', 'spacing.md': '8px' });
    expect(screen.getByText('color')).toBeInTheDocument();
    expect(screen.getByText('spacing')).toBeInTheDocument();
    expect(screen.getByText('primary')).toBeInTheDocument();
  });

  it('shows token count in header', () => {
    renderAllTokens({ 'color.primary': '#3b82f6', 'spacing.md': '8px', 'border.radius': '4px' });
    expect(screen.getByText(/3 tokens/i)).toBeInTheDocument();
  });

  it('add dispatches theme.setToken', async () => {
    const { project } = renderAllTokens({});
    const addBtn = screen.getByRole('button', { name: /\+ new token/i });
    await act(async () => { addBtn.click(); });
    const keyInput = screen.getByPlaceholderText(/token key/i);
    const valInput = screen.getByPlaceholderText(/value/i);
    await act(async () => {
      fireEvent.change(keyInput, { target: { value: 'custom.foo' } });
      fireEvent.change(valInput, { target: { value: 'bar' } });
      fireEvent.keyDown(keyInput, { key: 'Enter' });
    });
    expect((project.export().theme as any).tokens['custom.foo']).toBe('bar');
  });

  it('edit value on blur dispatches', async () => {
    const { project } = renderAllTokens({ 'color.primary': '#3b82f6' });
    const input = screen.getByDisplayValue('#3b82f6');
    await act(async () => {
      fireEvent.change(input, { target: { value: '#000' } });
      fireEvent.blur(input);
    });
    expect((project.export().theme as any).tokens['color.primary']).toBe('#000');
  });

  it('delete dispatches with value null', async () => {
    const { project } = renderAllTokens({ 'color.primary': '#3b82f6' });
    const deleteBtn = screen.getByRole('button', { name: /delete.*color\.primary/i });
    await act(async () => { deleteBtn.click(); });
    expect((project.export().theme as any).tokens['color.primary']).toBeUndefined();
  });

  it('color swatch appears for hex values', () => {
    renderAllTokens({ 'color.primary': '#3b82f6' });
    const swatch = screen.getByTestId('swatch-color.primary');
    expect(swatch).toHaveStyle({ backgroundColor: '#3b82f6' });
  });

  it('shows empty state when no tokens', () => {
    renderAllTokens({});
    expect(screen.getByText(/0 tokens/i)).toBeInTheDocument();
  });
});
