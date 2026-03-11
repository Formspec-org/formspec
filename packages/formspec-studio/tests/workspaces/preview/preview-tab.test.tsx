import { render, screen, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { PreviewTab } from '../../../src/workspaces/preview/PreviewTab';

const previewDef = {
  $formspec: '1.0', url: 'urn:test', version: '1.0.0',
  items: [
    { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
    { key: 'email', type: 'field', dataType: 'string', label: 'Email' },
    { key: 'bio', type: 'display', label: 'Biography' },
  ],
};

function renderPreview(def?: any) {
  const project = createProject({ seed: { definition: def || previewDef } });
  return render(
    <ProjectProvider project={project}>
      <PreviewTab />
    </ProjectProvider>
  );
}

describe('PreviewTab', () => {
  it('renders viewport switcher', () => {
    renderPreview();
    expect(screen.getByText(/desktop/i)).toBeInTheDocument();
    expect(screen.getByText(/tablet/i)).toBeInTheDocument();
    expect(screen.getByText(/mobile/i)).toBeInTheDocument();
  });

  it('renders form fields from definition', () => {
    renderPreview();
    expect(screen.getByText('Full Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('renders display items', () => {
    renderPreview();
    expect(screen.getByText('Biography')).toBeInTheDocument();
  });
});
