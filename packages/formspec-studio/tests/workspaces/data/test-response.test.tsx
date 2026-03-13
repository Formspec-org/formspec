import { render, screen, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { TestResponse } from '../../../src/workspaces/data/TestResponse';

describe('TestResponse', () => {
  it('runs the response generator and shows a JSON preview', async () => {
    const project = createProject({
      seed: {
        definition: {
          $formspec: '1.0',
          url: 'urn:test-response',
          version: '1.0.0',
          items: [
            {
              key: 'name',
              type: 'field',
              dataType: 'string',
              label: 'Name',
              initialValue: 'Alice',
            },
          ],
        } as any,
      },
    });

    render(
      <ProjectProvider project={project}>
        <TestResponse />
      </ProjectProvider>
    );

    await act(async () => {
      screen.getByRole('button', { name: /run test response/i }).click();
    });

    expect(screen.getByText(/"data"/i)).toBeInTheDocument();
    expect(screen.getByText(/"name": "Alice"/i)).toBeInTheDocument();
  });
});
