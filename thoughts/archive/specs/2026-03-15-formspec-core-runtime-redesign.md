# formspec-core Runtime Redesign

## Status

Proposed | 2026-03-15

## Problem

`raw-project.ts` is a 2,346-line file whose `RawProject` class (~2,140 lines, plus ~200 lines of top-level utilities) owns seven concerns: command dispatch, history, state management, component tree reconciliation, cross-artifact normalization, queries, and versioning. Four command execution paths exist with three different middleware behaviors. The handler registry uses global mutable state shared across all instances. One type in `ProjectState` (`ResolvedCatalog.entries: Map`) breaks JSON serialization. Two registry loading paths produce structurally different results.

These problems accumulated incrementally. Each decision was locally reasonable; the aggregate is not.

## Goals

1. **One dispatch pipeline.** All command execution routes through a single phase-aware pipeline. Middleware wraps it consistently.
2. **No global mutable state in the dispatch pipeline.** Handler table is a plain object, passed at construction. The handler registry `Map` and side-effect imports are eliminated. **Caveat:** Seven handler modules have module-level `let` counters for auto-generating unique IDs (`autoKeyCounter`, `nodeCounter`, `pageCounter`, `shapeCounter`, `varCounter`, `instanceCounter`, `pageIdCounter`). These are shared across instances. They produce monotonically increasing IDs so they don't cause correctness bugs, but two instances in the same process will see interleaved counter values. Fixing these (e.g., passing an ID generator via handler context) is out of scope for this redesign.
3. **Focused modules.** `RawProject` orchestrates; subsystems own their domain. Each module is small enough to hold in context.
4. **JSON-native state.** `ProjectState` is safe to `JSON.stringify`. Runtime indexes are private caches.
5. **Stable public interface.** `IProjectCore` does not change. Consumer packages require zero migration. Exception: `Middleware` type signature changes (no production consumers) and `ResolvedCatalog` type is removed (folded into `LoadedRegistry`).

## Non-Goals

- Changing command type strings or payload shapes.
- Adding new features (collaboration, new command types, UI state).
- Redesigning `formspec-studio-core`'s `Project` class (separate concern).
- Addressing `formspec-types` lint errors (tracked separately; `Item.children` typed as `{}` instead of array).

## Design

### 1. Explicit Handler Table

Each handler module exports a plain object instead of calling `registerHandler()` at import time.

**Before:**
```typescript
// handlers/definition-metadata.ts
import { registerHandler } from '../handler-registry.js';

registerHandler('definition.setTitle', (state, payload) => {
  // ...
  return { rebuildComponentTree: false };
});
```

**After:**
```typescript
// handlers/definition-metadata.ts
import type { CommandHandler } from '../types.js';

export const definitionMetadataHandlers: Record<string, CommandHandler> = {
  'definition.setTitle': (state, payload) => {
    // ...
    return { rebuildComponentTree: false };
  },
};
```

One aggregate module builds the full table from all handler modules:

```typescript
// handlers/index.ts
import { definitionMetadataHandlers } from './definition-metadata.js';
import { definitionItemsHandlers } from './definition-items.js';
// ... all 16 modules

export const builtinHandlers: Readonly<Record<string, CommandHandler>> = Object.freeze({
  ...definitionMetadataHandlers,
  ...definitionItemsHandlers,
  ...componentTreeHandlers,
  ...componentPropertiesHandlers,
  ...themeHandlers,
  ...mappingHandlers,
  ...pagesHandlers,
  ...projectHandlers,
  // ... remaining modules
});
```

`RawProject` receives the table at construction, with optional consumer extensions:

```typescript
constructor(options?: ProjectOptions) {
  this._handlers = options?.handlers
    ? { ...builtinHandlers, ...options.handlers }
    : builtinHandlers;
}
```

**Move:** `CommandHandler` type from `handler-registry.ts` to `types.ts`. Currently exported only from `handlers.ts`, not from `index.ts`. Add it to the `index.ts` public export list.

**Delete:** `handler-registry.ts` (global Map + register/get functions) and `handlers.ts` (side-effect import aggregator).

**Add to `ProjectOptions`:**
```typescript
interface ProjectOptions {
  // ... existing fields
  /** Additional command handlers merged with builtins. Keys override builtins. */
  handlers?: Record<string, CommandHandler>;
}
```

### 2. Unified Dispatch Pipeline

Four execution paths collapse to one internal method. The only variable is how commands are grouped into phases.

#### The Primitive

