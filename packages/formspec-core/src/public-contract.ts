/** @filedesc Stable type aliases for the formspec-core package public API (project + factory). */

import type { IProjectCore } from './project-core.js';
import type { ProjectOptions } from './types.js';

/**
 * Authoring-time project session: co-edited definition / component / theme / mappings,
 * command dispatch, undo/redo, read-model queries, and export.
 *
 * Implemented by {@link RawProject}. Higher layers (e.g. formspec-studio-core) should
 * depend on this type rather than the concrete class when only the contract is needed.
 */
export type FormspecCoreProject = IProjectCore;

/**
 * Factory shape for {@link createRawProject}. Returns a {@link FormspecCoreProject}.
 */
export type CreateFormspecCoreProject = (options?: ProjectOptions) => FormspecCoreProject;
