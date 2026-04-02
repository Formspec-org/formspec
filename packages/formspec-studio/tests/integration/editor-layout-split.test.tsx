/** @filedesc Integration tests verifying cross-tab behavioral guarantees of the Editor/Layout workspace split. */
import { render, screen, act, within, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject, type Project } from '@formspec-org/studio-core';
import { ProjectProvider } from '../../src/state/ProjectContext';
import { SelectionProvider, useSelection } from '../../src/state/useSelection';
import { ActiveGroupProvider } from '../../src/state/useActiveGroup';
import { DefinitionTreeEditor } from '../../src/workspaces/editor/DefinitionTreeEditor';
import { LayoutCanvas } from '../../src/workspaces/layout/LayoutCanvas';
import { EditorPropertiesPanel } from '../../src/workspaces/editor/properties/EditorPropertiesPanel';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProject(definition?: any): Project {
  if (definition) {
    return createProject({ seed: { definition } });
  }
  return createProject();
}

function Providers({ project, children }: { project: Project; children: React.ReactNode }) {
  return (
    <ProjectProvider project={project}>
      <SelectionProvider>
        <ActiveGroupProvider>
          {children}
        </ActiveGroupProvider>
      </SelectionProvider>
    </ProjectProvider>
  );
}

/** Helper component that selects an item in a given tab, then renders children. */
function SelectItem({
  itemKey, itemType, tab, children,
}: {
  itemKey: string; itemType: string; tab?: string; children: React.ReactNode;
}) {
  const { select } = useSelection();
  return (
    <>
      <button data-testid="do-select" onClick={() => select(itemKey, itemType, tab ? { tab } : undefined)}>
        Select
      </button>
      {children}
    </>
  );
}

