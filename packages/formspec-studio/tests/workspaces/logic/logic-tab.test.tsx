import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectionProvider } from '../../../src/state/useSelection';
import { LogicTab } from '../../../src/workspaces/logic/LogicTab';

const logicDef = {
  $formspec: '1.0', url: 'urn:test', version: '1.0.0',
  items: [
    { key: 'name', type: 'field', dataType: 'string' },
    { key: 'age', type: 'field', dataType: 'integer' },
  ],
  binds: {
    name: { required: 'true', relevant: '$age >= 18' },
    age: { required: 'true' },
  },
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
        </SelectionProvider>
      </ProjectProvider>
    ),
    project,
  };
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
    expect(screen.getByText('isAdult')).toBeInTheDocument();
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
});
