/** @filedesc IProjectCore interface defining the contract between core and studio. */
import type {
  FormItem, FormDefinition, ComponentDocument, ThemeDocument, MappingDocument,
} from 'formspec-types';
import type {
  ProjectState,
  LocaleState,
  AnyCommand,
  CommandResult,
  ChangeListener,
  LogEntry,
  ProjectStatistics,
  ProjectBundle,
  ItemFilter,
  ItemSearchResult,
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
  readonly mappings: Readonly<Record<string, MappingDocument>>;
  /** Read-only view of all loaded locale states, keyed by BCP 47 code. */
  readonly locales: Readonly<Record<string, LocaleState>>;

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

  // ── State restoration ─────────────────────────────────────────
  /**
   * Wholesale replace the project state with a prior snapshot.
   *
   * Used by the ProposalManager for changeset reject/partial-merge
   * (snapshot-and-replay). History stack is cleared on restore because
   * the changeset is the undo mechanism during its lifetime.
   *
   * Invalidates all cached views (component, generated component).
   */
  restoreState(snapshot: ProjectState): void;

  // ── Change notifications ─────────────────────────────────────
  onChange(listener: ChangeListener): () => void;

  // ── Queries ───────────────────────────────────────────────────
  fieldPaths(): string[];
  itemPaths(): string[];
  itemAt(path: string): FormItem | undefined;
  responseSchemaRows(): ResponseSchemaRow[];
  statistics(): ProjectStatistics;
  instanceNames(): string[];
  variableNames(): string[];
  optionSetUsage(name: string): string[];
  searchItems(filter: ItemFilter): ItemSearchResult[];
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
  previewMapping(params: import('./types.js').MappingPreviewParams): import('./types.js').MappingPreviewResult;
  /** Get a specific locale state by BCP 47 code. */
  localeAt(code: string): LocaleState | undefined;
  /** Get the currently selected locale code in the editor. */
  activeLocaleCode(): string | undefined;
  export(): ProjectBundle;
}
