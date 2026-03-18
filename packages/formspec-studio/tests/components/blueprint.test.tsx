import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../src/state/ProjectContext';
import { SelectionProvider } from '../../src/state/useSelection';
import { Blueprint } from '../../src/components/Blueprint';
import { Section } from '../../src/components/ui/Section';

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
  it('renders all 9 section names', () => {
    renderBlueprint();
    const sections = [
      'Structure', 'Component Tree', 'Theme', 'Screener', 'Variables',
      'Data Sources', 'Option Sets', 'Mappings', 'Settings'
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

  it('shows a non-zero count badge for Component Tree when a component document exists', () => {
    const project = createProject({ seed: {
      component: {
        $formspecComponent: '1.0',
        tree: {
          component: 'Root',
          children: [{ component: 'TextInput', bind: 'name' }],
        },
      } as any,
    } });
    render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <Blueprint activeSection="Structure" onSectionChange={vi.fn()} />
        </SelectionProvider>
      </ProjectProvider>
    );
    expect(screen.getByTestId('blueprint-section-Component Tree')).toHaveTextContent(/[123]/);
  });

  it('switches the collapse arrow glyph from collapsed to expanded when a sidebar section opens', async () => {
    render(<Section title="Settings" defaultOpen={false}><div>Section body</div></Section>);

    const toggle = screen.getByRole('button', { name: /settings/i });
    expect(toggle).toHaveTextContent('▶');

    await act(async () => {
      toggle.click();
    });

    expect(toggle).toHaveTextContent('▼');
  });
});
