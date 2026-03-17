/** @filedesc Hook that reads the Project instance from context, throwing if called outside a provider. */
import { useContext } from 'react';
import { ProjectContext } from './ProjectContext';

export function useProject() {
  const project = useContext(ProjectContext);
  if (!project) throw new Error('useProject must be used within a ProjectProvider');
  return project;
}
