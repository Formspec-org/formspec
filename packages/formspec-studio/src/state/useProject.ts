import { useContext } from 'react';
import { ProjectContext } from './ProjectContext';

export function useProject() {
  const project = useContext(ProjectContext);
  if (!project) throw new Error('useProject must be used within a ProjectProvider');
  return project;
}
