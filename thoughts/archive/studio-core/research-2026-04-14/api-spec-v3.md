# Formspec Studio Core — API Specification

## Status

Draft

## Purpose

A pure TypeScript library for creating and editing Formspec artifact bundles. Every edit is a serializable command dispatched against a Project instance. No framework dependencies, no singletons, no side effects.

Consumers include visual editors, CLI tools, importers, codemods, and test harnesses.

### Goals

- **Standalone** — usable from any context: GUI, CLI, test, script
- **Multi-instance** — each Project is independent; no shared global state
- **Commands as data** — every edit is a serializable object: log it, replay it, transmit it, persist it
- **Artifact parity** — definition, component, theme, and mapping are equally editable
- **On-demand computation** — diagnostics and derived state are pulled, not pushed

### Non-goals

- Registry authoring (registries are loaded as reference data, not authored)
- Response editing (responses are runtime outputs, not design-time artifacts)
- Collaboration protocol (the command model enables it; the protocol is a separate concern)
- UI framework bindings (consumers wire their own reactivity)

---

## Data Model

### ProjectState

A project contains four Formspec artifacts plus two supporting subsystems.

```typescript
interface ProjectState {
  definition: FormspecDefinition;
  component:  FormspecComponentDocument;
  theme:      FormspecThemeDocument;
  mapping:    FormspecMappingDocument;
  extensions: ExtensionsState;
  versioning: VersioningState;
}
```

**Definition** — the form's structure and behavior: items (fields, groups, displays), binds (calculate, relevant, required, readonly, constraint), shapes (cross-field validation), variables (named FEL expressions), option sets, instances (external data sources), screener (respondent routing), migrations (version transforms), and form-level metadata.

**Component** — a parallel UI tree: which widget renders each field, layout containers (grid, columns, wizard, tabs), responsive overrides per breakpoint, custom component templates, group display modes (stack vs data table).

**Theme** — visual presentation: design tokens, form-wide defaults, selector-based overrides (by item type/dataType), per-item overrides (cascade level 3), responsive breakpoints, page layout (12-column grid regions), external stylesheets.

**Mapping** — bidirectional transforms between form responses and external schemas (JSON, XML, CSV): field-level rules (preserve, expression, coerce, valueMap, flatten, nest, etc.), target schema definition, format-specific adapter configuration.

**Extensions** — loaded extension registries that provide custom data types, functions, constraints, and properties. Read-only reference data; the project loads registries but doesn't author them.

**Versioning** — a baseline definition snapshot and release history. Enables changelog generation (structured diff with semver impact classification) and version publishing.

No UI state (selection, panel visibility, viewport) lives in ProjectState. That belongs to the consumer.

### ExtensionsState

```typescript
interface ExtensionsState {
  registries: LoadedRegistry[];
}

interface LoadedRegistry {
  url: string;
  document: ExtensionRegistryDocument;
  catalog: ResolvedCatalog;   // pre-indexed by name+category for fast lookup
}
```

### VersioningState

```typescript
interface VersioningState {
  baseline: FormspecDefinition;  // snapshot at last publish (or creation)
  releases: VersionRelease[];   // ordered release history
}

interface VersionRelease {
  version: string;
  publishedAt: string;          // ISO 8601
  changelog: FormspecChangelog;  // structured diff from previous version
  snapshot: FormspecDefinition;  // frozen definition at this version
}
```

---

## Project

The public API. Each instance manages its own state, history, and subscriptions.

```typescript
function createProject(options?: ProjectOptions): Project;

interface ProjectOptions {
  seed?: Partial<ProjectState>;
  registries?: ExtensionRegistryDocument[];
  maxHistoryDepth?: number;       // default: 50
  middleware?: Middleware[];
}
```

Omitted fields in `seed` get sensible defaults (empty definition with a generated URL, blank component/theme/mapping documents targeting that URL, no extensions, no releases).

### Reading state

```typescript
class Project {
  /** Current state. Treat as immutable — mutations go through dispatch. */
  readonly state: Readonly<ProjectState>;

  /** Convenience accessors for each artifact. */
  readonly definition: Readonly<FormspecDefinition>;
  readonly component:  Readonly<FormspecComponentDocument>;
  readonly theme:      Readonly<FormspecThemeDocument>;
  readonly mapping:    Readonly<FormspecMappingDocument>;
}
```

### Dispatching commands

```typescript
class Project {
  /** Apply a single command. Returns a command-specific result. */
  dispatch<C extends AnyCommand>(command: C): ResultOf<C>;

  /** Apply multiple commands as one atomic operation (single undo entry, single notification).
   *  Returns per-command results aligned by index.
   *  Commands in a batch are independent — if a command needs results from an earlier command
   *  in the same batch, use sequential dispatch() calls instead. */
  batch(commands: AnyCommand[]): CommandResult[];
}
```

### History

```typescript
class Project {
  undo(): boolean;
  redo(): boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;

  /** Full command log. Serializable — can be persisted and replayed on a fresh project. */
  readonly log: readonly LogEntry[];
}

interface LogEntry {
  command: AnyCommand;        // or { type: 'batch', commands: AnyCommand[] }
  timestamp: number;
}
```

Undo restores a pre-command snapshot. Redo re-dispatches the command. Snapshots are capped by `maxHistoryDepth` and pruned oldest-first.

### Change notification

```typescript
class Project {
  /** Subscribe to state changes. Returns an unsubscribe function. */
  onChange(listener: ChangeListener): () => void;
}

type ChangeListener = (
  state: Readonly<ProjectState>,
  event: ChangeEvent
) => void;

interface ChangeEvent {
  command: AnyCommand;
  result: CommandResult;
  /** 'dispatch' | 'undo' | 'redo' | 'batch' */
  source: string;
}
```

### Queries

Read helpers for common questions about state. Pure functions, no caching — call them when you need the answer.

#### Definition & Cross-Artifact Queries

```typescript
class Project {
  /** All leaf field paths in the definition tree (dot-notation). */
  fieldPaths(): string[];

  /** Resolve an item by its dot-path. Returns undefined if not found. */
  itemAt(path: string): FormspecItem | undefined;

  /** Get the effective bind for a path (merges wildcard binds). */
  bindFor(path: string): ResolvedBind | undefined;

  /** Get the component tree node bound to a field key. */
  componentFor(fieldKey: string): ComponentNode | undefined;

  /** Resolve the effective presentation for a field through the theme cascade:
      defaults → matching selectors (in document order) → per-item overrides. */
  effectivePresentation(fieldKey: string): ResolvedPresentation;

  /** Resolve an extension name against loaded registries. */
  resolveExtension(name: string): ExtensionRegistryEntry | undefined;

  /** Search items by label, type, dataType, or extension usage. */
  searchItems(filter: ItemFilter): FormspecItem[];

  /** Which fields reference a named option set? */
  optionSetUsage(name: string): string[];

  /** All instance names declared in the definition. */
  instanceNames(): string[];

  /** All variable names declared in the definition. */
  variableNames(): string[];

  /** Form complexity metrics. */
  statistics(): ProjectStatistics;

  /** All valid dataTypes: the 13 core types plus any dataType extensions from loaded registries. */
  allDataTypes(): DataTypeInfo[];

  /** Definition items not bound to any component tree node (falling back to Tier 2/1 rendering). */
  unboundItems(): string[];

  /** Resolve effective token value through the cascade: Tier 3 (component) → Tier 2 (theme) → platform default. */
  resolveToken(key: string): string | number | undefined;
}

interface ItemFilter {
  type?: 'field' | 'group' | 'display';
  dataType?: string;
  label?: string;              // substring match
  hasExtension?: string;       // extension name
}

interface ProjectStatistics {
  fieldCount: number;
  groupCount: number;
  displayCount: number;
  maxNestingDepth: number;
  bindCount: number;
  shapeCount: number;
  variableCount: number;
  expressionCount: number;
  componentNodeCount: number;
  mappingRuleCount: number;
}

interface DataTypeInfo {
  name: string;
  source: 'core' | 'extension';
  baseType?: string;           // for extension dataTypes
  registryUrl?: string;
}
```

