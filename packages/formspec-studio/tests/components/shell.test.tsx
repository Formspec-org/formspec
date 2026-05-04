import { render, screen, act, fireEvent, within, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import JSZip from 'jszip';
import { createProject } from '@formspec-org/studio-core';
import type { FormDefinition } from '@formspec-org/types';
import { ProjectProvider } from '../../src/state/ProjectContext';
import { SelectionProvider } from '../../src/state/useSelection';
import { ModeProvider } from '../../src/studio-app/ModeProvider';
import { ShellProviders } from '../../src/providers/ShellProviders';
import { UnifiedStudio } from '../../src/studio-app/UnifiedStudio';
import { STUDIO_EVENTS } from '../../src/studio-events';

const seededDefinition = {
  $formspec: '1.0' as const,
  url: 'urn:test-shell',
  version: '1.0.0',
  title: 'Shell Test',
  items: [
    { key: 'name', type: 'field' as const, dataType: 'string' as const, label: 'Full Name' },
  ],
};

function renderStudio(definition?: FormDefinition, width = 1440, screener?: unknown) {
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
          <ModeProvider defaultMode="edit">
            <ShellProviders>
              <UnifiedStudio />
            </ShellProviders>
          </ModeProvider>
        </SelectionProvider>
      </ProjectProvider>
    ),
    project,
  };
}

