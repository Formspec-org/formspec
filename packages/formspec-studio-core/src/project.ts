import type {
  ProjectState,
  ProjectOptions,
  AnyCommand,
  CommandResult,
  ChangeListener,
  FormspecComponentDocument,
  FormspecThemeDocument,
  FormspecMappingDocument,
  LogEntry,
  Middleware,
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
  Diagnostic,
  ResponseSchemaRow,
} from './types.js';
import {
  analyzeFEL,
  getBuiltinFELFunctionCatalog,
  getFELDependencies,
  itemAtPath,
  normalizeIndexedPath,
  validateExtensionUsage,
  type DocumentType,
  type FELAnalysis,
  type FormspecDefinition,
  type FormspecItem,
} from 'formspec-engine';
import { getHandler } from './handlers.js';
import {
  createGeneratedLayoutDocument,
  getCurrentComponentDocument,
  getEditableComponentDocument,
  hasAuthoredComponentTree,
  splitComponentState,
} from './component-documents.js';
import { normalizeDefinition } from './normalization.js';

/** Maximum number of undo snapshots retained before oldest-first pruning. */
const DEFAULT_MAX_HISTORY = 50;

/**
 * Generate a unique URN for a new definition.
 * Uses a random base-36 suffix to produce a collision-resistant identifier.
 * @returns A URN string in the form `urn:formspec:<random>`.
 */
function generateUrl(): string {
  const id = Math.random().toString(36).slice(2, 10);
  return `urn:formspec:${id}`;
}

/**
 * Create a blank definition with sensible defaults.
 * Produces a minimal valid FormspecDefinition (version 1.0, empty items array)
 * with a unique generated URL.
 * @returns A new FormspecDefinition ready for use as a project seed.
 */
