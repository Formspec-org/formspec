/** @filedesc Tests for context menu behavior in the DefinitionTreeEditor. */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from '@formspec-org/studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectionProvider } from '../../../src/state/useSelection';
import { DefinitionTreeEditor } from '../../../src/workspaces/editor/DefinitionTreeEditor';

function renderTree(definition: any) {
  const project = createProject({ seed: { definition } });
  return {
    project,
    ...render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <DefinitionTreeEditor />
        </SelectionProvider>
      </ProjectProvider>,
    ),
  };
}

const SIMPLE = {
  $formspec: '1.0', url: 'urn:ctx-test', version: '1.0.0',
  items: [
    { key: 'name', type: 'field', dataType: 'string', label: 'Name' },
    { key: 'age', type: 'field', dataType: 'integer', label: 'Age' },
  ],
};

describe('Editor context menu', () => {
  it('right-click shows Delete and Duplicate', () => {
    renderTree(SIMPLE);
    fireEvent.contextMenu(screen.getByTestId('field-name'));
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByText('Duplicate')).toBeInTheDocument();
  });

  it('shows Move Up, Move Down, and Wrap in Group', () => {
    renderTree(SIMPLE);
    fireEvent.contextMenu(screen.getByTestId('field-name'));
    expect(screen.getByText('Move Up')).toBeInTheDocument();
    expect(screen.getByText('Move Down')).toBeInTheDocument();
    expect(screen.getByText('Wrap in Group')).toBeInTheDocument();
  });

  it('does NOT show layout-tier actions (Wrap in Card, Unwrap)', () => {
    renderTree(SIMPLE);
    fireEvent.contextMenu(screen.getByTestId('field-name'));
    expect(screen.queryByText(/wrap in card/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/wrap in stack/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/wrap in collapsible/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/unwrap/i)).not.toBeInTheDocument();
  });

  it('Delete removes the item', () => {
    const { project } = renderTree(SIMPLE);
    fireEvent.contextMenu(screen.getByTestId('field-name'));
    fireEvent.click(screen.getByText('Delete'));
    expect(project.definition.items).toHaveLength(1);
    expect(project.definition.items[0].key).toBe('age');
  });

  it('Duplicate copies the item', () => {
    const { project } = renderTree(SIMPLE);
    fireEvent.contextMenu(screen.getByTestId('field-name'));
    fireEvent.click(screen.getByText('Duplicate'));
    expect(project.definition.items).toHaveLength(3);
  });

  it('Move Down reorders the item', () => {
    const { project } = renderTree(SIMPLE);
    fireEvent.contextMenu(screen.getByTestId('field-name'));
    fireEvent.click(screen.getByText('Move Down'));
    expect(project.definition.items[0].key).toBe('age');
    expect(project.definition.items[1].key).toBe('name');
  });

  it('context menu also works on groups', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:ctx-test', version: '1.0.0',
      items: [{
        key: 'section', type: 'group', label: 'Section',
        children: [{ key: 'f1', type: 'field', dataType: 'string', label: 'F1' }],
      }],
    });
    fireEvent.contextMenu(screen.getByTestId('group-section'));
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });
});
