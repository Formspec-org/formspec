import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectionProvider } from '../../../src/state/useSelection';
import { VariablesList } from '../../../src/components/blueprint/VariablesList';
import { DataSourcesList } from '../../../src/components/blueprint/DataSourcesList';
import { OptionSetsList } from '../../../src/components/blueprint/OptionSetsList';
import { MappingsList } from '../../../src/components/blueprint/MappingsList';
import { ThemeOverview } from '../../../src/components/blueprint/ThemeOverview';

describe('VariablesList', () => {
  it('shows variables with expression', () => {
    const project = createProject({ seed: { definition: {
      $formspec: '1.0', url: 'urn:test', version: '1.0.0',
      items: [],
      variables: [{ name: 'isAdult', expression: '$age >= 18' }],
    } as any }});
    render(<ProjectProvider project={project}><SelectionProvider><VariablesList /></SelectionProvider></ProjectProvider>);
    expect(screen.getByText('@isAdult')).toBeInTheDocument();
    expect(screen.getByText('$age >= 18')).toBeInTheDocument();
  });
});

describe('DataSourcesList', () => {
  it('shows instance names', () => {
    const project = createProject({ seed: { definition: {
      $formspec: '1.0', url: 'urn:test', version: '1.0.0',
      items: [],
      instances: [{ name: 'counties' }],
    } as any }});
    render(<ProjectProvider project={project}><SelectionProvider><DataSourcesList /></SelectionProvider></ProjectProvider>);
    expect(screen.getByText('counties')).toBeInTheDocument();
  });
});

describe('OptionSetsList', () => {
  it('shows option set names', () => {
    const project = createProject({ seed: { definition: {
      $formspec: '1.0', url: 'urn:test', version: '1.0.0',
      items: [],
      optionSets: { colors: { options: [{ value: 'red', label: 'Red' }] } },
    } as any }});
    render(<ProjectProvider project={project}><SelectionProvider><OptionSetsList /></SelectionProvider></ProjectProvider>);
    expect(screen.getByText('colors')).toBeInTheDocument();
  });
});

describe('MappingsList', () => {
  it('shows mapping info', () => {
    const project = createProject({ seed: {
      definition: { $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [] } as any,
      mapping: { direction: 'outbound', rules: [{ source: 'a', target: 'b' }] },
    }});
    render(<ProjectProvider project={project}><SelectionProvider><MappingsList /></SelectionProvider></ProjectProvider>);
    expect(screen.getByText(/1 rule/i)).toBeInTheDocument();
    expect(screen.getByText(/outbound/i)).toBeInTheDocument();
  });
});

describe('ThemeOverview', () => {
  it('shows token count', () => {
    const project = createProject({ seed: {
      definition: { $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [] } as any,
      theme: { targetDefinition: { url: 'urn:test' }, tokens: { a: '1', b: '2' } },
    }});
    render(<ProjectProvider project={project}><SelectionProvider><ThemeOverview /></SelectionProvider></ProjectProvider>);
    expect(screen.getByText(/2 tokens/i)).toBeInTheDocument();
  });
});
