/** @filedesc Test utilities for the editor workspace: fixtures and a render helper with providers. */
import { render } from '@testing-library/react';
import { createProject, type Project } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectionProvider } from '../../../src/state/useSelection';
import { ActivePageProvider } from '../../../src/state/useActivePage';
import { EditorCanvas } from '../../../src/workspaces/editor/EditorCanvas';

export const editorFixtures = {
  canvas: {
    $formspec: '1.0',
    url: 'urn:test',
    version: '1.0.0',
    items: [
      { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
      {
        key: 'contact',
        type: 'group',
        label: 'Contact Info',
        children: [
          { key: 'email', type: 'field', dataType: 'string', label: 'Email' },
          { key: 'phone', type: 'field', dataType: 'string', label: 'Phone' },
        ],
      },
      { key: 'notice', type: 'display', label: 'Important Notice' },
    ],
    binds: {
      name: { required: 'true' },
      'contact.email': { calculate: '$name + "@example.com"' },
    },
  },
  dnd: {
    $formspec: '1.0',
    url: 'urn:dnd-test',
    version: '1.0.0',
    items: [
      { key: 'fieldA', type: 'field', dataType: 'string', label: 'Field A' },
      {
        key: 'groupX',
        type: 'group',
        label: 'Group X',
        children: [
          { key: 'child1', type: 'field', dataType: 'string', label: 'Child 1' },
          { key: 'child2', type: 'field', dataType: 'string', label: 'Child 2' },
        ],
      },
      { key: 'fieldB', type: 'field', dataType: 'string', label: 'Field B' },
    ],
  },
  simpleFields: {
    $formspec: '1.0',
    url: 'urn:test',
    version: '1.0.0',
    items: [
      { key: 'firstField', type: 'field', dataType: 'string', label: 'First Field' },
      { key: 'secondField', type: 'field', dataType: 'string', label: 'Second Field' },
    ],
  },
};

export function renderEditorCanvas(
  definition: any = editorFixtures.canvas,
  options: { component?: any; project?: Project } = {},
) {
  const project = options.project ?? createProject({
    seed: {
      definition,
      ...(options.component ? { component: options.component } : {}),
    },
  });

  return {
    project,
    ...render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <ActivePageProvider>
            <EditorCanvas />
          </ActivePageProvider>
        </SelectionProvider>
      </ProjectProvider>,
    ),
  };
}