```typescript
private _execute(phases: AnyCommand[][]): CommandResult[]
```

All public methods delegate:

| Public method | Internal call |
|---|---|
| `dispatch(cmd)` | `_execute([[cmd]])` |
| `dispatch([a, b])` | `_execute([[a, b]])` |
| `batch([a, b])` | `_execute([[a, b]])` |
| `batchWithRebuild(p1, p2)` | `_execute([p1, p2])` |

#### Pipeline Lifecycle

One path, always:

1. **Middleware** wraps the entire execution plan — can inspect, transform, or reject before any handler runs.
2. **Clone** state once via `structuredClone`.
3. **For each phase:**
   a. Execute each command's handler on the clone.
   b. If any command in this phase signaled `rebuildComponentTree` and the component tree is generated (not authored), run tree reconciliation on the clone.
4. **Normalize** cross-artifact invariants on the clone.
5. **Push history** snapshot (pre-mutation state onto undo stack).
6. **Handle `clearHistory`** — if any result signals `clearHistory: true`, wipe undo/redo stacks and log instead of pushing. **Note:** No handler currently returns `clearHistory: true` (`project.import` explicitly returns `false`; `project.reset` does not exist). The field exists on `CommandResult` as an extension point. The unified pipeline preserves this plumbing so handlers or consumers can use it in the future without pipeline changes.
7. **Swap** state to the clone.
8. **Log** the command(s).
9. **Notify** change listeners.

If any handler throws, the clone is discarded. State is unchanged.

**Undo/redo note:** `undo()` and `redo()` bypass `_execute` — they swap pre-normalized snapshots directly and must NOT call `normalizeState`. The snapshots on the undo stack were already normalized when they were the active state.

#### Middleware Contract

Middleware wraps the plan. It runs once per `_execute` call, before handlers touch the clone:

```typescript
type Middleware = (
  state: Readonly<ProjectState>,
  commands: Readonly<AnyCommand[][]>,
  next: (commands: AnyCommand[][]) => CommandResult[],
) => CommandResult[];
```

This differs from today's single-command middleware signature. Middleware sees the full execution plan and can:
- Transform commands before passing to `next()`
- Reject by returning without calling `next()`
- Inspect results after `next()` returns
- Log, validate, audit

**Breaking change:** The `Middleware` type is a public export from `formspec-core`. This signature change breaks any code importing the type. No production middleware implementations exist today (only test fixtures), so the impact is limited to updating test files that define middleware functions.

**Behavioral change:** `batch()` currently bypasses middleware entirely. After this change, middleware wraps all execution paths uniformly. Code that relied on `batch()` to skip middleware interception will now be intercepted. This is intentional — the inconsistency was the original problem.

### 3. Subsystem Decomposition

`RawProject` delegates to focused subsystems. Each is a separate module.

#### CommandPipeline

Owns the execute loop. Receives handlers and middleware. Does not own state — takes state in, returns new state out.

```typescript
// pipeline.ts
export class CommandPipeline {
  constructor(
    private handlers: Readonly<Record<string, CommandHandler>>,
    private middleware: Middleware[],
  ) {}

  execute(
    state: ProjectState,
    phases: AnyCommand[][],
    reconcile: (clone: ProjectState) => void,
  ): { newState: ProjectState; results: CommandResult[] } {
    const clone = structuredClone(state);
    const allResults: CommandResult[] = [];

    for (const phase of phases) {
      const phaseResults: CommandResult[] = [];
      for (const cmd of phase) {
        const handler = this.handlers[cmd.type];
        if (!handler) throw new Error(`Unknown command type: ${cmd.type}`);
        phaseResults.push(handler(clone, cmd.payload));
      }
      allResults.push(...phaseResults);
      // Reconcile between phases when any command in this phase signals it
      if (phaseResults.some(r => r.rebuildComponentTree)) {
        reconcile(clone);
      }
    }

    return { newState: clone, results: allResults };
  }
}
```

The `reconcile` callback is how `RawProject` injects tree rebuild behavior without the pipeline knowing about component trees. The pipeline inspects per-phase results to decide when to call it.

#### HistoryManager

Owns undo/redo stacks, snapshot capping, and command log. Pure data structure — no knowledge of commands or state shape.

