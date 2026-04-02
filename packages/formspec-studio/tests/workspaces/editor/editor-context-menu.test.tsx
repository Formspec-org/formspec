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
    expect(screen.getByRole('dialog', { name: /delete name/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /confirm delete/i }));
    expect(project.definition.items).toHaveLength(1);
    expect(project.definition.items[0].key).toBe('age');
  });

  it('Delete can be cancelled from the warning modal', () => {
    const { project } = renderTree(SIMPLE);
    fireEvent.contextMenu(screen.getByTestId('field-name'));
    fireEvent.click(screen.getByText('Delete'));

    expect(screen.getByRole('dialog', { name: /delete name/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /cancel delete/i }));

    expect(project.definition.items).toHaveLength(2);
    expect(screen.queryByRole('dialog', { name: /delete name/i })).not.toBeInTheDocument();
  });

  it('Duplicate copies the item', () => {
    const { project } = renderTree(SIMPLE);
    fireEvent.contextMenu(screen.getByTestId('field-name'));
    fireEvent.click(screen.getByText('Duplicate'));
    expect(project.definition.items).toHaveLength(3);
  });

  it('keeps menu item actions working for a real mouse press sequence', () => {
    const { project } = renderTree(SIMPLE);
    fireEvent.contextMenu(screen.getByTestId('field-name'));

    const duplicate = screen.getByText('Duplicate');
    fireEvent.mouseDown(duplicate);
    fireEvent.click(duplicate);

    expect(project.definition.items).toHaveLength(3);
  });

  it('Move Down reorders the item', () => {
    const { project } = renderTree(SIMPLE);
    fireEvent.contextMenu(screen.getByTestId('field-name'));
    fireEvent.click(screen.getByText('Move Down'));
    expect(project.definition.items[0].key).toBe('age');
    expect(project.definition.items[1].key).toBe('name');
  });

  it('Wrap in Group prompts for key and label before wrapping', () => {
    const { project } = renderTree(SIMPLE);
    fireEvent.contextMenu(screen.getByTestId('field-name'));
    fireEvent.click(screen.getByText('Wrap in Group'));

    expect(screen.getByRole('dialog', { name: /wrap name in group/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^group key$/i)).toHaveValue('');
    expect(screen.getByLabelText(/^group label$/i)).toHaveValue('');
    fireEvent.change(screen.getByLabelText(/^group key$/i), { target: { value: 'identity' } });
    fireEvent.change(screen.getByLabelText(/^group label$/i), { target: { value: 'Identity' } });
    fireEvent.click(screen.getByRole('button', { name: /create group/i }));

    expect(project.definition.items).toHaveLength(2);
    expect(project.definition.items[0].key).toBe('identity');
    expect((project.definition.items[0] as any).label).toBe('Identity');
    expect((project.definition.items[0] as any).children[0].key).toBe('name');
  });

  it('Wrap in Group can be cancelled without mutating the tree', () => {
    const { project } = renderTree(SIMPLE);
    fireEvent.contextMenu(screen.getByTestId('field-name'));
    fireEvent.click(screen.getByText('Wrap in Group'));

    expect(screen.getByRole('dialog', { name: /wrap name in group/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /cancel wrap/i }));

    expect(project.definition.items).toHaveLength(2);
    expect(project.definition.items[0].key).toBe('name');
    expect(screen.queryByRole('dialog', { name: /wrap name in group/i })).not.toBeInTheDocument();
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
