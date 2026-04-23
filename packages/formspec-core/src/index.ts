/**
 * @module formspec-core
 *
 * Raw form project state management: command dispatch, handler pipeline,
 * undo/redo, and the IProjectCore abstraction.
 *
 * Schema-derived document types come from formspec-types (re-exported here).
 * For the behavior-driven authoring API, use formspec-studio-core.
 */

export type { IProjectCore } from './project-core.js';
export { RawProject, createRawProject } from './raw-project.js';
export { createChangesetMiddleware } from './changeset-middleware.js';
export type { ChangesetRecorderControl } from './changeset-middleware.js';
export { resolveItemLocation } from './handlers/helpers.js';
export { normalizeDefinition } from './normalization.js';
export { resolveThemeCascade } from './theme-cascade.js';
export type { ResolvedProperty, ThemeCascadeInput, DefinitionCascadeInput } from './theme-cascade.js';
export { resolvePageStructure } from './page-resolution.js';
export { describeShapeConstraint } from './queries/shape-display.js';
export type { ResolvedPageStructure, ResolvedPage, ResolvedRegion, PageDiagnostic, PageStructureInput } from './page-resolution.js';

// Schema-derived types (from formspec-types, re-exported via types.ts)
export type {
  FormItem, FormBind, FormShape, FormVariable, FormInstance, FormOption,
  FormDefinition, ComponentDocument, ThemeDocument, MappingDocument,
} from './types.js';

// Core operational types
export type {
  ComponentState,
  ThemeState,
  MappingState,
  LocaleState,
  ProjectState,
  ProjectOptions,
  Command,
  AnyCommand,
  BuiltinCommandType,
  InternalCommand,
  InternalCommandType,
  ProjectCommandMap,
  CommandResult,
  CommandHandler,
  ChangeListener,
  ChangeEvent,
  LogEntry,
  Middleware,
  ProjectBundle,
  ProjectStatistics,
  ExtensionsState,
  LoadedRegistry,
  VersioningState,
  VersionRelease,
  ItemFilter,
  ItemSearchResult,
  DataTypeInfo,
  RegistrySummary,
  ExtensionFilter,
  Change,
  FormspecChangelog,
  FELParseContext,
  FELMappingContext,
  FELParseResult,
  FELReferenceSet,
  FELFunctionEntry,
  ExpressionLocation,
  DependencyGraph,
  FieldDependents,
  Diagnostic,
  Diagnostics,
  ResponseSchemaRow,
  MappingPreviewParams,
  MappingPreviewResult,
} from './types.js';
