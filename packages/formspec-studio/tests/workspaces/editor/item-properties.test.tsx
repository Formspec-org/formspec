import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createProject, type Project } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectionProvider, useSelection } from '../../../src/state/useSelection';
import { ItemProperties } from '../../../src/workspaces/editor/ItemProperties';

const testDef = {
  $formspec: '1.0', url: 'urn:test', version: '1.0.0',
  items: [
    { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
    { key: 'group1', type: 'group', label: 'Section', children: [
      { key: 'email', type: 'field', dataType: 'string' },
    ]},
  ],
  binds: [{ path: 'name', required: 'true' }],
};

function SelectAndInspect({ path, type }: { path: string; type: string }) {
  const { select } = useSelection();
  return (
    <>
      <button onClick={() => select(path, type)}>Select</button>
      <ItemProperties />
    </>
  );
}

function renderProps(project?: Project, selection: { path: string; type: string } = { path: 'name', type: 'field' }) {
  const p = project ?? createProject({ seed: { definition: testDef as any } });
  return {
    ...render(
      <ProjectProvider project={p}>
        <SelectionProvider>
          <SelectAndInspect path={selection.path} type={selection.type} />
        </SelectionProvider>
      </ProjectProvider>
    ),
    project: p,
  };
}

describe('ItemProperties', () => {
  it('shows empty state when nothing selected', () => {
    const project = createProject({ seed: { definition: testDef as any } });
    render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <ItemProperties />
        </SelectionProvider>
      </ProjectProvider>
    );
    expect(screen.getByText(/select an item/i)).toBeInTheDocument();
  });

  it('shows item details when selected', async () => {
    renderProps();
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByDisplayValue('name')).toBeInTheDocument();
    expect(screen.getByText(/string/i)).toBeInTheDocument();
  });

  it('dispatches rename on key change', async () => {
    const { project } = renderProps();
    const spy = vi.spyOn(project, 'dispatch');

    await act(async () => { screen.getByText('Select').click(); });

    const input = screen.getByDisplayValue('name');
    await act(async () => {
      // Simulate changing the key
      (input as HTMLInputElement).value = 'fullName';
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Should dispatch on blur
    await act(async () => {
      input.dispatchEvent(new Event('blur', { bubbles: true }));
    });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'definition.renameItem' })
    );
  });

  it('shows delete button', async () => {
    renderProps();
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  it('shows duplicate button', async () => {
    renderProps();
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByRole('button', { name: /duplicate/i })).toBeInTheDocument();
  });

  it('shows behavior rules for exact nested bind paths', async () => {
    const project = createProject({ seed: { definition: {
      $formspec: '1.0',
      url: 'urn:test',
      version: '1.0.0',
      items: [
        {
          key: 'household',
          type: 'group',
          label: 'Household',
          children: [{ key: 'hhSize', type: 'field', dataType: 'integer' }],
        },
      ],
      binds: [{ path: 'household.hhSize', required: 'count(.) > 0' }],
    } as any } });
    renderProps(project, { path: 'household.hhSize', type: 'field' });
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByText(/behavior rules/i)).toBeInTheDocument();
    expect(screen.getByText(/required/i)).toBeInTheDocument();
  });

  it('does not show behavior rules for nested fields when only a leaf-key bind exists', async () => {
    const project = createProject({ seed: { definition: {
      $formspec: '1.0',
      url: 'urn:test',
      version: '1.0.0',
      items: [
        {
          key: 'household',
          type: 'group',
          label: 'Household',
          children: [{ key: 'hhSize', type: 'field', dataType: 'integer' }],
        },
      ],
      binds: [{ path: 'hhSize', required: 'count(.) > 0' }],
    } as any } });
    renderProps(project, { path: 'household.hhSize', type: 'field' });
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.queryByText(/behavior rules/i)).toBeNull();
  });

  it('does not show cardinality inputs for repeatable groups', async () => {
    const project = createProject({ seed: { definition: {
      $formspec: '1.0',
      url: 'urn:test',
      version: '1.0.0',
      items: [
        {
          key: 'members',
          type: 'group',
          label: 'Members',
          repeatable: true,
          minItems: 1,
          maxItems: 5,
          children: [{ key: 'memberName', type: 'field', dataType: 'string' }],
        },
      ],
    } as any } });
    renderProps(project, { path: 'members', type: 'group' });
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.queryByText(/cardinality/i)).toBeNull();
    expect(screen.queryByLabelText(/min repeat/i)).toBeNull();
    expect(screen.queryByLabelText(/max repeat/i)).toBeNull();
  });

  it('shows choice options as read-only values', async () => {
    const project = createProject({ seed: { definition: {
      $formspec: '1.0',
      url: 'urn:test',
      version: '1.0.0',
      items: [
        {
          key: 'marital',
          type: 'field',
          dataType: 'choice',
          label: 'Marital Status',
          options: [
            { value: 'single', label: 'Single' },
            { value: 'married', label: 'Married' },
          ],
        },
      ],
    } as any } });
    renderProps(project, { path: 'marital', type: 'field' });
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByText(/options/i)).toBeInTheDocument();
    expect(screen.getByText('single')).toBeInTheDocument();
    expect(screen.getByText('Single')).toBeInTheDocument();
    expect(screen.queryByLabelText(/option 1 value/i)).toBeNull();
    expect(screen.queryByLabelText(/option 1 label/i)).toBeNull();
  });

  it('does not show add-rule affordances for existing behavior rules', async () => {
    renderProps();
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.queryByRole('button', { name: /\+ add rule/i })).toBeNull();
    expect(screen.queryByLabelText(/rule expression/i)).toBeNull();
  });

  it('shows a label input for editable field labels', async () => {
    renderProps();
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByLabelText(/label/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Full Name')).toBeInTheDocument();
  });
});