```typescript
// history.ts
export class HistoryManager<T> {
  constructor(maxDepth?: number);
  push(snapshot: T): void;
  popUndo(current: T): T | null;   // returns previous state, pushes current to redo
  popRedo(current: T): T | null;   // returns next state, pushes current to undo
  clear(): void;
  get canUndo(): boolean;
  get canRedo(): boolean;
  appendLog(entry: LogEntry): void;
  get log(): readonly LogEntry[];
}
```

#### Tree Reconciler

Pure function extracted from `_rebuildComponentTree` (~250 lines). Takes definition + current tree + theme, returns new tree. No instance state access. No state-swapping hack.

```typescript
// tree-reconciler.ts
import type { FormDefinition } from 'formspec-types';

export function reconcileComponentTree(
  definition: FormDefinition,
  currentTree: unknown,
  theme: ThemeState,
): unknown;
```

The `_rebuildComponentTree` method on `RawProject` today temporarily swaps `this._state` to operate on a clone. As a pure function, the reconciler operates directly on the clone's data — no swap needed.

**Implementation notes:**
- `_rebuildComponentTree` calls the private `_defaultComponent(item)` method to produce default component nodes for each item type. This logic must be inlined into the pure function or extracted as a helper within `tree-reconciler.ts`. It has no instance dependencies beyond reading the item's type and properties.
- `_markGeneratedComponentDoc()` sets `'x-studio-generated': true` on the generated component state after rebuild. This marker must be set by the caller (in `_execute`'s reconcile callback), not inside the pure reconciler function.

#### State Normalizer

Pure function extracted from `_normalize`. Enforces cross-artifact invariants on a mutable state object.

```typescript
// state-normalizer.ts
export function normalizeState(state: ProjectState): void;
```

Current invariants:
- Component, generated component, and theme `targetDefinition.url` stay in sync with `definition.url`
- Theme breakpoints sorted by `minWidth` ascending
- Component breakpoints inherit from theme when not independently set

#### Query Functions

The ~30 read-only methods become standalone functions in `queries/` modules. Each takes `ProjectState` (and optional dependencies like `SchemaValidator`) and returns a result.

```
queries/
  diagnostics.ts        — diagnose()
  dependency-graph.ts   — buildDependencyGraph(), fieldDependents()
  expression-index.ts   — allExpressions(), parseFEL(), availableReferences()
  field-queries.ts      — fieldPaths(), searchItems(), availableDataTypes()
  response-schema.ts    — responseSchemaRows()
  statistics.ts         — statistics()
  versioning.ts         — diffFromBaseline(), formatChangelog()
  registry-queries.ts   — listRegistries(), listExtensions(), felFunctions()
```

**Cross-dependencies:** Some query functions call other query functions (e.g., `statistics()` calls `allExpressions()` internally). Import across query modules as needed — they are all pure functions taking `ProjectState`, so no circular dependency risk.

`RawProject` keeps thin wrappers for `IProjectCore` compliance:

```typescript
diagnose(): Diagnostics {
  return diagnose(this._state, this._schemaValidator);
}

dependencyGraph(): DependencyGraph {
  return buildDependencyGraph(this._state);
}
```

### 4. JSON-Native State

Replace `ResolvedCatalog.entries: Map<string, unknown>` with a plain object:

**Before:**
```typescript
interface ResolvedCatalog {
  entries: Map<string, unknown>;
}
```

**After:**
```typescript
interface LoadedRegistry {
  url: string;
  document: unknown;
  /** Extension entries keyed by name. Plain object — JSON-serializable. */
  entries: Record<string, unknown>;
}
```

Remove `ResolvedCatalog` as a separate type and the `catalog` property from `LoadedRegistry`. Fold `entries` directly into `LoadedRegistry`. **Note:** `ResolvedCatalog` is currently a public export from `formspec-core/src/index.ts`. Removing it and renaming `catalog` to `entries` are breaking changes to the type surface. No downstream packages import `ResolvedCatalog` directly — `formspec-studio-core` uses `LoadedRegistry` and `ExtensionsState` but not `ResolvedCatalog`. Remove the export from `index.ts` in the same step.

**Runtime index** — `RawProject` holds a private cache for O(1) lookup, invalidated on state change:

```typescript
private _registryIndex: Map<string, Map<string, unknown>> | null = null;

private getRegistryIndex(): Map<string, Map<string, unknown>> {
  if (!this._registryIndex) {
    this._registryIndex = new Map();
    for (const reg of this._state.extensions.registries) {
      this._registryIndex.set(reg.url, new Map(Object.entries(reg.entries)));
    }
  }
  return this._registryIndex;
}
```

Invalidation: set `this._registryIndex = null` in `_execute` after state swap.

**Unify registry loading paths.** After this change, the `project.loadRegistry` handler stores `entries` as a `Record` (currently it builds a `Map`). The seed path (`ProjectOptions.seed.extensions`) accepts the same shape. Both go through the same normalization:

```typescript
function indexRegistry(registry: any): LoadedRegistry {
  const entries: Record<string, unknown> = {};
  for (const entry of registry.entries ?? []) {
    entries[entry.name] = entry;
  }
  return { url: registry.url, document: registry, entries };
}
```

Called by the handler. Called at construction for seeded registries. **Behavioral change:** Previously, `ProjectOptions.seed.extensions` required consumers to pre-build `LoadedRegistry` objects including the `Map` catalog. After this change, the construction path indexes registries automatically — consumers can seed raw registry documents or pre-indexed `LoadedRegistry` objects with `Record` entries.

### 5. RawProject After Redesign

```typescript
export class RawProject implements IProjectCore {
  private _state: ProjectState;
  private _pipeline: CommandPipeline;
  private _history: HistoryManager<ProjectState>;
  private _listeners: Set<ChangeListener>;
  private _schemaValidator: SchemaValidator | undefined;
  private _registryIndex: Map<string, Map<string, unknown>> | null = null;

  constructor(options?: ProjectOptions) {
    this._state = createDefaultState(options);
    this._pipeline = new CommandPipeline(
      options?.handlers ? { ...builtinHandlers, ...options.handlers } : builtinHandlers,
      options?.middleware ?? [],
    );
    this._history = new HistoryManager(options?.maxHistoryDepth);
    this._listeners = new Set();
    this._schemaValidator = options?.schemaValidator;
    // Initial tree build if needed
  }

  // ── Public dispatch surface (unchanged signatures) ──

  dispatch(command: AnyCommand): CommandResult;
  dispatch(command: AnyCommand[]): CommandResult[];
  dispatch(command: AnyCommand | AnyCommand[]): CommandResult | CommandResult[] {
    const commands = Array.isArray(command) ? command : [command];
    const results = this._execute([commands]);
    return Array.isArray(command) ? results : results[0];
  }

  batch(commands: AnyCommand[]): CommandResult[] {
    return this._execute([commands]);
  }

  batchWithRebuild(phase1: AnyCommand[], phase2: AnyCommand[]): CommandResult[] {
    return this._execute([phase1, phase2]);
  }

  // ── Single internal pipeline ──

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
          );
          clone.generatedComponent['x-studio-generated'] = true;
        }
      },
    );
    normalizeState(newState);
    if (results.some(r => r.clearHistory)) {
      this._history.clear();
    } else {
      this._history.push(snapshot);
    }
    this._state = newState;
    this._registryIndex = null; // invalidate cache
    this._logAndNotify(phases, results);
    return results;
  }

  // ── Queries (thin wrappers) ──

  diagnose(): Diagnostics { return diagnose(this._state, this._schemaValidator); }
  statistics(): ProjectStatistics { return statistics(this._state); }
  fieldPaths(): string[] { return fieldPaths(this._state); }
  // ... remaining query delegations
}
```

Target: ~300 lines for `RawProject`, down from 2,346.

## File Structure After Redesign

```
packages/formspec-core/src/
  raw-project.ts              (~300 lines — facade + orchestration)
  pipeline.ts                 (~80 lines — CommandPipeline)
  history.ts                  (~60 lines — HistoryManager)
  tree-reconciler.ts          (~250 lines — pure function)
  state-normalizer.ts         (~40 lines — pure function)
  types.ts                    (updated: ResolvedCatalog removed, LoadedRegistry simplified)
  project-core.ts             (IProjectCore — unchanged)
  component-documents.ts      (unchanged)
  normalization.ts            (unchanged — definition normalization, distinct from state normalization)
  page-resolution.ts          (unchanged)
  theme-cascade.ts            (unchanged)
  handlers/
    index.ts                  (explicit table: builtinHandlers export)
    helpers.ts                (resolveItemLocation — public re-export, unchanged)
    definition-metadata.ts    (exports object, no registerHandler)
    definition-items.ts
    definition-binds.ts
    definition-shapes.ts
    definition-variables.ts
    definition-pages.ts
    definition-optionsets.ts
    definition-instances.ts
    definition-screener.ts
    definition-migrations.ts
    component-tree.ts
    component-properties.ts
    theme.ts
    mapping.ts
    pages.ts
    project.ts
  queries/
    diagnostics.ts
    dependency-graph.ts
    expression-index.ts
    field-queries.ts
    response-schema.ts
    statistics.ts
    versioning.ts
    registry-queries.ts
```

**Deleted:** `handler-registry.ts`, `handlers.ts`

## Migration Path

Each step ships independently. Tests pass at every step because `IProjectCore` is stable. **Exception:** Steps 4 and 5 have a soft dependency — six query methods use `Map` methods on `reg.catalog.entries`. If Step 4 (query extraction) ships before Step 5 (JSON-native state), the extracted query functions will use `Map` APIs that Step 5 must then update. Either do Step 5 before Step 4, or accept that Step 5 touches query files extracted in Step 4.

### Step 1: Explicit Handler Table

Move `CommandHandler` type from `handler-registry.ts` to `types.ts`. Convert each handler module from `registerHandler()` calls to exported objects. Create `handlers/index.ts` with the aggregate table. Wire `RawProject` constructor to use it. Delete `handler-registry.ts` and `handlers.ts`. Update `index.ts` to export `CommandHandler` from `types.js` instead of `handlers.js`.

**Verification:** All existing tests pass. Add test proving two `RawProject` instances have independent handler tables.

### Step 2: Unified Pipeline

Extract `CommandPipeline` class. Rewrite `_dispatchSingle`, `_dispatchArray`, `batch`, and `batchWithRebuild` to delegate to `_execute`. Update `Middleware` type signature (breaking change — update test middleware fixtures). Handle `clearHistory` result flag in `_execute`.

**Behavioral changes:**
- `batch()` and `batchWithRebuild()` now run through middleware (previously bypassed entirely).
- `dispatch(array)` middleware now runs *before* handlers execute (previously ran post-hoc with a no-op inner chain — middleware could observe but not transform or reject).
- `clearHistory` is now honored in all dispatch paths. Previously only `_dispatchSingle` checked it; `batch()` and `batchWithRebuild()` ignored it. No handler currently returns `clearHistory: true`, so this is a consistency fix for future use, not a behavioral change today.

Update any tests that assert middleware bypass or post-hoc behavior.

**Verification:** All existing tests pass (after updating middleware test fixtures). Add test proving middleware runs consistently across all dispatch paths.

### Step 3: Extract Tree Reconciler

Pull `_rebuildComponentTree` and `_defaultComponent` into `tree-reconciler.ts` as a pure function. Eliminate the state-swap hack in `batchWithRebuild`.

**Verification:** All tree-sync and component-rebuild tests pass.

### Step 4: Extract Query Functions

Move read-only methods to `queries/` modules. `RawProject` keeps thin wrappers.

**Verification:** All query and diagnostics tests pass.

### Step 5: JSON-Native State

Replace `Map` in `LoadedRegistry` with `Record`. Add lazy cache. Unify seed and command registry loading through `indexRegistry()`. Remove `ResolvedCatalog` type.

**Verification:** All registry tests pass. Add test proving `JSON.stringify(project.state)` round-trips cleanly.

### Step 6: Extract History and Normalizer

Pull `HistoryManager` and `normalizeState` into their own modules.

**Verification:** All undo/redo and normalization tests pass.

## Known Issues (Out of Scope)

- **`formspec-types` lint errors in `formspec-studio-core`:** `Item.children` is typed as `{}` instead of an array type. Three errors in `project.ts` (lines 719, 729, 1374). These predate this redesign and should be addressed in a separate fix — either by correcting the schema's `children` type or by adding a cast in `formspec-studio-core`.
- **Theme page → PageLayout rename:** `formspec-types` now exports `PageLayout` instead of a generic page type. Handler code referencing `pages` arrays may need type annotations updated during implementation.
- **`ChangeListener` type shadow:** `formspec-core` defines `ChangeListener` as `(state, event) => void`. `formspec-studio-core` defines its own `ChangeListener` as a zero-arg callback `() => void`. Same name, different signatures, different packages. Not blocked by this redesign but worth noting for anyone reading the type surface.

## Supersedes

This spec supersedes the runtime architecture portions of:
- [ADR 0001: Current State Authoring Runtime](../../packages/formspec-studio-core/research/adr/0001-current-state-authoring-runtime.md) — slices 1, 2, 3, 4, 5
- [ADR 0002: Post-Split Follow-Ups](../../packages/formspec-studio-core/research/adr/0002-post-split-follow-ups.md) — items 1–5
