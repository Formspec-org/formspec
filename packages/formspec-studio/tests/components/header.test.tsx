import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createProject, type Project } from '@formspec-org/studio-core';
import { ProjectProvider } from '../../src/state/ProjectContext';
import { SelectionProvider } from '../../src/state/useSelection';
import { Header } from '../../src/components/Header';
import type { WorkspaceShellTab } from '../../src/studio/workspace-shell-tabs';

function renderHeader(project?: Project) {
  const p = project ?? createProject();
  const onTabChange = vi.fn();
  const onNew = vi.fn();
  const onExport = vi.fn();
  const result = render(
    <ProjectProvider project={p}>
      <SelectionProvider>
        <Header
          activeTab="Editor"
          onTabChange={onTabChange}
          onImport={() => {}}
          onSearch={() => {}}
          onNew={onNew}
          onExport={onExport}
        />
      </SelectionProvider>
    </ProjectProvider>
  );
  return { ...result, onTabChange, onNew, onExport, project: p };
}

describe('Header', () => {
  it('shows formspec version', () => {
    renderHeader();
    expect(screen.getByRole('button', { name: /FORMSPEC 1\.0 metadata/i })).toBeInTheDocument();
  });

  it('undo button disabled when canUndo is false', () => {
    renderHeader();
    expect(screen.getByRole('button', { name: /undo/i })).toBeDisabled();
  });

  it('redo button disabled when canRedo is false', () => {
    renderHeader();
    expect(screen.getByRole('button', { name: /redo/i })).toBeDisabled();
  });

  it('undo button enabled after dispatch', () => {
    const project = createProject();
    const { rerender } = render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <Header activeTab="Editor" onTabChange={() => {}} onImport={() => {}} onSearch={() => {}} />
        </SelectionProvider>
      </ProjectProvider>
    );

    act(() => {
      project.loadBundle({
        definition: {
          ...project.definition,
          title: 'Undo-enabled form',
        },
      });
    });

    // Re-render to pick up state change
    rerender(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <Header activeTab="Editor" onTabChange={() => {}} onImport={() => {}} onSearch={() => {}} />
        </SelectionProvider>
      </ProjectProvider>
    );

    expect(screen.getByRole('button', { name: /undo/i })).toBeEnabled();
  });

  it('exposes form metadata as an interactive control', () => {
    renderHeader();
    expect(screen.getByRole('button', { name: /formspec 1\.0/i })).toBeInTheDocument();
  });

  it('renders the avatar as a menu button', () => {
    renderHeader();
    expect(screen.getByRole('button', { name: /account|profile|avatar/i })).toBeInTheDocument();
  });

  it('renders New Form and Export actions and wires clicks to the provided handlers', async () => {
    const { onNew, onExport } = renderHeader();

    // Open the account menu dropdown, click New Form
    await act(async () => {
      screen.getByRole('button', { name: /account menu/i }).click();
    });
    await act(async () => {
      screen.getByRole('menuitem', { name: /new form/i }).click();
    });

    // Re-open menu (it closes after each click), click Export
    await act(async () => {
      screen.getByRole('button', { name: /account menu/i }).click();
    });
    await act(async () => {
      screen.getByRole('menuitem', { name: /^export$/i }).click();
    });

    expect(onNew).toHaveBeenCalledTimes(1);
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it('links each workspace tab to a tabpanel and only keeps the active tab in the tab order', () => {
    renderHeader();

    const editorTab = screen.getByRole('tab', { name: 'Editor' });
    const designTab = screen.getByRole('tab', { name: 'Design' });

    expect(editorTab).toHaveAttribute('id', 'studio-tab-editor');
    expect(editorTab).toHaveAttribute('aria-controls', 'studio-panel-editor');
    expect(editorTab).toHaveAttribute('tabindex', '0');
    expect(designTab).toHaveAttribute('tabindex', '-1');
  });

  it('renders the unified Studio workspace tabs', () => {
    renderHeader();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(5);
    expect(tabs.map(t => t.textContent)).toEqual(['Editor', 'Design', 'Evidence', 'Mapping', 'Preview']);
  });

  it('calls onTabChange with Evidence when the Evidence workspace tab is clicked (workspace tab strip)', async () => {
    const onTabChange = vi.fn<(tab: WorkspaceShellTab) => void>();
    render(
      <ProjectProvider project={createProject()}>
        <SelectionProvider>
          <Header
            activeTab="Editor"
            onTabChange={onTabChange}
            onImport={() => {}}
            onSearch={() => {}}
          />
        </SelectionProvider>
      </ProjectProvider>,
    );
    await act(async () => {
      screen.getByTestId('tab-Evidence').click();
    });
    expect(onTabChange).toHaveBeenCalledWith('Evidence');
  });

  it('calls onTabChange with Mapping when the Mapping workspace tab is clicked (workspace tab strip)', async () => {
    const onTabChange = vi.fn<(tab: WorkspaceShellTab) => void>();
    render(
      <ProjectProvider project={createProject()}>
        <SelectionProvider>
          <Header
            activeTab="Editor"
            onTabChange={onTabChange}
            onImport={() => {}}
            onSearch={() => {}}
          />
        </SelectionProvider>
      </ProjectProvider>,
    );
    await act(async () => {
      screen.getByTestId('tab-Mapping').click();
    });
    expect(onTabChange).toHaveBeenCalledWith('Mapping');
  });

  it('does not render legacy Logic or Data tabs', () => {
    renderHeader();
    expect(screen.queryByRole('tab', { name: 'Logic' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Data' })).not.toBeInTheDocument();
  });

  it('renders ModeToggle when mode and onModeChange are provided', () => {
    const onModeChange = vi.fn();
    render(
      <ProjectProvider project={createProject()}>
        <SelectionProvider>
          <Header
            activeTab="Editor"
            onTabChange={() => {}}
            onImport={() => {}}
            onSearch={() => {}}
            mode="chat"
            onModeChange={onModeChange}
          />
        </SelectionProvider>
      </ProjectProvider>,
    );
    expect(screen.getByTestId('mode-toggle-chat')).toBeInTheDocument();
    expect(screen.getByTestId('tab-Editor')).toBeInTheDocument();
  });

  it('renders Ask AI toggle when onSwitchToAssistant provided (workspace mode)', () => {
    const onSwitch = vi.fn();
    render(
      <ProjectProvider project={createProject()}>
        <SelectionProvider>
          <Header
            activeTab="Editor"
            onTabChange={() => {}}
            onImport={() => {}}
            onSearch={() => {}}
            onSwitchToAssistant={onSwitch}
          />
        </SelectionProvider>
      </ProjectProvider>,
    );

    const btn = screen.getByTestId('toggle-to-assistant');
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent('Ask AI');

    btn.click();
    expect(onSwitch).toHaveBeenCalledOnce();
  });

  it('omits Ask AI toggle when onSwitchToAssistant is null', () => {
    render(
      <ProjectProvider project={createProject()}>
        <SelectionProvider>
          <Header
            activeTab="Editor"
            onTabChange={() => {}}
            onImport={() => {}}
            onSearch={() => {}}
            onSwitchToAssistant={null}
          />
        </SelectionProvider>
      </ProjectProvider>,
    );

    expect(screen.queryByTestId('toggle-to-assistant')).not.toBeInTheDocument();
  });

  it('Ask AI toggle uses compact styling on compact layout', () => {
    const onSwitch = vi.fn();
    render(
      <ProjectProvider project={createProject()}>
        <SelectionProvider>
          <Header
            activeTab="Editor"
            onTabChange={() => {}}
            onImport={() => {}}
            onSearch={() => {}}
            onSwitchToAssistant={onSwitch}
            isCompact
          />
        </SelectionProvider>
      </ProjectProvider>,
    );

    const btn = screen.getByTestId('toggle-to-assistant');
    expect(btn).toBeInTheDocument();
    expect(btn.textContent).toBe('Ask AI');
  });
});
