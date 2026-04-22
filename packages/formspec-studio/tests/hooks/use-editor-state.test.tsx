import { render, screen, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from '@formspec-org/studio-core';
import { ProjectProvider } from '../../src/state/ProjectContext';
import { useEditorState } from '../../src/hooks/useEditorState';

function ManageCountDisplay() {
  const { manageCount } = useEditorState('Editor', false);
  return <div data-testid="manage-count">{manageCount}</div>;
}

describe('useEditorState manageCount', () => {
  it('updates when binds are added', () => {
    const project = createProject();
    render(
      <ProjectProvider project={project}>
        <ManageCountDisplay />
      </ProjectProvider>
    );
    expect(screen.getByTestId('manage-count')).toHaveTextContent('0');

    act(() => {
      project.addField('name', 'Name', 'string');
      project.showWhen('name', 'true');
    });

    expect(screen.getByTestId('manage-count')).toHaveTextContent('1');
  });
});
