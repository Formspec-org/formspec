import { render, screen, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { PreviewTab } from '../../../src/workspaces/preview/PreviewTab';

function renderJsonView(seed?: Record<string, unknown>) {
  const project = createProject({ seed: {
    definition: {
      $formspec: '1.0',
      url: 'urn:test',
      version: '1.0.0',
      items: [{ key: 'name', type: 'field', dataType: 'string', label: 'Full Name' }],
    } as any,
    ...seed,
  } });
  render(
    <ProjectProvider project={project}>
      <PreviewTab />
    </ProjectProvider>
  );
}

describe('Preview JSON view', () => {
  it('renders a copy action for the active JSON document', async () => {
    renderJsonView();
    await act(async () => {
      screen.getByTestId('preview-mode-json').click();
    });
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
  });

  it('shows non-empty component and theme documents instead of stub placeholders', async () => {
    renderJsonView();
    await act(async () => {
      screen.getByTestId('preview-mode-json').click();
    });
    await act(async () => {
      screen.getByRole('button', { name: 'Component' }).click();
    });
    expect(screen.getByTestId('json-doc-component')).not.toHaveTextContent(/\(empty\)/i);

    await act(async () => {
      screen.getByRole('button', { name: 'Theme' }).click();
    });
    expect(screen.getByTestId('json-doc-theme')).not.toHaveTextContent(/\(empty\)/i);
  });
});
