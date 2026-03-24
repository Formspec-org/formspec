/**
 * @module formspec-studio-core
 *
 * Document-agnostic semantic authoring API for Formspec.
 * Project composes IProjectCore (from formspec-core) and exposes
 * 51 behavior-driven helper methods for form authoring.
 *
 * Consumers import types from THIS package — never from formspec-core.
 */

// ── Project ─────────────────────────────────────────────────────────
export { Project, createProject } from './project.js';

// ── ProposalManager (changeset lifecycle) ────────────────────────────
export { ProposalManager } from './proposal-manager.js';
export type {
  Changeset,
  ChangeEntry,
  ChangesetStatus,
  DependencyGroup,
  ReplayFailure,
  MergeResult,
} from './proposal-manager.js';

// ── Studio-core types (own vocabulary) ──────────────────────────────
export type {
  // Schema-derived types (from formspec-types)
  FormItem,
  FormBind,
  FormShape,
  FormVariable,
  FormInstance,
  FormOption,
  FormDefinition,
  ComponentDocument,
  ThemeDocument,
  MappingDocument,
  // Operational types (studio-core's own)
  ProjectBundle,
  ProjectSnapshot,
  ProjectStatistics,
  Diagnostic,
  Diagnostics,
  LogEntry,
  ChangeListener,
  CreateProjectOptions,
} from './types.js';

// ── Helper types ────────────────────────────────────────────────────
export { HelperError } from './helper-types.js';
export type {
  HelperResult,
  HelperWarning,
  FieldProps,
  ContentProps,
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

// ── Field type aliases ──────────────────────────────────────────────
export { resolveFieldType, resolveWidget, widgetHintFor, isTextareaWidget } from './field-type-aliases.js';
export type { ResolvedFieldType } from './field-type-aliases.js';

// ── FEL & dependency query types (re-exported from formspec-core) ────
export type {
  FELParseContext, FELParseResult, FELReferenceSet, FELFunctionEntry,
  FieldDependents, ItemFilter, ItemSearchResult,
} from 'formspec-core';

// ── Theme utilities (re-exported from formspec-core for consumers) ───
export { resolveThemeCascade } from 'formspec-core';
export type { ResolvedProperty } from 'formspec-core';

// ── Page resolution utilities (re-exported from formspec-core) ───────
export { resolvePageStructure } from 'formspec-core';
export type { ResolvedPageStructure, ResolvedPage, ResolvedRegion, PageDiagnostic } from 'formspec-core';

// ── Behavioral page view (re-exported from formspec-core) ────────────
export { resolvePageView } from 'formspec-core';
export type { PageView, PageItemView, PlaceableItem, PageStructureView } from 'formspec-core';

// ── Evaluation helpers ──────────────────────────────────────────────
export { previewForm, validateResponse } from './evaluation-helpers.js';
