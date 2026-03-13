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

function renderThemeTab() {
  const project = createProject({
    seed: {
      definition: definition as any,
      theme: { targetDefinition: { url: definition.url } },
    },
  });

  return render(
    <ProjectProvider project={project}>
      <ThemeTab />
    </ProjectProvider>
  );
}

describe('ThemeTab', () => {
  it('keeps tokens editable while preserving real add affordances in other theme sub-tabs', () => {
    renderThemeTab();

    expect(screen.getByText(/no tokens defined/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ add token/i })).toBeInTheDocument();

    act(() => { screen.getByRole('button', { name: /selectors/i }).click(); });
    expect(screen.getByRole('button', { name: /\+ add selector/i })).toBeInTheDocument();

    act(() => { screen.getByRole('button', { name: /item overrides/i }).click(); });
    expect(screen.getByRole('button', { name: /\+ add item override/i })).toBeInTheDocument();

    act(() => { screen.getByRole('button', { name: /page layouts/i }).click(); });
    expect(screen.getByRole('button', { name: /\+ add page layout/i })).toBeInTheDocument();

    act(() => { screen.getByRole('button', { name: /breakpoints/i }).click(); });
    expect(screen.getByRole('button', { name: /\+ add breakpoint/i })).toBeInTheDocument();
  });
});