function createDefaultDefinition(): FormspecDefinition {
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
 * Omitted seed fields receive sensible defaults: an empty definition with a generated URL,
 * blank component/theme/mapping documents whose `targetDefinition.url` points at the
 * definition's URL, no extensions, and no releases.
 * @param options - Optional project options containing seed data and configuration.
 * @returns A fully populated ProjectState.
 */
function createDefaultState(options?: ProjectOptions): ProjectState {
  const rawDefinition = options?.seed?.definition ?? createDefaultDefinition();
  const definition = normalizeDefinition(rawDefinition);
  const url = definition.url;
  const componentState = splitComponentState(options?.seed?.component, url);

  const theme: FormspecThemeDocument = options?.seed?.theme ?? {
    targetDefinition: { url },
  };
  if (!theme.targetDefinition) {
    theme.targetDefinition = { url };
  }

  const mapping: FormspecMappingDocument = options?.seed?.mapping ?? {};

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

/** Deterministic JSON stringification used to compare item payloads independent of property order. */
function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return JSON.stringify(value);
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b));
  const pairs = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`);
  return `{${pairs.join(',')}}`;
}

type FlattenedItem = {
  path: string;
  parentPath: string;
  key: string;
  item: FormspecItem;
  snapshot: string;
  signature: string;
};

/** Flatten an item tree into comparable rows carrying both exact-path and rename-tolerant signatures. */
function flattenItems(items: FormspecItem[], prefix = '', visited?: WeakSet<object>): FlattenedItem[] {
  const seen = visited ?? new WeakSet<object>();
  const rows: FlattenedItem[] = [];
  for (const item of items) {
    if (seen.has(item as object)) continue;
    seen.add(item as object);
    const path = prefix ? `${prefix}.${item.key}` : item.key;
    const parentPath = prefix;
    const withoutChildren = { ...(item as Record<string, unknown>) };
    delete (withoutChildren as any).children;
    const signatureSource = { ...withoutChildren };
    // `snapshot` detects in-place edits at the same path; `signature` ignores the
    // key so removed/added pairs can still be matched as rename/move candidates.
    delete (signatureSource as any).key;
    rows.push({
      path,
      parentPath,
      key: item.key,
      item,
      snapshot: stableStringify(withoutChildren),
      signature: stableStringify(signatureSource),
    });
    if (item.children?.length) {
      rows.push(...flattenItems(item.children, path, seen));
    }
  }
  return rows;
}

/**
 * Central editing surface for a Formspec artifact bundle.
 *
 * A Project manages four co-evolving artifacts (definition, component, theme, mapping)
 * plus extension registries and version history. Every mutation flows through a
 * command-dispatch pipeline:
 *
 *   1. Middleware chain (may transform or reject the command)
 *   2. State clone + handler execution on the clone
 *   3. Component tree rebuild (if the handler signals structural change)
 *   4. Cross-artifact normalization (URL sync, breakpoint sync, sort invariants)
 *   5. History snapshot push (capped by `maxHistoryDepth`, pruned oldest-first)
 *   6. Change listener notification
 *
 * Key invariants:
 * - State is never mutated in place; handlers operate on a `structuredClone`.
 * - Undo/redo swap full snapshots, so every state transition is atomic.
 * - Queries (fieldPaths, statistics, diagnose, etc.) are pure reads with no caching;
 *   the consumer decides when to call them.
 * - No UI state (selection, panel visibility) lives here -- that belongs to the consumer.
 * - Each Project instance is fully independent; no shared global state.
 *
 * @see {@link createProject} for the recommended factory function.
 */
export class Project {
  /** Current project state. Mutated only via dispatch (clone-and-swap). */
  private _state: ProjectState;
  /** Stack of previous states for undo. Newest at the end. Capped by `_maxHistory`. */
  private _undoStack: ProjectState[] = [];
  /** Stack of undone states for redo. Cleared on any new dispatch. */
  private _redoStack: ProjectState[] = [];
  /** Append-only command log. Serializable -- can be persisted and replayed on a fresh project. */
  private _log: LogEntry[] = [];
  /** Active change listeners, notified after every state transition. */
  private _listeners: Set<ChangeListener> = new Set();
  /** Middleware pipeline wrapping the core dispatch. Outermost middleware runs first. */
  private _middleware: Middleware[];
  /** Maximum number of undo snapshots before oldest-first pruning. */
  private _maxHistory: number;
  /** Optional schema validator; when set, diagnose() populates structural diagnostics. */
  private _schemaValidator: ProjectOptions['schemaValidator'];

  /**
   * Create a new Project instance.
   * @param options - Optional configuration: seed state, middleware pipeline, and history depth.
   *   Omitted seed fields receive sensible defaults (see {@link createDefaultState}).
   */
  constructor(options?: ProjectOptions) {
    this._state = createDefaultState(options);
    this._maxHistory = options?.maxHistoryDepth ?? DEFAULT_MAX_HISTORY;
    this._middleware = options?.middleware ?? [];
    this._schemaValidator = options?.schemaValidator;

    // Auto-build generated layout when a definition is seeded without an
    // authored component tree.
    if (
      this._state.definition.items.length > 0 &&
      !hasAuthoredComponentTree(this._state.component) &&
      !this._state.generatedComponent.tree
    ) {
      this._rebuildComponentTree();
    }
  }

  // ── Reading state ────────────────────────────────────────────────

  /**
   * Current project state. Treat as immutable -- all mutations go through
   * {@link dispatch} or {@link batch}.
   */
  get state(): Readonly<ProjectState> {
    return this._state;
  }

  /** The form's structure and behavior: items, binds, shapes, variables, etc. */
  get definition(): Readonly<FormspecDefinition> {
    return this._state.definition;
  }

  /** The current editable component view: authored tree when present, otherwise generated layout. */
  get component(): Readonly<FormspecComponentDocument> {
    return getCurrentComponentDocument(this._state);
  }

  /** The authored Tier 3 artifact document exactly as stored in project state. */
  get artifactComponent(): Readonly<FormspecComponentDocument> {
    return this._state.component;
  }

  /** Studio-generated layout used when no authored component tree is available. */
  get generatedComponent(): Readonly<FormspecComponentDocument> {
    return this._state.generatedComponent;
  }

  /** Visual presentation: design tokens, defaults, selector overrides, breakpoints. */
  get theme(): Readonly<FormspecThemeDocument> {
    return this._state.theme;
  }

  /** Bidirectional transforms between form responses and external schemas. */
  get mapping(): Readonly<FormspecMappingDocument> {
    return this._state.mapping;
  }

  // ── Queries ─────────────────────────────────────────────────────

  /**
   * All leaf field paths in the definition item tree, in document order.
   * Paths use dot-notation (e.g., `"contact.email"`). Groups are traversed
   * but not included -- only items with `type === 'field'` appear.
   * @returns An array of dot-separated field path strings.
   */
  fieldPaths(): string[] {
    const paths: string[] = [];
    const walk = (items: FormspecItem[], prefix: string) => {
      for (const item of items) {
        const path = prefix ? `${prefix}.${item.key}` : item.key;
        if (item.type === 'field') {
          paths.push(path);
        }
        if (item.children) {
          walk(item.children, path);
        }
      }
    };
    walk(this._state.definition.items, '');
    return paths;
  }

  /**
   * Resolve an item by its dot-path within the definition tree.
   * Walks the item hierarchy segment by segment; returns `undefined` if any
   * segment is not found or if a non-group item is encountered mid-path.
   * @param path - Dot-separated path (e.g., `"address.street"`).
   * @returns The matching FormspecItem, or `undefined` if not found.
   */
  itemAt(path: string): FormspecItem | undefined {
    return itemAtPath(this._state.definition.items, path);
  }

  /**
   * Build a flat list of rows describing the response schema for the current definition.
   *
   * Each row describes one item (field or group) in terms of how it appears in a
   * submitted form response. Rows are emitted in depth-first document order, matching
   * the item tree traversal order.
   *
   * JSON type mapping:
   * - Non-repeatable groups → `"object"`
   * - Repeatable groups → `"array<object>"`
   * - Fields with dataType `integer` or `decimal` → `"number"`
   * - Fields with dataType `boolean` → `"boolean"`
   * - Everything else → `"string"`
   *
   * Bind flags (`required`, `calculated`, `conditional`) are derived from the
   * definition's `binds` array by matching each row's path against bind entries.
   *
   * @returns An array of {@link ResponseSchemaRow} objects in document order.
   */
  responseSchemaRows(): ResponseSchemaRow[] {
    const rows: ResponseSchemaRow[] = [];
    const binds = this._state.definition.binds ?? [];

    const getBindFor = (path: string) => binds.find((b: any) => b.path === path) as any | undefined;

    const jsonTypeForItem = (item: FormspecItem): ResponseSchemaRow['jsonType'] => {
      if (item.type === 'group') {
        return (item as any).repeatable ? 'array<object>' : 'object';
      }
      const dataType = (item as any).dataType as string | undefined;
      if (dataType === 'integer' || dataType === 'decimal') return 'number';
      if (dataType === 'boolean') return 'boolean';
      return 'string';
    };

    const walk = (items: FormspecItem[], prefix: string, depth: number) => {
      for (const item of items) {
        const path = prefix ? `${prefix}.${item.key}` : item.key;
        const bind = getBindFor(path);

        rows.push({
          path,
          key: item.key,
          label: item.label || item.key,
          depth,
          jsonType: jsonTypeForItem(item),
          required: bind ? 'required' in bind : false,
          calculated: bind ? 'calculate' in bind : false,
          conditional: bind ? ('relevant' in bind || 'readonly' in bind) : false,
        });

        if (item.children?.length) {
          walk(item.children, path, depth + 1);
        }
      }
    };

    walk(this._state.definition.items, '', 0);
    return rows;
  }

  /**
   * Compute form complexity metrics by walking the item tree.
   * Counts fields, groups, display items, and measures maximum nesting depth.
   * Also reports bind, shape, and variable counts from the definition.
   * @returns A {@link ProjectStatistics} snapshot of the current definition.
   */
  statistics(): ProjectStatistics {
    let fieldCount = 0, groupCount = 0, displayCount = 0, maxNestingDepth = 0;

    const walk = (items: FormspecItem[], depth: number) => {
      for (const item of items) {
        if (item.type === 'field') fieldCount++;
        else if (item.type === 'group') groupCount++;
        else if (item.type === 'display') displayCount++;
        if (depth > maxNestingDepth) maxNestingDepth = depth;
        if (item.children) walk(item.children, depth + 1);
      }
    };
    walk(this._state.definition.items, 1);

    const def = this._state.definition;
    const expressionCount = this.allExpressions().length;

    let componentNodeCount = 0;
    const tree = getCurrentComponentDocument(this._state).tree as any;
    if (tree) {
      const queue = [tree];
      while (queue.length > 0) {
        const node = queue.shift()!;
        componentNodeCount += 1;
        if (Array.isArray(node.children)) queue.push(...node.children);
      }
    }

    const mappingRules = (this._state.mapping.rules as unknown[] | undefined) ?? [];

    return {
      fieldCount,
      groupCount,
      displayCount,
      maxNestingDepth,
      bindCount: def.binds?.length ?? 0,
      shapeCount: def.shapes?.length ?? 0,
      variableCount: def.variables?.length ?? 0,
      expressionCount,
      componentNodeCount,
      mappingRuleCount: mappingRules.length,
    };
  }

  // ── Definition readers ──────────────────────────────────────────

  /**
   * All instance names declared in the definition's `instances` map.
   * Instances are external data sources referenceable in FEL via `@instance()`.
   * @returns An array of instance name strings, or empty if none declared.
   */
  instanceNames(): string[] {
    const instances = this._state.definition.instances;
    if (!instances) return [];
    return Object.keys(instances);
  }

  /**
   * All variable names declared in the definition.
   * Variables are named FEL expressions referenceable via `@variableName`.
   * @returns An array of variable name strings.
   */
  variableNames(): string[] {
    return (this._state.definition.variables ?? []).map((v: any) => v.name);
  }

  /**
   * Find all field paths that reference a given named option set.
   * Walks the item tree looking for items whose `optionSet` property
   * matches the provided name.
   * @param name - The option set name to search for.
   * @returns An array of dot-paths for fields referencing this option set.
   */
  optionSetUsage(name: string): string[] {
    const paths: string[] = [];
    const walk = (items: FormspecItem[], prefix: string) => {
      for (const item of items) {
        const path = prefix ? `${prefix}.${item.key}` : item.key;
        if ((item as any).optionSet === name) {
          paths.push(path);
        }
        if (item.children) walk(item.children, path);
      }
    };
    walk(this._state.definition.items, '');
    return paths;
  }

  /**
   * Search definition items by type, dataType, label substring, or extension usage.
   * All filter criteria are AND-ed: an item must match every specified filter field.
   * @param filter - Criteria to match against. Omitted fields are unconstrained.
   * @returns An array of matching FormspecItem objects (shallow references into the tree).
   */
  searchItems(filter: ItemFilter): FormspecItem[] {
    const results: FormspecItem[] = [];
    const walk = (items: FormspecItem[]) => {
      for (const item of items) {
        let match = true;
        if (filter.type && item.type !== filter.type) match = false;
        if (filter.dataType && (item as any).dataType !== filter.dataType) match = false;
        if (filter.label && !(item.label ?? '').toLowerCase().includes(filter.label.toLowerCase())) match = false;
        if (filter.hasExtension && !(item as any).extensions?.[filter.hasExtension]) match = false;
        if (match) results.push(item);
        if (item.children) walk(item.children);
      }
    };
    walk(this._state.definition.items);
    return results;
  }

  /**
   * Resolve the effective presentation for a field through the theme cascade.
   * Applies three tiers in order (later tiers override earlier):
   *   1. Theme defaults (global fallback)
   *   2. Matching selectors (by item type/dataType, in document order)
   *   3. Per-item overrides (keyed by field path)
   * @param fieldKey - Dot-path of the field to resolve presentation for.
   * @returns A merged record of presentation properties. Empty object if the item is not found.
   */
  effectivePresentation(fieldKey: string): Record<string, unknown> {
    const item = this.itemAt(fieldKey);
    if (!item) return {};

    const result: Record<string, unknown> = {};

    // Tier 1: defaults
    const defaults = this._state.theme.defaults as Record<string, unknown> | undefined;
    if (defaults) Object.assign(result, defaults);

    // Tier 2: selectors (document order)
    const selectors = this._state.theme.selectors as any[] | undefined;
    if (selectors) {
      for (const sel of selectors) {
        const match = sel.match;
        if (!match) continue;
        let matches = true;
        if (match.type && item.type !== match.type) matches = false;
        if (match.dataType && (item as any).dataType !== match.dataType) matches = false;
        if (matches) Object.assign(result, sel.apply);
      }
    }

    // Tier 3: per-item overrides
    const items = this._state.theme.items as Record<string, Record<string, unknown>> | undefined;
    if (items?.[fieldKey]) Object.assign(result, items[fieldKey]);

    return result;
  }

  // ── Cross-artifact queries ─────────────────────────────────────

  /**
   * Get the effective bind properties for a field path.
   * Looks up the bind entry whose `path` matches, then returns all bind
   * properties (calculate, relevant, required, readonly, constraint, etc.)
   * excluding the path itself.
   * @param path - Dot-path of the target field.
   * @returns A record of bind properties, or `undefined` if no bind exists for this path.
   */
  bindFor(path: string): Record<string, unknown> | undefined {
    const binds = this._state.definition.binds;
    if (!binds) return undefined;
    const bind = binds.find((b: any) => b.path === path);
    if (!bind) return undefined;
    // Return bind properties excluding 'path'
    const { path: _, ...props } = bind as any;
    return Object.keys(props).length > 0 ? props : undefined;
  }

  /**
   * Find the component tree node bound to a field key.
   * Performs a breadth-first search of the component tree looking for a node
   * whose `bind` property matches the given key.
   * @param fieldKey - The field key to look up in the component tree.
   * @returns The matching tree node, or `undefined` if no node is bound to this key.
   */
  componentFor(fieldKey: string): Record<string, unknown> | undefined {
    const tree = getEditableComponentDocument(this._state).tree as any;
    if (!tree) return undefined;
    const queue = [tree];
    while (queue.length > 0) {
      const node = queue.shift()!;
      if (node.bind === fieldKey) return node;
      if (node.children) queue.push(...node.children);
    }
    return undefined;
  }

  /**
   * Resolve an extension name against all loaded registries.
   * Searches registries in order, returning the first catalog entry whose name matches.
   * @param name - The extension name to look up (e.g., `"x-formspec-url"`).
   * @returns The registry entry as a record, or `undefined` if not found in any registry.
   */
  resolveExtension(name: string): Record<string, unknown> | undefined {
    for (const reg of this._state.extensions.registries) {
      const entry = reg.catalog.entries.get(name);
      if (entry) return entry as Record<string, unknown>;
    }
    return undefined;
  }

  /**
   * Find definition fields that have no corresponding node in the component tree.
   * These fields fall back to Tier 2/1 rendering (auto-generated from definition structure).
   * @returns An array of field paths that are not bound to any component tree node.
   */
  unboundItems(): string[] {
    const fieldKeys = this.fieldPaths();
    // Collect all bind values from the component tree
    const boundKeys = new Set<string>();
    const tree = getEditableComponentDocument(this._state).tree as any;
    if (tree) {
      const queue = [tree];
      while (queue.length > 0) {
        const node = queue.shift()!;
        if (node.bind) boundKeys.add(node.bind);
        if (node.children) queue.push(...node.children);
      }
    }
    return fieldKeys.filter(p => !boundKeys.has(p));
  }

  /**
   * Resolve a design token value through the two-tier cascade.
   * Checks component tokens (Tier 3) first, then theme tokens (Tier 2).
   * Platform defaults (Tier 1) are not handled here -- the consumer provides those.
   * @param key - The token key to resolve (e.g., `"spacing.md"`, `"color.primary"`).
   * @returns The resolved token value, or `undefined` if not defined at either tier.
   */
  resolveToken(key: string): string | number | undefined {
    // Tier 3: component tokens
    const compTokens = this._state.component.tokens as Record<string, unknown> | undefined;
    if (compTokens?.[key] !== undefined) return compTokens[key] as string | number;

    // Tier 2: theme tokens
    const themeTokens = this._state.theme.tokens as Record<string, unknown> | undefined;
    if (themeTokens?.[key] !== undefined) return themeTokens[key] as string | number;

    return undefined;
  }

  /**
   * Enumerate all valid data types: the 13 core types plus any dataType extensions
   * from loaded registries. Used by editors for field type selection UI.
   * @returns An array of {@link DataTypeInfo} entries with source provenance.
   */
  allDataTypes(): DataTypeInfo[] {
    const core: DataTypeInfo[] = [
      'string', 'integer', 'decimal', 'boolean', 'date', 'time', 'dateTime',
      'money', 'choice', 'multiChoice', 'attachment', 'signature', 'barcode',
    ].map(name => ({ name, source: 'core' as const }));

    // Extension dataTypes from loaded registries
    for (const reg of this._state.extensions.registries) {
      for (const [_, entry] of reg.catalog.entries) {
        const e = entry as any;
        if (e.category === 'dataType') {
          core.push({
            name: e.name,
            source: 'extension',
            baseType: e.baseType,
            registryUrl: reg.url,
          });
        }
      }
    }

    return core;
  }

  // ── FEL queries ────────────────────────────────────────────────

  private _analyzeExpression(expression: string): FELAnalysis {
    return analyzeFEL(expression, { includeCst: true });
  }

  private _resolveParseContext(context?: string | FELParseContext): FELParseContext {
    if (!context) return {};
    if (typeof context === 'string') return { targetPath: context };
    return context;
  }

  /**
   * Parse and validate a FEL expression without saving it to project state.
   * Parses with shared engine semantics; optional Studio context enables
   * scope-aware variable/reference checks for editor usage.
   * Intended for expression editor inline validation and autocomplete support.
   * @param expression - The FEL expression string to parse.
   * @param context - Optional Studio-owned editor context (`targetPath`, mapping scope).
   * @returns A {@link FELParseResult} with validity, errors, references, and function names.
   */
  parseFEL(expression: string, context?: FELParseContext): FELParseResult {
    const analysis = this._analyzeExpression(expression);
    const parseErrors: Diagnostic[] = analysis.errors.map((error) => ({
      artifact: 'definition',
      path: 'expression',
      severity: 'error',
      code: 'FEL_PARSE_ERROR',
      message: error.message,
    }));

    const semanticErrors: Diagnostic[] = [];
    if (context !== undefined && analysis.valid) {
      const available = this.availableReferences(this._resolveParseContext(context));
      const knownFieldPaths = new Set(available.fields.map((field) => normalizeIndexedPath(field.path)));
      const knownVariables = new Set([
        ...available.variables.map((variable) => variable.name),
        ...available.contextRefs
          .filter((entry) => entry.startsWith('@'))
          .map((entry) => entry.slice(1)),
      ]);

      for (const reference of analysis.references) {
        if (!knownFieldPaths.has(normalizeIndexedPath(reference))) {
          semanticErrors.push({
            artifact: 'definition',
            path: 'expression',
            severity: 'error',
            code: 'FEL_UNKNOWN_REFERENCE',
            message: `Unknown field reference "$${reference}" in this editor context`,
          });
        }
      }

      for (const variable of analysis.variables) {
        if (!knownVariables.has(variable)) {
          semanticErrors.push({
            artifact: 'definition',
            path: 'expression',
            severity: 'error',
            code: 'FEL_UNKNOWN_VARIABLE',
            message: `Unknown variable reference "@${variable}" in this editor context`,
          });
        }
      }
    }

    return {
      valid: analysis.valid && semanticErrors.length === 0,
      errors: [...parseErrors, ...semanticErrors],
      references: analysis.references,
      functions: analysis.functions,
      ast: analysis.valid && semanticErrors.length === 0 ? analysis.cst : undefined,
    };
  }

  /**
   * Enumerate the full FEL function catalog: built-in functions plus extension
   * functions from loaded registries. Used by editors for autocomplete and
   * function documentation popups.
   * @returns An array of {@link FELFunctionEntry} objects with name, category, and source.
   */
  felFunctionCatalog(): FELFunctionEntry[] {
    const catalog: FELFunctionEntry[] = getBuiltinFELFunctionCatalog().map((entry) => ({
      name: entry.name,
      category: entry.category,
      source: 'builtin',
    }));
    const seen = new Set(catalog.map((entry) => entry.name));

    // Extension functions from loaded registries
    for (const reg of this._state.extensions.registries) {
      for (const [_, entry] of reg.catalog.entries) {
        const e = entry as any;
        if (e.category === 'function' && typeof e.name === 'string' && !seen.has(e.name)) {
          catalog.push({
            name: e.name,
            category: typeof e.functionCategory === 'string'
              ? e.functionCategory
              : (typeof e.group === 'string' ? e.group : 'function'),
            source: 'extension',
            registryUrl: reg.url,
          });
          seen.add(e.name);
        }
      }
    }

    return catalog;
  }

  /**
   * Scope-aware list of valid FEL references at a given path.
   * Always includes all fields, variables, and instances. When `contextPath`
   * points to a repeatable group, also includes `@current`, `@index`, `@count`.
   * Used by expression editors for autocomplete and reference validation.
   * @param context - Optional scope context. Accepts either a dot-path or a full parse context object.
   * @returns A {@link FELReferenceSet} with fields, variables, instances, and context-specific refs.
   */
  availableReferences(context?: string | FELParseContext): FELReferenceSet {
    const resolved = this._resolveParseContext(context);
    const contextPath = resolved.targetPath;
    const fields: FELReferenceSet['fields'] = [];
    const walk = (items: FormspecItem[], prefix: string) => {
      for (const item of items) {
        const path = prefix ? `${prefix}.${item.key}` : item.key;
        if (item.type === 'field') {
          fields.push({ path, dataType: (item as any).dataType ?? 'string', label: item.label });
        }
        if (item.children) walk(item.children, path);
      }
    };
    walk(this._state.definition.items, '');

    const variables = (this._state.definition.variables ?? []).map((v: any) => ({
      name: v.name,
      expression: v.expression ?? '',
    }));

    const instances: FELReferenceSet['instances'] = [];
    const inst = this._state.definition.instances;
    if (inst) {
      for (const [name, entry] of Object.entries(inst)) {
        instances.push({ name, source: (entry as any).source });
      }
    }

    const contextRefs: string[] = [];
    // If inside a repeat group scope, add context refs.
    if (contextPath) {
      const normalized = normalizeIndexedPath(contextPath);
      const parts = normalized.split('.').filter(Boolean);
      for (let i = parts.length; i > 0; i--) {
        const candidate = parts.slice(0, i).join('.');
        const item = this.itemAt(candidate);
        if (item?.type === 'group' && (item as any).repeatable) {
          contextRefs.push('@current', '@index', '@count');
          break;
        }
      }
    }

    if (resolved.mappingContext) {
      contextRefs.push('@source', '@target');
    }

    return { fields, variables, instances, contextRefs: [...new Set(contextRefs)] };
  }

  /**
   * Enumerate all FEL expressions in the project with their artifact locations.
   * Scans bind properties (calculate, relevant, required, readonly, constraint),
   * shape constraints and activeWhen guards, and variable expressions.
   * @returns An array of {@link ExpressionLocation} entries with expression text and location paths.
   */
  allExpressions(): ExpressionLocation[] {
    const results: ExpressionLocation[] = [];
    const def = this._state.definition;
    const pushExpression = (
      expression: string | undefined,
      artifact: ExpressionLocation['artifact'],
      location: string,
    ) => {
      if (!expression || typeof expression !== 'string') return;
      results.push({ expression, artifact, location });
    };

    // Bind expressions
    for (const bind of def.binds ?? []) {
      const b = bind as any;
      for (const prop of ['calculate', 'relevant', 'required', 'readonly', 'constraint']) {
        pushExpression(b[prop], 'definition', `binds[${b.path}].${prop}`);
      }
      if (typeof b.default === 'string' && b.default.startsWith('=')) {
        pushExpression(b.default.slice(1), 'definition', `binds[${b.path}].default`);
      }
    }

    // Shape expressions
    for (const shape of def.shapes ?? []) {
      const s = shape as any;
      pushExpression(s.constraint, 'definition', `shapes[${s.id}].constraint`);
      pushExpression(s.activeWhen, 'definition', `shapes[${s.id}].activeWhen`);
      if (s.context && typeof s.context === 'object') {
        for (const [key, value] of Object.entries(s.context as Record<string, unknown>)) {
          if (typeof value === 'string') {
            pushExpression(value, 'definition', `shapes[${s.id}].context.${key}`);
          }
        }
      }
    }

    // Variable expressions
    for (const v of def.variables ?? []) {
      const va = v as any;
      pushExpression(va.expression, 'definition', `variables[${va.name}]`);
    }

    // Item-level FEL-bearing properties (visited prevents infinite recursion on circular item trees)
    const itemVisited = new WeakSet<object>();
    const walkItems = (items: FormspecItem[], prefix: string) => {
      for (const item of items) {
        if (itemVisited.has(item as object)) continue;
        itemVisited.add(item as object);
        const path = prefix ? `${prefix}.${item.key}` : item.key;
        const dynamic = item as any;
        for (const prop of ['relevant', 'required', 'readonly', 'calculate', 'constraint']) {
          if (typeof dynamic[prop] === 'string') {
            pushExpression(dynamic[prop], 'definition', `items[${path}].${prop}`);
          }
        }
        if (typeof dynamic.initialValue === 'string' && dynamic.initialValue.startsWith('=')) {
          pushExpression(dynamic.initialValue.slice(1), 'definition', `items[${path}].initialValue`);
        }
        if (item.children) walkItems(item.children, path);
      }
    };
    walkItems(def.items, '');

    // Mapping rule expressions
    const rules = (this._state.mapping as any).rules as any[] | undefined;
    if (rules) {
      for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        pushExpression(rule.expression, 'mapping', `rules[${i}].expression`);
        pushExpression(rule.condition, 'mapping', `rules[${i}].condition`);
        if (rule.reverse && typeof rule.reverse === 'object') {
          pushExpression(rule.reverse.expression, 'mapping', `rules[${i}].reverse.expression`);
          pushExpression(rule.reverse.condition, 'mapping', `rules[${i}].reverse.condition`);
        }
        if (Array.isArray(rule.innerRules)) {
          for (let j = 0; j < rule.innerRules.length; j++) {
            const inner = rule.innerRules[j];
            pushExpression(inner.expression, 'mapping', `rules[${i}].innerRules[${j}].expression`);
            pushExpression(inner.condition, 'mapping', `rules[${i}].innerRules[${j}].condition`);
          }
        }
      }
    }

    // Component document `when` guards (visited set prevents infinite recursion on circular trees)
    const componentVisited = new WeakSet<object>();
    const walkComponentNode = (node: unknown, location: string) => {
      if (!node || typeof node !== 'object') return;
      const n = node as Record<string, unknown>;
      if (componentVisited.has(n)) return;
      componentVisited.add(n);
      if (typeof n.when === 'string') {
        pushExpression(n.when, 'component', `${location}.when`);
      }
      if (Array.isArray(n.children)) {
        for (let i = 0; i < n.children.length; i++) {
          walkComponentNode(n.children[i], `${location}.children[${i}]`);
        }
      }
    };

    const componentDoc = getCurrentComponentDocument(this._state) as any;
    if (componentDoc.tree) {
      walkComponentNode(componentDoc.tree, 'tree');
    }

    const templateRegistry = componentDoc.components ?? componentDoc.customComponents;
    if (templateRegistry && typeof templateRegistry === 'object') {
      for (const [name, template] of Object.entries(templateRegistry as Record<string, unknown>)) {
        const templateTree = (template as any)?.tree;
        if (templateTree) {
          walkComponentNode(templateTree, `components[${name}].tree`);
        }
      }
    }

    return results;
  }

  /**
   * List all field paths that a FEL expression references.
   * Delegates to the regex-based field reference extractor.
   * @param expression - The FEL expression to analyze.
   * @returns An array of field path strings referenced by the expression.
   */
  expressionDependencies(expression: string): string[] {
    return getFELDependencies(expression);
  }

  /**
   * Reverse lookup: find all binds, shapes, variables, and mapping rules that
   * reference a given field. Uses substring matching on `$fieldPath` within
   * FEL expression strings.
   * @param fieldPath - The field path to search for as a dependency.
   * @returns A {@link FieldDependents} record grouping dependents by artifact type.
   */
  fieldDependents(fieldPath: string): FieldDependents {
    const result: FieldDependents = { binds: [], shapes: [], variables: [], mappingRules: [] };
    const def = this._state.definition;
    const target = normalizeIndexedPath(fieldPath);
    const expressionReferencesField = (expression: string): boolean => {
      const refs = getFELDependencies(expression).map(ref => normalizeIndexedPath(ref));
      return refs.includes(target);
    };

    // Check binds
    for (const bind of def.binds ?? []) {
      const b = bind as any;
      for (const prop of ['calculate', 'relevant', 'required', 'readonly', 'constraint']) {
        if (typeof b[prop] === 'string' && expressionReferencesField(b[prop])) {
          result.binds.push({ path: b.path, property: prop });
        }
      }
      if (typeof b.default === 'string' && b.default.startsWith('=') && expressionReferencesField(b.default.slice(1))) {
        result.binds.push({ path: b.path, property: 'default' });
      }
    }

    // Check shapes
    for (const shape of def.shapes ?? []) {
      const s = shape as any;
      if (typeof s.constraint === 'string' && expressionReferencesField(s.constraint)) {
        result.shapes.push({ id: s.id, property: 'constraint' });
      }
      if (typeof s.activeWhen === 'string' && expressionReferencesField(s.activeWhen)) {
        result.shapes.push({ id: s.id, property: 'activeWhen' });
      }
      if (s.context && typeof s.context === 'object') {
        for (const [key, value] of Object.entries(s.context as Record<string, unknown>)) {
          if (typeof value === 'string' && expressionReferencesField(value)) {
            result.shapes.push({ id: s.id, property: `context.${key}` });
          }
        }
      }
    }

    // Check variables
    for (const v of def.variables ?? []) {
      const va = v as any;
      if (typeof va.expression === 'string' && expressionReferencesField(va.expression)) {
        result.variables.push(va.name);
      }
    }

    // Check mapping rules
    const rules = (this._state.mapping as any).rules;
    if (rules) {
      for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        const sourcePath = typeof rule.sourcePath === 'string' ? normalizeIndexedPath(rule.sourcePath) : undefined;
        const dependsOnField =
          sourcePath === target
          || (typeof rule.expression === 'string' && expressionReferencesField(rule.expression))
          || (typeof rule.condition === 'string' && expressionReferencesField(rule.condition));
        if (dependsOnField) {
          result.mappingRules.push(i);
        }
      }
    }

    return result;
  }

  /**
   * Find all bind paths whose FEL expressions reference a given variable.
   * Uses substring matching on `@variableName` within bind expression strings.
   * @param variableName - The variable name to search for (without `@` prefix).
   * @returns Deduplicated array of bind paths that reference this variable.
   */
  variableDependents(variableName: string): string[] {
    const paths: string[] = [];
    const referencesVariable = (expression: string): boolean => {
      const analysis = analyzeFEL(expression);
      return analysis.valid && analysis.variables.includes(variableName);
    };

    for (const bind of this._state.definition.binds ?? []) {
      const b = bind as any;
      for (const prop of ['calculate', 'relevant', 'required', 'readonly', 'constraint']) {
        if (typeof b[prop] === 'string' && referencesVariable(b[prop])) {
          paths.push(b.path);
          break;
        }
      }
    }

    return [...new Set(paths)];
  }

  /**
   * Build a full dependency graph across all FEL expressions in the project.
   * Nodes represent fields, variables, and shapes. Edges represent FEL references
   * from binds, variables, and shape expressions. Cycles are detected with a
   * DFS over the normalized node graph.
   * @returns A {@link DependencyGraph} with nodes, edges, and a cycles array.
   */
  dependencyGraph(): DependencyGraph {
    const nodes: DependencyGraph['nodes'] = [];
    const edges: DependencyGraph['edges'] = [];
    const def = this._state.definition;
    const nodeIds = new Set<string>();
    const addNode = (id: string, type: 'field' | 'variable' | 'shape') => {
      if (nodeIds.has(id)) return;
      nodeIds.add(id);
      nodes.push({ id, type });
    };
    const addEdge = (from: string, to: string, via: string) => {
      edges.push({ from, to, via });
    };
    const addExpressionEdges = (expression: string, to: string, via: string) => {
      const analysis = analyzeFEL(expression);
      if (!analysis.valid) return;
      // Normalize field paths before graph insertion so repeat indices do not
      // fragment the graph into separate nodes for the same logical field.
      for (const ref of analysis.references) {
        addEdge(normalizeIndexedPath(ref), normalizeIndexedPath(to), via);
      }
      for (const variable of analysis.variables) {
        addEdge(variable, normalizeIndexedPath(to), via);
      }
    };

    // Add field nodes
    for (const path of this.fieldPaths()) {
      addNode(path, 'field');
    }

    // Add variable nodes
    for (const v of def.variables ?? []) {
      const va = v as any;
      addNode(va.name, 'variable');
    }

    // Add shape nodes
    for (const s of def.shapes ?? []) {
      addNode((s as any).id, 'shape');
    }

    // Build edges from binds
    for (const bind of def.binds ?? []) {
      const b = bind as any;
      for (const prop of ['calculate', 'relevant', 'required', 'readonly', 'constraint']) {
        if (typeof b[prop] === 'string') {
          addExpressionEdges(b[prop], b.path, prop);
        }
      }
      if (typeof b.default === 'string' && b.default.startsWith('=')) {
        addExpressionEdges(b.default.slice(1), b.path, 'default');
      }
    }

    // Build edges from variables
    for (const v of def.variables ?? []) {
      const va = v as any;
      if (typeof va.expression === 'string') {
        addExpressionEdges(va.expression, va.name, 'variable');
      }
    }

    // Build edges from shapes
    for (const shape of def.shapes ?? []) {
      const s = shape as any;
      if (typeof s.constraint === 'string') {
        addExpressionEdges(s.constraint, s.id, 'shape.constraint');
      }
      if (typeof s.activeWhen === 'string') {
        addExpressionEdges(s.activeWhen, s.id, 'shape.activeWhen');
      }
      if (s.context && typeof s.context === 'object') {
        for (const [key, value] of Object.entries(s.context as Record<string, unknown>)) {
          if (typeof value === 'string') {
            addExpressionEdges(value, s.id, `shape.context.${key}`);
          }
        }
      }
    }

    // Detect cycles using DFS over known node IDs only.
    const adjacency = new Map<string, Set<string>>();
    for (const edge of edges) {
      if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) continue;
      const toSet = adjacency.get(edge.from) ?? new Set<string>();
      toSet.add(edge.to);
      adjacency.set(edge.from, toSet);
    }

    const visited = new Set<string>();
    const inStack = new Set<string>();
    const stack: string[] = [];
    const cycles: string[][] = [];
    const cycleKeys = new Set<string>();

    const dfs = (node: string) => {
      visited.add(node);
      inStack.add(node);
      stack.push(node);

      for (const next of adjacency.get(node) ?? []) {
        if (!visited.has(next)) {
          dfs(next);
          continue;
        }
        if (!inStack.has(next)) continue;
        const start = stack.indexOf(next);
        if (start < 0) continue;
        const cycle = stack.slice(start);
        const key = cycle.join('->');
        if (!cycleKeys.has(key)) {
          cycleKeys.add(key);
          cycles.push(cycle);
        }
      }

      stack.pop();
      inStack.delete(node);
    };

    for (const node of nodeIds) {
      if (!visited.has(node)) dfs(node);
    }

    return { nodes, edges, cycles };
  }

  // ── Extension queries ──────────────────────────────────────────

  /**
   * Enumerate loaded extension registries with summary metadata.
   * @returns An array of {@link RegistrySummary} objects (URL and entry count per registry).
   */
  listRegistries(): RegistrySummary[] {
    return this._state.extensions.registries.map(r => ({
      url: r.url,
      entryCount: r.catalog.entries.size,
    }));
  }

  /**
   * Browse extension entries across all loaded registries with optional filtering.
   * Filter criteria (category, status, namePattern) are AND-ed.
   * @param filter - Optional criteria to narrow results. Omitted fields are unconstrained.
   * @returns An array of extension entry records matching the filter.
   */
  browseExtensions(filter?: ExtensionFilter): Record<string, unknown>[] {
    const results: Record<string, unknown>[] = [];
    for (const reg of this._state.extensions.registries) {
      for (const [_, entry] of reg.catalog.entries) {
        const e = entry as any;
        if (filter?.category && e.category !== filter.category) continue;
        if (filter?.status && e.status !== filter.status) continue;
        if (filter?.namePattern && !e.name?.includes(filter.namePattern)) continue;
        results.push(e);
      }
    }
    return results;
  }

  // ── Versioning queries ─────────────────────────────────────────

  /**
   * Compute a structured diff from a baseline (or a specific published version)
   * to the current definition state. Tracks same-path edits, then pairs removed
   * and added rows with identical non-key signatures to detect renames/moves
   * before emitting plain additions/removals.
   * @param fromVersion - Optional version string to diff from. If omitted, uses
   *   the creation-time baseline. Throws if the specified version is not found.
   * @returns An array of {@link Change} objects with impact classification.
   */
  diffFromBaseline(fromVersion?: string): Change[] {
    let baseline: FormspecDefinition;
    if (fromVersion) {
      const release = this._state.versioning.releases.find(r => r.version === fromVersion);
      if (!release) throw new Error(`Version not found: ${fromVersion}`);
      baseline = release.snapshot;
    } else {
      baseline = this._state.versioning.baseline;
    }

    const current = this._state.definition;
    const changes: Change[] = [];
    const baselineRows = flattenItems(baseline.items);
    const currentRows = flattenItems(current.items);
    const baselineByPath = new Map(baselineRows.map((row) => [row.path, row]));
    const currentByPath = new Map(currentRows.map((row) => [row.path, row]));

    const baselinePaths = new Set(baselineByPath.keys());
    const currentPaths = new Set(currentByPath.keys());

    // Same-path item modifications.
    for (const path of baselinePaths) {
      if (!currentPaths.has(path)) continue;
      const previous = baselineByPath.get(path)!;
      const next = currentByPath.get(path)!;
      if (previous.snapshot === next.snapshot) continue;
      changes.push({
        type: 'modified',
        target: 'item',
        path,
        impact: 'compatible',
        before: previous.item,
        after: next.item,
      });
    }

    const removedPaths = [...baselinePaths].filter((path) => !currentPaths.has(path));
    const addedPaths = [...currentPaths].filter((path) => !baselinePaths.has(path));
    const unmatchedAdded = new Set(addedPaths);

    // Pair removed/added rows greedily to collapse structural churn into a
    // rename/move when the underlying item payload is otherwise unchanged.
    for (const removedPath of removedPaths) {
      const removed = baselineByPath.get(removedPath)!;
      const pairedPath = [...unmatchedAdded].find((candidatePath) => {
        const added = currentByPath.get(candidatePath)!;
        return added.signature === removed.signature;
      });
      if (!pairedPath) continue;

      const added = currentByPath.get(pairedPath)!;
      unmatchedAdded.delete(pairedPath);

      const renamedOnly = removed.parentPath === added.parentPath && removed.key !== added.key;
      changes.push({
        type: renamedOnly ? 'renamed' : 'moved',
        target: 'item',
        path: removedPath,
        impact: 'breaking',
        before: removedPath,
        after: pairedPath,
        description: `${removedPath} -> ${pairedPath}`,
      });
    }

    const pairedRemoved = new Set(
      changes
        .filter((change) => change.type === 'renamed' || change.type === 'moved')
        .map((change) => change.path),
    );

    for (const removedPath of removedPaths) {
      if (pairedRemoved.has(removedPath)) continue;
      changes.push({
        type: 'removed',
        target: 'item',
        path: removedPath,
        impact: 'breaking',
      });
    }

    for (const addedPath of unmatchedAdded) {
      changes.push({
        type: 'added',
        target: 'item',
        path: addedPath,
        impact: 'compatible',
      });
    }

    if (baseline.title !== current.title) {
      changes.push({
        type: 'modified',
        target: 'metadata',
        path: 'title',
        impact: 'cosmetic',
        before: baseline.title,
        after: current.title,
      });
    }

    return changes.sort((a, b) => {
      if (a.target !== b.target) return a.target.localeCompare(b.target);
      if (a.path !== b.path) return a.path.localeCompare(b.path);
      return a.type.localeCompare(b.type);
    });
  }

  /**
   * Preview what the changelog would look like without committing to a publish.
   * Computes a diff from the baseline, determines the aggregate semver impact
   * (breaking > compatible > cosmetic), and packages it as a {@link FormspecChangelog}.
   * @returns A changelog object with version range, impact classification, and change list.
   */
  previewChangelog(): FormspecChangelog {
    const changes = this.diffFromBaseline();
    let semverImpact: 'breaking' | 'compatible' | 'cosmetic' = 'cosmetic';
    for (const c of changes) {
      if (c.impact === 'breaking') { semverImpact = 'breaking'; break; }
      if (c.impact === 'compatible') semverImpact = 'compatible';
    }

    return {
      definitionUrl: this._state.definition.url,
      fromVersion: this._state.versioning.baseline.version,
      toVersion: this._state.definition.version,
      semverImpact,
      changes,
    };
  }

  // ── Diagnostics ────────────────────────────────────────────────

  /**
   * On-demand multi-pass validation of the current project state.
   * Not continuously computed -- the consumer decides when to call it
   * (on save, on panel open, on a debounce timer, etc.).
   *
   * Passes: **structural** (when {@link ProjectOptions.schemaValidator} is set — JSON Schema
   * validation via formspec-engine, using shallow+per-node for component to avoid hangs),
   * **expressions** (FEL parse/analysis), **extensions** (registry-backed checks on definition
   * items), **consistency** (component binds, mapping paths, theme selectors).
   *
   * @returns A {@link Diagnostics} object with categorized diagnostic arrays and severity counts.
   */
  diagnose(): Diagnostics {
    const log = (msg: string) => {
      if (typeof process !== 'undefined' && process.env?.DIAGNOSE_DEBUG) process.stderr.write(`[diagnose] ${msg}\n`);
    };
    log('start');
    const structural: Diagnostic[] = [];
    const expressions: Diagnostic[] = [];
    const extensions: Diagnostic[] = [];
    const consistency: Diagnostic[] = [];

    // Structural: JSON Schema validation when a validator was provided (engine shallow+per-node for component).
    if (this._schemaValidator) {
      log('structural...');
      const artifacts: Array<{ artifact: Diagnostic['artifact']; doc: unknown; type: DocumentType }> = [
        { artifact: 'definition', doc: this._state.definition, type: 'definition' },
        { artifact: 'component', doc: getCurrentComponentDocument(this._state), type: 'component' },
        { artifact: 'theme', doc: this._state.theme, type: 'theme' },
        { artifact: 'mapping', doc: this._state.mapping, type: 'mapping' },
      ];
      for (const { artifact, doc, type } of artifacts) {
        if (doc == null || (typeof doc === 'object' && Object.keys(doc).length === 0)) continue;
        const result = this._schemaValidator.validate(doc, type);
        if (result.documentType === null && result.errors.length > 0) {
          structural.push({
            artifact,
            path: '$',
            severity: 'error',
            code: 'E100',
            message: result.errors[0].message,
          });
        } else {
          for (const e of result.errors) {
            structural.push({
              artifact,
              path: e.path.startsWith('$.') ? e.path.slice(2) : e.path === '$' ? '$' : e.path,
              severity: 'error',
              code: 'E101',
              message: e.message,
            });
          }
        }
      }
      log('structural done');
    }

    // Expression diagnostics: parser-backed FEL analysis for all indexed expressions.
    log('allExpressions...');
    const exprs = this.allExpressions();
    log(`allExpressions done (${exprs.length} exprs)`);
    for (const expr of exprs) {
      const analysis = analyzeFEL(expr.expression);
      if (analysis.valid) continue;
      for (const error of analysis.errors) {
        expressions.push({
          artifact: expr.artifact,
          path: expr.location,
          severity: 'error',
          code: 'FEL_PARSE_ERROR',
          message: error.message,
        });
      }
    }
    log('expressions pass done');

    // Extension diagnostics: shared engine helper over plain definition items.
    log('extensions...');
    const extensionLookup = new Map<string, Record<string, unknown>>();
    for (const registry of this._state.extensions.registries) {
      for (const [name, entry] of registry.catalog.entries) {
        if (!extensionLookup.has(name)) {
          extensionLookup.set(name, entry as Record<string, unknown>);
        }
      }
    }
    for (const issue of validateExtensionUsage(this._state.definition.items, {
      resolveEntry: (name) => extensionLookup.get(name) as any,
    })) {
      extensions.push({
        artifact: 'definition',
        path: issue.path,
        severity: issue.severity,
        code: issue.code,
        message: issue.message,
      });
    }
    log('extensions done');

    log('flattenItems...');
    const itemRows = flattenItems(this._state.definition.items);
    log(`flattenItems done (${itemRows.length} rows)`);
    const itemKeySet = new Set(itemRows.map((row) => row.key));
    const itemPathSet = new Set(itemRows.map((row) => row.path));
    const fieldRows = itemRows.filter((row) => row.item.type === 'field');
    const fieldPaths = new Set(fieldRows.map((row) => row.path));
    const normalizedItemPaths = new Set(itemRows.map((row) => normalizeIndexedPath(row.path)));

    // Consistency: orphan or mis-bound component nodes
    const itemTypeByKey = new Map(itemRows.map((row) => [row.key, row.item.type] as const));
    const itemTypeByPath = new Map(itemRows.map((row) => [row.path, row.item.type] as const));
    // Components that legitimately bind to group/repeat items rather than fields
    const GROUP_AWARE_COMPONENTS = new Set([
      'Stack', 'Grid', 'Columns', 'Panel', 'Collapsible',
      'DataTable', 'Accordion', 'Tabs',
    ]);
    log('component tree...');
    const tree = getCurrentComponentDocument(this._state).tree as any;
    if (tree) {
      const visited = new WeakSet<object>();
      const queue: unknown[] = [tree];
      let componentNodes = 0;
      while (queue.length > 0) {
        componentNodes++;
        if (componentNodes % 500 === 0) log(`component tree node ${componentNodes}`);
        const raw = queue.shift();
        if (!raw || typeof raw !== 'object') continue;
        if (visited.has(raw)) continue;
        visited.add(raw);
        const node = raw as { bind?: string; component?: string; children?: unknown[] };
        if (node.bind) {
          const bindExists = itemKeySet.has(node.bind) || itemPathSet.has(node.bind);
          if (!bindExists) {
            consistency.push({
              artifact: 'component',
              path: node.bind,
              severity: 'warning',
              code: 'ORPHAN_COMPONENT_BIND',
              message: `Component node bound to "${node.bind}" but no such item exists in the definition`,
            });
          } else {
            // Check if a non-group-aware component is bound to a group item (fields and display items are fine)
            const itemType = itemTypeByKey.get(node.bind) ?? itemTypeByPath.get(node.bind);
            if (itemType === 'group' && !GROUP_AWARE_COMPONENTS.has(node.component ?? '')) {
              consistency.push({
                artifact: 'component',
                path: node.bind,
                severity: 'warning',
                code: 'DISPLAY_ITEM_BIND',
                message: `Component "${node.component}" is bound to "${node.bind}" which is a group item, not a field — no value to display`,
              });
            }
          }
        }
        if (Array.isArray(node.children)) {
          for (const child of node.children) {
            if (child && typeof child === 'object' && !visited.has(child as object)) queue.push(child);
          }
        }
      }
      log(`component tree done (${componentNodes} nodes)`);
    }

    // Consistency: stale mapping rule source paths
    log('consistency mapping/theme...');
    const rules = (this._state.mapping as any).rules as any[] | undefined;
    if (rules) {
      for (let i = 0; i < rules.length; i++) {
        const sp = rules[i].sourcePath;
        const isKnownPath = (p: string): boolean => {
          const norm = normalizeIndexedPath(p);
          if (normalizedItemPaths.has(norm)) return true;
          // Allow sub-property paths of known items (e.g. money field → .amount/.currency)
          const dot = norm.lastIndexOf('.');
          return dot > 0 && normalizedItemPaths.has(norm.slice(0, dot));
        };
        if (typeof sp === 'string' && !isKnownPath(sp)) {
          consistency.push({
            artifact: 'mapping',
            path: `rules[${i}].sourcePath`,
            severity: 'warning',
            code: 'STALE_MAPPING_SOURCE',
            message: `Mapping rule source path "${sp}" does not match any field in the definition`,
          });
        }
      }
    }

    // Consistency: theme selector matches and stale item/page references.
    const selectors = (this._state.theme as any).selectors as any[] | undefined;
    if (Array.isArray(selectors)) {
      for (let i = 0; i < selectors.length; i++) {
        const selector = selectors[i];
        const match = selector?.match;
        if (!match || typeof match !== 'object') continue;
        const hasMatch = itemRows.some((row) => {
          const asAny = row.item as any;
          if (typeof match.type === 'string' && row.item.type !== match.type) return false;
          if (typeof match.dataType === 'string' && asAny.dataType !== match.dataType) return false;
          return true;
        });
        if (!hasMatch) {
          consistency.push({
            artifact: 'theme',
            path: `selectors[${i}]`,
            severity: 'warning',
            code: 'UNMATCHED_THEME_SELECTOR',
            message: 'Theme selector does not match any current definition item',
          });
        }
      }
    }

    const themeItems = (this._state.theme as any).items as Record<string, unknown> | undefined;
    if (themeItems) {
      for (const key of Object.keys(themeItems)) {
        if (!itemKeySet.has(key) && !fieldPaths.has(key)) {
          consistency.push({
            artifact: 'theme',
            path: `items.${key}`,
            severity: 'warning',
            code: 'STALE_THEME_ITEM_OVERRIDE',
            message: `Theme item override "${key}" does not match any item key in the definition`,
          });
        }
      }
    }

    const pages = (this._state.theme as any).pages as any[] | undefined;
    if (Array.isArray(pages)) {
      for (let i = 0; i < pages.length; i++) {
        const regions = pages[i]?.regions;
        if (!Array.isArray(regions)) continue;
        for (let j = 0; j < regions.length; j++) {
          const key = regions[j]?.key;
          if (typeof key !== 'string') continue;
          if (itemKeySet.has(key) || fieldPaths.has(key)) continue;
          consistency.push({
            artifact: 'theme',
            path: `pages[${i}].regions[${j}].key`,
            severity: 'warning',
            code: 'STALE_THEME_REGION_KEY',
            message: `Theme page region key "${key}" does not match any item key in the definition`,
          });
        }
      }
    }

    // Consistency: root-level non-group items in paged definitions
    const defPageMode = (this._state.definition as any).formPresentation?.pageMode;
    if (defPageMode === 'wizard' || defPageMode === 'tabs') {
      for (const item of this._state.definition.items) {
        if (item.type !== 'group') {
          consistency.push({
            artifact: 'definition',
            path: item.key,
            severity: 'warning',
            code: 'PAGED_ROOT_NON_GROUP',
            message: `Root-level ${item.type} "${item.key}" is not inside a page group — it will be hidden in ${defPageMode} mode`,
          });
        }
      }
    }

    log('consistency done');
    // Aggregate counts
    const all = [...structural, ...expressions, ...extensions, ...consistency];
    const counts = { error: 0, warning: 0, info: 0 };
    for (const d of all) {
      counts[d.severity]++;
    }

    log('done');
    return { structural, expressions, extensions, consistency, counts };
  }

  // ── Export ──────────────────────────────────────────────────────

  /**
   * Serialize the four core artifacts as standalone JSON-serializable documents.
   * Returns a deep clone so the caller can freely mutate the result without
   * affecting project state. Extensions and versioning state are excluded.
   * @returns A {@link ProjectBundle} containing definition, component, theme, and mapping.
   */
  export(): ProjectBundle {
    return structuredClone({
      definition: this._state.definition,
      component: this._state.component,
      theme: this._state.theme,
      mapping: this._state.mapping,
    });
  }

  // ── History ──────────────────────────────────────────────────────

  /** Whether there is at least one state snapshot on the undo stack. */
  get canUndo(): boolean {
    return this._undoStack.length > 0;
  }

  /** Whether there is at least one state snapshot on the redo stack. */
  get canRedo(): boolean {
    return this._redoStack.length > 0;
  }

  /**
   * Full command log. Serializable -- can be persisted and replayed on a
   * fresh project to reconstruct state.
   */
  get log(): readonly LogEntry[] {
    return this._log;
  }

  /**
   * Clear both the undo and redo stacks without modifying the current state.
   * Useful after programmatic seeding/setup operations where the resulting
   * history entries should not be part of the authoring history.
   * Does not trigger change listeners.
   */
  resetHistory(): void {
    this._undoStack.length = 0;
    this._redoStack.length = 0;
  }

  /**
   * Restore the most recent pre-command state snapshot.
   * Pushes the current state onto the redo stack, pops from the undo stack,
   * and notifies listeners with source `'undo'`.
   * @returns `true` if undo was performed, `false` if the undo stack was empty.
   */
  undo(): boolean {
    if (!this.canUndo) return false;
    this._redoStack.push(this._state);
    this._state = this._undoStack.pop()!;
    this._notify({ type: 'undo', payload: {} }, { rebuildComponentTree: false }, 'undo');
    return true;
  }

  /**
   * Re-apply the most recently undone state.
   * Pushes the current state onto the undo stack, pops from the redo stack,
   * and notifies listeners with source `'redo'`.
   * @returns `true` if redo was performed, `false` if the redo stack was empty.
   */
  redo(): boolean {
    if (!this.canRedo) return false;
    this._undoStack.push(this._state);
    this._state = this._redoStack.pop()!;
    this._notify({ type: 'redo', payload: {} }, { rebuildComponentTree: false }, 'redo');
    return true;
  }

  // ── Change notification ──────────────────────────────────────────

  /**
   * Subscribe to state changes. The listener is called after every dispatch,
   * batch, undo, or redo with the new state and a change event describing
   * what triggered the transition.
   * @param listener - Callback receiving the new state and change event.
   * @returns An unsubscribe function. Call it to remove the listener.
   */
  onChange(listener: ChangeListener): () => void {
    this._listeners.add(listener);
    return () => { this._listeners.delete(listener); };
  }

  /**
   * Notify all registered change listeners of a state transition.
   * @param command - The command (or synthetic command for undo/redo/batch) that caused the change.
   * @param result - The command result describing side effects.
   * @param source - The transition origin: `'dispatch'`, `'batch'`, `'undo'`, or `'redo'`.
   */
  private _notify(command: AnyCommand, result: CommandResult, source: string): void {
    for (const listener of this._listeners) {
      listener(this._state, { command, result, source });
    }
  }

  /**
   * Post-dispatch normalization: enforce cross-artifact invariants.
   * Runs after every dispatch, batch, undo, and redo. Current invariants:
   * - Component and theme `targetDefinition.url` stay in sync with `definition.url`.
   * - Theme breakpoints are sorted by `minWidth` ascending.
   * - Component breakpoints inherit from theme when not independently set.
   */
  private _normalize(): void {
    const url = this._state.definition.url;

    // Sync targetDefinition.url on component, generated layout, and theme
    if (this._state.component.targetDefinition) {
      this._state.component.targetDefinition.url = url;
    }
    if (this._state.generatedComponent.targetDefinition) {
      this._state.generatedComponent.targetDefinition.url = url;
    }
    if (this._state.theme.targetDefinition) {
      this._state.theme.targetDefinition.url = url;
    }

    // Sort theme breakpoints by minWidth ascending
    const themeBp = this._state.theme.breakpoints;
    if (themeBp) {
      const sorted = Object.entries(themeBp).sort((a, b) => a[1] - b[1]);
      const fresh: Record<string, number> = {};
      for (const [name, minWidth] of sorted) fresh[name] = minWidth;
      this._state.theme.breakpoints = fresh;
    }

    // Sync component breakpoints from theme when not independently set
    if (!this._state.component.breakpoints && themeBp) {
      this._state.component.breakpoints = { ...this._state.theme.breakpoints };
    }
  }

  /**
   * Full rebuild of the component tree to mirror the definition item hierarchy.
   * Triggered when a command's result signals `rebuildComponentTree: true`
   * (e.g., after adding, deleting, or moving items).
   *
   * Preserves existing bound node properties (widget overrides, styles) and
   * unbound layout nodes (appended at root). The algorithm:
   *   1. Collect all existing bound nodes by `bind` key (deep traversal).
   *   2. Rebuild tree from definition hierarchy, reusing existing nodes where available.
   *   3. Append preserved unbound layout nodes at root level.
   */
  private _markGeneratedComponentDoc(): void {
    const component = this._state.generatedComponent as Record<string, unknown>;
    component['x-studio-generated'] = true;
  }

  private _rebuildComponentTree(): void {
    type TreeNode = { component: string; bind?: string; nodeId?: string; children?: TreeNode[]; [k: string]: unknown };

    const tree = (this._state.generatedComponent.tree as TreeNode) ?? { component: 'Stack', nodeId: 'root', children: [] };

    // ── Phase 1: Snapshot top-level layout wrappers with their full subtrees ──
    // A "top-level" layout node is one whose parent is NOT a layout node.
    // Nested layout nodes are captured inside their parent's subtree snapshot.
    interface WrapperSnapshot {
      wrapper: TreeNode;  // deep clone of layout node + children
      parentRef: { bind?: string; nodeId?: string };
      position: number;   // index within parent's children
    }

    const wrapperSnapshots: WrapperSnapshot[] = [];

    const snapshotWrappers = (parent: TreeNode) => {
      const children = parent.children ?? [];
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child._layout) {
          wrapperSnapshots.push({
            wrapper: structuredClone(child),
            parentRef: parent.bind ? { bind: parent.bind } : { nodeId: parent.nodeId! },
            position: i,
          });
          // Don't recurse into layout node — nested layouts are part of this snapshot
        } else if (child.children) {
          snapshotWrappers(child);
        }
      }
    };
    snapshotWrappers(tree);

    // ── Phase 2: Collect existing bound/display nodes and rebuild flat tree ──
    const existingBound = new Map<string, TreeNode>();
    const existingDisplay = new Map<string, TreeNode>();

    const collectExisting = (node: TreeNode, parentPath = '') => {
      for (const child of node.children ?? []) {
        if (child._layout) {
          // Recurse into layout children to collect bound/display nodes inside
          const collectDeep = (n: TreeNode, path: string) => {
            for (const c of n.children ?? []) {
              if (c.bind) {
                const cPath = path ? `${path}.${c.bind}` : c.bind;
                existingBound.set(cPath, c);
                collectDeep(c, cPath);
              } else if (c.nodeId && !c._layout) {
                const cPath = path ? `${path}.${c.nodeId}` : c.nodeId;
                existingDisplay.set(cPath, c);
              } else if (c._layout) {
                collectDeep(c, path);
              }
            }
          };
          collectDeep(child, parentPath);
        } else if (child.bind) {
          const path = parentPath ? `${parentPath}.${child.bind}` : child.bind;
          existingBound.set(path, child);
          if (child.children) collectExisting(child, path);
        } else if (child.nodeId) {
          const path = parentPath ? `${parentPath}.${child.nodeId}` : child.nodeId;
          existingDisplay.set(path, child);
        }
      }
    };
    collectExisting(tree);

    const buildNode = (item: FormspecItem, parentPath = ''): TreeNode => {
      const itemPath = parentPath ? `${parentPath}.${item.key}` : item.key;
      let node: TreeNode;

      if (item.type === 'display') {
        const existing = existingDisplay.get(itemPath);
        if (existing) {
          node = { ...existing, text: item.label ?? '' };
          existingDisplay.delete(itemPath);
        } else {
          node = { component: 'Text', nodeId: item.key, text: item.label ?? '' };
        }
      } else {
        const existing = existingBound.get(itemPath);
        if (existing) {
          node = { ...existing };
        } else {
          node = { component: this._defaultComponent(item), bind: item.key };
        }
      }

      if (item.children && item.children.length > 0) {
        node.children = item.children.map(child => buildNode(child, itemPath));
      } else if (item.type === 'group') {
        node.children = [];
      } else {
        delete node.children;
      }

      return node;
    };

    // Build all item nodes
    const builtNodes: TreeNode[] = this._state.definition.items.map(item => buildNode(item));

    // ── Page-aware distribution ──
    // Reads formPresentation.pageMode (definition.schema.json) and theme.pages
    // (theme.schema.json) to generate schema-conformant component trees:
    //   wizard → Wizard > Page[] (component.schema.json: Wizard childConstraint "Page only")
    //   tabs   → Tabs > Page[]   (component.schema.json: Tabs reads tab labels from Page titles)
    //   single → Stack > items[] (flat, current behavior)
    const def = this._state.definition as any;
    const pageMode: string = def.formPresentation?.pageMode ?? 'single';
    const themePages = (this._state.theme.pages ?? []) as any[];

    let newRoot: TreeNode;

    if (themePages.length > 0 && (pageMode === 'wizard' || pageMode === 'tabs')) {
      // Build key → node lookup (bind for fields/groups, nodeId for display items)
      const nodeByKey = new Map<string, TreeNode>();
      for (const node of builtNodes) {
        const key = node.bind ?? node.nodeId;
        if (key) nodeByKey.set(key, node);
      }

      // Create Page nodes and distribute items by region assignment
      const pageNodes: TreeNode[] = [];
      const assigned = new Set<string>();

      for (const themePage of themePages) {
        const pageNode: TreeNode = {
          component: 'Page',
          nodeId: (themePage as any).id,
          title: (themePage as any).title,
          ...((themePage as any).description !== undefined && { description: (themePage as any).description }),
          children: [],
        };

        for (const region of ((themePage as any).regions ?? []) as any[]) {
          if (region.key && nodeByKey.has(region.key)) {
            pageNode.children!.push(nodeByKey.get(region.key)!);
            assigned.add(region.key);
          }
        }

        pageNodes.push(pageNode);
      }

      // Unassigned items: collect those not placed in any page
      const unassigned = builtNodes.filter(n => {
        const key = n.bind ?? n.nodeId;
        return key && !assigned.has(key);
      });

      // Wizard childConstraint: "Page only" — wrap unassigned in auto-generated Page
      if (pageMode === 'wizard') {
        if (unassigned.length > 0) {
          pageNodes.push({
            component: 'Page',
            nodeId: '_unassigned',
            title: 'Other',
            children: unassigned,
          });
        }
        newRoot = { component: 'Wizard', nodeId: 'root', children: pageNodes };
      } else {
        // Tabs mode: component.schema.json Tabs reads tab labels from child Page titles
        if (unassigned.length > 0) {
          pageNodes.push({
            component: 'Page',
            nodeId: '_unassigned',
            title: 'Other',
            children: unassigned,
          });
        }
        newRoot = { component: 'Tabs', nodeId: 'root', children: pageNodes };
      }
    } else {
      // Flat Stack (current behavior — single mode or no pages)
      newRoot = { component: 'Stack', nodeId: 'root', children: builtNodes };
    }

    // ── Phase 3: Re-insert layout wrappers ──
    // For each snapshot, update its bound/display children with rebuilt versions,
    // remove stale children, then insert at the right position.

    const findInTree = (root: TreeNode, ref: { bind?: string; nodeId?: string }): { parent: TreeNode; index: number; node: TreeNode } | undefined => {
      if (ref.nodeId && root.nodeId === ref.nodeId) return { parent: root, index: -1, node: root };
      if (ref.bind && root.bind === ref.bind) return { parent: root, index: -1, node: root };
      const stack: TreeNode[] = [root];
      while (stack.length) {
        const p = stack.pop()!;
        for (let i = 0; i < (p.children?.length ?? 0); i++) {
          const c = p.children![i];
          if (ref.nodeId && c.nodeId === ref.nodeId) return { parent: p, index: i, node: c };
          if (ref.bind && c.bind === ref.bind) return { parent: p, index: i, node: c };
          stack.push(c);
        }
      }
      return undefined;
    };

    // Update bound/display nodes inside a wrapper with their rebuilt versions.
    // Remove nodes that no longer exist in the rebuilt tree.
    const updateWrapperChildren = (wrapperNode: TreeNode): void => {
      if (!wrapperNode.children) return;
      const updatedChildren: TreeNode[] = [];
      for (const child of wrapperNode.children) {
        if (child._layout) {
          // Nested layout — recurse to update its children
          updateWrapperChildren(child);
          updatedChildren.push(child);
        } else if (child.bind) {
          // Find the rebuilt version and extract it from the flat tree
          const found = findInTree(newRoot, { bind: child.bind });
          if (found && found.index !== -1) {
            const [extracted] = found.parent.children!.splice(found.index, 1);
            updatedChildren.push(extracted);
          }
          // If not found, the item was deleted — omit it
        } else if (child.nodeId) {
          // Display node — find rebuilt version
          const found = findInTree(newRoot, { nodeId: child.nodeId });
          if (found && found.index !== -1) {
            const [extracted] = found.parent.children!.splice(found.index, 1);
            updatedChildren.push(extracted);
          }
        }
      }
      wrapperNode.children = updatedChildren;
    };

    for (const snap of wrapperSnapshots) {
      const wrapperNode = snap.wrapper;
      updateWrapperChildren(wrapperNode);

      // Find the parent node in the rebuilt tree
      const parentResult = findInTree(newRoot, snap.parentRef);
      const parentNode = parentResult ? parentResult.node : newRoot;
      if (!parentNode.children) parentNode.children = [];

      // Insert at original position (clamped to valid range)
      const idx = Math.min(snap.position, parentNode.children.length);
      parentNode.children.splice(idx, 0, wrapperNode);
    }

    this._markGeneratedComponentDoc();
    this._state.generatedComponent.tree = newRoot as any;
  }

  /**
   * Determine the default component type for a newly created tree node.
   * Maps item types to sensible widget defaults: field -> TextInput,
   * group -> Stack, display -> Text.
   * @param item - The definition item to map.
   * @returns A component type string for the tree node.
   */
  private _defaultComponent(item: FormspecItem): string {
    switch (item.type) {
      case 'field':
        if ((item as any).optionSet || Array.isArray((item as any).options)) return 'Select';
        switch (item.dataType) {
          case 'choice': return 'Select';
          case 'multiChoice': return 'CheckboxGroup';
          case 'boolean': return 'Toggle';
          case 'integer':
          case 'decimal': return 'NumberInput';
          case 'date':
          case 'dateTime':
          case 'time': return 'DatePicker';
          case 'money': return 'MoneyInput';
          case 'attachment': return 'FileUpload';
          default: return 'TextInput';
        }
      case 'group': return (item as any).repeatable ? 'Accordion' : 'Stack';
      case 'display': return 'Text';
      default: return 'TextInput';
    }
  }

  // ── Dispatching commands ─────────────────────────────────────────

  /**
   * Apply a single command through the full dispatch lifecycle.
   *
   * Lifecycle:
   *   1. Build middleware chain wrapping the core handler.
   *   2. Clone state, execute handler on clone, push history snapshot.
   *   3. If `result.clearHistory`, wipe undo/redo stacks and log.
   *   4. If `result.rebuildComponentTree`, sync component tree to definition.
   *   5. Run cross-artifact normalization.
   *   6. Notify all change listeners.
   *
   * If the handler throws, state is unchanged (the clone is discarded).
   *
   * @param command - The command to dispatch. Must have a `type` matching a registered handler.
   * @returns The {@link CommandResult} produced by the handler (may include extra fields
   *   like `insertedPath` depending on the command type).
   */
  dispatch(command: AnyCommand): CommandResult {
    // Build the middleware chain, innermost is the actual handler
    const coreDispatch = (cmd: AnyCommand): CommandResult => {
      const handler = getHandler(cmd.type);
      const clone = structuredClone(this._state);
      const result = handler(clone, cmd.payload);

      this._pushHistory(this._state);
      this._log.push({ command: cmd, timestamp: Date.now() });
      this._state = clone;
      return result;
    };

    // Compose middleware: outermost wraps innermost
    let chain = coreDispatch;
    for (let i = this._middleware.length - 1; i >= 0; i--) {
      const mw = this._middleware[i];
      const next = chain;
      chain = (cmd) => mw(this._state, cmd, next);
    }

    const result = chain(command);
    if (result.clearHistory) {
      this._undoStack.length = 0;
      this._redoStack.length = 0;
      this._log.length = 0;
    }
    if (result.rebuildComponentTree && !hasAuthoredComponentTree(this._state.component)) {
      this._rebuildComponentTree();
    }
    this._normalize();
    this._notify(command, result, 'dispatch');
    return result;
  }

  /**
   * Apply multiple commands as one atomic operation.
   * All commands execute sequentially on a single state clone, producing one
   * undo entry and one change notification. The component tree is rebuilt if
   * any command's result signals it. Middleware is bypassed -- commands go
   * directly to their handlers.
   *
   * Commands in a batch are independent: if a command needs results from an
   * earlier command in the same batch, use sequential {@link dispatch} calls instead.
   *
   * @param commands - The commands to execute in order.
   * @returns Per-command results aligned by index.
   */
  batch(commands: AnyCommand[]): CommandResult[] {
    const snapshot = this._state;
    const clone = structuredClone(this._state);
    const results: CommandResult[] = [];

    for (const cmd of commands) {
      const handler = getHandler(cmd.type);
      results.push(handler(clone, cmd.payload));
    }

    this._pushHistory(snapshot);
    this._log.push({
      command: { type: 'batch', payload: { commands } },
      timestamp: Date.now(),
    });
    this._state = clone;
    if (results.some(r => r.rebuildComponentTree) && !hasAuthoredComponentTree(this._state.component)) {
      this._rebuildComponentTree();
    }
    this._normalize();
    this._notify(
      { type: 'batch', payload: { commands } },
      { rebuildComponentTree: results.some(r => r.rebuildComponentTree) },
      'batch',
    );
    return results;
  }

  /**
   * Push a pre-mutation state snapshot onto the undo stack and clear the redo stack.
   * If the undo stack exceeds `_maxHistory`, the oldest snapshot is pruned.
   * @param snapshot - The state snapshot to preserve (typically the pre-clone state).
   */
  private _pushHistory(snapshot: ProjectState): void {
    this._undoStack.push(snapshot);
    if (this._undoStack.length > this._maxHistory) {
      this._undoStack.shift();
    }
    this._redoStack.length = 0;
  }
}

/**
 * Factory function for creating a new {@link Project} instance.
 * Preferred over direct constructor usage for API consistency.
 * @param options - Optional configuration: seed state, middleware, and history depth.
 * @returns A fully initialized Project ready for command dispatch.
 */
export function createProject(options?: ProjectOptions): Project {
  return new Project(options);
}