const BASE_DEF = {
  $formspec: '1.0', url: 'urn:split-test', version: '1.0.0',
  items: [
    { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
    { key: 'age', type: 'field', dataType: 'integer', label: 'Age' },
  ],
};

const BOUND_DEF = {
  ...BASE_DEF,
  binds: [{ path: 'name', required: 'true', constraint: '$name != ""' }],
};

// ---------------------------------------------------------------------------
// Cross-tab sync
// ---------------------------------------------------------------------------

describe('Editor/Layout cross-tab sync', () => {
  it('adding a field via project appears in DefinitionTreeEditor', () => {
    const project = makeProject();
    render(
      <Providers project={project}>
        <DefinitionTreeEditor />
      </Providers>,
    );

    act(() => { project.addField('email', 'Email Address', 'string'); });

    expect(screen.getByTestId('field-email')).toBeInTheDocument();
    expect(screen.getByText('Email Address')).toBeInTheDocument();
  });

  it('adding a field via project appears in LayoutCanvas', () => {
    const project = makeProject();
    render(
      <Providers project={project}>
        <LayoutCanvas />
      </Providers>,
    );

    act(() => { project.addField('email', 'Email Address', 'string'); });

    expect(screen.getByText('Email Address')).toBeInTheDocument();
  });

  it('field added in Editor appears as bound in Layout (not unassigned)', () => {
    const project = makeProject({
      $formspec: '1.0', url: 'urn:split-test', version: '1.0.0',
      items: [
        { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
      ],
    });

    render(
      <Providers project={project}>
        <LayoutCanvas />
      </Providers>,
    );

    // Initially: name is bound, no unassigned tray
    expect(screen.queryByText(/unassigned/i)).not.toBeInTheDocument();

    // Add a new field — it auto-syncs to component tree
    act(() => { project.addField('email', 'Email', 'string'); });

    // The new field should appear in the canvas, not in the unassigned tray
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('removing a component node makes an item appear as unassigned', () => {
    const project = makeProject({
      $formspec: '1.0', url: 'urn:split-test', version: '1.0.0',
      items: [
        { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
        { key: 'age', type: 'field', dataType: 'integer', label: 'Age' },
      ],
    });

    render(
      <Providers project={project}>
        <LayoutCanvas />
      </Providers>,
    );

    // Remove 'age' from component tree
    act(() => {
      (project as any).core.dispatch({
        type: 'component.deleteNode',
        payload: { node: { bind: 'age' } },
      });
    });

    expect(screen.getByText(/unassigned/i)).toBeInTheDocument();
    expect(screen.getByTestId('unassigned-age')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Reorder orthogonality
// ---------------------------------------------------------------------------

describe('Editor/Layout reorder orthogonality', () => {
  it('reorderItem changes definition order and rebuilds the component tree', () => {
    const project = makeProject({
      $formspec: '1.0', url: 'urn:split-test', version: '1.0.0',
      items: [
        { key: 'first', type: 'field', dataType: 'string', label: 'First' },
        { key: 'second', type: 'field', dataType: 'string', label: 'Second' },
        { key: 'third', type: 'field', dataType: 'string', label: 'Third' },
      ],
    });

    // Verify initial order
    const itemsBefore = project.state.definition.items as any[];
    expect(itemsBefore.map((i: any) => i.key)).toEqual(['first', 'second', 'third']);

    // Reorder: move 'second' down
    project.reorderItem('second', 'down');

    // Definition order changed
    const itemsAfter = project.state.definition.items as any[];
    expect(itemsAfter.map((i: any) => i.key)).toEqual(['first', 'third', 'second']);

    // Component tree is rebuilt from definition, so it follows the new order
    const treeAfter = project.component.tree as any;
    const bindsAfter = (treeAfter?.children ?? []).map((c: any) => c.bind).filter(Boolean);
    expect(bindsAfter).toEqual(['first', 'third', 'second']);
  });

  it('component.reorderNode changes component tree but NOT definition order', () => {
    const project = makeProject({
      $formspec: '1.0', url: 'urn:split-test', version: '1.0.0',
      items: [
        { key: 'first', type: 'field', dataType: 'string', label: 'First' },
        { key: 'second', type: 'field', dataType: 'string', label: 'Second' },
        { key: 'third', type: 'field', dataType: 'string', label: 'Third' },
      ],
    });

    // Capture definition order before
    const defBefore = (project.state.definition.items as any[]).map((i: any) => i.key);

    // Reorder component tree: move 'third' up
    (project as any).core.dispatch({
      type: 'component.reorderNode',
      payload: {
        node: { bind: 'third' },
        direction: 'up',
      },
    });

    // Component tree order changed
    const treeAfter = project.component.tree as any;
    const bindsAfter = (treeAfter?.children ?? []).map((c: any) => c.bind).filter(Boolean);
    expect(bindsAfter).toEqual(['first', 'third', 'second']);

    // Definition order unchanged
    const defAfter = (project.state.definition.items as any[]).map((i: any) => i.key);
    expect(defAfter).toEqual(defBefore);
  });

  it('component.moveNode changes component tree but NOT definition order', () => {
    const project = makeProject({
      $formspec: '1.0', url: 'urn:split-test', version: '1.0.0',
      items: [
        { key: 'first', type: 'field', dataType: 'string', label: 'First' },
        { key: 'second', type: 'field', dataType: 'string', label: 'Second' },
        { key: 'third', type: 'field', dataType: 'string', label: 'Third' },
      ],
    });

    // Capture definition order before
    const defBefore = (project.state.definition.items as any[]).map((i: any) => i.key);

    // Rearrange component tree: move 'third' to index 0 within root
    (project as any).core.dispatch({
      type: 'component.moveNode',
      payload: {
        source: { bind: 'third' },
        targetParent: { nodeId: 'root' },
        targetIndex: 0,
      },
    });

    // Component tree order changed
    const treeAfter = project.component.tree as any;
    const bindsAfter = (treeAfter?.children ?? []).map((c: any) => c.bind).filter(Boolean);
    expect(bindsAfter[0]).toBe('third');

    // Definition order unchanged
    const defAfter = (project.state.definition.items as any[]).map((i: any) => i.key);
    expect(defAfter).toEqual(defBefore);
  });
});

// ---------------------------------------------------------------------------
// Properties panel tier isolation
// ---------------------------------------------------------------------------

describe('Editor properties shows only definition props', () => {
  it('shows identity and binds sections for a field', async () => {
    render(
      <Providers project={makeProject(BOUND_DEF)}>
        <SelectItem itemKey="name" itemType="field" tab="editor">
          <EditorPropertiesPanel />
        </SelectItem>
      </Providers>,
    );

    await act(async () => { screen.getByTestId('do-select').click(); });

    // Tier 1 sections present
    expect(screen.getByLabelText(/^key$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^label$/i)).toBeInTheDocument();
    expect(screen.getByText(/behavior rules/i)).toBeInTheDocument();
  });

  it('does NOT show appearance or widget for a field', async () => {
    render(
      <Providers project={makeProject(BOUND_DEF)}>
        <SelectItem itemKey="name" itemType="field" tab="editor">
          <EditorPropertiesPanel />
        </SelectItem>
      </Providers>,
    );

    await act(async () => { screen.getByTestId('do-select').click(); });

    // Tier 2/3 sections absent
    expect(screen.queryByText(/^appearance$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^widget$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^accessibility$/i)).not.toBeInTheDocument();
  });
});

describe('Layout inline toolbar — Tier 2/3 only', () => {
  it('selecting a field in the canvas shows the inline toolbar (not a sidebar panel)', () => {
    render(
      <Providers project={makeProject(BOUND_DEF)}>
        <LayoutCanvas />
      </Providers>,
    );

    fireEvent.click(screen.getByTestId('layout-field-name'));

    // The inline toolbar overflow button appears when a field is selected
    expect(screen.getByTestId('toolbar-overflow')).toBeInTheDocument();
    // The condition chip is visible
    expect(screen.getByTestId('toolbar-condition-chip')).toBeInTheDocument();
  });

  it('the layout canvas does NOT show definition-tier sections (key, behavior rules)', () => {
    render(
      <Providers project={makeProject(BOUND_DEF)}>
        <LayoutCanvas />
      </Providers>,
    );

    fireEvent.click(screen.getByTestId('layout-field-name'));

    // Tier 1 sections never present in layout canvas
    expect(screen.queryByLabelText(/^key$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/behavior rules/i)).not.toBeInTheDocument();
  });
});
