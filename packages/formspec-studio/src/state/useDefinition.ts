/** @filedesc Hooks that return the current form definition document from project state. */
import { useContext } from 'react';
import { useProjectState } from './useProjectState';
import { ProjectContext } from './ProjectContext';

export function useDefinition() {
  return useProjectState().definition;
}

export function useOptionalDefinition() {
  const project = useContext(ProjectContext);
  if (!project) return null;
  return project.state.definition;
}
