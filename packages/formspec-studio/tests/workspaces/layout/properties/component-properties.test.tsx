/** @filedesc Tests for the Layout properties panel — Tier 2/3 only, no definition-tier properties. */
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject, type Project } from '@formspec-org/studio-core';
import { ProjectProvider } from '../../../../src/state/ProjectContext';
import { SelectionProvider, useSelection } from '../../../../src/state/useSelection';
import { ActiveGroupProvider } from '../../../../src/state/useActiveGroup';
import { ComponentProperties } from '../../../../src/workspaces/layout/properties/ComponentProperties';

const testDef = {
  $formspec: '1.0', url: 'urn:layout-props-test', version: '1.0.0',
  items: [
    { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
    { key: 'group1', type: 'group', label: 'Contact Info', children: [
      { key: 'email', type: 'field', dataType: 'string', label: 'Email' },
    ]},
    { key: 'notice', type: 'display', label: 'Important Notice' },
  ],
  binds: [{ path: 'name', required: 'true', constraint: '$name != ""' }],
};

function SelectAndShow({ selectKey, selectType }: { selectKey?: string; selectType?: string }) {
  const { select } = useSelection();
  return (
    <>
      {selectKey && (
        <button onClick={() => select(selectKey, selectType || 'field', { tab: 'layout' })}>
          Select
        </button>
      )}
      <ComponentProperties />
    </>
  );
}

function renderProperties(
  definition: any = testDef,
  selectKey?: string,
  selectType?: string,
) {
  const project = createProject({ seed: { definition } });
  const result = render(
    <ProjectProvider project={project}>
      <SelectionProvider>
        <ActiveGroupProvider>
          <SelectAndShow selectKey={selectKey} selectType={selectType} />
        </ActiveGroupProvider>
      </SelectionProvider>
    </ProjectProvider>,
  );
  return { project, ...result };
}

describe('ComponentProperties', () => {
  it('shows hint message when nothing is selected', () => {
    renderProperties();
    expect(screen.getByText(/select a component/i)).toBeInTheDocument();
  });

  it('does NOT show definition-tier properties for a field', async () => {
    renderProperties(testDef, 'name', 'field');
    await act(async () => { screen.getByText('Select').click(); });

    // No Tier 1 (definition) properties
    expect(screen.queryByText(/data\s?type/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/calculate/i)).not.toBeInTheDocument();
    // No bind behavior rules
    expect(screen.queryByText(/behavior rules/i)).not.toBeInTheDocument();
    // No identity section with Key/Label edits
    expect(screen.queryByLabelText(/^key$/i)).not.toBeInTheDocument();
  });

  it('shows Accessibility section header for a field', async () => {
    renderProperties(testDef, 'name', 'field');
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByText(/accessibility/i)).toBeInTheDocument();
  });

  it('shows Appearance section for a field', async () => {
    renderProperties(testDef, 'name', 'field');
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByText(/appearance/i)).toBeInTheDocument();
  });

  it('shows Visual Condition label (not bind relevant)', async () => {
    renderProperties(testDef, 'name', 'field');
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByText(/visual condition/i)).toBeInTheDocument();
    // Must NOT use the definition bind "relevant"
    expect(screen.queryByText(/^relevant$/i)).not.toBeInTheDocument();
  });

  it('shows container-specific sections for a group', async () => {
    renderProperties(testDef, 'group1', 'group');
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByText(/container/i)).toBeInTheDocument();
    expect(screen.getByText(/accessibility/i)).toBeInTheDocument();
  });

  it('shows Accessibility section for a display item', async () => {
    renderProperties(testDef, 'notice', 'display');
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByText(/accessibility/i)).toBeInTheDocument();
  });

  it('shows Layout section for a field', async () => {
    renderProperties(testDef, 'name', 'field');
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByText('Layout')).toBeInTheDocument();
  });

  it('shows Layout section for a display item', async () => {
    renderProperties(testDef, 'notice', 'display');
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByText('Layout')).toBeInTheDocument();
  });

  it('does NOT show Layout section for a group', async () => {
    renderProperties(testDef, 'group1', 'group');
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.queryByText('Layout')).not.toBeInTheDocument();
  });

  it('shows "Item not found" for an invalid key', async () => {
    renderProperties(testDef, 'nonexistent', 'field');
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByText(/item not found/i)).toBeInTheDocument();
  });

  it('shows the item label in the header', async () => {
    renderProperties(testDef, 'name', 'field');
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByText(/full name/i)).toBeInTheDocument();
  });

  it('does NOT show FieldConfigSection, OptionsSection, or GroupConfigSection', async () => {
    renderProperties(testDef, 'name', 'field');
    await act(async () => { screen.getByText('Select').click(); });
    // These are Tier 1 sections
    expect(screen.queryByText(/field config/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/options/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/validation shapes/i)).not.toBeInTheDocument();
  });

  it('shows nested child item when selected by full path', async () => {
    renderProperties(testDef, 'group1.email', 'field');
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByText(/email/i)).toBeInTheDocument();
    expect(screen.getByText(/accessibility/i)).toBeInTheDocument();
  });
});
