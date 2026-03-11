import { render, screen, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../src/state/ProjectContext';
import { SelectionProvider, useSelection } from '../../src/state/useSelection';

function SelectionDisplay() {
  const { selectedKey, selectedType, select, deselect } = useSelection();
  return (
    <div>
      <span data-testid="key">{selectedKey ?? 'none'}</span>
      <span data-testid="type">{selectedType ?? 'none'}</span>
      <button onClick={() => select('myField', 'field')}>Select</button>
      <button onClick={() => deselect()}>Deselect</button>
      <button onClick={() => select('myBind', 'bind')}>SelectBind</button>
    </div>
  );
}

describe('useSelection', () => {
  it('starts with nothing selected', () => {
    const project = createProject();
    render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <SelectionDisplay />
        </SelectionProvider>
      </ProjectProvider>
    );
    expect(screen.getByTestId('key')).toHaveTextContent('none');
    expect(screen.getByTestId('type')).toHaveTextContent('none');
  });

  it('select updates selected key and type', async () => {
    const project = createProject();
    render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <SelectionDisplay />
        </SelectionProvider>
      </ProjectProvider>
    );

    await act(async () => {
      screen.getByText('Select').click();
    });

    expect(screen.getByTestId('key')).toHaveTextContent('myField');
    expect(screen.getByTestId('type')).toHaveTextContent('field');
  });

  it('deselect clears selection', async () => {
    const project = createProject();
    render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <SelectionDisplay />
        </SelectionProvider>
      </ProjectProvider>
    );

    await act(async () => {
      screen.getByText('Select').click();
    });
    expect(screen.getByTestId('key')).toHaveTextContent('myField');

    await act(async () => {
      screen.getByText('Deselect').click();
    });
    expect(screen.getByTestId('key')).toHaveTextContent('none');
  });

  it('persists selection across re-renders', async () => {
    const project = createProject();
    const { rerender } = render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <SelectionDisplay />
        </SelectionProvider>
      </ProjectProvider>
    );

    await act(async () => {
      screen.getByText('Select').click();
    });

    // Re-render with same providers
    rerender(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <SelectionDisplay />
        </SelectionProvider>
      </ProjectProvider>
    );

    expect(screen.getByTestId('key')).toHaveTextContent('myField');
    expect(screen.getByTestId('type')).toHaveTextContent('field');
  });
});
