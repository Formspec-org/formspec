/**
 * Handlers for definition-level metadata commands.
 *
 * Form metadata consists of top-level descriptive properties on the definition
 * document: `title`, `name`, `description`, `url`, `version`, `status`, `date`,
 * `derivedFrom`, `versionAlgorithm`, and `nonRelevantBehavior`. These properties
 * identify and describe the form but do not affect field structure, binds, or
 * runtime behavior.
 *
 * Currently only the `definition.setFormTitle` command is implemented here.
 * Other metadata properties (url, version, name, description, status, date, etc.)
 * are handled by the generic `definition.setDefinitionProperty` command registered
 * elsewhere.
 *
 * @module definition-metadata
 */

import { registerHandler } from '../handler-registry.js';

/**
 * **Command: `definition.setFormTitle`**
 *
 * Sets the human-readable title of the form definition. The title is a top-level
 * metadata property displayed to end users as the form's heading or name. It is
 * distinct from `name` (a machine-readable identifier) and `description` (a
 * longer explanatory text).
 *
 * **Payload:**
 * - `title` -- The new title string for the form. An empty string is valid
 *   (clears the title display).
 *
 * @example
 * ```typescript
 * project.dispatch({
 *   type: 'definition.setFormTitle',
 *   payload: { title: 'Contact Form' }
 * });
 * ```
 *
 * @returns `{ rebuildComponentTree: false }` -- Title changes are purely
 * metadata and do not affect the component tree structure.
 */
registerHandler('definition.setFormTitle', (state, payload) => {
  const { title } = payload as { title: string };
  state.definition.title = title;
  return { rebuildComponentTree: false };
});
