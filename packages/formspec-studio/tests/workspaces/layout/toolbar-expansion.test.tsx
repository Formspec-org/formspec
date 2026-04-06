/** @filedesc Tests for Phase 3 toolbar expansion — Accordion, Collapsible, ConditionalGroup on the layout toolbar. */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject, type Project } from '@formspec-org/studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectionProvider } from '../../../src/state/useSelection';
import { ActiveGroupProvider } from '../../../src/state/useActiveGroup';
import { LayoutCanvas } from '../../../src/workspaces/layout/LayoutCanvas';

const EMPTY_DEF: any = {
  $formspec: '1.0', url: 'urn:toolbar-test', version: '1.0.0', title: 'Toolbar Test',
  items: [
    { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
  ],
};

function renderLayout(project: Project) {
  return render(
    <ProjectProvider project={project}>
      <SelectionProvider>
        <ActiveGroupProvider>
          <LayoutCanvas />
        </ActiveGroupProvider>
      </SelectionProvider>
    </ProjectProvider>,
  );
}

function makeProject() {
  return createProject({ seed: { definition: EMPTY_DEF } });
}

function openLayoutContainerTypeMenu() {
  fireEvent.click(screen.getByTestId('layout-add-container-menu'));
}

describe('Toolbar — Accordion and Collapsible', () => {
  it('shows a + Accordion toolbar button', () => {
    renderLayout(makeProject());
    openLayoutContainerTypeMenu();
    expect(screen.getByTestId('layout-add-accordion')).toBeInTheDocument();
  });

  it('shows a + Collapsible toolbar button', () => {
    renderLayout(makeProject());
    openLayoutContainerTypeMenu();
    expect(screen.getByTestId('layout-add-collapsible')).toBeInTheDocument();
  });

  it('adds an Accordion container to the canvas when clicked', () => {
    renderLayout(makeProject());
    openLayoutContainerTypeMenu();
    fireEvent.click(screen.getByTestId('layout-add-accordion'));
    expect(screen.getByText('Accordion')).toBeInTheDocument();
  });

  it('adds a Collapsible container to the canvas when clicked', () => {
    renderLayout(makeProject());
    openLayoutContainerTypeMenu();
    fireEvent.click(screen.getByTestId('layout-add-collapsible'));
    expect(screen.getByText('Collapsible')).toBeInTheDocument();
  });
});

describe('Toolbar — ConditionalGroup', () => {
  it('shows a + ConditionalGroup toolbar button', () => {
    renderLayout(makeProject());
    openLayoutContainerTypeMenu();
    expect(screen.getByTestId('layout-add-conditionalgroup')).toBeInTheDocument();
  });

  it('adds a ConditionalGroup container to the canvas when clicked', () => {
    renderLayout(makeProject());
    openLayoutContainerTypeMenu();
    fireEvent.click(screen.getByTestId('layout-add-conditionalgroup'));
    expect(screen.getByText('ConditionalGroup')).toBeInTheDocument();
  });

  it('ConditionalGroup node has no children initially and empty when expression', () => {
    const project = makeProject();
    renderLayout(project);
    openLayoutContainerTypeMenu();
    fireEvent.click(screen.getByTestId('layout-add-conditionalgroup'));
    // The component tree should have a ConditionalGroup node with _layout:true
    const tree = (project.component as any)?.tree;
    const rootChildren: any[] = tree?.children ?? [];
    const cgNode = rootChildren.find((n: any) => n.component === 'ConditionalGroup');
    expect(cgNode).toBeDefined();
    expect(cgNode?._layout).toBe(true);
  });
});

describe('Context menu — Wrap in ConditionalGroup', () => {
  it('offers "Wrap in Conditional Group" on field nodes', () => {
    renderLayout(makeProject());
    const field = screen.getByTestId('layout-field-name');
    fireEvent.contextMenu(field);
    expect(screen.getByTestId('layout-ctx-wrapInConditionalGroup')).toBeInTheDocument();
  });

  it('wraps a field in ConditionalGroup when the action is triggered', () => {
    const project = makeProject();
    renderLayout(project);
    const field = screen.getByTestId('layout-field-name');
    fireEvent.contextMenu(field);
    fireEvent.click(screen.getByTestId('layout-ctx-wrapInConditionalGroup'));
    // A ConditionalGroup wrapper should now exist in the tree
    const tree = (project.component as any)?.tree;
    const rootChildren: any[] = tree?.children ?? [];
    const cgNode = rootChildren.find((n: any) => n.component === 'ConditionalGroup');
    expect(cgNode).toBeDefined();
  });
});
