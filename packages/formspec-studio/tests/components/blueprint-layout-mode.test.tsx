/** @filedesc Layout tab blueprint: theme authoring sections in the left rail for both workspace modes. */
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import type { FormDefinition } from '@formspec-org/types';
import { createProject } from '@formspec-org/studio-core';
import { ProjectProvider } from '../../src/state/ProjectContext';
import { SelectionProvider } from '../../src/state/useSelection';
import { ActiveGroupProvider } from '../../src/state/useActiveGroup';
import { Shell } from '../../src/components/Shell';

/** Mirrors Shell THEME_MODE_BLUEPRINT_SECTIONS (Layout tab left rail). */
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

function renderLayoutShell() {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1440 });
  Object.defineProperty(document.documentElement, 'clientWidth', { writable: true, configurable: true, value: 1440 });
  const project = createProject({ seed: { definition: seededDefinition } });
  render(
    <ProjectProvider project={project}>
      <SelectionProvider>
        <ActiveGroupProvider>
          <Shell />
        </ActiveGroupProvider>
      </SelectionProvider>
    </ProjectProvider>,
  );
  return project;
}

function goToLayoutTab() {
  fireEvent.click(screen.getByRole('tab', { name: 'Layout' }));
}

function blueprintSidebar() {
  return screen.getByTestId('blueprint-sidebar');
}

/** Clicks the primary nav button inside a blueprint row (not the external-link or settings-edit chip). */
function selectBlueprintSection(name: string) {
  const row = screen.getByTestId(`blueprint-section-${name}`);
  fireEvent.click(within(row).getByRole('button', { name }));
}

describe('Blueprint — Layout workspace', () => {
  it('lists theme authoring sections on Layout tab (layout workspace mode)', async () => {
    renderLayoutShell();
    await act(async () => {
      goToLayoutTab();
    });

    for (const name of LAYOUT_TAB_THEME_SECTIONS) {
      expect(screen.getByTestId(`blueprint-section-${name}`)).toBeInTheDocument();
    }
    expect(screen.queryByTestId('blueprint-section-Structure')).not.toBeInTheDocument();
    expect(screen.queryByTestId('blueprint-section-Component Tree')).not.toBeInTheDocument();
    expect(screen.queryByTestId('blueprint-section-Theme')).not.toBeInTheDocument();
    expect(screen.queryByTestId('blueprint-section-Mappings')).not.toBeInTheDocument();
  });

  it('keeps the same theme blueprint list when switching Layout ↔ Theme workspace mode', async () => {
    renderLayoutShell();
    await act(async () => {
      goToLayoutTab();
    });

    expect(screen.getByTestId('blueprint-section-Colors')).toBeInTheDocument();
    expect(screen.getByTestId('blueprint-section-Typography')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('radio', { name: 'Theme' }));
    });
    expect(screen.getByTestId('blueprint-section-Colors')).toBeInTheDocument();
    expect(screen.getByTestId('blueprint-section-Typography')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('radio', { name: 'Layout' }));
    });
    expect(screen.getByTestId('blueprint-section-Colors')).toBeInTheDocument();
    expect(screen.getByTestId('blueprint-section-Typography')).toBeInTheDocument();
  });

  it('does not list Component Tree, Theme, or Mappings on Editor tab', () => {
    renderLayoutShell();
    expect(screen.queryByTestId('blueprint-section-Component Tree')).not.toBeInTheDocument();
    expect(screen.queryByTestId('blueprint-section-Theme')).not.toBeInTheDocument();
    expect(screen.queryByTestId('blueprint-section-Mappings')).not.toBeInTheDocument();
  });

  it('Layout canvas still shows the seeded field while blueprint is theme-focused', async () => {
    renderLayoutShell();
    await act(async () => {
      goToLayoutTab();
    });

    const workspace = screen.getByTestId('workspace-Layout');
    expect(await within(workspace).findByTestId('layout-field-name')).toBeInTheDocument();
  });

  it('Colors panel shows in the blueprint sidebar', async () => {
    renderLayoutShell();
    await act(async () => {
      goToLayoutTab();
    });
    selectBlueprintSection('Colors');

    expect(within(blueprintSidebar()).getByRole('heading', { name: 'Colors' })).toBeInTheDocument();
  });

  it('Typography panel shows typography controls', async () => {
    renderLayoutShell();
    await act(async () => {
      goToLayoutTab();
    });
    selectBlueprintSection('Typography');

    const panel = blueprintSidebar();
    expect(within(panel).getByRole('heading', { name: 'Typography' })).toBeInTheDocument();
    expect(within(panel).getByText('Font Family')).toBeInTheDocument();
  });

  it('Field Defaults panel is reachable from the blueprint', async () => {
    renderLayoutShell();
    await act(async () => {
      goToLayoutTab();
    });
    selectBlueprintSection('Field Defaults');

    expect(within(blueprintSidebar()).getByRole('heading', { name: 'Label Position' })).toBeInTheDocument();
  });

  it('Settings in the theme blueprint shows form title', async () => {
    renderLayoutShell();
    await act(async () => {
      goToLayoutTab();
    });
    selectBlueprintSection('Settings');

    const panel = blueprintSidebar();
    expect(within(panel).getByText('Title')).toBeInTheDocument();
    expect(within(panel).getByText('Blueprint Layout Test')).toBeInTheDocument();
  });

  it('keeps the selected theme subsection after click (no Shell coercion bug)', async () => {
    renderLayoutShell();
    await act(async () => {
      goToLayoutTab();
    });

    selectBlueprintSection('Typography');

    const typoRow = screen.getByTestId('blueprint-section-Typography');
    expect(within(typoRow).getByRole('button', { name: 'Typography' })).toHaveAttribute('aria-current', 'page');
    const colorsRow = screen.getByTestId('blueprint-section-Colors');
    expect(within(colorsRow).getByRole('button', { name: 'Colors' })).not.toHaveAttribute('aria-current');

    expect(within(blueprintSidebar()).getByRole('heading', { name: 'Typography' })).toBeInTheDocument();
  });

  it('marks the active blueprint section with aria-current', async () => {
    renderLayoutShell();
    await act(async () => {
      goToLayoutTab();
    });

    const colorsRow = screen.getByTestId('blueprint-section-Colors');
    expect(within(colorsRow).getByRole('button', { name: 'Colors' })).toHaveAttribute('aria-current', 'page');

    selectBlueprintSection('Field Defaults');
    const defaultsRow = screen.getByTestId('blueprint-section-Field Defaults');
    expect(within(defaultsRow).getByRole('button', { name: 'Field Defaults' })).toHaveAttribute('aria-current', 'page');
    expect(within(colorsRow).getByRole('button', { name: 'Colors' })).not.toHaveAttribute('aria-current');
  });
});
