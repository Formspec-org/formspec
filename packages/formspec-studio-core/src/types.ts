/**
 * Studio-core type vocabulary.
 *
 * Schema-derived types come from formspec-types (the shared canonical source).
 * Operational types shared with formspec-core are re-exported from there.
 * Studio-specific types (snapshot, factory options, narrower callback) are defined here.
 */

// ── Schema-derived types (re-exported from formspec-types) ──────────
export type {
  FormItem, FormBind, FormShape, FormVariable, FormInstance, FormOption,
  FormDefinition, ComponentDocument, ThemeDocument, MappingDocument,
} from 'formspec-types';
import type {
  FormDefinition, ComponentDocument, ThemeDocument, MappingDocument,
} from 'formspec-types';

// ── Shared operational types (re-exported from formspec-core) ────────
export type {
  ProjectStatistics,
  Diagnostic,
  Diagnostics,
  LogEntry,
  ProjectBundle,
  MappingPreviewParams,
  MappingPreviewResult,
} from 'formspec-core';
import type { ProjectBundle } from 'formspec-core';

/**
 * Read-only snapshot of the project's authored artifacts.
 * This is what `project.state` returns — the four editable artifacts
 * without internal bookkeeping (extensions, versioning, generated layout).
 */
export interface ProjectSnapshot {
  definition: FormDefinition;
  component: ComponentDocument;
  theme: ThemeDocument;
  mappings: Record<string, MappingDocument>;
  selectedMappingId?: string;
}

// ── Callback Types ──────────────────────────────────────────────────

/**
 * Callback invoked after every state change.
 * Intentionally narrower than core's ChangeListener — consumers subscribe
 * for re-render notifications, they don't inspect command internals.
 */
export type ChangeListener = () => void;

// ── Factory Types ───────────────────────────────────────────────────

/**
 * Options for creating a new Project via `createProject()`.
 * Simpler than core's ProjectOptions — no middleware, no raw ProjectState.
 */
export interface CreateProjectOptions {
  /** Partial bundle to seed the project with. */
  seed?: Partial<ProjectBundle>;
  /** Extension registry documents to load. */
  registries?: unknown[];
  /** Maximum undo snapshots (default: 50). */
  maxHistoryDepth?: number;
  /**
   * Whether to enable changeset support (ProposalManager).
   * Default: true. Set to false to skip the changeset middleware.
   */
  enableChangesets?: boolean;
}
