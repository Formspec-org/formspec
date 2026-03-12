import { render, screen, fireEvent } from '@testing-library/react';
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
  it('shows definition metadata', () => {
    renderSettings();
    expect(screen.getByText(/1\.0/)).toBeInTheDocument();
    expect(screen.getByText('urn:formspec:test')).toBeInTheDocument();
    expect(screen.getByText('1.2.0')).toBeInTheDocument();
  });

  it('shows status', () => {
    renderSettings();
    expect(screen.getByText(/draft/i)).toBeInTheDocument();
  });

  it('shows presentation defaults', () => {
    renderSettings();
    expect(screen.getByText(/single/i)).toBeInTheDocument();
    expect(screen.getByText(/top/i)).toBeInTheDocument();
    expect(screen.getByText(/comfortable/i)).toBeInTheDocument();
    expect(screen.getByText('USD')).toBeInTheDocument();
  });

  it('shows form title', () => {
    renderSettings();
    expect(screen.getByText('My Test Form')).toBeInTheDocument();
  });

  it('lets the title switch into an editable field when clicked', () => {
    renderSettings();

    fireEvent.click(screen.getByText('My Test Form'));

    expect(screen.getByDisplayValue('My Test Form')).toBeInTheDocument();
  });

  it('preserves the full title in a tooltip when the title is long', () => {
    const longTitle = 'This is a very long form title that should still be available in a tooltip when the sidebar truncates it';
    renderSettings({
      ...settingsDef,
      title: longTitle,
    });

    expect(screen.getByText(longTitle)).toHaveAttribute('title', longTitle);
  });
});
