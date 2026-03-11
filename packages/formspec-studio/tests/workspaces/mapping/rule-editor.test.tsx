import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { RuleEditor } from '../../../src/workspaces/mapping/RuleEditor';

const mappingDoc = {
  direction: 'outbound',
  rules: [
    { source: 'name', target: 'fullName', transform: 'preserve' },
    { source: 'age', target: 'age', transform: 'coerce:integer' },
    { source: 'address.street', target: 'addr.line1', transform: 'expression', expression: 'concat($street, " ", $city)' },
  ],
};

function renderRuleEditor() {
  const project = createProject({ seed: {
    definition: { $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [] } as any,
    mapping: mappingDoc,
  }});
  return { ...render(<ProjectProvider project={project}><RuleEditor /></ProjectProvider>), project };
}

describe('RuleEditor', () => {
  it('renders rules as cards', () => {
    renderRuleEditor();
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('fullName')).toBeInTheDocument();
  });

  it('shows transform type', () => {
    renderRuleEditor();
    expect(screen.getByText(/preserve/i)).toBeInTheDocument();
    expect(screen.getByText(/coerce/i)).toBeInTheDocument();
  });

  it('shows source → target mapping', () => {
    renderRuleEditor();
    expect(screen.getByText('age')).toBeInTheDocument();
  });

  it('shows all rules', () => {
    renderRuleEditor();
    expect(screen.getByText('address.street')).toBeInTheDocument();
    expect(screen.getByText('addr.line1')).toBeInTheDocument();
  });
});
