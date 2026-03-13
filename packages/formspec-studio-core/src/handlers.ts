/**
 * Handler aggregation module.
 *
 * Re-exports the registry API ({@link registerHandler}, {@link getHandler}) for
 * consumer convenience, and imports every handler module to trigger their
 * self-registration side effects.
 *
 * Importing this module guarantees that all built-in command handlers are
 * registered in the global handler map before any command is dispatched.
 * Handler modules are organized by artifact and concern:
 *
 * - **definition-*** -- mutations to the form definition (items, binds, shapes, etc.)
 * - **component-*** -- mutations to the component (UI) tree
 * - **theme** -- mutations to the theme document
 * - **mapping** -- mutations to the mapping document
 * - **project** -- whole-project operations (replace, reset)
 */

// Re-export registry for consumers
export { registerHandler, getHandler } from './handler-registry.js';
export type { CommandHandler } from './handler-registry.js';

// Import handler modules to trigger self-registration.
// Each module calls `registerHandler()` at the top level for every command type it owns.
import './handlers/definition-metadata.js';
import './handlers/definition-items.js';
import './handlers/definition-binds.js';
import './handlers/definition-shapes.js';
import './handlers/definition-variables.js';
import './handlers/definition-pages.js';
import './handlers/definition-optionsets.js';
import './handlers/definition-instances.js';
import './handlers/definition-screener.js';
import './handlers/definition-migrations.js';
import './handlers/component-tree.js';
import './handlers/component-properties.js';
import './handlers/theme.js';
import './handlers/mapping.js';
import './handlers/pages.js';
import './handlers/project.js';
