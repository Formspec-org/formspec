import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { DefaultFieldStyle } from '../../../src/workspaces/theme/DefaultFieldStyle';

function renderDefaults(defaults?: Record<string, unknown>) {
  const project = createProject({
    seed: {
      definition: { $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [] } as any,
      theme: { defaults } as any,
    },
  });
  return {
    ...render(
      <ProjectProvider project={project}>
        <DefaultFieldStyle />
      </ProjectProvider>
    ),
    project,
  };
}

describe('DefaultFieldStyle', () => {
  it('renders label position options', () => {
    renderDefaults();
    expect(screen.getByRole('button', { name: /top/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /hidden/i })).toBeInTheDocument();
  });

  it('clicking "Top" dispatches theme.setDefaults with labelPosition top', async () => {
    const { project } = renderDefaults({});
    await act(async () => {
      screen.getByRole('button', { name: /top/i }).click();
    });
    expect((project.export().theme as any).defaults.labelPosition).toBe('top');
  });

  it('active position shows accent styling', () => {
    renderDefaults({ labelPosition: 'start' });
    const startBtn = screen.getByRole('button', { name: /start/i });
    expect(startBtn.className).toMatch(/border-accent|ring-accent/);
  });

  it('shows current position from theme defaults', () => {
    renderDefaults({ labelPosition: 'hidden' });
    const hiddenBtn = screen.getByRole('button', { name: /hidden/i });
    expect(hiddenBtn.className).toMatch(/border-accent|ring-accent/);
  });

  it('default widget input dispatches on blur', async () => {
    const { project } = renderDefaults({});
    const input = screen.getByLabelText(/default widget/i);
    await act(async () => {
      fireEvent.change(input, { target: { value: 'text-input' } });
      fireEvent.blur(input);
    });
    expect((project.export().theme as any).defaults.widget).toBe('text-input');
  });

  it('CSS class input dispatches on blur', async () => {
    const { project } = renderDefaults({});
    const input = screen.getByLabelText(/css class/i);
    await act(async () => {
      fireEvent.change(input, { target: { value: 'my-class' } });
      fireEvent.blur(input);
    });
    expect((project.export().theme as any).defaults.cssClass).toBe('my-class');
  });
});
