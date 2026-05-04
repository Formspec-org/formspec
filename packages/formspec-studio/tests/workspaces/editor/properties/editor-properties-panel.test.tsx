/** @filedesc Tests for EditorPropertiesPanel — the Tier 1 (definition-only) properties panel for the Editor tab. */
import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from '@formspec-org/studio-core';
import { ProjectProvider } from '../../../../src/state/ProjectContext';
import { SelectionProvider, useSelection } from '../../../../src/state/useSelection';
import { EditorPropertiesPanel } from '../../../../src/workspaces/editor/properties/EditorPropertiesPanel';

function SelectAndRender({ selectKey, selectType }: { selectKey?: string; selectType?: string }) {
  const { select } = useSelection();
  return (
    <>
      {selectKey && (
        <button onClick={() => select(selectKey, selectType || 'field', { tab: 'editor' })}>Select</button>
      )}
      <EditorPropertiesPanel />
    </>
  );
}

function renderPanel(definition: any, selectKey?: string, selectType?: string) {
  const project = createProject({ seed: { definition } });
  return {
    project,
    ...render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <SelectAndRender selectKey={selectKey} selectType={selectType} />
        </SelectionProvider>
      </ProjectProvider>,
    ),
  };
}

describe('EditorPropertiesPanel', () => {
  const baseDef = {
    $formspec: '1.0', url: 'urn:props-test', version: '1.0.0',
    title: 'Test Form',
    items: [
      { key: 'name', type: 'field', dataType: 'string', label: 'Name' },
      { key: 'group1', type: 'group', label: 'Section', children: [
        { key: 'email', type: 'field', dataType: 'string', label: 'Email' },
      ]},
      { key: 'notes', type: 'display', label: 'Notes' },
    ],
    binds: [{ path: 'name', required: 'true', constraint: '$name != ""', constraintMessage: 'Name is required' }],
  };

  it('shows form metadata when no item is selected', () => {
    renderPanel(baseDef);
    expect(screen.getByText(/form properties/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/title/i)).toHaveValue('Test Form');
  });

  it('shows field identity when a field is selected', async () => {
    renderPanel(baseDef, 'name', 'field');
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByText('Identity')).toBeInTheDocument();
    expect(screen.getByText(/Deep configuration and advanced behavioral logic for this field/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('name')).toBeInTheDocument();
    expect(screen.getByText(/^Provenance$/i)).toBeInTheDocument();
  });

  it('shows behavior rules section for a field with binds', async () => {
    renderPanel(baseDef, 'name', 'field');
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByText(/behavior rules/i)).toBeInTheDocument();
    expect(screen.getByText(/must fill/i)).toBeInTheDocument();
  });

  it('does NOT show appearance section for a selected field', async () => {
    renderPanel(baseDef, 'name', 'field');
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.queryByText(/^appearance$/i)).not.toBeInTheDocument();
  });

  it('does NOT show widget section for a selected field', async () => {
    renderPanel(baseDef, 'name', 'field');
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.queryByLabelText(/^widget$/i)).not.toBeInTheDocument();
  });

  it('shows group config when a group is selected', async () => {
    renderPanel(baseDef, 'group1', 'group');
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByText(/group config/i)).toBeInTheDocument();
  });

  it('uses stronger contrast styling for group config labels', async () => {
    renderPanel({
      ...baseDef,
      items: [
        { key: 'group1', type: 'group', label: 'Section', repeatable: true, minRepeat: 1, maxRepeat: 3, children: [] },
      ],
    }, 'group1', 'group');
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByText('Repeatable').closest('label')).toHaveClass('text-ink');
    expect(screen.getByText('Min Repeat').closest('label')).toHaveClass('text-ink');
    expect(screen.getByText('Max Repeat').closest('label')).toHaveClass('text-ink');
  });

  it('shows content section when a display item is selected', async () => {
    renderPanel(baseDef, 'notes', 'display');
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByText(/content/i)).toBeInTheDocument();
  });

  it('restores the add placeholder when an optional description is cleared', async () => {
    const withDescription = {
      ...baseDef,
      items: [
        { key: 'name', type: 'field', dataType: 'string', label: 'Name', description: 'Existing description' },
      ],
      binds: [],
    };
    const { project } = renderPanel(withDescription, 'name', 'field');
    await act(async () => { screen.getByText('Select').click(); });

    const descriptionInput = screen.getByLabelText(/^description$/i);
    await act(async () => {
      fireEvent.change(descriptionInput, { target: { value: '' } });
      fireEvent.blur(descriptionInput);
    });

    expect(project.definition.items[0].description).toBeUndefined();
    expect(screen.getByRole('button', { name: /\+ add description/i })).toBeInTheDocument();
  });

  it('shows "select in layout tab" for layout node keys', async () => {
    renderPanel(baseDef, '__node:abc123', 'layout');
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByText(/layout tab/i)).toBeInTheDocument();
  });

  it('shows multi-select summary when multiple items are selected', async () => {
    const project = createProject({ seed: { definition: baseDef as any } });

    function MultiSelectAndRender() {
      const { select, toggleSelect } = useSelection();
      return (
        <>
          <button onClick={() => {
            select('name', 'field', { tab: 'editor' });
            toggleSelect('notes', 'display', { tab: 'editor' });
          }}>MultiSelect</button>
          <EditorPropertiesPanel />
        </>
      );
    }

    render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <MultiSelectAndRender />
        </SelectionProvider>
      </ProjectProvider>,
    );

    await act(async () => { screen.getByText('MultiSelect').click(); });
    expect(screen.getByText('2 items selected')).toBeInTheDocument();
  });

  it('shows constraint bind card in binds section', async () => {
    renderPanel(baseDef, 'name', 'field');
    await act(async () => { screen.getByText('Select').click(); });
    // constraint bind type label is shown as verb-intent label
    expect(screen.getByText(/validates/i)).toBeInTheDocument();
  });

  it('does not render constraintMessage as a separate bind card', async () => {
    renderPanel(baseDef, 'name', 'field');
    await act(async () => { screen.getByText('Select').click(); });
    // constraintMessage is metadata on constraint, not a standalone bind
    expect(screen.queryByText(/^constraintMessage$/i)).not.toBeInTheDocument();
  });

  it('shows constraintMessage text inside the constraint card', async () => {
    renderPanel(baseDef, 'name', 'field');
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByText(/Name is required/)).toBeInTheDocument();
  });

  it('shows options section for choice fields', async () => {
    const choiceDef = {
      ...baseDef,
      items: [{
        key: 'color', type: 'field', dataType: 'choice', label: 'Color',
        options: [{ value: 'red', label: 'Red' }],
      }],
      binds: [],
    };
    renderPanel(choiceDef, 'color', 'field');
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByText(/^options$/i)).toBeInTheDocument();
  });

  it('shows delete and duplicate buttons for selected items', async () => {
    renderPanel(baseDef, 'name', 'field');
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /duplicate/i })).toBeInTheDocument();
  });

  it('records manual provenance/patch metadata when label is edited', async () => {
    const { project } = renderPanel(baseDef, 'name', 'field');
    await act(async () => { screen.getByText('Select').click(); });

    const labelInput = screen.getByLabelText(/^label$/i);
    await act(async () => {
      fireEvent.change(labelInput, { target: { value: 'Applicant name' } });
      fireEvent.blur(labelInput);
    });

    const studioExt = (project.definition.extensions as Record<string, any> | undefined)?.['x-studio'];
    expect(studioExt).toBeDefined();
    expect(studioExt.patches.some((patch: any) => patch.source === 'manual')).toBe(true);
    expect(studioExt.provenance.some((entry: any) => entry.objectRef === 'name' || entry.objectRef === 'items.name')).toBe(true);
  });

  it('shows "item not found" for non-existent keys', async () => {
    renderPanel(baseDef, 'nonexistent', 'field');
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByText(/item not found/i)).toBeInTheDocument();
  });
});
