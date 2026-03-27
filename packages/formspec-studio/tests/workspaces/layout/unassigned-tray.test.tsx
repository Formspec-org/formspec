/** @filedesc Tests for the Layout workspace UnassignedTray — items not bound in the component tree. */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject, type Project } from '@formspec-org/studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectionProvider } from '../../../src/state/useSelection';
import { ActiveGroupProvider } from '../../../src/state/useActiveGroup';
import { LayoutCanvas } from '../../../src/workspaces/layout/LayoutCanvas';
import { computeUnassignedItems } from '../../../src/workspaces/layout/UnassignedTray';

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

describe('computeUnassignedItems (unit)', () => {
  it('returns empty when all items are bound', () => {
    const items = [
      { key: 'a', type: 'field', dataType: 'string', label: 'A' },
      { key: 'b', type: 'field', dataType: 'string', label: 'B' },
    ] as any[];
    const tree = [
      { component: 'TextInput', bind: 'a' },
      { component: 'TextInput', bind: 'b' },
    ];
    expect(computeUnassignedItems(items, tree)).toEqual([]);
  });

  it('returns items not in the tree', () => {
    const items = [
      { key: 'a', type: 'field', dataType: 'string', label: 'A' },
      { key: 'b', type: 'field', dataType: 'string', label: 'B' },
      { key: 'c', type: 'field', dataType: 'integer', label: 'C' },
    ] as any[];
    const tree = [{ component: 'TextInput', bind: 'a' }];
    const result = computeUnassignedItems(items, tree);
    expect(result).toHaveLength(2);
    expect(result.map(i => i.key)).toEqual(['b', 'c']);
  });

  it('uses item key as label fallback', () => {
    const items = [{ key: 'noLabel', type: 'field', dataType: 'string' }] as any[];
    const result = computeUnassignedItems(items, []);
    expect(result[0].label).toBe('noLabel');
  });

  it('detects display items bound via nodeId', () => {
    const items = [
      { key: 'notice', type: 'display', label: 'Notice' },
    ] as any[];
    const tree = [{ component: 'Text', nodeId: 'notice' }];
    expect(computeUnassignedItems(items, tree)).toEqual([]);
  });

  it('ignores layout nodes (_layout) when collecting bound keys', () => {
    const items = [
      { key: 'a', type: 'field', dataType: 'string', label: 'A' },
    ] as any[];
    // Layout node with a nodeId that happens to match an item key
    // should NOT count as "bound"
    const tree = [{ component: 'Card', nodeId: 'a', _layout: true }];
    const result = computeUnassignedItems(items, tree);
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('a');
  });

  it('finds items nested in layout containers', () => {
    const items = [
      { key: 'a', type: 'field', dataType: 'string', label: 'A' },
      { key: 'b', type: 'field', dataType: 'string', label: 'B' },
    ] as any[];
    const tree = [
      {
        component: 'Card', nodeId: 'card1', _layout: true,
        children: [{ component: 'TextInput', bind: 'a' }],
      },
    ];
    const result = computeUnassignedItems(items, tree);
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('b');
  });

  it('returns empty for empty definition', () => {
    expect(computeUnassignedItems([], [])).toEqual([]);
  });
});
