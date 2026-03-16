import type {
  FormItem, FormDefinition, ComponentDocument, ThemeDocument, MappingDocument,
} from 'formspec-types';
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
} from './types.js';

/**
 * Abstraction over the raw project core.
 * Implemented by RawProject (formspec-core). Consumed by Project (formspec-studio-core).
 * This is the seam between the two packages.
 */
export interface IProjectCore {
  // ── State getters ────────────────────────────────────────────
  readonly state: Readonly<ProjectState>;
  readonly definition: Readonly<FormDefinition>;
  readonly component: Readonly<ComponentDocument>;
  readonly artifactComponent: Readonly<ComponentDocument>;
  readonly generatedComponent: Readonly<ComponentDocument>;
  readonly theme: Readonly<ThemeDocument>;
  readonly mapping: Readonly<MappingDocument>;

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
  itemAt(path: string): FormItem | undefined;
  responseSchemaRows(): ResponseSchemaRow[];
  statistics(): ProjectStatistics;
  instanceNames(): string[];
  variableNames(): string[];
  optionSetUsage(name: string): string[];
  searchItems(filter: ItemFilter): FormItem[];
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
