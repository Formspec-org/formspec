import { render, screen, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../src/state/ProjectContext';
import { SelectionProvider } from '../../src/state/useSelection';
import { Shell } from '../../src/components/Shell';

function renderShell() {
  const project = createProject();
  return render(
    <ProjectProvider project={project}>
      <SelectionProvider>
        <Shell />
      </SelectionProvider>
    </ProjectProvider>
  );
}

describe('Shell', () => {
  it('renders header with app title', () => {
    renderShell();
    expect(screen.getByText('The Stack')).toBeInTheDocument();
  });

  it('shows 6 workspace tabs', () => {
    renderShell();
    for (const tab of ['Editor', 'Logic', 'Data', 'Theme', 'Mapping', 'Preview']) {
      expect(screen.getByRole('tab', { name: tab })).toBeInTheDocument();
    }
  });

  it('defaults to Editor tab', () => {
    renderShell();
    expect(screen.getByTestId('workspace-content')).toHaveAttribute('data-workspace', 'Editor');
  });

  it('clicking a tab switches workspace', async () => {
    renderShell();
    await act(async () => {
      screen.getByRole('tab', { name: 'Logic' }).click();
    });
    expect(screen.getByTestId('workspace-content')).toHaveAttribute('data-workspace', 'Logic');
  });
});
