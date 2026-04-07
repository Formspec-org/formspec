import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from '@formspec-org/studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { TypographySpacing } from '../../../src/workspaces/theme/TypographySpacing';

function renderTypography(tokens?: Record<string, unknown>) {
  const project = createProject({
    seed: {
      definition: { $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [] } as any,
      theme: { tokens } as any,
    },
  });
  return {
    ...render(
      <ProjectProvider project={project}>
        <TypographySpacing />
      </ProjectProvider>
    ),
    project,
  };
}

describe('TypographySpacing', () => {
  it('renders font family input with current value', () => {
    renderTypography({ 'font.family': 'Inter' });
    expect(screen.getByDisplayValue('Inter')).toBeInTheDocument();
  });

  it('font change dispatches theme.setToken', async () => {
    const { project } = renderTypography({ 'font.family': 'Inter' });
    const input = screen.getByDisplayValue('Inter');
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Roboto' } });
      fireEvent.blur(input);
    });
    expect((project.export().theme as any).tokens['font.family']).toBe('Roboto');
  });

  it('spacing values render as editable inputs', () => {
    renderTypography({ 'spacing.sm': '4px', 'spacing.md': '8px', 'spacing.lg': '16px' });
    expect(screen.getByDisplayValue('4px')).toBeInTheDocument();
    expect(screen.getByDisplayValue('8px')).toBeInTheDocument();
    expect(screen.getByDisplayValue('16px')).toBeInTheDocument();
  });

  it('spacing edit dispatches correctly', async () => {
    const { project } = renderTypography({ 'spacing.md': '8px' });
    const input = screen.getByDisplayValue('8px');
    await act(async () => {
      fireEvent.change(input, { target: { value: '12px' } });
      fireEvent.blur(input);
    });
    expect((project.export().theme as any).tokens['spacing.md']).toBe('12px');
  });

  it('radius input dispatches correctly', async () => {
    const { project } = renderTypography({ 'radius.sm': '4px' });
    const input = screen.getByDisplayValue('4px');
    await act(async () => {
      fireEvent.change(input, { target: { value: '8px' } });
      fireEvent.blur(input);
    });
    expect((project.export().theme as any).tokens['radius.sm']).toBe('8px');
  });

  it('shows placeholders when tokens not set', () => {
    renderTypography({});
    // Should still render the section labels
    expect(screen.getByText(/font family/i)).toBeInTheDocument();
    expect(screen.getByText(/spacing/i)).toBeInTheDocument();
  });
});
