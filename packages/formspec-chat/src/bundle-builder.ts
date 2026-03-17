/** @filedesc Builds a ProjectBundle from a bare FormDefinition via createRawProject. */
import type { FormDefinition } from 'formspec-types';
import { createRawProject, type ProjectBundle } from 'formspec-core';

/**
 * Build a full ProjectBundle from a bare definition.
 *
 * Uses createRawProject to generate the component tree, theme, and mapping
 * that the definition implies. On failure (degenerate definition), returns
 * a minimal bundle with the definition and empty/null documents.
 */
export function buildBundleFromDefinition(definition: FormDefinition): ProjectBundle {
  try {
    const project = createRawProject({ seed: { definition } });
    const exported = project.export();
    // export() returns authored component tree (null for new projects)
    // project.component merges authored + generated — use that for the bundle
    return {
      ...exported,
      component: structuredClone(project.component),
    };
  } catch {
    return {
      definition,
      component: { tree: null, customComponents: [] },
      theme: null,
      mapping: null,
    };
  }
}
