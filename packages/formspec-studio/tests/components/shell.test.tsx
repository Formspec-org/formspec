import { render, screen, act, fireEvent, within, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import JSZip from 'jszip';
import { createProject } from '@formspec-org/studio-core';
import type { FormDefinition } from '@formspec-org/types';
import { ProjectProvider } from '../../src/state/ProjectContext';
import { SelectionProvider } from '../../src/state/useSelection';
import { ActiveGroupProvider } from '../../src/state/useActiveGroup';
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

function renderShell(definition?: FormDefinition, width = 1440, screener?: unknown) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
  Object.defineProperty(document.documentElement, 'clientWidth', { writable: true, configurable: true, value: width });
  const project = definition
    ? createProject({
        seed: {
          definition,
          ...(screener !== undefined ? { screener: screener as any } : {}),
        },
      })
    : createProject();
  return {
    ...render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <ActiveGroupProvider>
            <Shell />
          </ActiveGroupProvider>
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

  it('shows 5 workspace tabs', () => {
    renderShell();
    for (const tab of ['Editor', 'Layout', 'Theme', 'Mapping', 'Preview']) {
      expect(screen.getByRole('tab', { name: tab })).toBeInTheDocument();
    }
  });

  it('defaults to Editor tab', () => {
    renderShell();
    expect(screen.getByTestId('workspace-Editor')).toHaveAttribute('data-workspace', 'Editor');
  });

  it('exposes the active workspace as a tabpanel linked to the selected tab', () => {
    renderShell();
    const workspace = screen.getByTestId('workspace-Editor');

    expect(workspace).toHaveAttribute('role', 'tabpanel');
    expect(workspace).toHaveAttribute('id', 'studio-panel-editor');
    expect(workspace).toHaveAttribute('aria-labelledby', 'studio-tab-editor');
  });

  it('clicking a tab switches workspace', async () => {
    renderShell();
    await act(async () => {
      screen.getByRole('tab', { name: 'Layout' }).click();
    });
    expect(screen.getByTestId('workspace-Layout')).toHaveAttribute('data-workspace', 'Layout');
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

  it('exports the current project as a downloadable ZIP bundle', async () => {
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

      // Wait for async zip generation and URL creation
      await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1), { timeout: 2000 });

      const blob = (createObjectURL.mock.calls as unknown[][])[0][0] as Blob;
      const zip = await JSZip.loadAsync(blob);
      
      const defFile = await zip.file('definition.json')?.async('string');
      const compFile = await zip.file('component.json')?.async('string');
      const themeFile = await zip.file('theme.json')?.async('string');

      expect(JSON.parse(defFile!)).toEqual(project.export().definition);
      expect(JSON.parse(compFile!)).toEqual(project.export().component);
      expect(JSON.parse(themeFile!)).toEqual(project.export().theme);

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
      screen.getByRole('tab', { name: 'Layout' }).click();
    });

    await act(async () => {
      fireEvent.keyDown(window, { key: 'Delete' });
    });

    await act(async () => {
      screen.getByRole('tab', { name: 'Editor' }).click();
    });

    expect(screen.getByTestId('field-name')).toBeInTheDocument();
  });

  it('always shows Form Health in the right rail regardless of selection', async () => {
    renderShell(seededDefinition, 1440);

    expect(screen.getByTestId('blueprint-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('editor-canvas-shell')).toBeInTheDocument();
    expect(screen.getByTestId('properties-panel')).toBeInTheDocument();
    // No field selected — shows Form Health
    expect(screen.getByText('Form Health')).toBeInTheDocument();

    // Select a field — right rail still shows Form Health (inline editing handles properties)
    await act(async () => {
      screen.getByTestId('field-name').click();
    });
    expect(screen.getByText('Form Health')).toBeInTheDocument();
  });

  it('hides the Component Tree blueprint section while Editor is active', () => {
    renderShell(seededDefinition, 1440);

    expect(screen.queryByTestId('blueprint-section-Component Tree')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Layout' }));
    expect(screen.getByTestId('blueprint-section-Component Tree')).toBeInTheDocument();
  });

  it('hides Theme and Mappings blueprint sections while Editor is active', () => {
    renderShell(seededDefinition, 1440);

    expect(screen.queryByTestId('blueprint-section-Theme')).toBeNull();
    expect(screen.queryByTestId('blueprint-section-Mappings')).toBeNull();
    // Screener is now visible in Editor
    expect(screen.getByTestId('blueprint-section-Screener')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Layout' }));
    expect(screen.getByTestId('blueprint-section-Theme')).toBeInTheDocument();
    expect(screen.getByTestId('blueprint-section-Mappings')).toBeInTheDocument();
  });

  it('uses the same row-first editor surface on compact screens without a separate properties mode', async () => {
    renderShell({
      ...seededDefinition,
      items: [
        { key: 'app', type: 'group' as const, label: 'Applicant Information', children: [
          { key: 'name', type: 'field' as const, dataType: 'string' as const, label: 'Full Legal Name' },
        ] },
      ],
    }, 390);
    fireEvent(window, new Event('resize'));

    expect(screen.queryByTestId('mobile-editor-switcher')).toBeNull();
    expect(screen.getByTestId('mobile-editor-structure')).toBeInTheDocument();
    expect(screen.queryByTestId('mobile-editor-properties')).toBeNull();
    expect(screen.getByTestId('mobile-selection-context')).toBeInTheDocument();
  });

  it('renders Build/Manage toggle in Editor workspace', () => {
    renderShell();
    expect(screen.getByRole('radiogroup', { name: /editor view/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Build' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Manage' })).toBeInTheDocument();
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
      screen.getByRole('tab', { name: 'Layout' }).click();
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
      screen.getByRole('tab', { name: 'Layout' }).click();
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
    const rightSidebar = shell.querySelector('aside[data-testid="properties-panel"]');

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

  it('renders the compact blueprint overlay as a modal dialog with a labelled close action', async () => {
    renderShell(seededDefinition, 768);
    fireEvent(window, new Event('resize'));

    await act(async () => {
      screen.getByRole('button', { name: /toggle blueprint menu/i }).click();
    });

    expect(screen.getByRole('dialog', { name: /blueprint/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /close blueprint drawer/i })).toBeInTheDocument();
  });

  it('shows the selected item label in compact editor context without a separate properties mode', async () => {
    renderShell(seededDefinition, 768);
    fireEvent(window, new Event('resize'));

    await act(async () => {
      within(screen.getByTestId('field-name')).getByRole('button', { name: 'Select Full Name' }).click();
    });

    expect(screen.getByTestId('mobile-selection-context')).toHaveTextContent('Full Name');
    expect(screen.getByTestId('mobile-selection-context')).not.toHaveTextContent('app.name');
    expect(screen.getByTestId('mobile-editor-structure')).toBeInTheDocument();
    expect(screen.queryByTestId('mobile-editor-properties')).toBeNull();
    expect(screen.queryByText('app.name')).toBeNull();
  });

  it('keeps compact editor selection context while staying on the single structure surface', async () => {
    renderShell(seededDefinition, 768);
    fireEvent(window, new Event('resize'));

    await act(async () => {
      within(screen.getByTestId('field-name')).getByRole('button', { name: 'Select Full Name' }).click();
    });

    expect(screen.getByTestId('mobile-editor-structure')).toBeInTheDocument();
    expect(screen.queryByTestId('mobile-editor-properties')).toBeNull();
    expect(screen.getByTestId('mobile-selection-context')).toHaveTextContent('Full Name');
  });

  // Right rail always shows FormHealthPanel regardless of view or selection
  it('shows Form Health panel in both Build and Manage views', async () => {
    renderShell(seededDefinition, 1440);

    // Select a field in Build view — right rail still shows Form Health
    await act(async () => {
      screen.getByTestId('field-name').click();
    });
    expect(screen.getByText('Form Health')).toBeInTheDocument();

    // Switch to Manage view — still Form Health
    await act(async () => {
      screen.getByRole('radio', { name: 'Manage' }).click();
    });
    expect(screen.getByText('Form Health')).toBeInTheDocument();
  });

  // A7: Navigate-workspace event with `view` parameter
  it('responds to formspec:navigate-workspace event with view parameter', async () => {
    renderShell(seededDefinition, 1440);

    // Initially in Build view
    expect(screen.getByRole('radio', { name: 'Build' })).toHaveAttribute('aria-checked', 'true');

    // Dispatch navigate event with view
    await act(async () => {
      window.dispatchEvent(new CustomEvent('formspec:navigate-workspace', {
        detail: { tab: 'Editor', view: 'manage' },
      }));
    });

    // Should switch to Manage view
    expect(screen.getByRole('radio', { name: 'Manage' })).toHaveAttribute('aria-checked', 'true');
  });

  // A8: Toggle resets to 'build' on New Form
  it('resets to Build view when creating a new form', async () => {
    renderShell(seededDefinition, 1440);

    // Switch to Manage view
    await act(async () => {
      screen.getByRole('radio', { name: 'Manage' }).click();
    });
    expect(screen.getByRole('radio', { name: 'Manage' })).toHaveAttribute('aria-checked', 'true');

    // Create new form
    await act(async () => {
      screen.getByRole('button', { name: /account menu/i }).click();
    });
    await act(async () => {
      screen.getByRole('button', { name: /new form/i }).click();
    });

    // Should be back in Build view
    expect(screen.getByRole('radio', { name: 'Build' })).toHaveAttribute('aria-checked', 'true');
  });

  // Task #5: activeEditorView persists across tab switches
  it('preserves activeEditorView when switching tabs and returning to Editor', async () => {
    renderShell(seededDefinition, 1440);

    // Switch to Manage view
    await act(async () => {
      screen.getByRole('radio', { name: 'Manage' }).click();
    });
    expect(screen.getByRole('radio', { name: 'Manage' })).toHaveAttribute('aria-checked', 'true');

    // Switch to Layout tab
    await act(async () => {
      screen.getByRole('tab', { name: 'Layout' }).click();
    });

    // Switch back to Editor tab
    await act(async () => {
      screen.getByRole('tab', { name: 'Editor' }).click();
    });

    // Manage view should still be active
    expect(screen.getByRole('radio', { name: 'Manage' })).toHaveAttribute('aria-checked', 'true');
  });

  // Task #9: Navigate-workspace event with section parameter
  it('responds to formspec:navigate-workspace event with section parameter', async () => {
    renderShell(seededDefinition, 1440);

    const scrollHandler = vi.fn();
    window.addEventListener('formspec:scroll-to-section', scrollHandler);

    // Dispatch navigate event with view and section
    await act(async () => {
      window.dispatchEvent(new CustomEvent('formspec:navigate-workspace', {
        detail: { tab: 'Editor', view: 'manage', section: 'shapes' },
      }));
    });

    // Should switch to Manage view
    expect(screen.getByRole('radio', { name: 'Manage' })).toHaveAttribute('aria-checked', 'true');

    // Should have dispatched a scroll-to-section event
    expect(scrollHandler).toHaveBeenCalledTimes(1);
    const scrollEvent = scrollHandler.mock.calls[0][0] as CustomEvent<{ section: string }>;
    expect(scrollEvent.detail.section).toBe('shapes');

    window.removeEventListener('formspec:scroll-to-section', scrollHandler);
  });

  it('does not dispatch scroll-to-section when section is not provided', async () => {
    renderShell(seededDefinition, 1440);

    const scrollHandler = vi.fn();
    window.addEventListener('formspec:scroll-to-section', scrollHandler);

    await act(async () => {
      window.dispatchEvent(new CustomEvent('formspec:navigate-workspace', {
        detail: { tab: 'Editor', view: 'manage' },
      }));
    });

    expect(scrollHandler).not.toHaveBeenCalled();
    window.removeEventListener('formspec:scroll-to-section', scrollHandler);
  });

  // Task #12: manageCount covers definition cross-cutting concerns (screener excluded — belongs to Screen badge)
  it('manageCount includes optionSets, instances, binds, shapes, and variables but excludes screener routes', () => {
    const definition: FormDefinition = {
      ...seededDefinition,
      binds: [
        { path: 'name', required: 'true' },
      ],
      shapes: [
        { id: 's1', target: 'name', constraint: '$name != null', message: 'Required' },
      ],
      variables: [
        { name: 'v1', expression: '1 + 1' },
      ],
      optionSets: {
        colors: { options: [{ value: 'red', label: 'Red' }] },
        sizes: { options: [{ value: 'sm', label: 'Small' }] },
      },
      instances: {
        lookup1: { data: { rows: [] } },
      },
    };

    const screenerDoc = {
      $formspecScreener: '1.0',
      url: 'urn:shell:screener',
      version: '1.0.0',
      title: 'Gate',
      items: [],
      evaluation: [
        {
          id: 'main',
          strategy: 'first-match',
          routes: [
            { condition: 'true', target: 'urn:a' },
            { condition: 'true', target: 'urn:b' },
          ],
        },
      ],
    };

    renderShell(definition, 1440, screenerDoc);

    // Total should be: 1 bind + 1 shape + 1 variable + 2 optionSets + 1 instance = 6
    // (screener routes excluded — they belong to the Screen mode badge, not Manage)
    const manageRadio = screen.getByRole('radio', { name: /Manage/i });
    const manageLabel = manageRadio.closest('label') ?? manageRadio.parentElement;
    expect(manageLabel?.textContent).toContain('6');
  });

  // Task #10: Compact/mobile Form Health layout
  it('shows a health badge button in compact Editor that opens a bottom sheet', async () => {
    renderShell(seededDefinition, 768);
    fireEvent(window, new Event('resize'));

    // The right rail Form Health panel should be hidden in compact mode
    const rightRail = screen.queryByTestId('properties-panel');
    expect(
      !rightRail ||
      rightRail.classList.contains('hidden') ||
      rightRail.getAttribute('data-responsive-hidden') === 'true'
    ).toBe(true);

    // A persistent health badge button should be visible in compact Editor
    const healthBadge = screen.getByRole('button', { name: /form health/i });
    expect(healthBadge).toBeInTheDocument();

    // Clicking it opens a bottom sheet dialog
    await act(async () => {
      healthBadge.click();
    });

    const healthSheet = screen.getByRole('dialog', { name: /form health/i });
    expect(healthSheet).toBeInTheDocument();
    expect(healthSheet.className).toMatch(/slide-in-from-bottom|bottom/);

    // The sheet contains the Form Health content
    expect(within(healthSheet).getAllByText('Form Health').length).toBeGreaterThanOrEqual(1);
    expect(within(healthSheet).getByText('Issues')).toBeInTheDocument();
  });

  it('closes the compact health sheet via its close button', async () => {
    renderShell(seededDefinition, 768);
    fireEvent(window, new Event('resize'));

    // Open the health sheet
    await act(async () => {
      screen.getByRole('button', { name: /form health/i }).click();
    });
    expect(screen.getByRole('dialog', { name: /form health/i })).toBeInTheDocument();

    // Close it
    await act(async () => {
      screen.getByRole('button', { name: /close.*health/i }).click();
    });
    expect(screen.queryByRole('dialog', { name: /form health/i })).not.toBeInTheDocument();
  });

  it('does not show health badge button on wide screens', () => {
    renderShell(seededDefinition, 1440);
    expect(screen.queryByRole('button', { name: /form health/i })).not.toBeInTheDocument();
  });

  it('shows Screener toggle option when a screener document exists', () => {
    renderShell(seededDefinition, 1440, {
      $formspec: '1.0',
      items: [],
      evaluation: [],
    });
    expect(screen.getByRole('radio', { name: 'Screener' })).toBeInTheDocument();
  });

  it('does not show Screener toggle option when no screener document exists', () => {
    renderShell(seededDefinition, 1440);
    expect(screen.queryByRole('radio', { name: 'Screener' })).not.toBeInTheDocument();
  });

  it('renders ScreenerWorkspace when Screener toggle is selected', async () => {
    renderShell(seededDefinition, 1440, {
      $formspec: '1.0',
      items: [{ key: 'q1', type: 'field', dataType: 'boolean', label: 'Over 18?' }],
      evaluation: [],
    });

    await act(async () => {
      screen.getByRole('radio', { name: 'Screener' }).click();
    });

    expect(screen.getByTestId('screener-workspace')).toBeInTheDocument();
    expect(screen.getByTestId('screener-item-surface')).toBeInTheDocument();
  });

  it('navigates to screener view when Blueprint Screener link arrow is clicked', async () => {
    renderShell(seededDefinition, 1440, {
      $formspec: '1.0',
      items: [{ key: 'q1', type: 'field', dataType: 'boolean', label: 'Age?' }],
      evaluation: [],
    });

    const handler = vi.fn();
    window.addEventListener('formspec:navigate-workspace', handler);

    // Click the Screener sidebar section link arrow button
    const screenerSection = screen.getByTestId('blueprint-section-Screener');
    const linkButton = within(screenerSection).getByRole('button', { name: /open screener tab/i });
    await act(async () => {
      linkButton.click();
    });

    expect(handler).toHaveBeenCalled();
    const detail = (handler.mock.calls[0][0] as CustomEvent).detail;
    expect(detail).toEqual({ tab: 'Editor', view: 'screener' });

    window.removeEventListener('formspec:navigate-workspace', handler);
  });

  it('excludes screener routes from manageCount (no double-counting with Screen badge)', () => {
    const definition: FormDefinition = {
      ...seededDefinition,
      binds: [
        { path: 'name', required: 'true' },
      ],
      shapes: [
        { id: 's1', target: 'name', constraint: '$name != null', message: 'Required' },
      ],
      variables: [
        { name: 'v1', expression: '1 + 1' },
      ],
      optionSets: {
        colors: { options: [{ value: 'red', label: 'Red' }] },
        sizes: { options: [{ value: 'sm', label: 'Small' }] },
      },
      instances: {
        lookup1: { data: { rows: [] } },
      },
    };

    const screenerDoc = {
      $formspecScreener: '1.0',
      url: 'urn:shell:screener',
      version: '1.0.0',
      title: 'Gate',
      items: [],
      evaluation: [
        {
          id: 'main',
          strategy: 'first-match',
          routes: [
            { condition: 'true', target: 'urn:a' },
            { condition: 'true', target: 'urn:b' },
          ],
        },
      ],
    };

    renderShell(definition, 1440, screenerDoc);

    // Total should be: 1 bind + 1 shape + 1 variable + 2 optionSets + 1 instance = 6
    // (screener routes excluded — they belong to the Screen badge, not Manage)
    const manageRadio = screen.getByRole('radio', { name: /Manage/i });
    const manageLabel = manageRadio.closest('label') ?? manageRadio.parentElement;
    expect(manageLabel?.textContent).toContain('6');
  });

  // Layout sidebar — live preview
  it('shows live preview panel (not ComponentProperties) in the Layout right sidebar', async () => {
    renderShell(seededDefinition, 1440);

    await act(async () => {
      screen.getByRole('tab', { name: 'Layout' }).click();
    });

    // The right sidebar should contain the layout preview header
    const panel = screen.getByTestId('properties-panel');
    expect(within(panel).getByTestId('layout-preview-header')).toBeInTheDocument();
  });

  it('does not show compact properties modal when on Layout tab (replaced by preview sheet)', async () => {
    renderShell(seededDefinition, 768);
    fireEvent(window, new Event('resize'));

    await act(async () => {
      screen.getByRole('tab', { name: 'Layout' }).click();
    });

    // Old compact properties modal should not be present
    expect(screen.queryByRole('dialog', { name: /properties/i })).toBeNull();
  });

  it('shows a Preview button in compact Layout mode', async () => {
    renderShell(seededDefinition, 768);
    fireEvent(window, new Event('resize'));

    await act(async () => {
      screen.getByRole('tab', { name: 'Layout' }).click();
    });

    const previewBtn = screen.getByRole('button', { name: /preview/i });
    expect(previewBtn).toBeInTheDocument();
  });

  it('opens preview bottom sheet when Preview button is clicked in compact Layout mode', async () => {
    renderShell(seededDefinition, 768);
    fireEvent(window, new Event('resize'));

    await act(async () => {
      screen.getByRole('tab', { name: 'Layout' }).click();
    });

    const previewBtn = screen.getByRole('button', { name: /preview/i });
    await act(async () => {
      previewBtn.click();
    });

    expect(screen.getByRole('dialog', { name: /live preview/i })).toBeInTheDocument();
  });
});
