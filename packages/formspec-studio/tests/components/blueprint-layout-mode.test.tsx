import { render, screen, fireEvent, within, act, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import type { FormDefinition } from '@formspec-org/types';
import { createProject } from '@formspec-org/studio-core';
import { ProjectProvider } from '../../src/state/ProjectContext';
import { SelectionProvider } from '../../src/state/useSelection';
import { ModeProvider } from '../../src/studio-app/ModeProvider';
import { ShellProviders } from '../../src/providers/ShellProviders';
import { UnifiedStudio } from '../../src/studio-app/UnifiedStudio';

const LAYOUT_TAB_THEME_SECTIONS = [
  'Colors',
  'Typography',
  'Field Defaults',
  'Field Rules',
  'Breakpoints',
  'All Tokens',
  'Settings',
] as const;

const seededDefinition: FormDefinition = {
  $formspec: '1.0',
  url: 'urn:blueprint-layout-test',
  version: '1.0.0',
  title: 'Blueprint Layout Test',
  items: [
    { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
  ],
};

function renderStudio(definition?: FormDefinition, width = 1440) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
  Object.defineProperty(document.documentElement, 'clientWidth', { writable: true, configurable: true, value: width });
  const project = createProject({ seed: { definition: definition ?? seededDefinition } });
  render(
    <ProjectProvider project={project}>
      <SelectionProvider>
        <ModeProvider defaultMode="edit">
          <ShellProviders>
            <UnifiedStudio />
          </ShellProviders>
        </ModeProvider>
      </SelectionProvider>
    </ProjectProvider>,
  );
  return project;
}

function goToDesignMode() {
  fireEvent.click(screen.getByTestId('tab-Design'));
}

function blueprintSidebar() {
  return screen.getByTestId('blueprint-sidebar');
}

function selectBlueprintSection(name: string) {
  const row = screen.getByTestId(`blueprint-section-${name}`);
  fireEvent.click(within(row).getByRole('button', { name }));
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('Blueprint — Layout workspace', () => {
  it('lists theme authoring sections on Layout tab (layout workspace mode)', async () => {
    renderStudio();
    await act(async () => {
      goToDesignMode();
    });

    for (const name of LAYOUT_TAB_THEME_SECTIONS) {
      expect(screen.getByTestId(`blueprint-section-${name}`)).toBeInTheDocument();
    }
    expect(screen.queryByTestId('blueprint-section-Structure')).not.toBeInTheDocument();
    expect(screen.queryByTestId('blueprint-section-Component Tree')).not.toBeInTheDocument();
    expect(screen.queryByTestId('blueprint-section-Theme')).not.toBeInTheDocument();
    expect(screen.queryByTestId('blueprint-section-Mappings')).not.toBeInTheDocument();
  });

  it('uses only the theme authoring blueprint on Layout tab (no separate Theme workspace toggle)', async () => {
    renderStudio();
    await act(async () => {
      goToDesignMode();
    });

    expect(screen.getByTestId('blueprint-section-Colors')).toBeInTheDocument();
    expect(screen.getByTestId('blueprint-section-Typography')).toBeInTheDocument();
    expect(screen.queryByTestId('layout-theme-toggle')).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Theme' })).not.toBeInTheDocument();
  });

  it('does not list Component Tree or Theme on Editor tab', () => {
    renderStudio();
    expect(screen.queryByTestId('blueprint-section-Component Tree')).not.toBeInTheDocument();
    expect(screen.queryByTestId('blueprint-section-Theme')).not.toBeInTheDocument();
    expect(screen.getByTestId('blueprint-section-Mappings')).toBeInTheDocument();
  });

  it('Design canvas still shows the seeded field while blueprint is theme-focused', async () => {
    if (!customElements.get('formspec-render')) {
      class MockFormspecRender extends HTMLElement {
        connectedCallback() {
          this.innerHTML = '<div data-name="name" data-testid="layout-field-name">Full Name</div>';
        }
      }
      customElements.define('formspec-render', MockFormspecRender);
    }

    renderStudio();
    await act(async () => {
      goToDesignMode();
    });

    const workspace = screen.getByTestId('workspace-Design');
    expect(await within(workspace).findByTestId('layout-field-name')).toBeInTheDocument();
  });

  it('Colors panel shows in the blueprint sidebar', async () => {
    renderStudio();
    await act(async () => {
      goToDesignMode();
    });

    await act(async () => {
      selectBlueprintSection('Colors');
    });

    expect(within(blueprintSidebar()).getByRole('heading', { name: 'Colors' })).toBeInTheDocument();
  });

  it('Typography panel shows typography controls', async () => {
    renderStudio();
    await act(async () => {
      goToDesignMode();
    });
    selectBlueprintSection('Typography');

    const panel = blueprintSidebar();
    expect(within(panel).getByRole('heading', { name: 'Typography' })).toBeInTheDocument();
    expect(within(panel).getByText('Font Family')).toBeInTheDocument();
  });

  it('Field Defaults panel is reachable from the blueprint', async () => {
    renderStudio();
    await act(async () => {
      goToDesignMode();
    });
    selectBlueprintSection('Field Defaults');

    expect(within(blueprintSidebar()).getByRole('heading', { name: 'Label Position' })).toBeInTheDocument();
  });

  it('Settings in the theme blueprint shows form title', async () => {
    renderStudio();
    await act(async () => {
      goToDesignMode();
    });
    selectBlueprintSection('Settings');

    const panel = blueprintSidebar();
    expect(within(panel).getByText('Title')).toBeInTheDocument();
    expect(within(panel).getByText('Blueprint Layout Test')).toBeInTheDocument();
  });

  it('keeps the selected theme subsection after click (no coercion bug)', async () => {
    renderStudio();
    await act(async () => {
      goToDesignMode();
    });

    selectBlueprintSection('Typography');

    const typoRow = screen.getByTestId('blueprint-section-Typography');
    expect(within(typoRow).getByRole('button', { name: 'Typography' })).toHaveAttribute('aria-current', 'page');
    const colorsRow = screen.getByTestId('blueprint-section-Colors');
    expect(within(colorsRow).getByRole('button', { name: 'Colors' })).not.toHaveAttribute('aria-current');

    expect(within(blueprintSidebar()).getByRole('heading', { name: 'Typography' })).toBeInTheDocument();
  });

  it('marks the active blueprint section with aria-current', async () => {
    renderStudio();
    await act(async () => {
      goToDesignMode();
    });

    const colorsRow = screen.getByTestId('blueprint-section-Colors');
    expect(within(colorsRow).getByRole('button', { name: 'Colors' })).toHaveAttribute('aria-current', 'page');

    selectBlueprintSection('Field Defaults');
    const defaultsRow = screen.getByTestId('blueprint-section-Field Defaults');
    expect(within(defaultsRow).getByRole('button', { name: 'Field Defaults' })).toHaveAttribute('aria-current', 'page');
    expect(within(colorsRow).getByRole('button', { name: 'Colors' })).not.toHaveAttribute('aria-current');
  });
});
