import { render, screen, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from '@formspec-org/studio-core';
import { ProjectProvider } from '../../src/state/ProjectContext';
import { SelectionProvider, useSelection, selectionPrimaryKeyRetainedAfterDefinitionChange } from '../../src/state/useSelection';

function SelectionDisplay() {
  const { primaryKey, primaryType, revealedPath, select, deselect, reveal, consumeRevealedPath } = useSelection();
  return (
    <div>
      <span data-testid="key">{primaryKey ?? 'none'}</span>
      <span data-testid="type">{primaryType ?? 'none'}</span>
      <span data-testid="revealed">{revealedPath ?? 'none'}</span>
      <button onClick={() => select('myField', 'field')}>Select</button>
      <button onClick={() => deselect()}>Deselect</button>
      <button onClick={() => select('myBind', 'bind')}>SelectBind</button>
      <button onClick={() => reveal('items.name')}>Reveal</button>
      <button onClick={() => consumeRevealedPath()}>ConsumeReveal</button>
    </div>
  );
}

function SelectionCleanupDisplay({ keyToSelect }: { keyToSelect: string }) {
  const { primaryKey, select } = useSelection();
  return (
    <div>
      <span data-testid="cleanup-key">{primaryKey ?? 'none'}</span>
      <button onClick={() => select(keyToSelect, 'field')}>SelectExisting</button>
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

  it('tracks reveal intent and clears it when consumed', async () => {
    const project = createProject();
    render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <SelectionDisplay />
        </SelectionProvider>
      </ProjectProvider>
    );

    expect(screen.getByTestId('revealed')).toHaveTextContent('none');

    await act(async () => {
      screen.getByText('Reveal').click();
    });
    expect(screen.getByTestId('revealed')).toHaveTextContent('items.name');

    await act(async () => {
      screen.getByText('ConsumeReveal').click();
    });
    expect(screen.getByTestId('revealed')).toHaveTextContent('none');
  });

  it('clears selection when selected field path no longer exists', async () => {
    const project = createProject({
      seed: {
        definition: {
          $formspec: '1.0',
          url: 'urn:test',
          version: '1.0.0',
          title: 'Selection cleanup',
          items: [{ key: 'name', type: 'field', label: 'Name', dataType: 'string' }],
        },
      },
    });
    const existingPath = project.fieldPaths()[0]!;

    render(
      <ProjectProvider project={project}>
        <SelectionProvider project={project}>
          <SelectionCleanupDisplay keyToSelect={existingPath} />
        </SelectionProvider>
      </ProjectProvider>
    );

    await act(async () => {
      screen.getByText('SelectExisting').click();
    });
    expect(screen.getByTestId('cleanup-key')).toHaveTextContent(existingPath);

    await act(async () => {
      project.loadBundle({
        definition: {
          ...project.definition,
          items: [],
        },
      });
    });
    expect(screen.getByTestId('cleanup-key')).toHaveTextContent('none');
  });
});

describe('selectionPrimaryKeyRetainedAfterDefinitionChange', () => {
  it('retains layout synthetic keys and valid field paths only', () => {
    const paths = new Set(['name', 'age']);
    expect(selectionPrimaryKeyRetainedAfterDefinitionChange('name', paths)).toBe(true);
    expect(selectionPrimaryKeyRetainedAfterDefinitionChange('__node:layout-1', paths)).toBe(true);
    expect(selectionPrimaryKeyRetainedAfterDefinitionChange('deletedField', paths)).toBe(false);
  });
});
