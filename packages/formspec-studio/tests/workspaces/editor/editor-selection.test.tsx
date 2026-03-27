/** @filedesc Tests for selection behavior in the DefinitionTreeEditor. */
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

const TWO_FIELDS = {
  $formspec: '1.0', url: 'urn:sel-test', version: '1.0.0',
  items: [
    { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
    { key: 'age', type: 'field', dataType: 'integer', label: 'Age' },
  ],
};

const WITH_GROUP = {
  $formspec: '1.0', url: 'urn:sel-test', version: '1.0.0',
  items: [
    { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
    {
      key: 'contact', type: 'group', label: 'Contact',
      children: [
        { key: 'email', type: 'field', dataType: 'string', label: 'Email' },
      ],
    },
  ],
};

describe('Editor selection', () => {
  it('clicking an item selects it', () => {
    renderTree(TWO_FIELDS);
    fireEvent.click(screen.getByTestId('field-name'));
    expect(screen.getByTestId('field-name').className).toContain('border-accent');
  });

  it('clicking another item deselects the first', () => {
    renderTree(TWO_FIELDS);
    fireEvent.click(screen.getByTestId('field-name'));
    expect(screen.getByTestId('field-name').className).toContain('border-accent');

    fireEvent.click(screen.getByTestId('field-age'));
    expect(screen.getByTestId('field-age').className).toContain('border-accent');
    expect(screen.getByTestId('field-name').className).not.toContain('border-accent');
  });

  it('Escape clears selection', () => {
    renderTree(TWO_FIELDS);
    fireEvent.click(screen.getByTestId('field-name'));
    expect(screen.getByTestId('field-name').className).toContain('border-accent');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByTestId('field-name').className).not.toContain('border-accent');
  });

  it('clicking a group header selects it', () => {
    renderTree(WITH_GROUP);
    // Click the group header area (the div with data-testid="group-contact")
    fireEvent.click(screen.getByTestId('group-contact'));
    expect(screen.getByTestId('group-contact').className).toContain('border-accent');
  });

  it('Ctrl+click toggles multi-select', () => {
    renderTree(TWO_FIELDS);
    fireEvent.click(screen.getByTestId('field-name'));
    fireEvent.click(screen.getByTestId('field-age'), { ctrlKey: true });

    expect(screen.getByTestId('field-name').className).toContain('border-accent');
    expect(screen.getByTestId('field-age').className).toContain('border-accent');
  });
});