#### FEL Queries

These queries enable a rich FEL expression editor with inline validation and autocomplete.

```typescript
class Project {
  /** Parse and validate a FEL expression without saving it to project state.
   *  Returns parse errors, resolved references, and the AST if valid. */
  parseFEL(expression: string, context?: FELContext): FELParseResult;

  /** Built-in function catalog plus extension functions from loaded registries. */
  felFunctionCatalog(): FELFunctionEntry[];

  /** Scope-aware list of valid references at a given path.
   *  Inside a repeat group: includes @current, @index, @count.
   *  Inside mapping expressions: includes @source, @target.
   *  Always includes: $fields, @variables, @instance names. */
  availableReferences(contextPath?: string): FELReferenceSet;

  /** Full dependency graph across all FEL expressions in the project. */
  dependencyGraph(): DependencyGraph;

  /** Reverse lookup: what binds, shapes, variables, and mapping rules reference this field? */
  fieldDependents(fieldPath: string): FieldDependents;

  /** List all field paths that reference a given variable in their FEL expressions. */
  variableDependents(variableName: string): string[];

  /** List all field paths that a FEL expression references. */
  expressionDependencies(expression: string): string[];

  /** All FEL expressions in the project with their locations. */
  allExpressions(): ExpressionLocation[];
}

interface FELContext {
  /** Path where this expression will be used (for scope resolution). */
  targetPath?: string;
  /** Whether the expression is in a mapping context (@source/@target available). */
  mappingContext?: boolean;
}

interface FELParseResult {
  valid: boolean;
  errors: Diagnostic[];          // errors include a `phase` property ('definition' | 'evaluation') when relevant
  /** Field paths referenced by the expression. */
  references: string[];
  /** Function names called by the expression. */
  functions: string[];
  ast?: unknown;               // parsed AST when valid — enables expression tree visualization and refactoring
}

interface FELFunctionEntry {
  name: string;
  category: string;
  parameters: {
    name: string;
    type: string;
    required: boolean;
    description: string;
    variadic?: boolean;
    enum?: string[];           // constrained literal values (e.g., dateDiff unit: ['days','months','years'])
  }[];
  returnType: string;
  returnDescription?: string;  // clarification when returnType alone is insufficient
  description: string;
  nullHandling?: string;       // how the function behaves when arguments are null
  deterministic: boolean;      // false for today(), now()
  shortCircuit: boolean;       // true for if(), countWhere()
  sinceVersion: string;        // e.g. '1.0'
  examples: { expression: string; result: unknown; note?: string }[];
  source: 'builtin' | 'extension';
  registryUrl?: string;
}

interface FELReferenceSet {
  fields: { path: string; dataType: string; label?: string }[];
  variables: { name: string; expression: string }[];
  instances: { name: string; source?: string }[];
  contextRefs: string[];      // ['@current', '@index', '@count'] when inside repeat
}

interface DependencyGraph {
  nodes: { id: string; type: 'field' | 'variable' | 'shape' }[];
  edges: { from: string; to: string; via: 'calculate' | 'relevant' | 'required' | 'readonly' | 'constraint' | 'shape' | 'variable' }[];
  cycles: string[][];         // circular dependency chains (should be empty)
}

interface FieldDependents {
  binds: { path: string; property: string }[];
  shapes: { id: string; property: 'constraint' | 'activeWhen' | 'context' }[];
  variables: string[];
  mappingRules: number[];
}

interface ExpressionLocation {
  expression: string;
  artifact: 'definition' | 'component' | 'mapping';
  location: string;            // e.g. 'binds[email].constraint', 'shapes[BUDGET_01].activeWhen'
}

/** Classification of FEL errors for editor UX. */
type FELErrorPhase = 'definition' | 'evaluation';
// 'definition' = blocks form loading (parse errors, unresolved references)
// 'evaluation' = produces null + diagnostic at runtime (type mismatch, division by zero)
```

#### Extension Queries

```typescript
class Project {
  /** Enumerate loaded registries with indexed entry counts. */
  listRegistries(): RegistrySummary[];

  /** Browse extension entries across all loaded registries with optional filtering. */
  browseExtensions(filter?: ExtensionFilter): ExtensionRegistryEntry[];
}

interface ExtensionFilter {
  category?: 'dataType' | 'function' | 'constraint' | 'property' | 'namespace';
  status?: 'draft' | 'stable' | 'deprecated' | 'retired';
  namePattern?: string;        // substring match
}
```

#### Versioning Queries

```typescript
class Project {
  /** Preview what the changelog would look like without committing to publish. */
  previewChangelog(): FormspecChangelog;

  /** Structured diff from the baseline (or a specific version) to the current state. */
  diffFromBaseline(fromVersion?: string): Change[];
}

interface Change {
  type: 'added' | 'removed' | 'modified' | 'moved' | 'renamed';
  target: 'item' | 'bind' | 'shape' | 'optionSet' | 'dataSource' | 'screener' | 'migration' | 'metadata';
  path: string;
  impact: 'breaking' | 'compatible' | 'cosmetic';
  description?: string;
  before?: unknown;
  after?: unknown;
}

interface FormspecChangelog {
  definitionUrl: string;
  fromVersion: string;
  toVersion: string;
  semverImpact: 'breaking' | 'compatible' | 'cosmetic';
  changes: Change[];
}
```

### Diagnostics

On-demand validation of the current state. Not continuously computed — the consumer decides when to call it (on save, on panel open, on a debounce timer, etc.). Always processes the full project — multi-pass analysis (dependency cycles, extension resolution) requires the complete graph. If performance becomes an issue on large forms, artifact-level scoping is the natural boundary to add.

```typescript
class Project {
  diagnose(): Diagnostics;
}

interface Diagnostics {
  /** Per-artifact schema validation (definition, component, theme, mapping against their JSON Schemas). */
  structural: Diagnostic[];

  /** FEL expression errors: parse failures, type mismatches, unresolved references. */
  expressions: Diagnostic[];

  /** Extension resolution errors: fields referencing extensions not in any loaded registry. */
  extensions: Diagnostic[];

  /** Cross-artifact consistency: component tree referencing items that don't exist,
      mapping rules referencing invalid paths, theme selectors matching no items, etc. */
  consistency: Diagnostic[];

  counts: { error: number; warning: number; info: number };
}

interface Diagnostic {
  artifact: 'definition' | 'component' | 'theme' | 'mapping';
  path: string;                   // dot-path within the artifact
  severity: 'error' | 'warning' | 'info';
  code: string;                   // machine-readable (e.g. 'UNRESOLVED_EXTENSION', 'FEL_PARSE_ERROR')
  message: string;                // human-readable
}
```

