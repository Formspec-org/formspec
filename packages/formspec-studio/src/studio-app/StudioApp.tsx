/** @filedesc Bootstraps a Studio project and wires context providers around the Shell. */
import { useState, type ReactElement } from 'react';
import { createProject, type Project } from 'formspec-studio-core';
import { ProjectProvider } from '../state/ProjectContext';
import { SelectionProvider } from '../state/useSelection';
import { ActivePageProvider } from '../state/useActivePage';
import { Shell } from '../components/Shell';
import { exampleDefinition } from '../fixtures/example-definition';

export function createStudioProject(seed?: Parameters<typeof createProject>[0]): Project {
  const project = createProject(seed ?? { seed: { definition: exampleDefinition as any } });

  // Auto-generate theme.pages from definition groups if the seed didn't provide pages
  const themePages = (project.theme as any).pages;
  if (!themePages || themePages.length === 0) {
    const items = (project.definition as any).items ?? [];
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
