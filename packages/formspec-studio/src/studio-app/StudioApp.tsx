/** @filedesc Bootstraps a Studio project and wires context providers around the Shell. */
import { useState, type ReactElement } from 'react';
import { createProject, type CreateProjectOptions, type Project, type FormDefinition } from '@formspec-org/studio-core';
import commonRegistry from '../../../../registries/formspec-common.registry.json';

const COMMON_REGISTRY_URL = 'https://formspec.org/registries/formspec-common.registry.json';
import { ProjectProvider } from '../state/ProjectContext';
import { SelectionProvider } from '../state/useSelection';
import { ActiveGroupProvider } from '../state/useActiveGroup';
import { Shell } from '../components/Shell';
import { exampleDefinition } from '../fixtures/example-definition';
import { useColorScheme } from '../hooks/useColorScheme';

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

export function createStudioProject(seed?: CreateProjectOptions): Project {
  const handoffBundle = !seed ? getHandoffBundle() : null;
  const options: CreateProjectOptions = seed ?? (handoffBundle ? { seed: handoffBundle } : { seed: { definition: exampleDefinition as FormDefinition } });
  const bundledRegistry = { ...(commonRegistry as Record<string, unknown>), url: COMMON_REGISTRY_URL };
  return createProject({
    ...options,
    registries: [...(options.registries ?? []), bundledRegistry],
  });
}

interface StudioAppProps {
  project?: Project;
}

export function StudioApp({ project }: StudioAppProps = {}): ReactElement {
  const [activeProject] = useState<Project>(() => project ?? createStudioProject());
  const colorScheme = useColorScheme();

  return (
    <ProjectProvider project={activeProject}>
      <SelectionProvider>
        <ActiveGroupProvider>
          <Shell colorScheme={colorScheme} />
        </ActiveGroupProvider>
      </SelectionProvider>
    </ProjectProvider>
  );
}
