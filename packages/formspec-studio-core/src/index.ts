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

export { RawProject, createRawProject } from './raw-project.js';
export { Project, createProject } from './project-wrapper.js';
export { HelperError } from './helper-types.js';
export type {
  HelperResult,
  HelperWarning,
  FieldProps,
  GroupProps,
  RepeatProps,
  BranchPath,
  LayoutArrangement,
  PlacementOptions,
  FlowProps,
  ValidationOptions,
  InstanceProps,
  ChoiceOption,
  ItemChanges,
  MetadataChanges,
} from './helper-types.js';
export { resolveFieldType, resolveWidget, widgetHintFor, isTextareaWidget } from './field-type-aliases.js';
export type { ResolvedFieldType } from './field-type-aliases.js';
export { previewForm, validateResponse } from './evaluation-helpers.js';
export { resolveItemLocation } from './handlers/helpers.js';
export { normalizeDefinition } from './normalization.js';
export { resolveThemeCascade } from './theme-cascade.js';
export type { ResolvedProperty } from './theme-cascade.js';
export { resolvePageStructure } from './page-resolution.js';
export type { ResolvedPageStructure, ResolvedPage, ResolvedRegion, PageDiagnostic } from './page-resolution.js';
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
  ResponseSchemaRow,
} from './types.js';
