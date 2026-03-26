import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { MappingTab } from '../../../src/workspaces/mapping/MappingTab';

function renderTab() {
  const project = createProject({
    seed: {
      definition: { $formspec: '1.0', url: 'urn:mapping-tab-test', version: '1.0.0', items: [] } as any,
      mappings: { default: { direction: 'outbound', rules: [] } as any },
    },
  });

  return render(
    <ProjectProvider project={project}>
      <MappingTab />
    </ProjectProvider>
  );
}

describe('MappingTab', () => {
  it('highlights the active tab in uncontrolled mode', () => {
    renderTab();

    // Default is 'all'
    expect(screen.getByTestId('mapping-filter-tab-all').className).toContain('bg-accent');

    fireEvent.click(screen.getByTestId('mapping-filter-tab-config'));
    expect(screen.getByTestId('mapping-filter-tab-config').className).toContain('bg-accent');

    fireEvent.click(screen.getByTestId('mapping-filter-tab-rules'));
    expect(screen.getByTestId('mapping-filter-tab-rules').className).toContain('bg-accent');
  });

  it('keeps the Configuration section collapsed after switching away and back', () => {
    renderTab();

    // Switch to blueprint tab
    fireEvent.click(screen.getByTestId('mapping-filter-tab-config'));

    expect(screen.getByText('Direction')).toBeInTheDocument();

    // Click the toggle button in MappingConfig (Configuration header)
    fireEvent.click(screen.getByRole('button', { name: /configuration/i }));
    expect(screen.queryByText('Direction')).not.toBeInTheDocument(); // internal collapse unmounts content

    // Switch tabs away and back
    fireEvent.click(screen.getByTestId('mapping-filter-tab-rules'));
    
    // Check that the blueprint pillar has the 'hidden' class
    const blueprintPillar = screen.getByTestId('mapping-pillar-config');
    expect(blueprintPillar.className).toContain('hidden');

    fireEvent.click(screen.getByTestId('mapping-filter-tab-config'));
    expect(blueprintPillar.className).not.toContain('hidden');

    // Should still be collapsed because local state in MappingConfig persisted
    expect(screen.queryByText('Direction')).not.toBeInTheDocument();
  });
});
