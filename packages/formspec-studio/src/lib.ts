// Library entry point for embedding Studio in host apps
import './index.css';

// Re-export the main component
export { StudioApp } from './studio-app/StudioApp';

// Re-export project creation utilities
export { createProject, type Project } from 'formspec-studio-core';

// Re-export types consumers need
export type { ProjectSnapshot, CreateProjectOptions } from 'formspec-studio-core';

// Export a helper to register the formspec-render custom element
// (needed for the Preview tab to work)
export function registerFormspecRender() {
  // Dynamic import to avoid pulling in the webcomponent unless needed
  return import('formspec-webcomponent').then(({ FormspecRender }) => {
    if (!customElements.get('formspec-render')) {
      customElements.define('formspec-render', FormspecRender);
    }
  });
}