### Export

```typescript
class Project {
  /** Serialize all artifacts as standalone JSON documents. */
  export(): ProjectBundle;
}

interface ProjectBundle {
  definition: FormspecDefinition;
  component:  FormspecComponentDocument;
  theme:      FormspecThemeDocument;
  mapping:    FormspecMappingDocument;
}
```

---

## Command System

### Shape

```typescript
interface Command<T extends string, P> {
  type: T;
  payload: P;
  id?: string;              // optional, consumer-supplied — for middleware correlation, undo tracing, sync deduplication
}
```

Commands are plain JSON-serializable objects. The `type` string is namespaced by artifact domain (`definition.*`, `component.*`, `theme.*`, `mapping.*`, `project.*`).

### Result

```typescript
interface CommandResult {
  /** Structural change that requires the component tree to resync with the definition. */
  rebuildComponentTree: boolean;
}
```

Commands that produce additional output extend this (e.g., `& { insertedPath: string }`).

### Dispatch lifecycle

```
1. Run middleware pipeline (may transform or reject the command)
2. Clone current state
3. Look up handler by command.type
4. Execute handler(clonedState, command.payload) → result
5. If result.rebuildComponentTree → sync component tree to definition
6. Normalize cross-artifact consistency
7. Record to history (command + pre-clone snapshot)
8. Commit: replace state with cloned state
9. Notify onChange listeners
10. Return result
```

Steps 2–6 are the "transaction": if the handler throws, state is unchanged.

### Middleware

```typescript
type Middleware = (
  state: Readonly<ProjectState>,
  command: AnyCommand,
  next: (command: AnyCommand) => CommandResult
) => CommandResult;
```

