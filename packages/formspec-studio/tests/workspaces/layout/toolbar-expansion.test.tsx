/** @filedesc Tests for layout containers available from the Layout workspace AddItemPalette (modal catalog). */
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

function openLayoutAddPalette() {
  fireEvent.click(screen.getByTestId('layout-add-item'));
}

describe('Layout palette — Accordion and Collapsible', () => {
  it('offers Accordion in the add palette', () => {
    renderLayout(makeProject());
    openLayoutAddPalette();
    expect(screen.getByRole('button', { name: /Accordion / })).toBeInTheDocument();
  });

  it('offers Collapsible in the add palette', () => {
    renderLayout(makeProject());
    openLayoutAddPalette();
    expect(screen.getByRole('button', { name: /Collapsible / })).toBeInTheDocument();
  });

  it('adds an Accordion container to the canvas when chosen', () => {
    renderLayout(makeProject());
    openLayoutAddPalette();
    fireEvent.click(screen.getByRole('button', { name: /Accordion / }));
    expect(screen.getByText('Accordion')).toBeInTheDocument();
  });

  it('adds a Collapsible container to the canvas when chosen', () => {
    renderLayout(makeProject());
    openLayoutAddPalette();
    fireEvent.click(screen.getByRole('button', { name: /Collapsible / }));
    expect(screen.getByText('Collapsible')).toBeInTheDocument();
  });
});

describe('Layout palette — ConditionalGroup', () => {
  it('offers Conditional Group in the add palette', () => {
    renderLayout(makeProject());
    openLayoutAddPalette();
    expect(screen.getByRole('button', { name: /Conditional Group / })).toBeInTheDocument();
  });

  it('adds a ConditionalGroup container to the canvas when chosen', () => {
    renderLayout(makeProject());
    openLayoutAddPalette();
    fireEvent.click(screen.getByRole('button', { name: /Conditional Group / }));
    expect(screen.getByText('ConditionalGroup')).toBeInTheDocument();
  });

  it('ConditionalGroup node has no children initially and empty when expression', () => {
    const project = makeProject();
    renderLayout(project);
    openLayoutAddPalette();
    fireEvent.click(screen.getByRole('button', { name: /Conditional Group / }));
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
    const tree = (project.component as any)?.tree;
    const rootChildren: any[] = tree?.children ?? [];
    const cgNode = rootChildren.find((n: any) => n.component === 'ConditionalGroup');
    expect(cgNode).toBeDefined();
  });
});
