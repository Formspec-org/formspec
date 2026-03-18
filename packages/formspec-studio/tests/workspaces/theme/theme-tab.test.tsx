import { render, screen, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { ThemeTab } from '../../../src/workspaces/theme/ThemeTab';

const definition = {
  $formspec: '1.0',
  url: 'urn:theme-tab-test',
  version: '1.0.0',
  items: [],
};

function renderThemeTab(theme?: Record<string, unknown>) {
  const project = createProject({
    seed: {
      definition: definition as any,
      theme: { targetDefinition: { url: definition.url }, ...theme } as any,
    },
  });

  return {
    ...render(
      <ProjectProvider project={project}>
        <ThemeTab />
      </ProjectProvider>
    ),
    project,
  };
}

describe('ThemeTab', () => {
  it('renders all 6 pillar headings when filter is "All Theme"', () => {
    renderThemeTab();
    expect(screen.getByText('Color Palette')).toBeInTheDocument();
    expect(screen.getByText('Typography & Spacing')).toBeInTheDocument();
    expect(screen.getByText('All Tokens')).toBeInTheDocument();
    expect(screen.getByText('Default Field Style')).toBeInTheDocument();
    expect(screen.getByText('Field Type Rules')).toBeInTheDocument();
    expect(screen.getByText('Screen Sizes')).toBeInTheDocument();
  });

  it('"Brand & Colors" shows only Color Palette, Typography & Spacing, All Tokens', async () => {
    renderThemeTab();
    await act(async () => {
      screen.getByRole('button', { name: /brand & colors/i }).click();
    });
    expect(screen.getByText('Color Palette')).toBeInTheDocument();
    expect(screen.getByText('Typography & Spacing')).toBeInTheDocument();
    expect(screen.getByText('All Tokens')).toBeInTheDocument();
    expect(screen.queryByText('Default Field Style')).not.toBeInTheDocument();
    expect(screen.queryByText('Field Type Rules')).not.toBeInTheDocument();
    expect(screen.queryByText('Screen Sizes')).not.toBeInTheDocument();
  });

  it('"Field Presentation" shows only Default Field Style, Field Type Rules', async () => {
    renderThemeTab();
    await act(async () => {
      screen.getByRole('button', { name: /field presentation/i }).click();
    });
    expect(screen.getByText('Default Field Style')).toBeInTheDocument();
    expect(screen.getByText('Field Type Rules')).toBeInTheDocument();
    expect(screen.queryByText('Color Palette')).not.toBeInTheDocument();
    expect(screen.queryByText('Typography & Spacing')).not.toBeInTheDocument();
    expect(screen.queryByText('All Tokens')).not.toBeInTheDocument();
    expect(screen.queryByText('Screen Sizes')).not.toBeInTheDocument();
  });

  it('"Layout" shows only Screen Sizes', async () => {
    renderThemeTab();
    await act(async () => {
      screen.getByRole('button', { name: /^layout$/i }).click();
    });
    expect(screen.getByText('Screen Sizes')).toBeInTheDocument();
    expect(screen.queryByText('Color Palette')).not.toBeInTheDocument();
    expect(screen.queryByText('Typography & Spacing')).not.toBeInTheDocument();
    expect(screen.queryByText('All Tokens')).not.toBeInTheDocument();
    expect(screen.queryByText('Default Field Style')).not.toBeInTheDocument();
    expect(screen.queryByText('Field Type Rules')).not.toBeInTheDocument();
  });

  it('renders without props (no controlled state from Shell)', () => {
    const project = createProject({
      seed: {
        definition: definition as any,
        theme: { targetDefinition: { url: definition.url } } as any,
      },
    });
    const { container } = render(
      <ProjectProvider project={project}>
        <ThemeTab />
      </ProjectProvider>
    );
    expect(container.querySelector('[class*="flex"]')).toBeTruthy();
  });
});
