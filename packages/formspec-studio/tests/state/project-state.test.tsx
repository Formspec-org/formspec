import { render, screen, act, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { createProject, type Project } from 'formspec-studio-core';

afterEach(cleanup);
import { ProjectProvider } from '../../src/state/ProjectContext';
import { useProjectState } from '../../src/state/useProjectState';
import { useDefinition } from '../../src/state/useDefinition';

function StateDisplay() {
  const state = useProjectState();
  return <div data-testid="version">{state.definition.version}</div>;
}

function DefinitionDisplay() {
  const definition = useDefinition();
  return <div data-testid="item-count">{definition.items.length}</div>;
}

describe('useProjectState', () => {
  it('returns current project state', () => {
    const project = createProject();
    render(
      <ProjectProvider project={project}>
        <StateDisplay />
      </ProjectProvider>
    );
    expect(screen.getByTestId('version')).toHaveTextContent('0.1.0');
  });

  it('re-renders when state changes via dispatch', () => {
    const project = createProject();
    render(
      <ProjectProvider project={project}>
        <DefinitionDisplay />
      </ProjectProvider>
    );
    expect(screen.getByTestId('item-count')).toHaveTextContent('0');

    act(() => {
      project.dispatch({
        type: 'definition.addItem',
        payload: { item: { key: 'name', type: 'field', dataType: 'string' } }
      });
    });

    expect(screen.getByTestId('item-count')).toHaveTextContent('1');
  });
});

describe('useDefinition', () => {
  it('returns definition from state', () => {
    const project = createProject();
    render(
      <ProjectProvider project={project}>
        <DefinitionDisplay />
      </ProjectProvider>
    );
    expect(screen.getByTestId('item-count')).toHaveTextContent('0');
  });
});
