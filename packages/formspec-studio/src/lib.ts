/** @filedesc Public library entry point for embedding Formspec Studio in host applications. */
// Library entry point for embedding Studio in host apps
import './index.css';

// Re-export the main component
export { StudioApp } from './studio-app/StudioApp';

// Re-export project creation utilities
export { createProject, type Project } from '@formspec-org/studio-core';

// Re-export WASM init functions for embedders that need FEL tools
export { initFormspecEngine, initFormspecEngineTools } from '@formspec-org/engine';

// Re-export types consumers need
export type { ProjectSnapshot, CreateProjectOptions } from '@formspec-org/studio-core';

// Export a helper to register the formspec-render custom element
// (needed for the Preview tab to work)
export function registerFormspecRender() {
  // Dynamic import to avoid pulling in the webcomponent unless needed
  return import('@formspec-org/webcomponent').then(({ FormspecRender }) => {
    if (!customElements.get('formspec-render')) {
      customElements.define('formspec-render', FormspecRender);
    }
  });
}
