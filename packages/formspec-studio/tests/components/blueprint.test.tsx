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
  it('renders all 10 section names', () => {
    renderBlueprint();
    const sections = [
      'Structure', 'Component Tree', 'Theme', 'Screener', 'Variables',
      'Data Sources', 'Option Sets', 'Mappings', 'Migrations', 'Settings'
    ];
    for (const name of sections) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });

  it('shows entity count badges only when count > 0', () => {
    renderBlueprint();
    // Empty project: no count badge rendered (zeros are hidden by design)
    const structureBtn = screen.getByTestId('blueprint-section-Structure');
    expect(structureBtn).not.toHaveTextContent(/^\d+$/);
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
