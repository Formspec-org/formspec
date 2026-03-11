import { render, screen, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../src/state/ProjectContext';
import { SelectionProvider, useSelection } from '../../src/state/useSelection';
import { PropertiesPanel } from '../../src/components/PropertiesPanel';

function SelectAndShow() {
  const { select } = useSelection();
  return (
    <>
      <button onClick={() => select('myField', 'field')}>Select Field</button>
      <PropertiesPanel />
    </>
  );
}

describe('PropertiesPanel', () => {
  it('shows empty state when nothing selected', () => {
    const project = createProject();
    render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <PropertiesPanel />
        </SelectionProvider>
      </ProjectProvider>
    );
    expect(screen.getByText(/select an item/i)).toBeInTheDocument();
  });

  it('shows selected item info when field is selected', async () => {
    const project = createProject();
    render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <SelectAndShow />
        </SelectionProvider>
      </ProjectProvider>
    );

    await act(async () => {
      screen.getByText('Select Field').click();
    });

    expect(screen.getByText('myField')).toBeInTheDocument();
    // Use exact match to avoid ambiguity with "Select Field" button and "myField"
    expect(screen.getByText('field')).toBeInTheDocument();
  });
});
