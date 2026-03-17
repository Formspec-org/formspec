/** @filedesc React context and provider that makes the active Project instance available to the tree. */
import { createContext, type ReactNode } from 'react';
import type { Project } from 'formspec-studio-core';

const ProjectContext = createContext<Project | null>(null);

export function ProjectProvider({ project, children }: { project: Project; children: ReactNode }) {
  return (
    <ProjectContext.Provider value={project}>
      {children}
    </ProjectContext.Provider>
  );
}

export { ProjectContext };
