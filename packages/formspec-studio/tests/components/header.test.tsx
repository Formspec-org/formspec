import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createProject, type Project } from 'formspec-studio-core';
import { ProjectProvider } from '../../src/state/ProjectContext';
import { SelectionProvider } from '../../src/state/useSelection';
import { Header } from '../../src/components/Header';

function renderHeader(project?: Project) {
  const p = project ?? createProject();
  const onTabChange = vi.fn();
  const result = render(
    <ProjectProvider project={p}>
      <SelectionProvider>
        <Header activeTab="Editor" onTabChange={onTabChange} onImport={() => {}} onSearch={() => {}} />
      </SelectionProvider>
    </ProjectProvider>
  );
  return { ...result, onTabChange, project: p };
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
      project.dispatch({
        type: 'definition.addItem',
        payload: { item: { key: 'f1', type: 'field', dataType: 'string' } }
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
});