if (typeof customElements !== 'undefined' && !customElements.get('formspec-render')) {
  class MockFormspecRender extends HTMLElement {
    connectedCallback() {
      const path = this.getAttribute('data-form-path') || 'name';
      this.innerHTML = `
        <div data-name="${path}" data-testid="field-${path}">
          Field: ${path}
          <button aria-label="Select Full Name">Select</button>
        </div>`;
    }
  }
  customElements.define('formspec-render', MockFormspecRender);
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('Shell', () => {
  it('renders without crashing', () => {
    renderStudio();
    expect(screen.getByTestId('shell')).toBeInTheDocument();
  });

  it('renders header with app title', () => {
    renderStudio();
    expect(screen.getByRole('button', { name: /the stack home/i })).toBeInTheDocument();
  });

  it('shows mode tabs (Chat, Edit, Design, Preview)', () => {
    renderStudio();
    expect(screen.getByTestId('mode-toggle-chat')).toBeInTheDocument();
    expect(screen.getByTestId('mode-toggle-edit')).toBeInTheDocument();
    expect(screen.getByTestId('mode-toggle-design')).toBeInTheDocument();
    expect(screen.getByTestId('mode-toggle-preview')).toBeInTheDocument();
  });

  it('defaults to Editor workspace in edit mode', () => {
    renderStudio();
    expect(screen.getByTestId('workspace-Editor')).toBeInTheDocument();
  });

  it('switches to Evidence workspace when navigate-workspace targets Evidence', async () => {
    renderStudio();
    await act(async () => {
      window.dispatchEvent(new CustomEvent(STUDIO_EVENTS.NAVIGATE_WORKSPACE, {
        detail: { tab: 'Evidence' },
      }));
    });
    expect(screen.getByTestId('workspace-Evidence')).toBeInTheDocument();
  });

  it('switches to Mapping workspace when navigate-workspace targets Mapping', async () => {
    renderStudio();
    await act(async () => {
      window.dispatchEvent(new CustomEvent(STUDIO_EVENTS.NAVIGATE_WORKSPACE, {
        detail: { tab: 'Mapping' },
      }));
    });
    expect(screen.getByTestId('workspace-Mapping')).toBeInTheDocument();
  });

  it('switches to Evidence workspace when the Evidence header tab is clicked', async () => {
    renderStudio();
    await act(async () => {
      screen.getByTestId('tab-Evidence').click();
    });
    expect(screen.getByTestId('workspace-Evidence')).toBeInTheDocument();
  });

  it('switches to Mapping workspace when the Mapping header tab is clicked', async () => {
    renderStudio();
    await act(async () => {
      screen.getByTestId('tab-Mapping').click();
    });
    expect(screen.getByTestId('workspace-Mapping')).toBeInTheDocument();
  });

  it('clicking a mode tab switches workspace', async () => {
    renderStudio();
    await act(async () => {
      screen.getByTestId('mode-toggle-design').click();
    });
    expect(screen.getByTestId('workspace-Design')).toBeInTheDocument();
  });

  it('renders the app logo as a clickable home action', () => {
    renderStudio();
    expect(screen.getByRole('button', { name: /the stack/i })).toBeInTheDocument();
  });

  it('resets the project to a blank form when New Form is clicked', async () => {
    const { project } = renderStudio(seededDefinition);

    expect(screen.getByTestId('field-name')).toBeInTheDocument();

    await act(async () => {
      screen.getByRole('button', { name: /account menu/i }).click();
    });
    await act(async () => {
      screen.getByRole('menuitem', { name: /new form/i }).click();
    });

    expect(screen.queryByTestId('field-name')).toBeNull();
    expect(project.definition.items).toHaveLength(0);
  });

  it('exports the current project as a downloadable ZIP bundle', async () => {
    const { project } = renderStudio(seededDefinition);
    const createObjectURL = vi.fn(() => 'blob:formspec-test');
    const revokeObjectURL = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;

    try {
      await act(async () => {
        screen.getByRole('button', { name: /account menu/i }).click();
      });
      await act(async () => {
        screen.getByRole('menuitem', { name: /^export$/i }).click();
      });

      await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1), { timeout: 2000 });

      const blob = (createObjectURL.mock.calls as unknown[][])[0][0] as Blob;
      const zip = await JSZip.loadAsync(blob);

      const defFile = await zip.file('definition.json')?.async('string');
      const compFile = await zip.file('component.json')?.async('string');
      const themeFile = await zip.file('theme.json')?.async('string');

      expect(JSON.parse(defFile!)).toEqual(project.exportBundle().definition);
      expect(JSON.parse(compFile!)).toEqual(project.exportBundle().component);
      expect(JSON.parse(themeFile!)).toEqual(project.exportBundle().theme);

      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:formspec-test');
    } finally {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      clickSpy.mockRestore();
    }
  });

  it('always shows Form Health in the right rail regardless of selection', async () => {
    renderStudio(seededDefinition, 1440);

    expect(screen.getByTestId('blueprint-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('properties-panel')).toBeInTheDocument();
    expect(screen.getByText('Form Health')).toBeInTheDocument();

    await act(async () => {
      screen.getByTestId('field-name').click();
    });
    expect(screen.getByText('Form Health')).toBeInTheDocument();
  });

  it('hides the Component Tree blueprint section while Editor or Design is active', async () => {
    renderStudio(seededDefinition, 1440);

    expect(screen.queryByTestId('blueprint-section-Component Tree')).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByTestId('tab-Design'));
    });
    expect(screen.queryByTestId('blueprint-section-Component Tree')).toBeNull();
  });

  it('hides Theme while Editor is active, keeps Mappings', () => {
    renderStudio(seededDefinition, 1440);

    expect(screen.queryByTestId('blueprint-section-Theme')).toBeNull();
    expect(screen.getByTestId('blueprint-section-Mappings')).toBeInTheDocument();
    expect(screen.getByTestId('blueprint-section-Screener')).toBeInTheDocument();
  });

  it('renders Build/Manage toggle in Editor workspace', () => {
    renderStudio();
    expect(screen.getByRole('radiogroup', { name: /editor view/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Build' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Manage' })).toBeInTheDocument();
  });

  it('Design workspace Blueprint shows theme authoring sections', async () => {
    renderStudio(seededDefinition, 1440);
    await act(async () => { fireEvent.click(screen.getByTestId('tab-Design')); });
    expect(screen.getByTestId('blueprint-section-Colors')).toBeInTheDocument();
    expect(screen.getByTestId('blueprint-section-Typography')).toBeInTheDocument();
  });

  it('Design workspace shows a live preview in the right rail', async () => {
    renderStudio(seededDefinition, 1440);
    await act(async () => { fireEvent.click(screen.getByTestId('tab-Design')); });
    expect(screen.getByTestId('layout-preview-panel')).toBeInTheDocument();
    expect(within(screen.getByTestId('layout-preview-panel')).getByTestId('layout-preview-header')).toBeInTheDocument();
  });

  it('preserves Mapping tab state when navigating away and returning', async () => {
    renderStudio();

    await act(async () => {
      window.dispatchEvent(new CustomEvent(STUDIO_EVENTS.NAVIGATE_WORKSPACE, {
        detail: { tab: 'Mapping' },
      }));
    });

    const mappingWorkspace = screen.getByTestId('workspace-Mapping');
    await act(async () => {
      within(mappingWorkspace).getByRole('button', { name: /configuration/i }).click();
      within(mappingWorkspace).getByTestId('mapping-filter-tab-preview').click();
    });
    expect(within(mappingWorkspace).getByTestId('preview-source-header')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('tab-Design'));
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent(STUDIO_EVENTS.NAVIGATE_WORKSPACE, {
        detail: { tab: 'Mapping' },
      }));
    });

    const restoredMappingWorkspace = screen.getByTestId('workspace-Mapping');
    expect(within(restoredMappingWorkspace).getByTestId('preview-source-header')).toBeInTheDocument();

    await act(async () => {
      within(restoredMappingWorkspace).getByTestId('mapping-filter-tab-preview').click();
    });

    expect(within(screen.getByTestId('workspace-Mapping')).queryByText('Direction')).not.toBeInTheDocument();
  });

  it('preserves Preview mode and viewport when navigating away and returning', async () => {
    renderStudio(seededDefinition, 768);
    fireEvent(window, new Event('resize'));

    await act(async () => {
      screen.getByTestId('tab-Preview').click();
    });

    const previewWorkspace = screen.getByTestId('workspace-Preview');
    await act(async () => {
      within(previewWorkspace).getByRole('button', { name: /mobile/i }).click();
    });
    await act(async () => {
      within(previewWorkspace).getByTestId('preview-mode-json').click();
    });

    await act(async () => {
      screen.getByTestId('tab-Design').click();
    });

    await act(async () => {
      screen.getByTestId('tab-Preview').click();
    });

    const restoredWorkspace = screen.getByTestId('workspace-Preview');
    expect(within(restoredWorkspace).getByTestId('preview-mode-json').className).toMatch(/bg-accent/);

    await act(async () => {
      within(restoredWorkspace).getByTestId('preview-mode-form').click();
    });

    expect(within(restoredWorkspace).getByRole('button', { name: /mobile/i }).className).toMatch(/bg-accent|text-white/);
  });

  it('uses a minimum font size of 11px for blueprint count badges', () => {
    renderStudio(seededDefinition);

    const blueprint = screen.getByTestId('blueprint');
    const countBadges = blueprint.querySelectorAll('span');

    const visibleBadges = Array.from(countBadges).filter(
      (span) => span.textContent !== '' && /^\d+$/.test((span.textContent ?? '').trim())
    );
    expect(visibleBadges.length).toBeGreaterThan(0);

    for (const badge of visibleBadges) {
      expect(badge.className).not.toMatch(/text-\[9px\]/);
      expect(badge.className).not.toMatch(/text-\[10px\]/);
    }
  });

  it('uses a minimum font size of 11px for status bar text', () => {
    renderStudio(seededDefinition);

    const statusBar = screen.getByTestId('status-bar');
    expect(statusBar.className).not.toMatch(/text-\[9px\]/);
    expect(statusBar.className).not.toMatch(/text-\[10px\]/);
  });

  it('shows Form Health panel in both Build and Manage views', async () => {
    renderStudio(seededDefinition, 1440);

    await act(async () => {
      screen.getByTestId('field-name').click();
    });
    expect(screen.getByText('Form Health')).toBeInTheDocument();

    await act(async () => {
      screen.getByRole('radio', { name: 'Manage' }).click();
    });
    expect(screen.getByText('Form Health')).toBeInTheDocument();
  });

  it('responds to formspec:navigate-workspace event with view parameter', async () => {
    renderStudio(seededDefinition, 1440);

    expect(screen.getByRole('radio', { name: 'Build' })).toHaveAttribute('aria-checked', 'true');

    await act(async () => {
      window.dispatchEvent(new CustomEvent(STUDIO_EVENTS.NAVIGATE_WORKSPACE, {
        detail: { tab: 'Editor', view: 'manage' },
      }));
    });

    expect(screen.getByRole('radio', { name: 'Manage' })).toHaveAttribute('aria-checked', 'true');
  });

  it('switches to chat mode when creating a new form', async () => {
    renderStudio(seededDefinition, 1440);

    await act(async () => {
      screen.getByRole('radio', { name: 'Manage' }).click();
    });
    expect(screen.getByRole('radio', { name: 'Manage' })).toHaveAttribute('aria-checked', 'true');

    await act(async () => {
      screen.getByRole('button', { name: /account menu/i }).click();
    });
    await act(async () => {
      screen.getByRole('menuitem', { name: /new form/i }).click();
    });

    expect(screen.getByTestId('mode-toggle-chat')).toHaveAttribute('aria-selected', 'true');
  });

  it('preserves activeEditorView when switching modes and returning to Editor', async () => {
    renderStudio(seededDefinition, 1440);

    await act(async () => {
      screen.getByRole('radio', { name: 'Manage' }).click();
    });
    expect(screen.getByRole('radio', { name: 'Manage' })).toHaveAttribute('aria-checked', 'true');

    await act(async () => {
      screen.getByTestId('mode-toggle-design').click();
    });

    await act(async () => {
      screen.getByTestId('mode-toggle-edit').click();
    });

    expect(screen.getByRole('radio', { name: 'Manage' })).toHaveAttribute('aria-checked', 'true');
  });

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

    renderStudio(definition, 1440, screenerDoc);

    const manageRadio = screen.getByRole('radio', { name: /Manage/i });
    const manageLabel = manageRadio.closest('label') ?? manageRadio.parentElement;
    expect(manageLabel?.textContent).toContain('6');
  });

  it('shows Screener toggle option when a screener document exists', () => {
    renderStudio(seededDefinition, 1440, {
      $formspec: '1.0',
      items: [],
      evaluation: [],
    });
    expect(screen.getByRole('radio', { name: 'Screener' })).toBeInTheDocument();
  });

  it('does not show Screener toggle option when no screener document exists', () => {
    renderStudio(seededDefinition, 1440);
    expect(screen.queryByRole('radio', { name: 'Screener' })).not.toBeInTheDocument();
  });

  it('renders ScreenerWorkspace when Screener toggle is selected', async () => {
    renderStudio(seededDefinition, 1440, {
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
    renderStudio(seededDefinition, 1440, {
      $formspec: '1.0',
      items: [{ key: 'q1', type: 'field', dataType: 'boolean', label: 'Age?' }],
      evaluation: [],
    });

    const handler = vi.fn();
    window.addEventListener(STUDIO_EVENTS.NAVIGATE_WORKSPACE, handler);

    const screenerSection = screen.getByTestId('blueprint-section-Screener');
    const linkButton = within(screenerSection).getByRole('button', { name: /open screener tab/i });
    await act(async () => {
      linkButton.click();
    });

    expect(handler).toHaveBeenCalled();
    const detail = (handler.mock.calls[0][0] as CustomEvent).detail;
    expect(detail).toEqual({ tab: 'Editor', view: 'screener' });

    window.removeEventListener(STUDIO_EVENTS.NAVIGATE_WORKSPACE, handler);
  });

  it('shows live preview in a dedicated right rail on the Design tab', async () => {
    renderStudio(seededDefinition, 1440);

    await act(async () => {
      screen.getByTestId('tab-Design').click();
    });

    expect(screen.getByTestId('layout-preview-panel')).toBeInTheDocument();
    expect(within(screen.getByTestId('layout-preview-panel')).getByTestId('layout-preview-header')).toBeInTheDocument();
    expect(screen.queryByTestId('properties-panel')).not.toBeInTheDocument();
  });
});
