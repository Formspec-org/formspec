/** @filedesc Tests for the Layout workspace UnassignedTray — items not bound in the component tree. */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject, type Project } from '@formspec-org/studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectionProvider } from '../../../src/state/useSelection';
import { ActiveGroupProvider } from '../../../src/state/useActiveGroup';
import { LayoutCanvas } from '../../../src/workspaces/layout/LayoutCanvas';

function renderLayout(project: Project) {
  return {
    project,
    ...render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <ActiveGroupProvider>
            <LayoutCanvas />
          </ActiveGroupProvider>
        </SelectionProvider>
      </ProjectProvider>,
    ),
  };
}

function makeProject(definition: any): Project {
  return createProject({ seed: { definition } });
}

/** Remove a bound node from the component tree by its bind key. */
function removeBoundNode(project: Project, bindKey: string) {
  (project as any).core.dispatch({
    type: 'component.deleteNode',
    payload: { node: { bind: bindKey } },
  });
}

describe('UnassignedTray (integration)', () => {
  it('shows items removed from the component tree', () => {
    const project = makeProject({
      $formspec: '1.0', url: 'urn:tray-test', version: '1.0.0',
      items: [
        { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
        { key: 'age', type: 'field', dataType: 'integer', label: 'Age' },
      ],
    });

    removeBoundNode(project, 'age');

    renderLayout(project);
    expect(screen.getByText(/unassigned/i)).toBeInTheDocument();
    expect(screen.getByText('Age')).toBeInTheDocument();
  });

  it('hides the tray when all items are bound', () => {
    const project = makeProject({
      $formspec: '1.0', url: 'urn:tray-test', version: '1.0.0',
      items: [
        { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
      ],
    });

    renderLayout(project);
    expect(screen.queryByText(/unassigned/i)).not.toBeInTheDocument();
  });

  it('shows group items that are unbound', () => {
    const project = makeProject({
      $formspec: '1.0', url: 'urn:tray-test', version: '1.0.0',
      items: [
        {
          key: 'contact', type: 'group', label: 'Contact Info',
          children: [
            { key: 'phone', type: 'field', dataType: 'string', label: 'Phone' },
          ],
        },
      ],
    });

    removeBoundNode(project, 'contact');

    renderLayout(project);
    expect(screen.getByText(/unassigned/i)).toBeInTheDocument();
    expect(screen.getByText('Contact Info')).toBeInTheDocument();
  });

  it('shows display items that are unbound', () => {
    const project = makeProject({
      $formspec: '1.0', url: 'urn:tray-test', version: '1.0.0',
      items: [
        { key: 'notice', type: 'display', label: 'Important Notice' },
        { key: 'name', type: 'field', dataType: 'string', label: 'Name' },
      ],
    });

    // Remove display item (uses nodeId in tree)
    (project as any).core.dispatch({
      type: 'component.deleteNode',
      payload: { node: { nodeId: 'notice' } },
    });

    renderLayout(project);
    expect(screen.getByText(/unassigned/i)).toBeInTheDocument();
    expect(screen.getByText('Important Notice')).toBeInTheDocument();
  });
});
