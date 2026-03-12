import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { MappingPreview } from '../../../src/workspaces/mapping/MappingPreview';
import { MappingConfig } from '../../../src/workspaces/mapping/MappingConfig';

function renderPreview() {
  const project = createProject({ seed: {
    definition: { $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [] } as any,
    mapping: { direction: 'outbound', rules: [] },
  }});
  return render(<ProjectProvider project={project}><MappingPreview /></ProjectProvider>);
}

function renderConfig(direction?: string) {
  const project = createProject({ seed: {
    definition: { $formspec: '1.0', url: 'urn:mapping-config', version: '1.0.0', items: [] } as any,
    mapping: { direction: direction ?? 'unset', rules: [] },
  }});
  return render(<ProjectProvider project={project}><MappingConfig /></ProjectProvider>);
}

describe('MappingPreview', () => {
  it('shows direction toggle', () => {
    renderPreview();
    expect(screen.getByText(/outbound/i)).toBeInTheDocument();
  });

  it('renders direction as an interactive control', () => {
    renderPreview();
    expect(screen.getByRole('button', { name: /direction.*outbound|outbound.*direction/i })).toBeInTheDocument();
  });

  it('shows input and output panels', () => {
    renderPreview();
    expect(screen.getByText(/input/i)).toBeInTheDocument();
    expect(screen.getByText(/output/i)).toBeInTheDocument();
  });
});

// Bug #31: Pressing Escape does not close the direction picker in the mapping config
describe('MappingConfig direction picker', () => {
  it('opens a picker when the direction value is clicked', async () => {
    renderConfig('unset');

    // The direction pill/value should be clickable and open a picker
    const directionValue = screen.getByText(/unset/i);
    await act(async () => {
      fireEvent.click(directionValue);
    });

    // A picker / dropdown with direction options should now be visible
    expect(
      screen.getByRole('listbox') ||
      screen.getByRole('menu') ||
      screen.getByRole('dialog') ||
      screen.queryByTestId('direction-picker')
    ).toBeTruthy();
  });

  it('closes the direction picker when Escape is pressed', async () => {
    renderConfig('unset');

    // Click the direction value to open the picker
    const directionValue = screen.getByText(/unset/i);
    await act(async () => {
      fireEvent.click(directionValue);
    });

    // Verify picker is open by checking for an option like "inbound"
    expect(screen.getByText(/inbound/i)).toBeInTheDocument();

    // Press Escape — the picker should close
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });

    // After Escape, the picker options should no longer be visible
    expect(screen.queryByText(/inbound/i)).not.toBeInTheDocument();
  });
});
