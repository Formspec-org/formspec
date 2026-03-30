import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createProject, type Project } from '@formspec-org/studio-core';
import { ProjectProvider } from '../../src/state/ProjectContext';
import { SelectionProvider } from '../../src/state/useSelection';
import { Header } from '../../src/components/Header';

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
    expect(screen.getByText(/1\.0/)).toBeInTheDocument();
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
      project.addField('f1', 'F1', 'string');
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
      screen.getByRole('button', { name: /new form/i }).click();
    });

    // Re-open menu (it closes after each click), click Export
    await act(async () => {
      screen.getByRole('button', { name: /account menu/i }).click();
    });
    await act(async () => {
      screen.getByRole('button', { name: /^export$/i }).click();
    });

    expect(onNew).toHaveBeenCalledTimes(1);
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it('links each workspace tab to a tabpanel and only keeps the active tab in the tab order', () => {
    renderHeader();

    const editorTab = screen.getByRole('tab', { name: 'Editor' });
    const layoutTab = screen.getByRole('tab', { name: 'Layout' });

    expect(editorTab).toHaveAttribute('id', 'studio-tab-editor');
    expect(editorTab).toHaveAttribute('aria-controls', 'studio-panel-editor');
    expect(editorTab).toHaveAttribute('tabindex', '0');
    expect(layoutTab).toHaveAttribute('tabindex', '-1');
  });

  it('renders exactly 5 workspace tabs (Editor, Layout, Theme, Mapping, Preview)', () => {
    renderHeader();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(5);
    expect(tabs.map(t => t.textContent)).toEqual(['Editor', 'Layout', 'Theme', 'Mapping', 'Preview']);
  });

  it('does not render Logic or Data tabs', () => {
    renderHeader();
    expect(screen.queryByRole('tab', { name: 'Logic' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Data' })).not.toBeInTheDocument();
  });
});
