import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { createProject } from '@formspec-org/studio-core';
import { ProjectProvider } from '../../src/state/ProjectContext';
import { useOptionalDefinition, useDefinition } from '../../src/state/useDefinition';
import { useOptionalDefinition as useOptionalDefinitionDirect } from '../../src/state/useDefinition';

afterEach(() => {});

function OptionalDefDisplay() {
  const def = useOptionalDefinition();
  return <div data-testid="opt-item-count">{def ? def.items.length : 'null'}</div>;
}

function NullOutsideProvider() {
  const def = useOptionalDefinitionDirect();
  return <div data-testid="opt-null">{def === null ? 'null' : 'not-null'}</div>;
}

describe('useOptionalDefinition', () => {
  it('returns null outside ProjectProvider', () => {
    render(<NullOutsideProvider />);
    expect(screen.getByTestId('opt-null')).toHaveTextContent('null');
  });

  it('returns definition inside ProjectProvider', () => {
    const project = createProject();
    render(
      <ProjectProvider project={project}>
        <OptionalDefDisplay />
      </ProjectProvider>
    );
    expect(screen.getByTestId('opt-item-count')).toHaveTextContent('0');
  });

  it('re-renders when definition changes', () => {
    const project = createProject();
    render(
      <ProjectProvider project={project}>
        <OptionalDefDisplay />
      </ProjectProvider>
    );
    expect(screen.getByTestId('opt-item-count')).toHaveTextContent('0');

    act(() => {
      project.addField('name', 'Name', 'string');
    });

    expect(screen.getByTestId('opt-item-count')).toHaveTextContent('1');
  });
});
