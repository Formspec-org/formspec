/** @filedesc Aggregates all built-in command handlers into a single registry. */
import type { CommandHandler } from '../types.js';
import type { ProjectCommandMap } from '../project-commands.js';

import { definitionMetadataHandlers } from './definition-metadata.js';
import { definitionItemsHandlers } from './definition-items.js';
import { definitionBindsHandlers } from './definition-binds.js';
import { definitionShapesHandlers } from './definition-shapes.js';
import { definitionVariablesHandlers } from './definition-variables.js';
import { definitionPagesHandlers } from './definition-pages.js';
import { definitionOptionsetsHandlers } from './definition-optionsets.js';
import { definitionInstancesHandlers } from './definition-instances.js';
import { screenerHandlers } from './screener.js';
import { definitionMigrationsHandlers } from './definition-migrations.js';
import { componentTreeHandlers } from './component-tree.js';
import { componentPropertiesHandlers } from './component-properties.js';
import { themeHandlers } from './theme.js';
import { mappingHandlers } from './mapping.js';
import { localeHandlers } from './locale.js';
import { projectHandlers } from './project.js';

export type { CommandHandler };

export const builtinHandlers = Object.freeze({
  ...definitionMetadataHandlers,
  ...definitionItemsHandlers,
  ...definitionBindsHandlers,
  ...definitionShapesHandlers,
  ...definitionVariablesHandlers,
  ...definitionPagesHandlers,
  ...definitionOptionsetsHandlers,
  ...definitionInstancesHandlers,
  ...screenerHandlers,
  ...definitionMigrationsHandlers,
  ...componentTreeHandlers,
  ...componentPropertiesHandlers,
  ...themeHandlers,
  ...mappingHandlers,
  ...localeHandlers,
  ...projectHandlers,
});

// ── Compile-time sync proof ─────────────────────────────────────────
// Ensures builtinHandlers keys and ProjectCommandMap keys are identical.
// If a handler is added/removed without updating project-commands.ts
// (or vice versa), this block produces a compile error.
type _HandlerKeys = keyof typeof builtinHandlers;
type _MapKeys = keyof ProjectCommandMap;
type _MissingFromMap = Exclude<_HandlerKeys, _MapKeys>;
type _MissingFromHandlers = Exclude<_MapKeys, _HandlerKeys>;
type _AssertSync = [_MissingFromMap, _MissingFromHandlers] extends [never, never]
  ? true
  : 'ERROR: ProjectCommandMap and builtinHandlers are out of sync';
const _syncProof: _AssertSync = true;
void _syncProof;
