import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectionProvider } from '../../../src/state/useSelection';
import { ScreenerSection } from '../../../src/components/blueprint/ScreenerSection';

const screenerDef = {
  $formspec: '1.0', url: 'urn:test', version: '1.0.0',
  items: [
    { key: 'age', type: 'field', dataType: 'integer' },
    { key: 'income', type: 'field', dataType: 'money' },
  ],
  screener: {
    enabled: true,
    items: [
      { key: 'age', type: 'field', dataType: 'integer' },
    ],
    routes: [
      { condition: '$age >= 18', destination: 'main' },
      { condition: 'true', destination: 'ineligible' },
    ],
  },
};

function renderScreener(def?: any) {
  const project = createProject({ seed: { definition: def || screenerDef } });
  return render(
    <ProjectProvider project={project}>
      <SelectionProvider>
        <ScreenerSection />
      </SelectionProvider>
    </ProjectProvider>
  );
}

describe('ScreenerSection', () => {
  it('shows enabled state', () => {
    renderScreener();
    expect(screen.getByText(/enabled/i)).toBeInTheDocument();
  });

  it('lists screening fields', () => {
    renderScreener();
    expect(screen.getByText('age')).toBeInTheDocument();
  });

  it('shows routing rules', () => {
    renderScreener();
    expect(screen.getByText(/\$age >= 18/)).toBeInTheDocument();
    expect(screen.getByText('main')).toBeInTheDocument();
  });

  it('shows default fallback route', () => {
    renderScreener();
    // Route with condition 'true' is the default fallback
    expect(screen.getByText(/default/i)).toBeInTheDocument();
  });

  it('shows disabled state when no screener', () => {
    renderScreener({ $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [] });
    expect(screen.getByText(/disabled/i)).toBeInTheDocument();
  });

  it('renders the disabled screener badge as an interactive control to start setup', () => {
    renderScreener({ $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [] });

    expect(screen.getByRole('button', { name: /disabled/i })).toBeInTheDocument();
  });
});
