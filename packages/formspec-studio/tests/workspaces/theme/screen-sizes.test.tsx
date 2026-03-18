import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { ScreenSizes } from '../../../src/workspaces/theme/ScreenSizes';

function renderSizes(breakpoints?: Record<string, number>) {
  const project = createProject({
    seed: {
      definition: { $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [] } as any,
      theme: { breakpoints } as any,
    },
  });
  return {
    ...render(
      <ProjectProvider project={project}>
        <ScreenSizes />
      </ProjectProvider>
    ),
    project,
  };
}

describe('ScreenSizes', () => {
  it('renders breakpoints sorted by width', () => {
    renderSizes({ desktop: 1024, mobile: 0, tablet: 768 });
    const names = screen.getAllByTestId(/^breakpoint-name-/).map((el) => el.textContent);
    expect(names).toEqual(['mobile', 'tablet', 'desktop']);
  });

  it('empty state with preset suggestion', () => {
    renderSizes({});
    expect(screen.getByText(/no breakpoints/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /apply presets/i })).toBeInTheDocument();
  });

  it('add dispatches theme.setBreakpoint', async () => {
    const { project } = renderSizes({});
    await act(async () => {
      screen.getByRole('button', { name: /\+ new breakpoint/i }).click();
    });
    const nameInput = screen.getByPlaceholderText(/name/i);
    const widthInput = screen.getByPlaceholderText(/min.*width/i);
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'wide' } });
      fireEvent.change(widthInput, { target: { value: '1440' } });
      fireEvent.keyDown(nameInput, { key: 'Enter' });
    });
    expect((project.export().theme as any).breakpoints.wide).toBe(1440);
  });

  it('delete dispatches with minWidth null', async () => {
    const { project } = renderSizes({ tablet: 768 });
    const deleteBtn = screen.getByRole('button', { name: /delete.*tablet/i });
    await act(async () => { deleteBtn.click(); });
    expect((project.export().theme as any).breakpoints.tablet).toBeUndefined();
  });

  it('preset apply creates all 3 breakpoints', async () => {
    const { project } = renderSizes({});
    await act(async () => {
      screen.getByRole('button', { name: /apply presets/i }).click();
    });
    const bp = (project.export().theme as any).breakpoints;
    expect(bp.mobile).toBe(0);
    expect(bp.tablet).toBe(768);
    expect(bp.desktop).toBe(1024);
  });

  it('shows breakpoint count', () => {
    renderSizes({ mobile: 0, tablet: 768, desktop: 1024 });
    expect(screen.getByText(/3 breakpoints/i)).toBeInTheDocument();
  });
});
