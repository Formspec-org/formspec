import { render, screen, act, fireEvent, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../src/state/ProjectContext';
import { SelectionProvider } from '../../src/state/useSelection';
import { ActivePageProvider } from '../../src/state/useActivePage';
import { Shell } from '../../src/components/Shell';

const seededDefinition = {
  $formspec: '1.0',
  url: 'urn:test-shell',
  version: '1.0.0',
  title: 'Shell Test',
  items: [
    { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
  ],
};

function renderShell(definition?: typeof seededDefinition) {
  const project = definition ? createProject({ seed: { definition } }) : createProject();
  return render(
    <ProjectProvider project={project}>
      <SelectionProvider>
        <ActivePageProvider>
          <Shell />
        </ActivePageProvider>
      </SelectionProvider>
    </ProjectProvider>
  );
}

describe('Shell', () => {
  it('renders header with app title', () => {
    renderShell();
    expect(screen.getByText('The Stack')).toBeInTheDocument();
  });

  it('shows 6 workspace tabs', () => {
    renderShell();
    for (const tab of ['Editor', 'Logic', 'Data', 'Theme', 'Mapping', 'Preview']) {
      expect(screen.getByRole('tab', { name: tab })).toBeInTheDocument();
    }
  });

  it('defaults to Editor tab', () => {
    renderShell();
    expect(screen.getByTestId('workspace-Editor')).toHaveAttribute('data-workspace', 'Editor');
  });

  it('clicking a tab switches workspace', async () => {
    renderShell();
    await act(async () => {
      screen.getByRole('tab', { name: 'Logic' }).click();
    });
    expect(screen.getByTestId('workspace-Logic')).toHaveAttribute('data-workspace', 'Logic');
  });

  it('renders the app logo as a clickable home action', () => {
    renderShell();
    expect(screen.getByRole('button', { name: /the stack/i })).toBeInTheDocument();
  });

  it('does not delete the selected field after switching away from the Editor workspace', async () => {
    renderShell(seededDefinition);

    await act(async () => {
      screen.getByTestId('field-name').click();
    });

    await act(async () => {
      screen.getByRole('tab', { name: 'Data' }).click();
    });

    await act(async () => {
      fireEvent.keyDown(window, { key: 'Delete' });
    });

    await act(async () => {
      screen.getByRole('tab', { name: 'Editor' }).click();
    });

    expect(screen.getByTestId('field-name')).toBeInTheDocument();
  });

  // Bug #16: The active sub-tab inside the Data workspace should be remembered
  // when the user navigates away and returns. Currently DataTab keeps its
  // sub-tab selection in local component state (useState), so every time the
  // user leaves and comes back the state resets to the default "Response Schema".
  it('preserves the active Data sub-tab when navigating away and returning', async () => {
    renderShell();

    // Navigate to the Data workspace.
    await act(async () => {
      screen.getByRole('tab', { name: 'Data' }).click();
    });

    // The main workspace area contains the DataTab. Find it and click the
    // "Option Sets" sub-tab button within it (not the Blueprint sidebar button).
    const workspace = screen.getByTestId('workspace-Data');
    await act(async () => {
      within(workspace).getByRole('button', { name: /option sets/i }).click();
    });

    // Navigate away to Logic.
    await act(async () => {
      screen.getByRole('tab', { name: 'Logic' }).click();
    });

    // Return to Data.
    await act(async () => {
      screen.getByRole('tab', { name: 'Data' }).click();
    });

    // "Option Sets" sub-tab should still be the active selection.
    // The active tab button carries `border-b-2 border-accent` (active class)
    // while inactive ones do not.  We check that the "Option Sets" button has
    // the active styling, not the default "Response Schema".
    const dataWorkspace = screen.getByTestId('workspace-Data');
    const optionSetsBtn = within(dataWorkspace).getByRole('button', { name: /option sets/i });
    expect(optionSetsBtn.className).toMatch(/border-accent/);
  });

  it('preserves the active Theme sub-tab when navigating away and returning', async () => {
    renderShell();

    await act(async () => {
      screen.getByRole('tab', { name: 'Theme' }).click();
    });

    const themeWorkspace = screen.getByTestId('workspace-Theme');
    await act(async () => {
      within(themeWorkspace).getByRole('button', { name: /selectors/i }).click();
    });

    await act(async () => {
      screen.getByRole('tab', { name: 'Logic' }).click();
    });

    await act(async () => {
      screen.getByRole('tab', { name: 'Theme' }).click();
    });

    const selectorsBtn = within(screen.getByTestId('workspace-Theme')).getByRole('button', { name: /selectors/i });
    expect(selectorsBtn.className).toMatch(/border-accent/);
  });

  it('preserves Mapping tab state when navigating away and returning', async () => {
    renderShell();

    await act(async () => {
      screen.getByRole('tab', { name: 'Mapping' }).click();
    });

    const mappingWorkspace = screen.getByTestId('workspace-Mapping');
    await act(async () => {
      within(mappingWorkspace).getByRole('button', { name: /configuration/i }).click();
      within(mappingWorkspace).getByRole('button', { name: /preview/i }).click();
    });
    expect(within(mappingWorkspace).getByText(/input/i)).toBeInTheDocument();

    await act(async () => {
      screen.getByRole('tab', { name: 'Logic' }).click();
    });

    await act(async () => {
      screen.getByRole('tab', { name: 'Mapping' }).click();
    });

    const restoredMappingWorkspace = screen.getByTestId('workspace-Mapping');
    expect(within(restoredMappingWorkspace).getByText(/input/i)).toBeInTheDocument();

    await act(async () => {
      within(restoredMappingWorkspace).getByRole('button', { name: /config/i }).click();
    });

    expect(within(screen.getByTestId('workspace-Mapping')).queryByText('Direction')).not.toBeInTheDocument();
  });

  it('preserves Preview mode and viewport when navigating away and returning', async () => {
    renderShell(seededDefinition);

    await act(async () => {
      screen.getByRole('tab', { name: 'Preview' }).click();
    });

    const previewWorkspace = screen.getByTestId('workspace-Preview');
    await act(async () => {
      within(previewWorkspace).getByRole('button', { name: /mobile/i }).click();
    });
    await act(async () => {
      within(previewWorkspace).getByTestId('preview-mode-json').click();
    });

    await act(async () => {
      screen.getByRole('tab', { name: 'Logic' }).click();
    });

    await act(async () => {
      screen.getByRole('tab', { name: 'Preview' }).click();
    });

    const restoredWorkspace = screen.getByTestId('workspace-Preview');
    expect(within(restoredWorkspace).getByTestId('preview-mode-json').className).toMatch(/bg-accent/);

    await act(async () => {
      within(restoredWorkspace).getByTestId('preview-mode-form').click();
    });

    expect(within(restoredWorkspace).getByRole('button', { name: /mobile/i }).className).toMatch(/bg-accent|text-white/);
  });

  // Bug #1: Shell layout breaks at tablet width — sidebar + main overflow horizontally
  it('does not overflow horizontally at tablet width (768px)', () => {
    // Set viewport width to tablet size before rendering
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 768 });
    Object.defineProperty(document.documentElement, 'clientWidth', { writable: true, configurable: true, value: 768 });

    renderShell(seededDefinition);

    const shell = screen.getByTestId('shell');

    // The shell root must not exceed the viewport width
    // scrollWidth > clientWidth indicates horizontal overflow
    // In jsdom getBoundingClientRect returns zeros, so we check that the shell
    // does not carry a fixed-width layout wider than the viewport by checking
    // that it lacks any inline style or class that would force width > 768px.
    // The concrete failure signal: both sidebars are always visible at full
    // width (230px + 270px = 500px) without any responsive hiding mechanism.
    const leftSidebar = shell.querySelector('aside:first-of-type');
    const rightSidebar = shell.querySelector('aside[data-testid="properties"]');

    // At tablet width at least one sidebar should be hidden or collapsed to
    // prevent the total rendered width from exceeding the viewport.
    const leftHidden =
      !leftSidebar ||
      leftSidebar.getAttribute('data-responsive-hidden') === 'true' ||
      (leftSidebar as HTMLElement).style.display === 'none' ||
      leftSidebar.classList.contains('hidden');

    const rightHidden =
      !rightSidebar ||
      rightSidebar.getAttribute('data-responsive-hidden') === 'true' ||
      (rightSidebar as HTMLElement).style.display === 'none' ||
      rightSidebar.classList.contains('hidden');

    // At least one sidebar must be hidden at tablet width — if both are visible
    // the layout overflows at 768px (230 + main + 270 > 768px)
    expect(leftHidden || rightHidden).toBe(true);
  });

  // Bug #8: Navigational and diagnostic text is too small (9-10px); minimum should be 11px
  it('uses a minimum font size of 11px for blueprint count badges', () => {
    renderShell(seededDefinition);

    // Blueprint count badges are rendered with font-mono text-[9px] — below the 11px minimum.
    // The Badge spec requires all navigational / diagnostic text to be >= 11px.
    // We verify the rendered class list does NOT contain a sub-11px Tailwind font size.
    const blueprint = screen.getByTestId('blueprint');
    const countBadges = blueprint.querySelectorAll('span');

    // At least one count badge should be rendered for the seeded definition
    // (it has 1 item so the Structure section badge should show "1")
    const visibleBadges = Array.from(countBadges).filter(
      (span) => span.textContent !== '' && /^\d+$/.test((span.textContent ?? '').trim())
    );
    expect(visibleBadges.length).toBeGreaterThan(0);

    for (const badge of visibleBadges) {
      // text-[9px] and text-[10px] are the violating classes currently in production
      expect(badge.className).not.toMatch(/text-\[9px\]/);
      expect(badge.className).not.toMatch(/text-\[10px\]/);
    }
  });

  it('uses a minimum font size of 11px for status bar text', () => {
    renderShell(seededDefinition);

    const statusBar = screen.getByTestId('status-bar');

    // Status bar currently uses text-[9px] — below the 11px minimum for legible
    // diagnostic text. The class must be replaced with at least text-[11px].
    expect(statusBar.className).not.toMatch(/text-\[9px\]/);
    expect(statusBar.className).not.toMatch(/text-\[10px\]/);
  });
});
