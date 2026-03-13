/**
 * @module formspec-studio-core
 *
 * Pure TypeScript library for creating and editing Formspec artifact bundles.
 * Every edit is a serializable {@link Command} dispatched against a {@link Project}.
 *
 * Entry point: call {@link createProject} to get a new {@link Project} instance,
 * then use `project.dispatch(command)` to apply mutations.
 *
 * No framework dependencies, no singletons, no side effects.
 */

export { Project, createProject } from './project.js';
export type {
  ProjectState,
  ProjectOptions,
  Command,
  AnyCommand,
  CommandResult,
  ChangeListener,
  ChangeEvent,
  LogEntry,
  Middleware,
  ProjectBundle,
  ProjectStatistics,
  FormspecComponentDocument,
  FormspecGeneratedLayoutDocument,
  FormspecThemeDocument,
  FormspecMappingDocument,
  ExtensionsState,
  VersioningState,
  ItemFilter,
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
} from './types.js';
