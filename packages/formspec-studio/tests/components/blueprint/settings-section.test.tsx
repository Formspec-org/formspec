import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectionProvider } from '../../../src/state/useSelection';
import { SettingsSection } from '../../../src/components/blueprint/SettingsSection';

const settingsDef = {
  $formspec: '1.0',
  url: 'urn:formspec:test',
  version: '1.2.0',
  status: 'draft',
  name: 'Test Form',
  title: 'My Test Form',
  description: 'A test form',
  items: [],
  formPresentation: { pageMode: 'single', labelPosition: 'top', density: 'comfortable', defaultCurrency: 'USD' },
};

function renderSettings(def?: any) {
  const project = createProject({ seed: { definition: def || settingsDef } });
  return render(
    <ProjectProvider project={project}>
      <SelectionProvider>
        <SettingsSection />
      </SelectionProvider>
    </ProjectProvider>
  );
}

describe('SettingsSection', () => {
  it('shows key summary fields', () => {
    renderSettings();
    expect(screen.getByText('My Test Form')).toBeInTheDocument();
    expect(screen.getByText('1.2.0')).toBeInTheDocument();
    expect(screen.getByText(/draft/i)).toBeInTheDocument();
  });

  it('shows page mode when present', () => {
    renderSettings();
    expect(screen.getByText(/single/i)).toBeInTheDocument();
  });

  it('shows dash for missing title', () => {
    const minDef = { ...settingsDef, title: undefined };
    renderSettings(minDef);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
