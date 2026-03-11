import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { DefaultsEditor } from '../../../src/workspaces/theme/DefaultsEditor';

const themeDoc = {
  targetDefinition: { url: 'urn:test' },
  defaults: { labelPosition: 'top', density: 'comfortable', pageMode: 'standard' },
};

function renderDefaults() {
  const project = createProject({ seed: {
    definition: { $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [] } as any,
    theme: themeDoc
  }});
  return render(<ProjectProvider project={project}><DefaultsEditor /></ProjectProvider>);
}

describe('DefaultsEditor', () => {
  it('shows current defaults', () => {
    renderDefaults();
    expect(screen.getByText(/top/i)).toBeInTheDocument();
    expect(screen.getByText(/comfortable/i)).toBeInTheDocument();
  });

  it('shows page mode', () => {
    renderDefaults();
    expect(screen.getByText(/standard/i)).toBeInTheDocument();
  });
});
