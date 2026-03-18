import { render, screen, act, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../src/state/ProjectContext';
import { SelectionProvider } from '../../src/state/useSelection';
import { ActivePageProvider } from '../../src/state/useActivePage';
import { Shell } from '../../src/components/Shell';

const seededDefinition = {
  $formspec: '1.0' as const,
  url: 'urn:test-shell',
  version: '1.0.0',
  title: 'Shell Test',
  items: [
    { key: 'name', type: 'field' as const, dataType: 'string' as const, label: 'Full Name' },
  ],
};

function renderShell(definition?: typeof seededDefinition, width = 1440) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
  Object.defineProperty(document.documentElement, 'clientWidth', { writable: true, configurable: true, value: width });
  const project = definition ? createProject({ seed: { definition } }) : createProject();
  return {
    ...render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <ActivePageProvider>
            <Shell />
          </ActivePageProvider>
        </SelectionProvider>
      </ProjectProvider>
    ),
    project,
  };
}

describe('Shell', () => {
  it('renders header with app title', () => {
    renderShell();
    expect(screen.getByRole('button', { name: /the stack home/i })).toBeInTheDocument();
  });

  it('shows 7 workspace tabs', () => {
    renderShell();
    for (const tab of ['Editor', 'Logic', 'Data', 'Pages', 'Theme', 'Mapping', 'Preview']) {
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

  it('resets the project to a blank form when New Form is clicked', async () => {
    const { project } = renderShell(seededDefinition);

    expect(screen.getByTestId('field-name')).toBeInTheDocument();

    // Open the account menu dropdown, then click New Form
    await act(async () => {
      screen.getByRole('button', { name: /account menu/i }).click();
    });
    await act(async () => {
      screen.getByRole('button', { name: /new form/i }).click();
    });

    expect(screen.queryByTestId('field-name')).toBeNull();
    expect(project.definition.items).toHaveLength(0);
  });

  it('exports the current definition as a downloadable JSON blob', async () => {
    const { project } = renderShell(seededDefinition);
    const createObjectURL = vi.fn(() => 'blob:formspec-test');
    const revokeObjectURL = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;

    try {
      // Open the account menu dropdown, then click Export
      await act(async () => {
        screen.getByRole('button', { name: /account menu/i }).click();
      });
      await act(async () => {
        screen.getByRole('button', { name: /^export$/i }).click();
      });

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      const blob = (createObjectURL.mock.calls as unknown[][])[0][0] as Blob;
      const json = JSON.parse(await blob.text());
      expect(json).toEqual(project.export().definition);
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:formspec-test');
    } finally {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      clickSpy.mockRestore();
    }
  });

  it('does not delete the selected field after switching away from the Editor workspace', async () => {
    renderShell(seededDefinition, 768);

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

  // DataTab uses internal section filter state (useState). When the user
  // navigates away and back, React unmounts/remounts the component, resetting
  // the filter to "All Data". This is expected — the Data workspace is now
  // self-contained (like LogicTab), so sub-tab state is local.
  it('renders DataTab workspace with section filter buttons', async () => {
    renderShell();

    await act(async () => {
      screen.getByRole('tab', { name: 'Data' }).click();
    });

    const workspace = screen.getByTestId('workspace-Data');
    // Verify the filter buttons exist
    expect(within(workspace).getByRole('button', { name: /all data/i })).toBeInTheDocument();
    expect(within(workspace).getByRole('button', { name: /sources/i })).toBeInTheDocument();
  });

  it('renders the Theme workspace with zone filter buttons', async () => {
    renderShell();

    await act(async () => {
      screen.getByRole('tab', { name: 'Theme' }).click();
    });

    const themeWorkspace = screen.getByTestId('workspace-Theme');
    expect(within(themeWorkspace).getByRole('button', { name: /all theme/i })).toBeInTheDocument();
    expect(within(themeWorkspace).getByRole('button', { name: /brand & colors/i })).toBeInTheDocument();
    expect(within(themeWorkspace).getByRole('button', { name: /field presentation/i })).toBeInTheDocument();
    expect(within(themeWorkspace).getByRole('button', { name: /^layout$/i })).toBeInTheDocument();
  });

  it('preserves Mapping tab state when navigating away and returning', async () => {
    renderShell();

    await act(async () => {
      screen.getByRole('tab', { name: 'Mapping' }).click();
    });

    const mappingWorkspace = screen.getByTestId('workspace-Mapping');
    await act(async () => {
      within(mappingWorkspace).getByRole('button', { name: /configuration/i }).click();
      within(mappingWorkspace).getByTestId('mapping-filter-tab-preview').click();
    });
    expect(within(mappingWorkspace).getByTestId('preview-source-header')).toBeInTheDocument();

    await act(async () => {
      screen.getByRole('tab', { name: 'Logic' }).click();
    });

    await act(async () => {
      screen.getByRole('tab', { name: 'Mapping' }).click();
    });

    const restoredMappingWorkspace = screen.getByTestId('workspace-Mapping');
    expect(within(restoredMappingWorkspace).getByTestId('preview-source-header')).toBeInTheDocument();

    await act(async () => {
      within(restoredMappingWorkspace).getByTestId('mapping-filter-tab-preview').click();
    });

    // Preview-only filter hides the config pillar
    expect(within(screen.getByTestId('workspace-Mapping')).queryByText('Direction')).not.toBeInTheDocument();
  });

  it('preserves Preview mode and viewport when navigating away and returning', async () => {
    renderShell(seededDefinition, 768);
    fireEvent(window, new Event('resize'));

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

    renderShell(seededDefinition, 768);
    fireEvent(window, new Event('resize'));

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