Middleware wraps the dispatch lifecycle. Each middleware calls `next` to continue (or doesn't, to block). Use cases: validation, logging, debounce-batching text input, broadcasting commands for sync.

---

## Command Catalog

### Definition — Items

| Command | Payload | Extra Result | Notes |
|---------|---------|-------------|-------|
| `definition.addItem` | `AddItemPayload` | `{ insertedPath }` | Auto-generates key if omitted. Defaults: field→string, group→empty children, display→empty. |
| `definition.deleteItem` | `{ path }` | | Removes subtree. Cleans up: binds targeting deleted paths, shape references, component bindings, theme item overrides. |
| `definition.renameItem` | `{ path, newKey }` | `{ newPath }` | Rewrites all references: binds, shapes, variables, component bindings, theme item override keys, mapping rules. |
| `definition.moveItem` | `{ sourcePath, targetParentPath?, targetIndex? }` | `{ newPath }` | Validates no circular nesting (can't move group into its own descendant). |
| `definition.reorderItem` | `{ path, direction: 'up'\|'down' }` | | Swap with adjacent sibling within same parent. |
| `definition.duplicateItem` | `{ path }` | `{ insertedPath }` | Deep clone with auto-suffixed keys. Duplicated binds/shapes reference new paths. |

```typescript
interface AddItemPayload {
  type: 'field' | 'group' | 'display';
  parentPath?: string;        // omit for root — supports both group AND field parents (for dependent sub-questions)
  insertIndex?: number;       // omit to append
  key?: string;               // auto-generated if omitted
  dataType?: string;          // fields only, default 'string' — accepts core types and extension dataTypes
  label?: string;
  description?: string;
  hint?: string;
  labels?: Record<string, string>;  // context-keyed alternative labels ('short', 'pdf', 'csv', 'accessibility')
  options?: Option[] | string;      // inline options or optionSet URI (choice/multiChoice fields)
  initialValue?: unknown;           // literal or '=expression' (FEL, validated and dependency-tracked)
  presentation?: Partial<Presentation>;
  extensions?: Record<string, unknown>;
}
```

### Definition — Field Configuration

| Command | Payload | Notes |
|---------|---------|-------|
| `definition.setItemProperty` | `{ path, property, value }` | Generic setter for any item property. Supports nested dot-paths for deep properties. Validates property applicability per item type and dataType. Supported properties include all common properties (`label`, `description`, `hint`, `labels`, `presentation`), field-specific properties (see table below), group-specific properties (`repeatable`, `minRepeat`, `maxRepeat`), and presentation sub-properties via dot-paths (`presentation.widgetHint`, `presentation.layout.columns`, `presentation.layout.collapsible`, `presentation.layout.page`, `presentation.styleHints.emphasis`, `presentation.accessibility.role`). |
| `definition.setFieldDataType` | `{ path, dataType }` | Resets incompatible options and bind expressions when type changes. |
| `definition.setFieldOptions` | `{ path, options }` | Inline options (array of `Option`) or URI string referencing an external option set. |
| `definition.setItemExtension` | `{ path, extension, value }` | Set `value` to `null` to remove. Validates extension exists in loaded registries. |

**Group-specific properties** settable via `definition.setItemProperty`:

| Property | Notes |
|----------|-------|
| `repeatable` | Boolean. Toggle via `definition.setItemProperty` (definition-level) or `component.setGroupRepeatable` (syncs both). |
| `minRepeat` | Integer ≥ 0. Minimum instances for repeatable groups. Produces `MIN_REPEAT` validation error. Only valid when `repeatable` is true. |
| `maxRepeat` | Integer ≥ 1. Maximum instances. Produces `MAX_REPEAT` validation error. Only valid when `repeatable` is true. |

**Display item content**: Display items use `label` for their content text. The `presentation.widgetHint` controls rendering style: `'heading'` for section headers (with `presentation.styleHints.size` for level), `'paragraph'` for instruction text, `'divider'` for visual separators.

### Definition — Field-Specific Properties

These properties are set via `definition.setItemProperty` and are validated per-dataType. Setting a property incompatible with the field's dataType produces a diagnostic warning.

| Property | Applicable dataTypes | Notes |
|----------|---------------------|-------|
| `currency` | money | ISO 4217 code (e.g., 'USD'). Sets the default currency for money fields. |
| `precision` | integer, decimal, money | Number of decimal places. |
| `prefix` | string, integer, decimal, money | Display prefix (e.g., '$'). Presentation-only, not stored in response. |
| `suffix` | string, integer, decimal, money | Display suffix (e.g., '%', 'kg'). Presentation-only. |
| `initialValue` | all field types | Literal value or `=expression` (FEL string prefixed with `=`). Evaluated once at form load. Distinct from bind `default` (fires on non-relevant→relevant) and `calculate` (continuous). When value is an `=expression`, FEL is parsed, validated, and dependency-tracked. |
| `semanticType` | all field types | Domain meaning annotation (e.g., 'us-gov:ein'). Metadata only — no runtime effect. |
| `prePopulate` | all field types | Object: `{ instance, path, editable? }`. Shorthand for `initialValue` + implicit readonly bind when `editable` is false (default). Setting `prePopulate` with `editable: false` auto-creates a readonly bind if none exists. |
| `optionSet` | choice, multiChoice | Name of a declared option set. Alternative to inline `options`. Set via `definition.setItemProperty({ path, property: 'optionSet', value: 'setName' })`. Set to `null` to unlink. |

### Definition — Option Sets

| Command | Payload | Notes |
|---------|---------|-------|
| `definition.setOptionSet` | `SetOptionSetPayload` | Create or replace a named reusable option list. Accepts either inline options or an external source. |
| `definition.deleteOptionSet` | `{ name }` | Inlines options into fields that were referencing this set. |
| `definition.promoteToOptionSet` | `{ path, name }` | Extracts a field's inline options into a named set and references it. |

```typescript
type SetOptionSetPayload =
  | { name: string; options: Option[] }                                          // inline
  | { name: string; source: string; valueField?: string; labelField?: string };  // external
```

### Definition — Binds

| Command | Payload | Notes |
|---------|---------|-------|
| `definition.setBind` | `SetBindPayload` | Set one or more bind properties on a target path. Setting a property to `null` removes it. If all properties become null, the bind entry is removed entirely. |

```typescript
interface SetBindPayload {
  path: string;             // dot-path, wildcards allowed (e.g. 'items[*].amount')
  properties: Partial<{
    calculate: string | null;
    relevant: string | null;
    required: string | null;
    readonly: string | null;
    constraint: string | null;
    constraintMessage: string | null;
    default: unknown | null;
    nonRelevantBehavior: 'remove' | 'empty' | 'keep' | null;
    whitespace: 'preserve' | 'trim' | 'normalize' | 'remove' | null;
    excludedValue: 'preserve' | 'null' | null;
    disabledDisplay: 'hidden' | 'protected' | null;
    extensions: Record<string, unknown> | null;
  }>;
}
```

### Definition — Shapes

| Command | Payload | Notes |
|---------|---------|-------|
| `definition.addShape` | `AddShapePayload` | `id` auto-generated if omitted. |
| `definition.setShapeProperty` | `{ id, property, value }` | Update any shape property: constraint, message, severity, target, code, context, activeWhen, timing, extensions. |
| `definition.setShapeComposition` | `SetShapeCompositionPayload` | Replace a shape's constraint with a composition over other shape IDs. |
| `definition.renameShape` | `{ id, newId }` | Rewrites composition references. |
| `definition.deleteShape` | `{ id }` | Removes from all compositions that reference it. |

```typescript
interface AddShapePayload {
  id?: string;
  target: string;
  constraint?: string;          // FEL expression
  severity?: 'error' | 'warning' | 'info';
  message?: string;
  code?: string;
  context?: Record<string, string>;     // key→FEL expression map for diagnostic data
  activeWhen?: string;                   // FEL boolean — shape fires only when true
  timing?: 'continuous' | 'submit' | 'demand';
  extensions?: Record<string, unknown>;
}

type SetShapeCompositionPayload =
  | { id: string; mode: 'and' | 'or' | 'xone'; refs: (string | { expression: string })[] }  // shape IDs or inline FEL
  | { id: string; mode: 'not'; ref: string };                                                  // single shape ID
```

When `refs` contains an object with `expression`, the FEL expression is evaluated as a boolean inline constraint rather than referencing another shape by ID. This enables mixed composition of named shapes and ad-hoc expressions.

### Definition — Variables

| Command | Payload | Notes |
|---------|---------|-------|
| `definition.addVariable` | `{ name?, expression?, scope?, extensions? }` | Auto-named if omitted. Validates name uniqueness. |
| `definition.setVariable` | `{ name, property, value }` | Update expression, scope, name, or extensions. |
| `definition.deleteVariable` | `{ name }` | Warns if referenced in binds/shapes (via diagnostics, not blocked). |

### Definition — Instances

| Command | Payload | Notes |
|---------|---------|-------|
| `definition.addInstance` | `AddInstancePayload` | Named external data source for `@instance()` FEL references. |
| `definition.setInstance` | `{ name, property, value }` | Update any instance property: source, schema, data, static, readonly, description, extensions. |
| `definition.renameInstance` | `{ name, newName }` | Rewrites `@instance('oldName')` in all FEL expressions. |
| `definition.deleteInstance` | `{ name }` | |

```typescript
interface AddInstancePayload {
  name?: string;              // auto-generated if omitted
  source?: string;            // URI
  schema?: object;            // JSON Schema describing instance data structure
  data?: unknown;             // inline data (mutually exclusive with source URI at load time)
  static?: boolean;           // caching hint
  readonly?: boolean;         // default true; false enables writable scratch-pad
  description?: string;
  extensions?: Record<string, unknown>;
}
```

### Definition — Pages & Form-level

| Command | Payload | Notes |
|---------|---------|-------|
| `definition.addPage` | `{ title?, insertIndex? }` | Only valid when form presentation uses pages. |
| `definition.deletePage` | `{ pageKey }` | Reassigns orphaned items to an adjacent page. Cannot delete the last page. |
| `definition.reorderPage` | `{ pageKey, direction }` | |
| `definition.setFormPresentation` | `{ property, value }` | Any `formPresentation` property: page mode, wizard config, labelPosition, density, defaultCurrency. Toggling page mode on creates an initial page; toggling off flattens. |
| `definition.setFormTitle` | `{ title }` | |
| `definition.setDefinitionProperty` | `{ property, value }` | Any top-level definition property: name, description, url, version, status, date, derivedFrom, versionAlgorithm, nonRelevantBehavior. |

### Definition — Screener

The screener is a self-contained routing mechanism with its own items, binds, and routes. It operates in its own scope — separate from the main form's instance data.

| Command | Payload | Extra Result | Notes |
|---------|---------|-------------|-------|
| `definition.setScreener` | `{ enabled: boolean }` | | Create an empty screener (`true`) or remove it entirely (`false`). |
| `definition.addScreenerItem` | `AddItemPayload` | `{ insertedKey }` | Add a screening field. Same payload shape as `definition.addItem` but targets the screener scope. |
| `definition.deleteScreenerItem` | `{ key }` | | Remove a screener item. Cleans up screener binds and route conditions referencing it. |
| `definition.setScreenerBind` | `SetBindPayload` | | Same shape as `definition.setBind` but targets screener bind scope. Paths reference screener item keys. |
| `definition.addRoute` | `AddRoutePayload` | `{ insertedIndex }` | Append or insert a routing rule. |
| `definition.setRouteProperty` | `{ index, property, value }` | | Update `condition`, `target`, `label`, or `extensions` on a route. |
| `definition.deleteRoute` | `{ index }` | | Remove a route. Cannot delete the last route. |
| `definition.reorderRoute` | `{ index, direction }` | | Routes are order-dependent (first match wins). |

```typescript
interface AddRoutePayload {
  condition: string;           // FEL expression evaluated against screener item values
  target: string;              // URI to target definition
  label?: string;
  insertIndex?: number;        // omit to append
}
```

### Definition — Migrations

Migrations declare how to transform responses from prior definition versions into the current version's structure.

| Command | Payload | Notes |
|---------|---------|-------|
| `definition.addMigration` | `{ fromVersion, description? }` | Create a migration descriptor for a specific source version. |
| `definition.deleteMigration` | `{ fromVersion }` | Remove a migration descriptor. |
| `definition.setMigrationProperty` | `{ fromVersion, property, value }` | Update `description` or `extensions`. |
| `definition.addFieldMapRule` | `AddFieldMapRulePayload` | Add a field mapping rule to a migration descriptor. |
| `definition.setFieldMapRule` | `{ fromVersion, index, property, value }` | Update a field map rule's `source`, `target`, `transform`, or `expression`. |
| `definition.deleteFieldMapRule` | `{ fromVersion, index }` | |
| `definition.setMigrationDefaults` | `{ fromVersion, defaults }` | Set literal defaults for new fields (keys are target field paths). |

```typescript
interface AddFieldMapRulePayload {
  fromVersion: string;
  source: string;              // field path in source version
  target: string | null;       // field path in target version; null = drop
  transform: 'preserve' | 'drop' | 'expression';
  expression?: string;         // FEL expression when transform is 'expression'
  insertIndex?: number;        // omit to append
}
```

### Definition — Modular Composition

| Command | Payload | Notes |
|---------|---------|-------|
| `definition.setGroupRef` | `{ path, ref, keyPrefix? }` | Set or clear `$ref` and `keyPrefix` on a group item. `ref: null` removes the reference, making the group standalone. |

### Component — Node Addressing

Component tree nodes are addressed by stable identity, not positional tree-addresses.

- **Bound nodes** (Input, Display components bound to a definition item) are addressed by their **bind path** — the same stable key used in binds, shapes, FEL references, and theme overrides.
- **Unbound nodes** (layout containers like Card, Column, Spacer that have no bind) are addressed by a **stable `nodeId`** generated at creation time and persisted in the component document.

```typescript
/** Identifies a component tree node. Exactly one of `bind` or `nodeId` must be set. */
type NodeRef =
  | { bind: string }           // bound node — addressed by item key / bind path
  | { nodeId: string };        // unbound layout node — addressed by stable generated ID
```

All component commands that target an existing node use `NodeRef` for addressing.

### Component — Tree Structure

Structural commands for building and modifying the component tree. These mirror the definition domain's item CRUD verbs.

| Command | Payload | Extra Result | Notes |
|---------|---------|-------------|-------|
| `component.addNode` | `AddNodePayload` | `{ nodeRef: NodeRef }` | Insert a new component into the tree. Auto-generates default props per component type. Unbound nodes get a generated `nodeId`. |
| `component.deleteNode` | `{ node: NodeRef }` | | Remove a node and its subtree. Bound fields fall back to Tier 2/1 rendering. Does NOT delete the definition item. |
| `component.moveNode` | `{ source: NodeRef, targetParent: NodeRef, targetIndex? }` | | Move a node (and subtree) to a new parent. Validates nesting constraints (component-spec §3.4). |
| `component.reorderNode` | `{ node: NodeRef, direction: 'up'\|'down' }` | | Swap with adjacent sibling in the same parent's children array. |
| `component.duplicateNode` | `{ node: NodeRef }` | `{ nodeRef: NodeRef }` | Deep clone a subtree. Duplicate bind references emit a warning (§4.3 uniqueness). Cloned unbound nodes get new `nodeId`s. |
| `component.wrapNode` | `WrapNodePayload` | `{ nodeRef: NodeRef }` | Wrap an existing node in a new container. The target node becomes the wrapper's only child. |
| `component.unwrapNode` | `{ node: NodeRef }` | | Dissolve a container — promote its children into the container's parent at the container's position. Only valid on Layout/Container nodes with children. |

```typescript
interface AddNodePayload {
  parent: NodeRef;             // parent node to insert under
  insertIndex?: number;        // omit to append
  component: string;           // built-in name or custom component key
  bind?: string;               // item key (required for Input components)
  props?: Record<string, unknown>; // component-specific props
}

interface WrapNodePayload {
  node: NodeRef;
  wrapper: {
    component: string;         // must be Layout or Container category
    props?: Record<string, unknown>;
  };
}
```

**Nesting validation:** `addNode` and `moveNode` MUST enforce component-spec §3.4:
- Input and Display components MUST NOT have children.
- Wizard children MUST all be Page components.
- Spacer MUST NOT have children.
- Nesting depth SHOULD NOT exceed 20 levels.

### Component — Node Properties

| Command | Payload | Notes |
|---------|---------|-------|
| `component.setNodeProperty` | `{ node: NodeRef, property, value }` | Any property on any component tree node. |
| `component.setNodeType` | `{ node: NodeRef, component: string, preserveProps?: boolean }` | Change a node's component type in-place. When `preserveProps` is true (default), compatible properties are preserved; incompatible ones are dropped. Validates nesting constraints for the new type. For bound fields, prefer `component.setFieldWidget` which also validates dataType compatibility. |
| `component.setNodeStyle` | `{ node: NodeRef, property: string, value: string \| number \| null }` | Set or remove a single style property on a node's StyleMap. `null` removes the property. More ergonomic than replacing the entire style object via `setNodeProperty`. Values may contain `$token.key` references. |
| `component.setNodeAccessibility` | `{ node: NodeRef, property: 'role' \| 'description' \| 'liveRegion', value: string \| null }` | Set or remove a single accessibility property. `null` removes. |
| `component.spliceArrayProp` | `SpliceArrayPropPayload` | Add, remove, or replace elements within array-valued component properties (Summary `items`, DataTable `columns`, Tabs `tabLabels`, Accordion `labels`, Columns `widths`). Uses splice semantics for precise array manipulation without whole-array replacement. |
| `component.setFieldWidget` | `{ fieldKey, widget }` | Override which component type renders a field. Validates widget/dataType compatibility (component-spec §4.6). |
| `component.setResponsiveOverride` | `{ node: NodeRef, breakpoint, patch }` | Per-breakpoint property overrides. Set `patch` to `null` to remove the override. `component`, `bind`, `when`, `children`, and `responsive` are forbidden in overrides (component-spec §9.4). |
| `component.setWizardProperty` | `{ property, value }` | Wizard props: `showProgress`, `allowSkip`. |
| `component.setGroupRepeatable` | `{ groupKey, repeatable }` | Toggle repeat mode. Adjusts component tree (adds/removes repeat container, add/remove buttons). |
| `component.setGroupDisplayMode` | `{ groupKey, mode: 'stack'\|'dataTable' }` | Switch between stacked fields and tabular data entry. |
| `component.setGroupDataTable` | `{ groupKey, config }` | Column definitions, sorting, add/remove row behavior. |

```typescript
interface SpliceArrayPropPayload {
  node: NodeRef;
  property: string;           // array-valued prop name (e.g., 'items', 'columns', 'tabLabels')
  index: number;              // position to start
  deleteCount: number;        // elements to remove (0 = pure insert)
  insert?: unknown[];         // elements to insert at position
}
```

**Conditional rendering (`when`):** Every component node supports an optional `when` property — a FEL boolean expression that controls visibility. Set via `component.setNodeProperty({ node, property: 'when', value: '...' })`. The expression is parsed and validated using the FEL pipeline; invalid expressions produce diagnostics. `ConditionalGroup` components REQUIRE `when` — omitting it is a structural error.

**Bind-category enforcement:** `component.addNode` and `component.moveNode` enforce bind rules per component category:
- **Layout** (Stack, Grid, Wizard, Columns): bind FORBIDDEN
- **Container** (Card, Collapsible, Tabs, Accordion, Panel, Modal, Popover): bind FORBIDDEN (except DataTable)
- **Input** (TextInput, NumberInput, etc.): bind REQUIRED
- **Display** (Heading, Text, Divider, Alert, Badge, ProgressBar): bind OPTIONAL
- **Special** (Summary, ValidationSummary, SubmitButton): bind per-component rules

### Component — Custom Components

| Command | Payload | Notes |
|---------|---------|-------|
| `component.registerCustom` | `{ name, params, tree }` | Register a reusable custom component template. PascalCase name, MUST NOT collide with built-in names. |
| `component.updateCustom` | `{ name, params?, tree? }` | Update an existing template's params and/or tree. Partial — omitted fields are unchanged. |
| `component.deleteCustom` | `{ name }` | Remove a custom component template. Instances in the tree are replaced with their expanded subtree. |
| `component.renameCustom` | `{ name, newName }` | Rewrites all references in the component tree. |

### Component — Document-Level

| Command | Payload | Notes |
|---------|---------|-------|
| `component.setToken` | `{ key, value }` | Set a Tier 3 design token. `null` removes. Overrides Tier 2 theme tokens of the same key. |
| `component.setBreakpoint` | `{ name, minWidth }` | Set a component-level breakpoint. `null` removes. Independent of theme breakpoints. |
| `component.setDocumentProperty` | `{ property, value }` | Top-level component document metadata: url, name, title, description, version, targetDefinition. |

### Theme — Tokens & Defaults

| Command | Payload | Notes |
|---------|---------|-------|
| `theme.setToken` | `{ key, value }` | Set a design token. `null` value removes it. Keys are dot-delimited (e.g. `color.primary`). |
| `theme.setTokens` | `{ tokens }` | Batch-set multiple tokens in one command. |
| `theme.setDefaults` | `{ property, value }` | Form-wide presentation baseline (cascade level 1). |

### Theme — Selectors (Cascade Level 2)

| Command | Payload | Notes |
|---------|---------|-------|
| `theme.addSelector` | `{ match, apply, insertIndex? }` | Pattern-based override. `match` requires at least one of `type` or `dataType`. |
| `theme.setSelector` | `{ index, match?, apply? }` | Update match criteria and/or apply PresentationBlock. |
| `theme.deleteSelector` | `{ index }` | |
| `theme.reorderSelector` | `{ index, direction }` | Selector order matters — they apply in document order. |

### Theme — Per-Item Overrides (Cascade Level 3)

Highest-specificity cascade level. Per-item PresentationBlock overrides keyed by the item's `key`.

| Command | Payload | Notes |
|---------|---------|-------|
| `theme.setItemOverride` | `{ itemKey, property, value }` | Set a single PresentationBlock property on a per-item override. `null` removes the property. If all properties become null, the item entry is removed. |
| `theme.deleteItemOverride` | `{ itemKey }` | Remove the entire PresentationBlock for an item key. |
| `theme.setItemStyle` | `{ itemKey, property: string, value: string \| number \| null }` | Set or remove a single CSS property within a per-item style override. `null` removes the property. More ergonomic than replacing the entire style object. Values may contain `$token.key` references. |
| `theme.setItemWidgetConfig` | `{ itemKey, property: string, value: unknown \| null }` | Set or remove a single widgetConfig property within a per-item override. `null` removes. |
| `theme.setItemAccessibility` | `{ itemKey, property: 'role' \| 'description' \| 'liveRegion', value: string \| null }` | Set or remove a single accessibility property within a per-item override. `null` removes. |

`property` is one of: `widget`, `widgetConfig`, `style`, `accessibility`, `fallback`, `labelPosition`, `cssClass`.

```typescript
// Set the widget for a specific field
{ type: 'theme.setItemOverride', payload: { itemKey: 'totalBudget', property: 'widget', value: 'moneyInput' } }

// Set widget config on a field
{ type: 'theme.setItemOverride', payload: { itemKey: 'totalBudget', property: 'widgetConfig', value: { showCurrencySymbol: true } } }

// Remove all overrides for a field
{ type: 'theme.deleteItemOverride', payload: { itemKey: 'totalBudget' } }
```

### Theme — Page Layout

| Command | Payload | Notes |
|---------|---------|-------|
| `theme.addPage` | `{ id?, title?, description?, insertIndex? }` | Add a page to the layout. `id` auto-generated if omitted. |
| `theme.setPageProperty` | `{ pageId, property, value }` | Update a page's `title` or `description`. |
| `theme.deletePage` | `{ pageId }` | Cannot delete the last page. Orphaned regions are moved to the adjacent page. |
| `theme.reorderPage` | `{ pageId, direction: 'up'\|'down' }` | |
| `theme.addRegion` | `{ pageId, key?, span?, start?, insertIndex? }` | Add a 12-column grid region to a page. `key` auto-generated if omitted. |
| `theme.setRegionProperty` | `{ pageId, regionKey, property, value }` | Update `span`, `start`, or `responsive` on a region. |
| `theme.deleteRegion` | `{ pageId, regionKey }` | |
| `theme.reorderRegion` | `{ pageId, regionKey, direction }` | |
| `theme.renamePage` | `{ pageId, newId }` | Rename a page's `id`. Rewrites region references and navigation targets. |
| `theme.setRegionKey` | `{ pageId, regionKey, newKey }` | Change a region's bound item key. Updates the region's definition-item binding. |
| `theme.setPages` | `{ pages }` | Bulk replace all pages. Retained for import scenarios; prefer granular commands for editing. |

### Theme — Document-Level

| Command | Payload | Notes |
|---------|---------|-------|
| `theme.setBreakpoint` | `{ name, minWidth }` | Define a named responsive breakpoint. `null` removes it. |
| `theme.setStylesheets` | `{ urls }` | External CSS to load. |
| `theme.setDocumentProperty` | `{ property, value }` | Top-level theme metadata: url, version, name, title, description, platform. |
| `theme.setExtension` | `{ key, value }` | Set or remove a document-level `x-` extension property. Key MUST be `x-` prefixed. `null` removes. |
| `theme.setTargetCompatibility` | `{ compatibleVersions: string \| null }` | Set or clear `targetDefinition.compatibleVersions` without affecting the auto-synced `url`. |

### Mapping

| Command | Payload | Notes |
|---------|---------|-------|
| `mapping.setProperty` | `{ property, value }` | Any top-level mapping property: direction, autoMap, conformanceLevel, version, definitionRef, definitionVersion. |
| `mapping.setTargetSchema` | `{ property, value }` | Target schema properties: format (`json`/`xml`/`csv`/`x-*`), name, url, rootElement, namespaces. |
| `mapping.addRule` | `AddRulePayload` | Append or insert a transform rule. |
| `mapping.setRule` | `{ index, property, value }` | Update any FieldRule property: sourcePath, targetPath, transform, expression, condition, coerce, valueMap, array, reverse, default, priority, bidirectional, separator, description, reversePriority. |
| `mapping.deleteRule` | `{ index }` | |
| `mapping.reorderRule` | `{ index, direction }` | Rule order can matter for priority resolution. |
| `mapping.setAdapter` | `{ format, config }` | Format-specific adapter config. json: pretty, sortKeys, nullHandling. xml: declaration, indent, cdata. csv: delimiter, quote, header, encoding, lineEnding. |
| `mapping.setDefaults` | `{ defaults }` | Literal key-value pairs written to target before rules execute. |
| `mapping.autoGenerateRules` | `AutoGenerateRulesPayload` | Generate `preserve` rules for all leaf fields not already covered by an explicit rule. Rules are inserted into the document as visible, editable entries. Distinct from the runtime `autoMap` flag which copies unmentioned fields at execution time without persisting rules. |
| `mapping.setExtension` | `{ key, value }` | Set or remove a document-level `x-` extension property. Key MUST be `x-` prefixed. `null` removes. |
| `mapping.setRuleExtension` | `{ index, key, value }` | Set or remove an `x-` extension property on a specific rule. `null` removes. |
| `mapping.addInnerRule` | `AddInnerRulePayload` | Add an inner rule within an existing rule's `array.innerRules`. |
| `mapping.setInnerRule` | `{ ruleIndex, innerIndex, property, value }` | Update a property on an inner rule. |
| `mapping.deleteInnerRule` | `{ ruleIndex, innerIndex }` | Remove an inner rule from an array descriptor. |
| `mapping.reorderInnerRule` | `{ ruleIndex, innerIndex, direction }` | Reorder an inner rule within its parent array descriptor. |
| `mapping.preview` | `PreviewPayload` | Dry-run the mapping against sample data. Returns the transformed output without persisting anything. For development and debugging. |

```typescript
interface AddRulePayload {
  sourcePath?: string;
  targetPath?: string;
  transform?: string;         // default: 'preserve'
  insertIndex?: number;       // omit to append
}

interface AutoGenerateRulesPayload {
  /** Only generate rules for fields under this path prefix. Omit for all fields. */
  scopePath?: string;
  /** Priority assigned to generated rules. Default: -1 (below any explicit rules). */
  priority?: number;
  /** When true, removes existing auto-generated rules before regenerating. Default: false. */
  replace?: boolean;
}

interface AddInnerRulePayload {
  ruleIndex: number;           // parent rule index
  sourcePath?: string;
  targetPath?: string;
  transform?: string;          // default: 'preserve'
  insertIndex?: number;        // omit to append
}

interface PreviewPayload {
  sampleData: Record<string, unknown>;   // sample form response
  direction?: 'forward' | 'reverse';     // default: 'forward'
  ruleIndices?: number[];                // subset of rules to apply; omit for all
}

/** Sub-object types for mapping rule properties. These are set as values via `mapping.setRule`. */

interface Coerce {
  from: string;                // source type
  to: string;                  // target type
  format?: string;             // format string (e.g., date format)
}

interface ValueMap {
  forward: Record<string, unknown>;      // source→target value mapping
  reverse?: Record<string, unknown>;     // target→source (for bidirectional)
  unmapped?: 'pass' | 'null' | 'error';  // strategy for unmatched values
  default?: unknown;                      // fallback value
}

interface ArrayDescriptor {
  mode: 'each' | 'whole' | 'indexed';
  separator?: string;
  innerRules?: InnerRule[];
}

interface InnerRule {
  index?: number;
  sourcePath?: string;
  targetPath?: string;
  transform?: string;
  expression?: string;
  extensions?: Record<string, unknown>;
}

interface ReverseOverride {
  targetPath?: string;
  transform?: string;
  expression?: string;
  priority?: number;
  extensions?: Record<string, unknown>;
}
```

### Project-level

| Command | Payload | Notes |
|---------|---------|-------|
| `project.import` | `ImportPayload` | Replace the entire project state from imported artifacts. Clears history. |
| `project.importSubform` | `{ definition, targetGroupPath?, keyPrefix? }` | Merge a definition fragment into the current project as a nested group. |
| `project.loadRegistry` | `{ registry }` | Load an extension registry document. Pre-indexes entries for fast resolution. |
| `project.removeRegistry` | `{ url }` | Unload a registry by URL. |
| `project.publish` | `{ version, summary? }` | Snapshot current state as a versioned release. Generates changelog from diff against previous version/baseline. |

```typescript
interface ImportPayload {
  /** Any combination — missing artifacts get defaults. */
  definition?:  FormspecDefinition;
  component?:   FormspecComponentDocument;
  theme?:       FormspecThemeDocument;
  mapping?:     FormspecMappingDocument;
  registries?:  ExtensionRegistryDocument[];
}
```

---

## Cross-artifact Behaviors

Certain commands have effects that span multiple artifacts. These are handled automatically — the caller dispatches one command and all artifacts stay consistent.

### Component tree sync

When the definition's item structure changes (add, delete, move, rename, duplicate, toggle pages, toggle group repeatability), the component tree is fully rebuilt to reflect the new structure. Existing component node properties (widget overrides, responsive settings, custom styling) are preserved where the item still exists; nodes for deleted items are removed; new items get default component nodes.

This is signaled by `CommandResult.rebuildComponentTree` and executed as part of the dispatch lifecycle. Full rebuild is the initial strategy; if profiling shows it's too slow on large forms, memoization (cache keyed by definition structure hash) is the preferred optimization over incremental diffing.

### Reference rewriting

When an item is renamed (`definition.renameItem`) or an instance is renamed (`definition.renameInstance`):
- **Binds**: paths are rewritten
- **Shapes**: target paths are rewritten
- **Variables**: FEL expressions containing `$oldPath` or `@instance('oldName')` are rewritten
- **Component**: bind references are rewritten
- **Theme**: per-item override keys (`items.{key}`) are rewritten
- **Mapping**: sourcePath entries are rewritten

When a shape is renamed (`definition.renameShape`):
- Other shapes' composition references are rewritten

When a custom component is renamed (`component.renameCustom`):
- All references in the component tree are rewritten

When an item is deleted (`definition.deleteItem`):
- Theme per-item override entries for the deleted key are removed

### Post-dispatch normalization

After every command, cross-artifact invariants are enforced:
- Component and theme `targetDefinition.url` synced to `definition.url`
- Theme breakpoints sorted and validated; component breakpoints synced from theme when not independently set
- Mapping rules validated against current definition paths (stale paths flagged in diagnostics, not silently removed)
- Versioning state initialized if missing

### Extension property management

Extension properties (`x-` prefixed) are supported at multiple levels across all artifacts. The following commands manage them:

| Scope | Command | Notes |
|-------|---------|-------|
| Definition item | `definition.setItemExtension` | Validates against loaded registries |
| Definition bind | Include in `definition.setBind` payload `extensions` property | |
| Definition shape | `definition.setShapeProperty({ id, property: 'extensions', value })` | |
| Definition variable | `definition.setVariable({ name, property: 'extensions', value })` | |
| Definition instance | `definition.setInstance({ name, property: 'extensions', value })` | |
| Theme document | `theme.setExtension` | |
| Mapping document | `mapping.setExtension` | |
| Mapping rule | `mapping.setRuleExtension` | |

Extension properties not managed by a dedicated command (e.g., screener-level, option entry, migration top-level) can be set through their parent object's generic property setter where available, or via the `extensions` property in creation payloads.

---

## Patterns

### Null removes

Throughout the command catalog, setting a value to `null` means "remove this property/entry":
- `theme.setToken({ key: 'color.primary', value: null })` → removes the token
- `theme.setBreakpoint({ name: 'tablet', minWidth: null })` → removes the breakpoint
- `definition.setBind({ path: 'age', properties: { required: null } })` → removes the required bind
- `definition.setItemExtension({ path: 'email', extension: 'x-url', value: null })` → removes the extension
- `theme.setItemOverride({ itemKey: 'total', property: 'widget', value: null })` → removes the widget override

### Auto-generation

Commands that create new entries (addItem, addShape, addVariable, addInstance, addPage, addNode, addRoute, addMigration) auto-generate identifiers when omitted. Generated identifiers are deterministic (based on type + sibling count) and guaranteed unique within their scope.

### Batch for compound edits

Common multi-step workflows should be dispatched as a batch so they undo as one step:

```typescript
project.batch([
  { type: 'definition.addItem', payload: { type: 'field', key: 'email', dataType: 'string' } },
  { type: 'definition.setBind', payload: { path: 'email', properties: { required:  'true' } } },
  { type: 'definition.setItemExtension', payload: { path: 'email', extension: 'x-formspec-url', value: true } },
  { type: 'component.setFieldWidget', payload: { fieldKey: 'email', widget: 'TextInput' } },
]);
```

### Idempotent where possible

Commands that set a value are idempotent: dispatching the same command twice produces the same state. Commands that add entries (addItem, addRule, addSelector, addNode, addRoute) are not idempotent — each dispatch creates a new entry.

---

## Usage Examples

### Create a simple form from scratch

```typescript
const project = createProject();

project.dispatch({
  type: 'definition.setFormTitle',
  payload: { title: 'Contact Form' }
});

project.dispatch({
  type: 'definition.addItem',
  payload: { type: 'field', key: 'name', dataType: 'string', label: 'Full Name' }
});

project.dispatch({
  type: 'definition.addItem',
  payload: { type: 'field', key: 'email', dataType: 'string', label: 'Email Address' }
});

project.dispatch({
  type: 'definition.setBind',
  payload: {
    path: 'email',
    properties: {
      required:  'true',
      constraint: 'matches($email, "^[^@]+@[^@]+$")',
      constraintMessage: 'Please enter a valid email address'
    }
  }
});

// Check state
console.log(project.definition.title);           // 'Contact Form'
console.log(project.fieldPaths());                // ['name', 'email']
console.log(project.bindFor('email')?.required);  //  'true'
```

### Build a component tree for a wizard

```typescript
const project = createProject({ seed: { definition: existingDef } });

// Build the wizard structure — batch returns per-command results
const results = project.batch([
  { type: 'component.addNode', payload: { parent: { nodeId: 'root' }, component: 'Wizard', props: { showProgress: true } } },
  { type: 'component.addNode', payload: { parent: { nodeId: 'root' }, component: 'Page', props: { title: 'Step 1: Basics' } } },
  { type: 'component.addNode', payload: { parent: { nodeId: 'root' }, component: 'Page', props: { title: 'Step 2: Details' } } },
]);

// Bind fields to pages using the returned nodeRefs
const page1Ref = results[1].nodeRef;  // { nodeId: 'page-xxx' }

project.batch([
  { type: 'component.addNode', payload: { parent: page1Ref, component: 'TextInput', bind: 'name' } },
  { type: 'component.addNode', payload: { parent: results[2].nodeRef, component: 'DatePicker', bind: 'startDate' } },
]);

// Wrap a field in a Card — address bound node by its bind path
project.dispatch({
  type: 'component.wrapNode',
  payload: { node: { bind: 'name' }, wrapper: { component: 'Card', props: { title: 'Contact Info' } } }
});
```

### Load and modify an existing project

```typescript
import registryDoc from './my-registry.json';

const project = createProject({
  seed: { definition: existingDef, component: existingComp, theme: existingTheme, mapping: existingMapping },
  registries: [registryDoc]
});

// Add a group with repeatable fields
project.batch([
  { type: 'definition.addItem', payload: { type: 'group', key: 'contacts', label: 'Emergency Contacts' } },
  { type: 'definition.addItem', payload: { type: 'field', key: 'contactName', parentPath: 'contacts', dataType: 'string' } },
  { type: 'definition.addItem', payload: { type: 'field', key: 'contactPhone', parentPath: 'contacts', dataType: 'string' } },
  { type: 'component.setGroupRepeatable', payload: { groupKey: 'contacts', repeatable: true } },
  { type: 'component.setGroupDisplayMode', payload: { groupKey: 'contacts', mode: 'dataTable' } },
]);

// Add a mapping rule
project.dispatch({
  type: 'mapping.addRule',
  payload: { sourcePath: 'contacts[*].contactName', targetPath: 'emergency_contacts.name', transform: 'preserve' }
});

// Oops, undo the whole batch
project.undo();
```

### FEL expression editing

```typescript
// Validate an expression before saving
const result = project.parseFEL('$total > $budget * 1.1', { targetPath: 'overBudgetFlag' });
if (!result.valid) {
  showErrors(result.errors);
} else {
  project.dispatch({
    type: 'definition.setBind',
    payload: { path: 'overBudgetFlag', properties: { calculate: '$total > $budget * 1.1' } }
  });
}

// Get autocomplete suggestions
const refs = project.availableReferences('contacts[*].amount');
// refs.contextRefs = ['@current', '@index', '@count']  (inside repeat group)

// Browse available functions
const functions = project.felFunctionCatalog();
// [{ name: 'sum', category: 'aggregate', ... }, { name: 'matches', category: 'string', ... }, ...]
```

### Preview changelog before publishing

```typescript
const changelog = project.previewChangelog();
console.log(`Impact: ${changelog.semverImpact}`);  // 'minor'
console.log(`Changes: ${changelog.changes.length}`);

for (const change of changelog.changes) {
  console.log(`  ${change.type} ${change.path} — ${change.description}`);
}

// Looks good — publish
project.dispatch({
  type: 'project.publish',
  payload: { version: '1.2.0', summary: 'Added emergency contacts section' }
});
```

### Headless validation (CLI tool)

```typescript
const project = createProject({ seed: loadArtifactsFromDisk('./forms/intake/') });

const diag = project.diagnose();

if (diag.counts.error > 0) {
  for (const d of [...diag.structural, ...diag.expressions, ...diag.extensions, ...diag.consistency]) {
    if (d.severity === 'error') {
      console.error(`[${d.artifact}] ${d.path}: ${d.message}`);
    }
  }
  process.exit(1);
}

console.log('All artifacts valid.');
```

### Subscribe to changes (UI integration)

```typescript
const project = createProject();

// Framework-agnostic: the consumer decides how to trigger re-renders
const unsubscribe = project.onChange((state, event) => {
  // Could update a signal, call setState, emit to a store, etc.
  renderApp(state);
});
```

---

## Command Count Summary

| Domain | Commands |
|--------|----------|
| Definition — Items | 6 |
| Definition — Field Configuration | 4 |
| Definition — Field-Specific Properties | (via setItemProperty) |
| Definition — Option Sets | 3 |
| Definition — Binds | 1 |
| Definition — Shapes | 5 |
| Definition — Variables | 3 |
| Definition — Instances | 4 |
| Definition — Pages & Form-level | 6 |
| Definition — Screener | 8 |
| Definition — Migrations | 7 |
| Definition — Modular Composition | 1 |
| Component — Tree Structure | 7 |
| Component — Node Properties | 11 |
| Component — Custom Components | 4 |
| Component — Document-Level | 3 |
| Theme — Tokens & Defaults | 3 |
| Theme — Selectors | 4 |
| Theme — Per-Item Overrides | 5 |
| Theme — Page Layout | 11 |
| Theme — Document-Level | 5 |
| Mapping | 16 |
| Project-level | 5 |
| **Total Commands** | **122** |

| Query Category | Count |
|----------------|-------|
| Definition & Cross-Artifact | 14 |
| FEL | 8 |
| Extensions | 2 |
| Versioning | 2 |
| **Total Queries** | **26** |
