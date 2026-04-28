import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createProject } from '@formspec-org/studio-core';
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
      'Structure', 'Component Tree', 'Theme', 'Screener', 'Calculations',
      'External data', 'Option Sets', 'Mappings', 'Settings'
    ];
    for (const name of sections) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
    expect(screen.getByRole('navigation', { name: 'Blueprint sections' })).toBeInTheDocument();
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
      screen.getByText('Calculations').click();
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

  it('shows route count badge for Screener when screener has routes', () => {
    const project = createProject({ seed: {
      definition: {
        $formspec: '1.0', url: 'urn:test', version: '1.0.0', title: 'Test',
        items: [],
      } as any,
    } });
    // Load screener via command dispatch (screener is standalone, not part of ProjectBundle)
    (project as any).core.dispatch({
      type: 'screener.setDocument',
      payload: {
        $formspecScreener: '1.0',
        url: 'urn:test:gate',
        version: '1.0.0',
        title: 'Gate',
        items: [{ key: 'age', type: 'field', dataType: 'integer', label: 'Age' }],
        evaluation: [
          {
            id: 'main',
            strategy: 'first-match',
            routes: [
              { condition: '$age >= 18', target: 'adult' },
              { condition: 'true', target: 'rejected' },
            ],
          },
        ],
      },
    } as any);
    render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <Blueprint activeSection="Structure" onSectionChange={vi.fn()} />
        </SelectionProvider>
      </ProjectProvider>
    );
    // Screener section should show combined count of items + routes = 3
    expect(screen.getByTestId('blueprint-section-Screener')).toHaveTextContent('3');
  });

  it('auto-switches to Manage view when clicking a Manage concern section while in Build view', async () => {
    const onSectionChange = vi.fn();
    const spy = vi.fn();
    window.addEventListener('formspec:navigate-workspace', spy);

    const project = createProject();
    render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <Blueprint
            activeSection="Structure"
            onSectionChange={onSectionChange}
            activeEditorView="build"
            activeTab="Editor"
          />
        </SelectionProvider>
      </ProjectProvider>
    );

    // Click "Variables" — a Manage concern — while in Build view
    await act(async () => {
      screen.getByText('Calculations').click();
    });

    // Should still call onSectionChange
    expect(onSectionChange).toHaveBeenCalledWith('Variables');
    // Should dispatch navigate-workspace to switch to Manage view
    expect(spy).toHaveBeenCalled();
    const detail = (spy.mock.calls[0][0] as CustomEvent).detail;
    expect(detail).toEqual(expect.objectContaining({ tab: 'Editor', view: 'manage' }));

    window.removeEventListener('formspec:navigate-workspace', spy);
  });

  it('does NOT auto-switch when clicking Structure section (stays in Build)', async () => {
    const onSectionChange = vi.fn();
    const spy = vi.fn();
    window.addEventListener('formspec:navigate-workspace', spy);

    const project = createProject();
    render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <Blueprint
            activeSection="Variables"
            onSectionChange={onSectionChange}
            activeEditorView="build"
            activeTab="Editor"
          />
        </SelectionProvider>
      </ProjectProvider>
    );

    // Click "Structure" — should NOT auto-switch
    await act(async () => {
      screen.getByText('Structure').click();
    });

    expect(onSectionChange).toHaveBeenCalledWith('Structure');
    // Should NOT dispatch navigate-workspace
    expect(spy).not.toHaveBeenCalled();

    window.removeEventListener('formspec:navigate-workspace', spy);
  });

  it('does NOT auto-switch when already in Manage view', async () => {
    const onSectionChange = vi.fn();
    const spy = vi.fn();
    window.addEventListener('formspec:navigate-workspace', spy);

    const project = createProject();
    render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <Blueprint
            activeSection="Structure"
            onSectionChange={onSectionChange}
            activeEditorView="manage"
            activeTab="Editor"
          />
        </SelectionProvider>
      </ProjectProvider>
    );

    // Click "Variables" while already in Manage view
    await act(async () => {
      screen.getByText('Calculations').click();
    });

    expect(onSectionChange).toHaveBeenCalledWith('Variables');
    // Should NOT dispatch navigate-workspace since already in manage
    expect(spy).not.toHaveBeenCalled();

    window.removeEventListener('formspec:navigate-workspace', spy);
  });

  it('switches the collapse arrow glyph from collapsed to expanded when a sidebar section opens', async () => {
    render(<Section title="Settings" defaultOpen={false}><div>Section body</div></Section>);

    const toggle = screen.getByRole('button', { name: /settings/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await act(async () => {
      toggle.click();
    });

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });
});
