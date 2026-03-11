import { createContext, useMemo, type ReactNode } from 'react';
import type { Project, AnyCommand, CommandResult } from 'formspec-studio-core';

const ProjectContext = createContext<Project | null>(null);
const DispatchContext = createContext<((command: AnyCommand) => CommandResult) | null>(null);

export function ProjectProvider({ project, children }: { project: Project; children: ReactNode }) {
  const dispatch = useMemo(
    () => (command: AnyCommand): CommandResult => project.dispatch(command),
    [project]
  );
  return (
    <ProjectContext.Provider value={project}>
      <DispatchContext.Provider value={dispatch}>
        {children}
      </DispatchContext.Provider>
    </ProjectContext.Provider>
  );
}

export { ProjectContext, DispatchContext };
