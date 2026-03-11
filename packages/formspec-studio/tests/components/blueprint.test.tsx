import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../src/state/ProjectContext';
import { SelectionProvider } from '../../src/state/useSelection';
import { Blueprint } from '../../src/components/Blueprint';

function renderBlueprint(onSectionChange = vi.fn()) {
  const project = createProject();
  return {
    ...render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <Blueprint activeSection="Structure" onSectionChange={onSectionChange} />
        </SelectionProvider>
      </ProjectProvider>
    ),
    onSectionChange,
    project,
  };
}

describe('Blueprint', () => {
  it('renders all 11 section names', () => {
    renderBlueprint();
    const sections = [
      'Structure', 'Component Tree', 'Theme', 'Screener', 'Variables',
      'Data Sources', 'Option Sets', 'Mappings', 'Migrations', 'FEL Reference', 'Settings'
    ];
    for (const name of sections) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });

  it('shows entity count badges', () => {
    renderBlueprint();
    // Default empty project should show 0 for Structure items
    const structureRow = screen.getByText('Structure').closest('[data-testid]') || screen.getByText('Structure').parentElement;
    expect(structureRow).toHaveTextContent('0');
  });

  it('clicking a section calls onSectionChange', async () => {
    const onSectionChange = vi.fn();
    renderBlueprint(onSectionChange);
    await act(async () => {
      screen.getByText('Variables').click();
    });
    expect(onSectionChange).toHaveBeenCalledWith('Variables');
  });
});
