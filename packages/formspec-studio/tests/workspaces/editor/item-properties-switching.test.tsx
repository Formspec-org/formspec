import { render, screen, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectionProvider, useSelection } from '../../../src/state/useSelection';
import { ItemProperties } from '../../../src/workspaces/editor/ItemProperties';

const definition = {
  $formspec: '1.0',
  url: 'urn:test',
  version: '1.0.0',
  items: [
    { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
    { key: 'ssn', type: 'field', dataType: 'string', label: 'SSN' },
  ],
};

function InspectorHarness() {
  const { select } = useSelection();
  return (
    <>
      <button type="button" onClick={() => select('name', 'field')}>
        Select Name
      </button>
      <button type="button" onClick={() => select('ssn', 'field')}>
        Select SSN
      </button>
      <ItemProperties />
    </>
  );
}

function renderInspector() {
  const project = createProject({ seed: { definition: definition as any } });
  return render(
    <ProjectProvider project={project}>
      <SelectionProvider>
        <InspectorHarness />
      </SelectionProvider>
    </ProjectProvider>
  );
}

describe('ItemProperties switching', () => {
  it('updates the KEY input when switching between selected fields', async () => {
    renderInspector();

    await act(async () => {
      screen.getByText('Select Name').click();
    });
    expect(screen.getByDisplayValue('name')).toBeInTheDocument();

    await act(async () => {
      screen.getByText('Select SSN').click();
    });
    expect(screen.getByDisplayValue('ssn')).toBeInTheDocument();
  });

  it('keeps showing the renamed item instead of falling into an item-not-found state', async () => {
    renderInspector();

    await act(async () => {
      screen.getByText('Select Name').click();
    });

    const keyInput = screen.getByDisplayValue('name');
    await act(async () => {
      (keyInput as HTMLInputElement).value = 'fullLegalName';
      keyInput.dispatchEvent(new Event('change', { bubbles: true }));
      keyInput.dispatchEvent(new Event('blur', { bubbles: true }));
    });

    expect(screen.queryByText(/item not found/i)).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('fullLegalName')).toBeInTheDocument();
  });
});
