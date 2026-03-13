import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectionProvider, useSelection } from '../../../src/state/useSelection';
import { LogicTab } from '../../../src/workspaces/logic/LogicTab';

const logicDef = {
  $formspec: '1.0', url: 'urn:test', version: '1.0.0',
  items: [
    { key: 'name', type: 'field', dataType: 'string' },
    { key: 'age', type: 'field', dataType: 'integer' },
  ],
  binds: [
    { path: 'name', required: 'true', relevant: '$age >= 18' },
    { path: 'age', required: 'true' },
  ],
  shapes: [
    { name: 'ageCheck', severity: 'error', constraint: '$age >= 0', targets: ['age'] },
  ],
  variables: [
    { name: 'isAdult', expression: '$age >= 18' },
  ],
};

function renderLogic(def?: any) {
  const project = createProject({ seed: { definition: def || logicDef } });
  return {
    ...render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <LogicTab />
          <SelectionProbe />
        </SelectionProvider>
      </ProjectProvider>
    ),
    project,
  };
}

function SelectionProbe() {
  const { selectedKey } = useSelection();
  return <div data-testid="selected-key">{selectedKey || ''}</div>;
}

describe('LogicTab', () => {
  it('shows filter bar with bind type counts', () => {
    renderLogic();
    // FilterBar shows "required (2)" and "relevant (1)" pills
    expect(screen.getByText(/required \(2\)/i)).toBeInTheDocument();
    expect(screen.getByText(/relevant \(1\)/i)).toBeInTheDocument();
  });

  it('renders variables section', () => {
    renderLogic();
    expect(screen.getByText('@isAdult')).toBeInTheDocument();
    // $age >= 18 appears in both variables and binds sections
    const ageExprs = screen.getAllByText('$age >= 18');
    expect(ageExprs.length).toBeGreaterThanOrEqual(1);
  });

  it('renders shapes section', () => {
    renderLogic();
    expect(screen.getByText('ageCheck')).toBeInTheDocument();
  });

  it('renders bind entries', () => {
    renderLogic();
    // Should show bind info for fields with binds
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('age')).toBeInTheDocument();
  });

  it('filters the workspace when a bind-type pill is clicked', async () => {
    renderLogic();
    await act(async () => {
      screen.getByText(/relevant \(1\)/i).click();
    });
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.queryByText(/^age$/i)).not.toBeInTheDocument();
  });

  it('selects the related field when a bind row is clicked', async () => {
    renderLogic();
    await act(async () => {
      screen.getByText(/^age$/i).click();
    });
    expect(screen.getByTestId('selected-key')).toHaveTextContent('age');
  });

  it('variable expression is inline-editable on click', async () => {
    renderLogic({
      ...logicDef,
      variables: [
        { name: 'householdIncome', expression: 'sum($members[*].mInc)' },
      ],
    });

    await act(async () => {
      screen.getByText('sum($members[*].mInc)').click();
    });

    // InlineExpression should now show a textarea with the value
    expect(screen.getByDisplayValue('sum($members[*].mInc)')).toBeInTheDocument();
  });

  it('shows Variables section even when no variables defined', () => {
    renderLogic({
      ...logicDef,
      variables: [],
    });
    expect(screen.getByText(/Calculated Values/)).toBeInTheDocument();
    expect(screen.getByText('+ New Variable')).toBeInTheDocument();
  });
});
