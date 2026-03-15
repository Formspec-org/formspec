import type {
  ProjectState,
  AnyCommand,
  CommandResult,
  ChangeListener,
  LogEntry,
  ProjectStatistics,
  ProjectBundle,
  ItemFilter,
  DataTypeInfo,
  RegistrySummary,
  ExtensionFilter,
  Change,
  FormspecChangelog,
  FELParseContext,
  FELParseResult,
  FELReferenceSet,
  FELFunctionEntry,
  ExpressionLocation,
  DependencyGraph,
  FieldDependents,
  Diagnostics,
  ResponseSchemaRow,
  FormspecComponentDocument,
  FormspecThemeDocument,
  FormspecMappingDocument,
} from './types.js';
import type {
  FormspecDefinition,
  FormspecItem,
} from 'formspec-engine';

/**
 * Abstraction over the raw project core.
 * Implemented by RawProject (formspec-core). Consumed by Project (formspec-studio-core).
 * This is the seam between the two packages.
 */
export interface IProjectCore {
  // ── State getters ────────────────────────────────────────────
  readonly state: Readonly<ProjectState>;
  readonly definition: Readonly<FormspecDefinition>;
  readonly component: Readonly<FormspecComponentDocument>;
  readonly artifactComponent: Readonly<FormspecComponentDocument>;
  readonly generatedComponent: Readonly<FormspecComponentDocument>;
  readonly theme: Readonly<FormspecThemeDocument>;
  readonly mapping: Readonly<FormspecMappingDocument>;

  // ── Command dispatch ─────────────────────────────────────────
  dispatch(command: AnyCommand): CommandResult;
  dispatch(command: AnyCommand[]): CommandResult[];
  batch(commands: AnyCommand[]): CommandResult[];
  batchWithRebuild(phase1: AnyCommand[], phase2: AnyCommand[]): CommandResult[];

  // ── History ──────────────────────────────────────────────────
  undo(): boolean;
  redo(): boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly log: readonly LogEntry[];
  resetHistory(): void;

  // ── Change notifications ─────────────────────────────────────
  onChange(listener: ChangeListener): () => void;

  // ── Queries ───────────────────────────────────────────────────
  fieldPaths(): string[];
  itemAt(path: string): FormspecItem | undefined;
  responseSchemaRows(): ResponseSchemaRow[];
  statistics(): ProjectStatistics;
  instanceNames(): string[];
  variableNames(): string[];
  optionSetUsage(name: string): string[];
  searchItems(filter: ItemFilter): FormspecItem[];
  effectivePresentation(fieldKey: string): Record<string, unknown>;
  bindFor(path: string): Record<string, unknown> | undefined;
  componentFor(fieldKey: string): Record<string, unknown> | undefined;
  resolveExtension(name: string): Record<string, unknown> | undefined;
  unboundItems(): string[];
  resolveToken(key: string): string | number | undefined;
  allDataTypes(): DataTypeInfo[];
  parseFEL(expression: string, context?: FELParseContext): FELParseResult;
  felFunctionCatalog(): FELFunctionEntry[];
  availableReferences(context?: string | FELParseContext): FELReferenceSet;
  allExpressions(): ExpressionLocation[];
  expressionDependencies(expression: string): string[];
  fieldDependents(fieldPath: string): FieldDependents;
  variableDependents(variableName: string): string[];
  dependencyGraph(): DependencyGraph;
  listRegistries(): RegistrySummary[];
  browseExtensions(filter?: ExtensionFilter): Record<string, unknown>[];
  diffFromBaseline(fromVersion?: string): Change[];
  previewChangelog(): FormspecChangelog;
  diagnose(): Diagnostics;
  export(): ProjectBundle;
}
