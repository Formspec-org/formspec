import { render, screen, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from '@formspec-org/studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { TestResponse } from '../../../src/workspaces/editor/TestResponse';

function renderTestResponse(def?: any) {
  const project = createProject({
    seed: {
      definition: def || {
        $formspec: '1.0', url: 'urn:test', version: '1.0.0',
        items: [
          { key: 'name', type: 'field', dataType: 'string', label: 'Name', initialValue: 'Alice' },
        ],
      },
    },
  });
  return render(
    <ProjectProvider project={project}>
      <TestResponse />
    </ProjectProvider>
  );
}

describe('TestResponse', () => {
  it('renders run button', () => {
    renderTestResponse();
    expect(screen.getByRole('button', { name: /run simulation/i })).toBeInTheDocument();
  });

  it('click button shows JSON with "data" key', async () => {
    renderTestResponse();
    await act(async () => {
      screen.getByRole('button', { name: /run simulation/i }).click();
    });
    expect(screen.getByText(/"data"/i)).toBeInTheDocument();
  });

  it('shows initial values in output', async () => {
    renderTestResponse();
    await act(async () => {
      screen.getByRole('button', { name: /run simulation/i }).click();
    });
    expect(screen.getByText(/"name": "Alice"/i)).toBeInTheDocument();
  });
});
