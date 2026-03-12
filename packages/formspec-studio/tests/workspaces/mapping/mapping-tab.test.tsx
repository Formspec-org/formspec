import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { MappingTab } from '../../../src/workspaces/mapping/MappingTab';

function renderTab() {
  const project = createProject({
    seed: {
      definition: { $formspec: '1.0', url: 'urn:mapping-tab-test', version: '1.0.0', items: [] } as any,
      mapping: { direction: 'outbound', rules: [] },
    },
  });

  return render(
    <ProjectProvider project={project}>
      <MappingTab />
    </ProjectProvider>
  );
}

describe('MappingTab', () => {
  it('keeps the Configuration section collapsed after switching away and back', () => {
    renderTab();

    expect(screen.getByText('Direction')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /configuration/i }));
    expect(screen.queryByText('Direction')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /rules/i }));
    fireEvent.click(screen.getByRole('button', { name: /config/i }));

    expect(screen.queryByText('Direction')).not.toBeInTheDocument();
  });
});
