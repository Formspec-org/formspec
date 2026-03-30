import { render, screen, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from '@formspec-org/studio-core';
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

  it('shows an add field button when screener is enabled', () => {
    renderScreener();
    expect(screen.getByRole('button', { name: /add.*field/i })).toBeInTheDocument();
  });

  it('shows an add route button when screener is enabled', () => {
    renderScreener();
    expect(screen.getByRole('button', { name: /add.*route/i })).toBeInTheDocument();
  });

  it('adds a screener field when add field button is clicked', async () => {
    renderScreener();

    await act(async () => {
      screen.getByRole('button', { name: /add.*field/i }).click();
    });

    // Should have 2 screening fields now (original 'age' + new one)
    const fieldLabels = screen.getAllByText(/^(age|screen_\d+)$/);
    expect(fieldLabels.length).toBeGreaterThanOrEqual(2);
  });

  it('adds a route when add route button is clicked', async () => {
    renderScreener();

    await act(async () => {
      screen.getByRole('button', { name: /add.*route/i }).click();
    });

    // Should have 3 routes now (2 original + new one)
    // The new route should have a default condition
    const routeElements = screen.getAllByText(/→/);
    expect(routeElements.length).toBeGreaterThanOrEqual(3);
  });

  it('does not show add buttons when screener is disabled', () => {
    renderScreener({ $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [] });
    expect(screen.queryByRole('button', { name: /add.*field/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add.*route/i })).not.toBeInTheDocument();
  });
});
