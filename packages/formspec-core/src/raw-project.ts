import type { IProjectCore } from './project-core.js';
import type {
  ComponentDocument, ThemeDocument, MappingDocument, FormDefinition, FormItem,
} from 'formspec-types';
import type {
  ProjectState,
  ProjectOptions,
  ThemeState,
  MappingState,
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
import { builtinHandlers } from './handlers/index.js';
import type { CommandHandler } from './types.js';
import { CommandPipeline } from './pipeline.js';
import {
  createGeneratedLayoutDocument,
  getCurrentComponentDocument,
  hasAuthoredComponentTree,
  splitComponentState,
} from './component-documents.js';
import { normalizeDefinition } from './normalization.js';
import { HistoryManager } from './history.js';
import { reconcileComponentTree } from './tree-reconciler.js';
import { normalizeState } from './state-normalizer.js';
import {
  fieldPaths as _fieldPaths,
  itemAt as _itemAt,
  responseSchemaRows as _responseSchemaRows,
  instanceNames as _instanceNames,
  variableNames as _variableNames,
  optionSetUsage as _optionSetUsage,
  searchItems as _searchItems,
  effectivePresentation as _effectivePresentation,
  bindFor as _bindFor,
  componentFor as _componentFor,
  unboundItems as _unboundItems,
  resolveToken as _resolveToken,
  allDataTypes as _allDataTypes,
  parseFEL as _parseFEL,
  felFunctionCatalog as _felFunctionCatalog,
  availableReferences as _availableReferences,
  allExpressions as _allExpressions,
  expressionDependencies as _expressionDependencies,
  fieldDependents as _fieldDependents,
  variableDependents as _variableDependents,
  dependencyGraph as _dependencyGraph,
  statistics as _statistics,
  diagnose as _diagnose,
  diffFromBaseline as _diffFromBaseline,
  previewChangelog as _previewChangelog,
  listRegistries as _listRegistries,
  browseExtensions as _browseExtensions,
  resolveExtension as _resolveExtension,
} from './queries/index.js';

/**
 * Generate a unique URN for a new definition.
 */
function generateUrl(): string {
  const id = Math.random().toString(36).slice(2, 10);
  return `urn:formspec:${id}`;
}

/**
 * Create a blank definition with sensible defaults.
 */
function createDefaultDefinition(): FormDefinition {
  return {
    $formspec: '1.0',
    url: generateUrl(),
    version: '0.1.0',
    title: '',
    items: [],
  };
}

/**
 * Create default project state, applying seed overrides.
 */
function createDefaultState(options?: ProjectOptions): ProjectState {
  const rawDefinition = options?.seed?.definition ?? createDefaultDefinition();
  const definition = normalizeDefinition(rawDefinition);
  const url = definition.url;
  const componentState = splitComponentState(options?.seed?.component, url);

  const theme: ThemeState = options?.seed?.theme ?? {};
  if (!theme.targetDefinition) {
    theme.targetDefinition = { url };
  }

  const mapping: MappingState = options?.seed?.mapping ?? {};

  return {
    definition,
    component: componentState.component,
    generatedComponent: options?.seed?.generatedComponent
      ? createGeneratedLayoutDocument(url, options.seed.generatedComponent)
      : componentState.generatedComponent,
    theme,
    mapping,
    extensions: options?.seed?.extensions ?? { registries: [] },
    versioning: options?.seed?.versioning ?? {
      baseline: structuredClone(definition),
      releases: [],
    },
  };
}

/**
 * Central editing surface for a Formspec artifact bundle.
 *
 * Manages four co-evolving artifacts (definition, component, theme, mapping)
 * plus extension registries and version history. Every mutation flows through a
 * command-dispatch pipeline. Queries are delegated to pure functions in `queries/`.
 */
export class RawProject implements IProjectCore {
  private _state: ProjectState;
  private _history: HistoryManager<ProjectState>;
  private _listeners: Set<ChangeListener> = new Set();
  private _pipeline: CommandPipeline;
  private _schemaValidator: ProjectOptions['schemaValidator'];
  private _handlers: Readonly<Record<string, CommandHandler>>;
  private _cachedComponent: ComponentDocument | null = null;
  private _cachedComponentForState: ProjectState | null = null;

  constructor(options?: ProjectOptions) {
    this._state = createDefaultState(options);
    this._history = new HistoryManager(options?.maxHistoryDepth);
    this._schemaValidator = options?.schemaValidator;
    this._handlers = options?.handlers
      ? Object.freeze({ ...builtinHandlers, ...options.handlers })
      : builtinHandlers;
    this._pipeline = new CommandPipeline(
      this._handlers,
      options?.middleware ?? [],
    );

    if (
      this._state.definition.items.length > 0 &&
      !hasAuthoredComponentTree(this._state.component) &&
      !this._state.generatedComponent.tree
    ) {
      this._state.generatedComponent.tree = reconcileComponentTree(
        this._state.definition,
        this._state.generatedComponent.tree,
        this._state.theme,
      ) as any;
      (this._state.generatedComponent as Record<string, unknown>)['x-studio-generated'] = true;
    }
  }

  // ── State getters ───────────────────────────────────────────────

  get state(): Readonly<ProjectState> { return this._state; }

  get definition(): Readonly<FormDefinition> {
    return this._state.definition as unknown as Readonly<FormDefinition>;
  }

  get component(): Readonly<ComponentDocument> {
    if (this._cachedComponentForState !== this._state) {
      this._cachedComponent = getCurrentComponentDocument(this._state) as unknown as ComponentDocument;
      this._cachedComponentForState = this._state;
    }
    return this._cachedComponent as Readonly<ComponentDocument>;
  }

  get artifactComponent(): Readonly<ComponentDocument> {
    return this._state.component as unknown as Readonly<ComponentDocument>;
  }

  get generatedComponent(): Readonly<ComponentDocument> {
    return this._state.generatedComponent as unknown as Readonly<ComponentDocument>;
  }

  get theme(): Readonly<ThemeDocument> {
    return this._state.theme as unknown as Readonly<ThemeDocument>;
  }

  get mapping(): Readonly<MappingDocument> {
    return this._state.mapping as unknown as Readonly<MappingDocument>;
  }

  // ── Query wrappers ──────────────────────────────────────────────

  fieldPaths(): string[] { return _fieldPaths(this._state); }
  itemAt(path: string): FormItem | undefined { return _itemAt(this._state, path); }
  responseSchemaRows(): ResponseSchemaRow[] { return _responseSchemaRows(this._state); }
  statistics(): ProjectStatistics { return _statistics(this._state); }
  instanceNames(): string[] { return _instanceNames(this._state); }
  variableNames(): string[] { return _variableNames(this._state); }
  optionSetUsage(name: string): string[] { return _optionSetUsage(this._state, name); }
  searchItems(filter: ItemFilter): ItemSearchResult[] { return _searchItems(this._state, filter); }
  effectivePresentation(fieldKey: string): Record<string, unknown> { return _effectivePresentation(this._state, fieldKey); }
  bindFor(path: string): Record<string, unknown> | undefined { return _bindFor(this._state, path); }
  componentFor(fieldKey: string): Record<string, unknown> | undefined { return _componentFor(this._state, fieldKey); }
  resolveExtension(name: string): Record<string, unknown> | undefined { return _resolveExtension(this._state, name); }
  unboundItems(): string[] { return _unboundItems(this._state); }
  resolveToken(key: string): string | number | undefined { return _resolveToken(this._state, key); }
  allDataTypes(): DataTypeInfo[] { return _allDataTypes(this._state); }
  parseFEL(expression: string, context?: FELParseContext): FELParseResult { return _parseFEL(this._state, expression, context); }
  felFunctionCatalog(): FELFunctionEntry[] { return _felFunctionCatalog(this._state); }
  availableReferences(context?: string | FELParseContext): FELReferenceSet { return _availableReferences(this._state, context); }
  allExpressions(): ExpressionLocation[] { return _allExpressions(this._state); }
  expressionDependencies(expression: string): string[] { return _expressionDependencies(this._state, expression); }
  fieldDependents(fieldPath: string): FieldDependents { return _fieldDependents(this._state, fieldPath); }
  variableDependents(variableName: string): string[] { return _variableDependents(this._state, variableName); }
  dependencyGraph(): DependencyGraph { return _dependencyGraph(this._state); }
  listRegistries(): RegistrySummary[] { return _listRegistries(this._state); }
  browseExtensions(filter?: ExtensionFilter): Record<string, unknown>[] { return _browseExtensions(this._state, filter); }
  diffFromBaseline(fromVersion?: string): Change[] { return _diffFromBaseline(this._state, fromVersion); }
  previewChangelog(): FormspecChangelog { return _previewChangelog(this._state); }
  diagnose(): Diagnostics { return _diagnose(this._state, this._schemaValidator); }

  // ── Export ──────────────────────────────────────────────────────

  export(): ProjectBundle {
    const url = this._state.definition.url;
    const effectiveComponent = getCurrentComponentDocument(this._state);
    const { tree, 'x-studio-generated': _, ...restComponent } = effectiveComponent as Record<string, unknown>;
    const { targetDefinition: themeTarget, ...restTheme } = this._state.theme;
    const { rules, targetSchema, definitionRef, definitionVersion, ...restMapping } = this._state.mapping;
    return structuredClone({
      definition: this._state.definition as unknown as FormDefinition,
      component: {
        $formspecComponent: '1.0',
        version: '0.1.0',
        targetDefinition: { url },
        ...restComponent,
        tree: tree ?? null,
      } as ComponentDocument,
      theme: {
        $formspecTheme: '1.0',
        version: '0.1.0',
        ...restTheme,
        targetDefinition: themeTarget ?? { url },
      } as ThemeDocument,
      mapping: {
        version: '0.1.0',
        definitionRef: definitionRef ?? url,
        definitionVersion: definitionVersion ?? '>=0.0.0',
        targetSchema: targetSchema ?? { format: 'json' },
        rules: rules ?? [],
        ...restMapping,
      } as MappingDocument,
    });
  }

  // ── History ──────────────────────────────────────────────────────

  get canUndo(): boolean { return this._history.canUndo; }
  get canRedo(): boolean { return this._history.canRedo; }
  get log(): readonly LogEntry[] { return this._history.log; }

  resetHistory(): void { this._history.clear(); }

  undo(): boolean {
    const prev = this._history.popUndo(this._state);
    if (!prev) return false;
    this._state = prev;
    this._notify({ type: 'undo', payload: {} }, { rebuildComponentTree: false }, 'undo');
    return true;
  }

  redo(): boolean {
    const next = this._history.popRedo(this._state);
    if (!next) return false;
    this._state = next;
    this._notify({ type: 'redo', payload: {} }, { rebuildComponentTree: false }, 'redo');
    return true;
  }

  // ── Change notification ──────────────────────────────────────────

  onChange(listener: ChangeListener): () => void {
    this._listeners.add(listener);
    return () => { this._listeners.delete(listener); };
  }

  private _notify(command: AnyCommand, result: CommandResult, source: string): void {
    for (const listener of this._listeners) {
      listener(this._state, { command, result, source });
    }
  }

  // ── Dispatching commands ─────────────────────────────────────────

  dispatch(command: AnyCommand): CommandResult;
  dispatch(command: AnyCommand[]): CommandResult[];
  dispatch(command: AnyCommand | AnyCommand[]): CommandResult | CommandResult[] {
    const commands = Array.isArray(command) ? command : [command];
    const results = this._execute([commands]);
    return Array.isArray(command) ? results : results[0];
  }

  batchWithRebuild(phase1: AnyCommand[], phase2: AnyCommand[]): CommandResult[] {
    return this._execute([phase1, phase2]);
  }

  clearRedo(): void {
    this._history.clearRedo();
  }

  batch(commands: AnyCommand[]): CommandResult[] {
    return this._execute([commands]);
  }

  private _execute(phases: AnyCommand[][]): CommandResult[] {
    const snapshot = this._state;

    const { newState, results } = this._pipeline.execute(
      this._state,
      phases,
      (clone) => {
        if (!hasAuthoredComponentTree(clone.component)) {
          clone.generatedComponent.tree = reconcileComponentTree(
            clone.definition,
            clone.generatedComponent.tree,
            clone.theme,
          ) as any;
          (clone.generatedComponent as Record<string, unknown>)['x-studio-generated'] = true;
        }
      },
    );

    normalizeState(newState);

    if (results.some(r => r.clearHistory)) {
      this._history.clear();
      this._history.clearLog();
    } else {
      this._history.push(snapshot);
    }

    this._state = newState;

    if (results.some(r => r.rebuildComponentTree) && !hasAuthoredComponentTree(this._state.component)) {
      this._state.generatedComponent.tree = reconcileComponentTree(
        this._state.definition,
        this._state.generatedComponent.tree,
        this._state.theme,
      ) as any;
      (this._state.generatedComponent as Record<string, unknown>)['x-studio-generated'] = true;
    }

    const allCommands = phases.flat();
    const logCommand: AnyCommand = allCommands.length === 1
      ? allCommands[0]
      : phases.length > 1
        ? { type: 'batchWithRebuild', payload: { phases } }
        : { type: 'batch', payload: { commands: allCommands } };
    this._history.appendLog({ command: logCommand, timestamp: Date.now() });

    const source = allCommands.length === 1 ? 'dispatch' : 'batch';
    this._notify(
      logCommand,
      { rebuildComponentTree: results.some(r => r.rebuildComponentTree) },
      source,
    );

    return results;
  }
}

/**
 * Factory function for creating a new {@link RawProject} instance.
 */
export function createRawProject(options?: ProjectOptions): RawProject {
  return new RawProject(options);
}
