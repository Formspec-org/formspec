/** @filedesc Bootstraps a Studio project and wires context providers around the Shell. */
import { useState, type ReactElement } from 'react';
import { createProject, type Project, type FormDefinition } from 'formspec-studio-core';
import { ProjectProvider } from '../state/ProjectContext';
import { SelectionProvider } from '../state/useSelection';
import { ActivePageProvider } from '../state/useActivePage';
import { Shell } from '../components/Shell';
import { exampleDefinition } from '../fixtures/example-definition';

/**
 * Check for a handoff bundle in localStorage (from Chat or Inquest).
 */
function getHandoffBundle(): any | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const handoffId = params.get('h');
  if (!handoffId) return null;

  const storageKey = `formspec-handoff:${handoffId}`;
  const raw = localStorage.getItem(storageKey);
  if (!raw) return null;

  try {
    const bundle = JSON.parse(raw);
    localStorage.removeItem(storageKey);

    // Clean up URL without reload
    const url = new URL(window.location.href);
    url.searchParams.delete('h');
    window.history.replaceState({}, '', url.toString());

    return bundle;
  } catch (err) {
    console.error('Failed to parse handoff bundle', err);
    return null;
  }
}

export function createStudioProject(seed?: Parameters<typeof createProject>[0]): Project {
  const handoffBundle = !seed ? getHandoffBundle() : null;
  const finalSeed = seed ?? (handoffBundle ? { seed: handoffBundle } : { seed: { definition: exampleDefinition as FormDefinition } });

  const project = createProject(finalSeed);

  // Auto-generate theme.pages from definition groups if the seed didn't provide pages
  const themePages = project.theme.pages;
  if (!themePages || themePages.length === 0) {
    const items = project.definition.items ?? [];
    const hasGroups = items.some((item: any) => item.type === 'group');
    if (hasGroups) {
      project.autoGeneratePages();
    }
  }

  return project;
}

interface StudioAppProps {
  project?: Project;
}

export function StudioApp({ project }: StudioAppProps = {}): ReactElement {
  const [activeProject] = useState<Project>(() => project ?? createStudioProject());

  return (
    <ProjectProvider project={activeProject}>
      <SelectionProvider>
        <ActivePageProvider>
          <Shell />
        </ActivePageProvider>
      </SelectionProvider>
    </ProjectProvider>
  );
}
