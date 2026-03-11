import { render, screen, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../src/state/ProjectContext';
import { useDispatch } from '../../src/state/useDispatch';
import { useProjectState } from '../../src/state/useProjectState';

function DispatchTester() {
  const dispatch = useDispatch();
  const state = useProjectState();
  return (
    <div>
      <span data-testid="count">{state.definition.items.length}</span>
      <button onClick={() => dispatch({
        type: 'definition.addItem',
        payload: { item: { key: 'test', type: 'field', dataType: 'string' } }
      })}>Add</button>
    </div>
  );
}

function StabilityTester() {
  const dispatch1 = useDispatch();
  const dispatch2 = useDispatch();
  return <div data-testid="same">{String(dispatch1 === dispatch2)}</div>;
}

describe('useDispatch', () => {
  it('returns a stable dispatch function', () => {
    const project = createProject();
    render(
      <ProjectProvider project={project}>
        <StabilityTester />
      </ProjectProvider>
    );
    expect(screen.getByTestId('same')).toHaveTextContent('true');
  });

  it('dispatching addItem updates state', async () => {
    const project = createProject();
    render(
      <ProjectProvider project={project}>
        <DispatchTester />
      </ProjectProvider>
    );
    expect(screen.getByTestId('count')).toHaveTextContent('0');

    await act(async () => {
      screen.getByText('Add').click();
    });

    expect(screen.getByTestId('count')).toHaveTextContent('1');
  });
});
