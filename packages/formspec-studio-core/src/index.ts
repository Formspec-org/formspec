/**
 * @module formspec-studio-core
 *
 * Document-agnostic semantic authoring API for Formspec.
 * Project composes IProjectCore (from formspec-core) and exposes
 * 51 behavior-driven helper methods for form authoring.
 *
 * Re-exports all of formspec-core for consumer convenience.
 */

// Re-export everything from formspec-core so consumers need no import changes
export * from 'formspec-core';

// Local exports
export { Project, createProject } from './project.js';
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
