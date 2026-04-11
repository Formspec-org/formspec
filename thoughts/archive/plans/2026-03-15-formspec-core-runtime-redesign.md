# formspec-core Runtime Redesign — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decompose `RawProject` (~2,346 lines, 7 concerns) into focused subsystems with a single unified dispatch pipeline, no global mutable state, and JSON-native state.

**Architecture:** Six incremental steps, each independently shippable. Handler modules convert from self-registration to exported objects. Four dispatch paths collapse into `_execute(phases)`. Tree reconciliation, history, normalization, and queries extract into focused modules. `ResolvedCatalog.entries: Map` becomes `Record`. `IProjectCore` stays unchanged throughout.

**Tech Stack:** TypeScript, Vitest, formspec-types, formspec-engine

**Spec:** `docs/superpowers/specs/2026-03-15-formspec-core-runtime-redesign.md`

---

## Chunk 1: Explicit Handler Table (Step 1)

Convert 16 handler modules from `registerHandler()` calls to exported objects. Create aggregate `handlers/index.ts`. Wire `RawProject` to use the table. Delete `handler-registry.ts` and `handlers.ts`.

### Task 1: Move `CommandHandler` type to `types.ts`

**Files:**
- Modify: `packages/formspec-core/src/types.ts`
- Modify: `packages/formspec-core/src/handler-registry.ts`
- Modify: `packages/formspec-core/src/index.ts`

- [ ] **Step 1: Add `CommandHandler` type to `types.ts`**

After the `CommandResult` interface (around line 204), add:

```typescript
/**
 * A function that applies a command's payload to a cloned project state.
 * Handlers receive a mutable clone of ProjectState and mutate it in-place.
 * They return a CommandResult indicating what side effects are needed.
 */
export type CommandHandler = (
  state: ProjectState,
  payload: unknown,
) => CommandResult & Record<string, unknown>;
```

- [ ] **Step 2: Update `handler-registry.ts` to import from `types.ts`**

Replace the inline `CommandHandler` type definition with:

```typescript
import type { ProjectState, CommandResult, CommandHandler } from './types.js';
```

Remove the `CommandHandler` type definition (lines 14-25). Keep the `export type { CommandHandler }` re-export for now (will be removed later).

- [ ] **Step 3: Add `CommandHandler` to `index.ts` exports**

In `packages/formspec-core/src/index.ts`, add `CommandHandler` to the "Core operational types" export block:

```typescript
export type {
  // ... existing types ...
  CommandHandler,
  // ...
} from './types.js';
```

- [ ] **Step 4: Run tests to verify**

Run: `cd packages/formspec-core && npm test`
Expected: All 424 passing, 3 failing (pre-existing schema resolution — unchanged).

- [ ] **Step 5: Commit**

```bash
git add packages/formspec-core/src/types.ts packages/formspec-core/src/handler-registry.ts packages/formspec-core/src/index.ts
git commit -m "refactor: move CommandHandler type to types.ts, add to public exports"
```

### Task 2: Convert handler modules to exported objects

**Files:**
- Modify: All 17 files in `packages/formspec-core/src/handlers/` (except `helpers.ts`)

Each handler module currently:
1. Imports `registerHandler` from `../handler-registry.js`
2. Calls `registerHandler('command.type', (state, payload) => { ... })` for each command

Convert each to:
1. Import `CommandHandler` from `../types.js`
2. Export a named `Record<string, CommandHandler>` object

The transformation is mechanical. For each file:

**Pattern — Before:**
```typescript
import { registerHandler } from '../handler-registry.js';

registerHandler('command.name', (state, payload) => {
  // handler body
  return { rebuildComponentTree: false };
});
```

**Pattern — After:**
```typescript
import type { CommandHandler } from '../types.js';

export const moduleNameHandlers: Record<string, CommandHandler> = {
  'command.name': (state, payload) => {
    // handler body (unchanged)
    return { rebuildComponentTree: false };
  },
};
```

- [ ] **Step 1: Convert `definition-metadata.ts`**

Export name: `definitionMetadataHandlers`
Commands: `definition.setFormTitle`

- [ ] **Step 2: Convert `definition-items.ts`**

Export name: `definitionItemsHandlers`
Commands: `definition.addItem`, `definition.deleteItem`, `definition.renameItem`, `definition.moveItem`, `definition.reorderItem`, `definition.duplicateItem`

Note: This file has top-level helpers and a module-level `let autoKeyCounter`. Keep the counter and helpers as-is — they're module-scoped, not in the export object. Only wrap the `registerHandler` calls.

- [ ] **Step 3: Convert `definition-binds.ts`**

Export name: `definitionBindsHandlers`
Commands: `definition.setBind`, `definition.setItemProperty`, `definition.setFieldDataType`, `definition.setFieldOptions`, `definition.setItemExtension`

- [ ] **Step 4: Convert `definition-shapes.ts`**

Export name: `definitionShapesHandlers`
Commands: `definition.addShape`, `definition.setShapeProperty`, `definition.setShapeComposition`, `definition.renameShape`, `definition.deleteShape`

Note: Has module-level `let shapeCounter`.

- [ ] **Step 5: Convert `definition-variables.ts`**

Export name: `definitionVariablesHandlers`
Commands: `definition.addVariable`, `definition.setVariable`, `definition.deleteVariable`

Note: Has module-level `let varCounter`.

- [ ] **Step 6: Convert `definition-pages.ts`**

Export name: `definitionPagesHandlers`
Commands: `definition.setDefinitionProperty`, `definition.setFormPresentation`, `definition.setGroupRef`

- [ ] **Step 7: Convert `definition-optionsets.ts`**

Export name: `definitionOptionsetsHandlers`
Commands: `definition.setOptionSet`, `definition.setOptionSetProperty`, `definition.deleteOptionSet`, `definition.promoteToOptionSet`

- [ ] **Step 8: Convert `definition-instances.ts`**

Export name: `definitionInstancesHandlers`
Commands: `definition.addInstance`, `definition.setInstance`, `definition.renameInstance`, `definition.deleteInstance`

Note: Has module-level `let instanceCounter`.

- [ ] **Step 9: Convert `definition-screener.ts`**

Export name: `definitionScreenerHandlers`
Commands: `definition.setScreener`, `definition.addScreenerItem`, `definition.deleteScreenerItem`, `definition.setScreenerBind`, `definition.addRoute`, `definition.setRouteProperty`, `definition.deleteRoute`, `definition.reorderRoute`

- [ ] **Step 10: Convert `definition-migrations.ts`**

Export name: `definitionMigrationsHandlers`
Commands: `definition.addMigration`, `definition.deleteMigration`, `definition.setMigrationProperty`, `definition.addFieldMapRule`, `definition.setFieldMapRule`, `definition.deleteFieldMapRule`, `definition.setMigrationDefaults`

- [ ] **Step 11: Convert `component-tree.ts`**

Export name: `componentTreeHandlers`
Commands: `component.addNode`, `component.deleteNode`, `component.moveNode`, `component.reorderNode`, `component.duplicateNode`, `component.wrapNode`, `component.unwrapNode`

Note: Has module-level `let nodeCounter`.

- [ ] **Step 12: Convert `component-properties.ts`**

Export name: `componentPropertiesHandlers`
Commands: `component.setNodeProperty`, `component.setNodeType`, `component.setNodeStyle`, `component.setNodeAccessibility`, `component.spliceArrayProp`, `component.setFieldWidget`, `component.setResponsiveOverride`, `component.setWizardProperty`, `component.setGroupRepeatable`, `component.setGroupDisplayMode`, `component.setGroupDataTable`, `component.registerCustom`, `component.updateCustom`, `component.deleteCustom`, `component.renameCustom`, `component.setToken`, `component.setBreakpoint`, `component.setDocumentProperty`

- [ ] **Step 13: Convert `theme.ts`**

Export name: `themeHandlers`
Commands: All 28 `theme.*` commands (see grep output).

- [ ] **Step 14: Convert `mapping.ts`**

Export name: `mappingHandlers`
Commands: All 16 `mapping.*` commands.

- [ ] **Step 15: Convert `pages.ts`**

Export name: `pagesHandlers`
Commands: `pages.addPage`, `pages.deletePage`, `pages.setMode`, `pages.reorderPages`, `pages.setPageProperty`, `pages.assignItem`, `pages.unassignItem`, `pages.autoGenerate`, `pages.reorderRegion`, `pages.setRegionProperty`

Note: Has module-level `let pageCounter` and `let pageIdCounter`.

- [ ] **Step 16: Convert `project.ts`**

Export name: `projectHandlers`
Commands: `project.import`, `project.importSubform`, `project.loadRegistry`, `project.removeRegistry`, `project.publish`

Note: `project.loadRegistry` builds a `Map` for `catalog.entries` — leave as-is for now (Step 5 changes this to `Record`).

- [ ] **Step 17: Proceed to Task 3**

Do NOT commit yet — the handler modules are converted but not wired. Tests will fail until Task 3 completes. Tasks 2 and 3 land as a single atomic commit.

### Task 3: Create aggregate handler table and wire into RawProject

**Files:**
- Create: `packages/formspec-core/src/handlers/index.ts` (new — replaces old `handlers.ts`)
- Modify: `packages/formspec-core/src/raw-project.ts`
- Modify: `packages/formspec-core/src/types.ts` (add `handlers` to `ProjectOptions`)
- Delete: `packages/formspec-core/src/handler-registry.ts`
- Delete: `packages/formspec-core/src/handlers.ts` (the old side-effect aggregator — NOT `handlers/index.ts`)

- [ ] **Step 1: Write the failing test — independent handler tables**

Create a test that proves two `RawProject` instances can have independent handler tables. Add to `packages/formspec-core/tests/raw-project.test.ts`:

```typescript
describe('handler table', () => {
  it('two instances have independent handler tables when custom handlers provided', () => {
    const customHandler = (_state: any, _payload: any) => ({
      rebuildComponentTree: false,
      custom: true,
    });
    const p1 = createRawProject({
      handlers: { 'custom.test': customHandler },
    });
    const p2 = createRawProject();

    // p1 can dispatch custom command
    const result = p1.dispatch({ type: 'custom.test', payload: {} });
    expect((result as any).custom).toBe(true);

    // p2 cannot — it only has builtins
    expect(() => p2.dispatch({ type: 'custom.test', payload: {} })).toThrow('Unknown command type');
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `cd packages/formspec-core && npx vitest run tests/raw-project.test.ts`
Expected: FAIL — `ProjectOptions` doesn't have `handlers`, `createRawProject` doesn't accept it.

- [ ] **Step 3: Create `handlers/index.ts` — the aggregate table**

```typescript
import type { CommandHandler } from '../types.js';

import { definitionMetadataHandlers } from './definition-metadata.js';
import { definitionItemsHandlers } from './definition-items.js';
import { definitionBindsHandlers } from './definition-binds.js';
import { definitionShapesHandlers } from './definition-shapes.js';
import { definitionVariablesHandlers } from './definition-variables.js';
import { definitionPagesHandlers } from './definition-pages.js';
import { definitionOptionsetsHandlers } from './definition-optionsets.js';
import { definitionInstancesHandlers } from './definition-instances.js';
import { definitionScreenerHandlers } from './definition-screener.js';
import { definitionMigrationsHandlers } from './definition-migrations.js';
import { componentTreeHandlers } from './component-tree.js';
import { componentPropertiesHandlers } from './component-properties.js';
import { themeHandlers } from './theme.js';
import { mappingHandlers } from './mapping.js';
import { pagesHandlers } from './pages.js';
import { projectHandlers } from './project.js';

export type { CommandHandler };

export const builtinHandlers: Readonly<Record<string, CommandHandler>> = Object.freeze({
  ...definitionMetadataHandlers,
  ...definitionItemsHandlers,
  ...definitionBindsHandlers,
  ...definitionShapesHandlers,
  ...definitionVariablesHandlers,
  ...definitionPagesHandlers,
  ...definitionOptionsetsHandlers,
  ...definitionInstancesHandlers,
  ...definitionScreenerHandlers,
  ...definitionMigrationsHandlers,
  ...componentTreeHandlers,
  ...componentPropertiesHandlers,
  ...themeHandlers,
  ...mappingHandlers,
  ...pagesHandlers,
  ...projectHandlers,
});
```

- [ ] **Step 4: Add `handlers` to `ProjectOptions` in `types.ts`**

```typescript
export interface ProjectOptions {
  // ... existing fields ...
  /** Additional command handlers merged with builtins. Keys override builtins. */
  handlers?: Record<string, CommandHandler>;
}
```

- [ ] **Step 5: Wire `RawProject` to use handler table**

In `raw-project.ts`:

1. Replace `import { getHandler } from './handlers.js'` with `import { builtinHandlers } from './handlers/index.js'`.

2. Add a private field:
```typescript
private _handlers: Readonly<Record<string, CommandHandler>>;
```

3. In the constructor, build the table:
```typescript
this._handlers = options?.handlers
  ? Object.freeze({ ...builtinHandlers, ...options.handlers })
  : builtinHandlers;
```

4. Replace every `getHandler(cmd.type)` call (5 occurrences across `_dispatchSingle`, `_dispatchArray`, `batchWithRebuild`, `batch`) with:
```typescript
const handler = this._handlers[cmd.type];
if (!handler) throw new Error(`Unknown command type: ${cmd.type}`);
```

- [ ] **Step 6: Delete `handler-registry.ts` and old `handlers.ts`**

```bash
rm packages/formspec-core/src/handler-registry.ts
rm packages/formspec-core/src/handlers.ts
```

- [ ] **Step 7: Update `index.ts` imports if needed**

The `CommandHandler` type now comes from `types.ts` (already added in Task 1). Verify no imports reference the deleted `handlers.ts` — they should all point to `handlers/index.js` or `types.js`.

Verify `index.ts` still has: `export { resolveItemLocation } from './handlers/helpers.js';` (this was never routed through `handlers.ts`).

- [ ] **Step 8: Run ALL tests — verify they pass**

Run: `cd packages/formspec-core && npm test`
Expected: All 424 passing (plus the new handler table test), 3 failing (pre-existing).

Also run studio-core to verify no breakage:
Run: `cd packages/formspec-studio-core && npm test`
Expected: 222 passing.

- [ ] **Step 9: Commit (includes Task 2 handler conversions)**

This commit includes both the handler module conversions (Task 2) and the wiring (Task 3) as one atomic change — tests are green.

```bash
git add -A packages/formspec-core/src/
git add packages/formspec-core/tests/raw-project.test.ts
git commit -m "refactor: replace global handler registry with explicit handler table

- Convert 16 handler modules from registerHandler() to exported objects
- handlers/index.ts aggregates all handler modules into builtinHandlers
- RawProject receives handler table at construction (options.handlers for extensions)
- Delete handler-registry.ts (global Map) and handlers.ts (side-effect imports)"
```

---

## Chunk 2: Unified Dispatch Pipeline (Step 2)

Collapse `_dispatchSingle`, `_dispatchArray`, `batch`, and `batchWithRebuild` into `_execute(phases)`. Extract `CommandPipeline`. Update `Middleware` signature.

### Task 4: Extract `CommandPipeline` class

**Files:**
- Create: `packages/formspec-core/src/pipeline.ts`
- Create: `packages/formspec-core/tests/pipeline.test.ts`

- [ ] **Step 1: Write failing tests for `CommandPipeline`**

```typescript
import { describe, it, expect } from 'vitest';
import { CommandPipeline } from '../src/pipeline.js';
import type { CommandHandler, ProjectState, AnyCommand } from '../src/types.js';

// Minimal state factory for testing
function minimalState(): ProjectState {
  return {
    definition: { $formspec: '1.0', url: '', version: '', status: 'draft', title: '', items: [] } as any,
    component: {},
    generatedComponent: { 'x-studio-generated': true as const },
    theme: {},
    mapping: {},
    extensions: { registries: [] },
    versioning: { baseline: {} as any, releases: [] },
  } as ProjectState;
}

describe('CommandPipeline', () => {
  const setTitle: CommandHandler = (state, payload) => {
    const { title } = payload as { title: string };
    state.definition.title = title;
    return { rebuildComponentTree: false };
  };

  const addItem: CommandHandler = (state, payload) => {
    const { key } = payload as { key: string };
    (state.definition.items as any[]).push({ key, type: 'field' });
    return { rebuildComponentTree: true };
  };

  const handlers: Record<string, CommandHandler> = {
    'definition.setFormTitle': setTitle,
    'definition.addItem': addItem,
  };

  it('executes a single-phase command', () => {
    const pipeline = new CommandPipeline(handlers, []);
    const state = minimalState();
    const { newState, results } = pipeline.execute(
      state,
      [[{ type: 'definition.setFormTitle', payload: { title: 'Hello' } }]],
      () => {},
    );
    expect(newState.definition.title).toBe('Hello');
    expect(results).toHaveLength(1);
    expect(results[0].rebuildComponentTree).toBe(false);
    // Original state unchanged
    expect(state.definition.title).toBe('');
  });

  it('executes multi-phase with reconcile between phases', () => {
    let reconcileCount = 0;
    const pipeline = new CommandPipeline(handlers, []);
    const { results } = pipeline.execute(
      minimalState(),
      [
        [{ type: 'definition.addItem', payload: { key: 'f1' } }],
        [{ type: 'definition.setFormTitle', payload: { title: 'After' } }],
      ],
      () => { reconcileCount++; },
    );
    // addItem signals rebuildComponentTree, so reconcile runs between phases
    expect(reconcileCount).toBe(1);
    expect(results).toHaveLength(2);
  });

  it('does NOT reconcile when no command signals rebuild', () => {
    let reconcileCount = 0;
    const pipeline = new CommandPipeline(handlers, []);
    pipeline.execute(
      minimalState(),
      [
        [{ type: 'definition.setFormTitle', payload: { title: 'A' } }],
        [{ type: 'definition.setFormTitle', payload: { title: 'B' } }],
      ],
      () => { reconcileCount++; },
    );
    expect(reconcileCount).toBe(0);
  });

  it('throws on unknown command type', () => {
    const pipeline = new CommandPipeline(handlers, []);
    expect(() => pipeline.execute(
      minimalState(),
      [[{ type: 'nonexistent.command', payload: {} }]],
      () => {},
    )).toThrow('Unknown command type: nonexistent.command');
  });

  it('runs middleware wrapping the entire execution', () => {
    const log: string[] = [];
    const middleware = [
      (state: any, commands: any, next: any) => {
        log.push('before');
        const results = next(commands);
        log.push('after');
        return results;
      },
    ];
    const pipeline = new CommandPipeline(handlers, middleware);
    pipeline.execute(
      minimalState(),
      [[{ type: 'definition.setFormTitle', payload: { title: 'X' } }]],
      () => {},
    );
    expect(log).toEqual(['before', 'after']);
  });

  it('middleware can reject by not calling next', () => {
    const middleware = [
      (state: any, _commands: any, _next: any) => {
        // Return a clone of the original state — not a live reference
        return { newState: structuredClone(state), results: [{ rebuildComponentTree: false }] };
      },
    ];
    const pipeline = new CommandPipeline(handlers, middleware);
    const state = minimalState();
    const { newState } = pipeline.execute(
      state,
      [[{ type: 'definition.setFormTitle', payload: { title: 'Blocked' } }]],
      () => {},
    );
    // State unchanged — middleware blocked
    expect(newState.definition.title).toBe('');
  });

  it('rolls back if any command throws', () => {
    const badHandler: CommandHandler = () => { throw new Error('boom'); };
    const pipeline = new CommandPipeline(
      { ...handlers, 'bad.command': badHandler },
      [],
    );
    expect(() => pipeline.execute(
      minimalState(),
      [[
        { type: 'definition.setFormTitle', payload: { title: 'Set' } },
        { type: 'bad.command', payload: {} },
      ]],
      () => {},
    )).toThrow('boom');
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `cd packages/formspec-core && npx vitest run tests/pipeline.test.ts`
Expected: FAIL — `pipeline.ts` doesn't exist.

- [ ] **Step 3: Implement `CommandPipeline`**

Create `packages/formspec-core/src/pipeline.ts`:

```typescript
import type { CommandHandler, ProjectState, AnyCommand, CommandResult, Middleware } from './types.js';

/**
 * Phase-aware command execution pipeline.
 *
 * Receives an immutable state, clones it, runs commands across phases with
 * inter-phase reconciliation, and returns the new state with all results.
 * Middleware wraps the entire execution plan.
 */
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
    // Build the core execution function
    const core = (cmds: AnyCommand[][]): { newState: ProjectState; results: CommandResult[] } => {
      const clone = structuredClone(state);
      const allResults: CommandResult[] = [];

      for (const phase of cmds) {
        const phaseResults: CommandResult[] = [];
        for (const cmd of phase) {
          const handler = this.handlers[cmd.type];
          if (!handler) throw new Error(`Unknown command type: ${cmd.type}`);
          phaseResults.push(handler(clone, cmd.payload));
        }
        allResults.push(...phaseResults);
        if (phaseResults.some(r => r.rebuildComponentTree)) {
          reconcile(clone);
        }
      }

      return { newState: clone, results: allResults };
    };

    // Wrap with middleware
    if (this.middleware.length === 0) {
      return core(phases);
    }

    let chain = core;
    for (let i = this.middleware.length - 1; i >= 0; i--) {
      const mw = this.middleware[i];
      const next = chain;
      chain = (cmds) => mw(state, cmds, next);
    }
    return chain(phases);
  }
}
```

- [ ] **Step 4: Run pipeline tests — verify they pass**

Run: `cd packages/formspec-core && npx vitest run tests/pipeline.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/formspec-core/src/pipeline.ts packages/formspec-core/tests/pipeline.test.ts
git commit -m "feat: add CommandPipeline class with phase-aware execution and middleware"
```

### Task 5: Update `Middleware` type signature

**Files:**
- Modify: `packages/formspec-core/src/types.ts`
- Modify: `packages/formspec-core/tests/raw-project.test.ts`
- Modify: `packages/formspec-core/tests/definition-shapes-vars.test.ts`

- [ ] **Step 1: Update `Middleware` type in `types.ts`**

Replace lines 252-256:

```typescript
export type Middleware = (
  state: Readonly<ProjectState>,
  commands: Readonly<AnyCommand[][]>,
  next: (commands: AnyCommand[][]) => { newState: ProjectState; results: CommandResult[] },
) => { newState: ProjectState; results: CommandResult[] };
```

- [ ] **Step 2: Run tests — verify they FAIL**

Run: `cd packages/formspec-core && npm test`
Expected: FAIL — existing middleware tests use old `(state, command, next)` signature.

- [ ] **Step 3: Update middleware test in `raw-project.test.ts`**

Update the middleware test (line 36-49). The old test creates middleware with `(_state, _cmd, next)` and passes a single command. Update to the new `(state, commands, next)` shape:

```typescript
it('runs middleware once for array dispatch', () => {
  let callCount = 0;
  const raw = createRawProject({
    middleware: [(_state, _cmds, next) => {
      callCount++;
      return next(_cmds);
    }],
  });
  raw.dispatch([
    { type: 'definition.addItem', payload: { type: 'field', key: 'a' } },
    { type: 'definition.addItem', payload: { type: 'field', key: 'b' } },
  ]);
  expect(callCount).toBe(1);
});
```

- [ ] **Step 4: Update middleware tests in `definition-shapes-vars.test.ts`**

Update both middleware tests (lines 286-320) to new signature:

```typescript
describe('middleware', () => {
  it('wraps dispatch and can observe commands', () => {
    const log: string[] = [];

    const project = createRawProject({
      middleware: [
        (_state, commands, next) => {
          log.push(`before:${commands[0]?.[0]?.type}`);
          const result = next(commands);
          log.push(`after:${commands[0]?.[0]?.type}`);
          return result;
        },
      ],
    });

    project.dispatch({ type: 'definition.setFormTitle', payload: { title: 'Test' } });

    expect(log).toEqual(['before:definition.setFormTitle', 'after:definition.setFormTitle']);
    expect(project.definition.title).toBe('Test');
  });

  it('can block a command by not calling next', () => {
    const project = createRawProject({
      middleware: [
        (state, _commands, _next) => {
          return { newState: structuredClone(state) as any, results: [{ rebuildComponentTree: false }] };
        },
      ],
    });

    project.dispatch({ type: 'definition.setFormTitle', payload: { title: 'Blocked' } });

    expect(project.definition.title).toBe('');
  });
});
```

- [ ] **Step 5: Update pipeline tests to match final Middleware type**

Update `packages/formspec-core/tests/pipeline.test.ts` middleware tests to use the correct type signature.

- [ ] **Step 6: Run tests — verify they still fail (pipeline not wired in yet)**

The middleware tests should compile but the wiring in `RawProject` still uses the old dispatch paths. We'll fix that in the next task.

- [ ] **Step 7: Commit**

```bash
git add packages/formspec-core/src/types.ts packages/formspec-core/tests/
git commit -m "refactor: update Middleware type to phase-aware signature

Breaking change: Middleware now receives (state, commands[][], next) instead of
(state, command, next). No production consumers exist."
```

### Task 6: Rewrite dispatch methods to use `_execute` + `CommandPipeline`

**Files:**
- Modify: `packages/formspec-core/src/raw-project.ts`

- [ ] **Step 1: Write failing test — middleware runs for batch()**

Currently `batch()` bypasses middleware. Add a test proving it runs:

In `packages/formspec-core/tests/batch-and-notify.test.ts`:

```typescript
it('runs middleware for batch operations', () => {
  let middlewareRan = false;
  const project = createRawProject({
    middleware: [(_state, commands, next) => {
      middlewareRan = true;
      return next(commands);
    }],
  });

  project.batch([
    { type: 'definition.setFormTitle', payload: { title: 'Batched' } },
  ]);

  expect(middlewareRan).toBe(true);
  expect(project.definition.title).toBe('Batched');
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `cd packages/formspec-core && npx vitest run tests/batch-and-notify.test.ts`
Expected: FAIL — `batch()` currently bypasses middleware.

- [ ] **Step 3: Implement `_execute` on RawProject**

In `raw-project.ts`, add the `CommandPipeline` import and private field, then implement `_execute`:

```typescript
import { CommandPipeline } from './pipeline.js';
```

Add private field:
```typescript
private _pipeline: CommandPipeline;
```

Initialize in constructor (after `_handlers` is set):
```typescript
this._pipeline = new CommandPipeline(
  this._handlers,
  options?.middleware ?? [],
);
```

Add `_execute` method:

**Critical ordering:** snapshot must be cloned (not a reference) because `_normalize` mutates state in-place. Normalization runs on `newState` before the swap. History push uses the clean snapshot.

```typescript
private _execute(phases: AnyCommand[][]): CommandResult[] {
  // Clone snapshot for undo — must be independent of any mutation
  const snapshot = structuredClone(this._state);

  const { newState, results } = this._pipeline.execute(
    this._state,
    phases,
    (clone) => {
      if (!hasAuthoredComponentTree(clone.component)) {
        // Inline tree rebuild on clone — will be extracted to tree-reconciler in Task 8
        const saved = this._state;
        this._state = clone;
        this._rebuildComponentTree();
        this._state = saved;
      }
    },
  );

  // Normalize the new state (not the old state!)
  // Temporarily swap so _normalize operates on newState
  const saved = this._state;
  this._state = newState;
  this._normalize();
  this._state = saved;

  // History
  if (results.some(r => r.clearHistory)) {
    this._undoStack.length = 0;
    this._redoStack.length = 0;
    this._log.length = 0;
  } else {
    this._pushHistory(snapshot);
  }

  // Swap to new state
  this._state = newState;

  // Log — preserve phase structure for replay fidelity
  const allCommands = phases.flat();
  const logCommand: AnyCommand = allCommands.length === 1
    ? allCommands[0]
    : phases.length > 1
      ? { type: 'batchWithRebuild', payload: { phases } }
      : { type: 'batch', payload: { commands: allCommands } };
  this._log.push({ command: logCommand, timestamp: Date.now() });

  // Notify
  const source = allCommands.length === 1 ? 'dispatch' : 'batch';
  this._notify(
    logCommand,
    { rebuildComponentTree: results.some(r => r.rebuildComponentTree) },
    source,
  );

  return results;
}
```

**Note on `batchWithRebuild` semantics:** The current implementation rebuilds unconditionally between phases. The new `CommandPipeline` rebuilds conditionally (only when a phase-1 command signals `rebuildComponentTree`). In practice, all current `batchWithRebuild` callers send `definition.addItem` in phase 1, which always signals rebuild. If unconditional semantics are needed in the future, callers can add a no-op rebuild-signaling command.

**Note on reconcile callback:** Still uses the `_state` swap hack temporarily. Task 8 (tree reconciler extraction) will eliminate this.

- [ ] **Step 4: Rewrite public dispatch methods**

Replace `_dispatchSingle`, `_dispatchArray`, `batchWithRebuild`, and `batch` with:

```typescript
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
```

Delete `_dispatchSingle` and `_dispatchArray` methods entirely.

- [ ] **Step 5: Run ALL tests**

Run: `cd packages/formspec-core && npm test`
Expected: All pass (424 + new tests), 3 pre-existing failures.

Run: `cd packages/formspec-studio-core && npm test`
Expected: 222 passing.

- [ ] **Step 6: Commit**

```bash
git add packages/formspec-core/src/raw-project.ts packages/formspec-core/src/pipeline.ts packages/formspec-core/tests/
git commit -m "refactor: unify dispatch paths into _execute + CommandPipeline

Four dispatch paths (single, array, batch, batchWithRebuild) now delegate to
_execute(phases). Middleware wraps all paths uniformly. batch() no longer
bypasses middleware."
```

---

## Chunk 3: Extract Tree Reconciler and History (Steps 3 + 6)

### Task 7: Extract `HistoryManager`

**Files:**
- Create: `packages/formspec-core/src/history.ts`
- Create: `packages/formspec-core/tests/history-manager.test.ts`
- Modify: `packages/formspec-core/src/raw-project.ts`

- [ ] **Step 1: Write failing tests for `HistoryManager`**

```typescript
import { describe, it, expect } from 'vitest';
import { HistoryManager } from '../src/history.js';

describe('HistoryManager', () => {
  it('push and popUndo', () => {
    const hm = new HistoryManager<string>();
    hm.push('state-0');
    expect(hm.canUndo).toBe(true);
    const prev = hm.popUndo('state-1');
    expect(prev).toBe('state-0');
    expect(hm.canUndo).toBe(false);
    expect(hm.canRedo).toBe(true);
  });

  it('popRedo after undo', () => {
    const hm = new HistoryManager<string>();
    hm.push('state-0');
    hm.popUndo('state-1');
    const next = hm.popRedo('state-0');
    expect(next).toBe('state-1');
    expect(hm.canRedo).toBe(false);
  });

  it('returns null when nothing to undo/redo', () => {
    const hm = new HistoryManager<string>();
    expect(hm.popUndo('current')).toBeNull();
    expect(hm.popRedo('current')).toBeNull();
  });

  it('clears redo on push', () => {
    const hm = new HistoryManager<string>();
    hm.push('a');
    hm.popUndo('b'); // redo has 'b'
    expect(hm.canRedo).toBe(true);
    hm.push('c'); // clears redo
    expect(hm.canRedo).toBe(false);
  });

  it('respects maxDepth', () => {
    const hm = new HistoryManager<string>(2);
    hm.push('a');
    hm.push('b');
    hm.push('c'); // 'a' pruned
    expect(hm.popUndo('d')).toBe('c');
    expect(hm.popUndo('c')).toBe('b');
    expect(hm.popUndo('b')).toBeNull(); // 'a' was pruned
  });

  it('clear wipes both stacks', () => {
    const hm = new HistoryManager<string>();
    hm.push('a');
    hm.push('b');
    hm.popUndo('c');
    hm.clear();
    expect(hm.canUndo).toBe(false);
    expect(hm.canRedo).toBe(false);
  });

  it('appendLog and get log', () => {
    const hm = new HistoryManager<string>();
    hm.appendLog({ command: { type: 'test', payload: {} }, timestamp: 123 });
    expect(hm.log).toHaveLength(1);
    expect(hm.log[0].command.type).toBe('test');
  });

  it('clearLog wipes the log', () => {
    const hm = new HistoryManager<string>();
    hm.appendLog({ command: { type: 'test', payload: {} }, timestamp: 123 });
    hm.clearLog();
    expect(hm.log).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run — verify fail**

Run: `cd packages/formspec-core && npx vitest run tests/history-manager.test.ts`
Expected: FAIL — `history.ts` doesn't exist.

- [ ] **Step 3: Implement `HistoryManager`**

Create `packages/formspec-core/src/history.ts`:

```typescript
import type { LogEntry } from './types.js';

/**
 * Manages undo/redo stacks and command log.
 * Pure data structure — no knowledge of commands or state shape.
 */
export class HistoryManager<T> {
  private _undoStack: T[] = [];
  private _redoStack: T[] = [];
  private _log: LogEntry[] = [];
  private _maxDepth: number;

  constructor(maxDepth = 50) {
    this._maxDepth = maxDepth;
  }

  get canUndo(): boolean { return this._undoStack.length > 0; }
  get canRedo(): boolean { return this._redoStack.length > 0; }
  get log(): readonly LogEntry[] { return this._log; }

  push(snapshot: T): void {
    this._undoStack.push(snapshot);
    if (this._undoStack.length > this._maxDepth) {
      this._undoStack.shift();
    }
    this._redoStack.length = 0;
  }

  popUndo(current: T): T | null {
    if (!this.canUndo) return null;
    this._redoStack.push(current);
    return this._undoStack.pop()!;
  }

  popRedo(current: T): T | null {
    if (!this.canRedo) return null;
    this._undoStack.push(current);
    return this._redoStack.pop()!;
  }

  clear(): void {
    this._undoStack.length = 0;
    this._redoStack.length = 0;
  }

  clearRedo(): void {
    this._redoStack.length = 0;
  }

  appendLog(entry: LogEntry): void {
    this._log.push(entry);
  }

  clearLog(): void {
    this._log.length = 0;
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `cd packages/formspec-core && npx vitest run tests/history-manager.test.ts`
Expected: PASS

- [ ] **Step 5: Wire `HistoryManager` into `RawProject`**

In `raw-project.ts`:

1. Import: `import { HistoryManager } from './history.js';`
2. Replace `_undoStack`, `_redoStack`, `_log`, `_maxHistory` fields with:
   ```typescript
   private _history: HistoryManager<ProjectState>;
   ```
3. Initialize in constructor:
   ```typescript
   this._history = new HistoryManager(options?.maxHistoryDepth);
   ```
4. Update all references:
   - `this._pushHistory(snapshot)` → `this._history.push(snapshot)`
   - `this._undoStack.length > 0` → `this._history.canUndo`
   - `this._redoStack.length > 0` → `this._history.canRedo`
   - `this._log` → `this._history.log`
   - `this._undoStack.pop()` → `this._history.popUndo(this._state)`
   - `this._redoStack.pop()` → `this._history.popRedo(this._state)`
   - `this._redoStack.length = 0` in clearRedo → `this._history.clearRedo()`
   - `resetHistory()` method body → `this._history.clear()`
   - Log append → `this._history.appendLog(...)`
   - Clear history (in _execute clearHistory branch) → `this._history.clear(); this._history.clearLog();`

5. Rewrite `undo()`:
   ```typescript
   undo(): boolean {
     const prev = this._history.popUndo(this._state);
     if (!prev) return false;
     this._state = prev;
     this._notify({ type: 'undo', payload: {} }, { rebuildComponentTree: false }, 'undo');
     return true;
   }
   ```

6. Rewrite `redo()`:
   ```typescript
   redo(): boolean {
     const next = this._history.popRedo(this._state);
     if (!next) return false;
     this._state = next;
     this._notify({ type: 'redo', payload: {} }, { rebuildComponentTree: false }, 'redo');
     return true;
   }
   ```

7. Delete `_pushHistory` method.

- [ ] **Step 6: Run ALL tests**

Run: `cd packages/formspec-core && npm test`
Expected: All passing.

Run: `cd packages/formspec-studio-core && npm test`
Expected: 222 passing.

- [ ] **Step 7: Commit**

```bash
git add packages/formspec-core/src/history.ts packages/formspec-core/tests/history-manager.test.ts packages/formspec-core/src/raw-project.ts
git commit -m "refactor: extract HistoryManager from RawProject

HistoryManager owns undo/redo stacks, log, and depth cap.
RawProject delegates all history operations."
```

### Task 8: Extract tree reconciler as pure function

**Files:**
- Create: `packages/formspec-core/src/tree-reconciler.ts`
- Create: `packages/formspec-core/tests/tree-reconciler.test.ts`
- Modify: `packages/formspec-core/src/raw-project.ts`

- [ ] **Step 1: Write failing test for pure reconciler**

```typescript
import { describe, it, expect } from 'vitest';
import { reconcileComponentTree, defaultComponentType } from '../src/tree-reconciler.js';

describe('reconcileComponentTree', () => {
  it('builds a flat Stack from simple definition', () => {
    const definition = {
      items: [
        { key: 'name', type: 'field', dataType: 'string' },
        { key: 'age', type: 'field', dataType: 'integer' },
      ],
    } as any;

    const tree = reconcileComponentTree(definition, undefined, {});
    expect(tree.component).toBe('Stack');
    expect(tree.children).toHaveLength(2);
    expect(tree.children[0].bind).toBe('name');
    expect(tree.children[0].component).toBe('TextInput');
    expect(tree.children[1].bind).toBe('age');
    expect(tree.children[1].component).toBe('NumberInput');
  });

  it('reuses existing bound node properties', () => {
    const definition = {
      items: [{ key: 'email', type: 'field', dataType: 'string' }],
    } as any;
    const existing = {
      component: 'Stack',
      nodeId: 'root',
      children: [{ component: 'EmailInput', bind: 'email', placeholder: 'Enter email' }],
    };

    const tree = reconcileComponentTree(definition, existing, {});
    expect(tree.children[0].component).toBe('EmailInput');
    expect(tree.children[0].placeholder).toBe('Enter email');
  });

  it('removes nodes for deleted items', () => {
    const definition = { items: [] } as any;
    const existing = {
      component: 'Stack',
      nodeId: 'root',
      children: [{ component: 'TextInput', bind: 'deleted' }],
    };

    const tree = reconcileComponentTree(definition, existing, {});
    expect(tree.children).toHaveLength(0);
  });
});

describe('defaultComponentType', () => {
  it('maps field types to widgets', () => {
    expect(defaultComponentType({ type: 'field', dataType: 'string' } as any)).toBe('TextInput');
    expect(defaultComponentType({ type: 'field', dataType: 'boolean' } as any)).toBe('Toggle');
    expect(defaultComponentType({ type: 'field', dataType: 'integer' } as any)).toBe('NumberInput');
    expect(defaultComponentType({ type: 'field', dataType: 'date' } as any)).toBe('DatePicker');
    expect(defaultComponentType({ type: 'field', dataType: 'money' } as any)).toBe('MoneyInput');
    expect(defaultComponentType({ type: 'field', dataType: 'attachment' } as any)).toBe('FileUpload');
    expect(defaultComponentType({ type: 'field', dataType: 'choice' } as any)).toBe('Select');
    expect(defaultComponentType({ type: 'field', dataType: 'multiChoice' } as any)).toBe('CheckboxGroup');
  });

  it('maps group and display types', () => {
    expect(defaultComponentType({ type: 'group' } as any)).toBe('Stack');
    expect(defaultComponentType({ type: 'group', repeatable: true } as any)).toBe('Accordion');
    expect(defaultComponentType({ type: 'display' } as any)).toBe('Text');
  });

  it('selects Select for fields with optionSet or options', () => {
    expect(defaultComponentType({ type: 'field', optionSet: 'countries' } as any)).toBe('Select');
    expect(defaultComponentType({ type: 'field', options: [{ value: 'a' }] } as any)).toBe('Select');
  });
});
```

- [ ] **Step 2: Run — verify fail**

Run: `cd packages/formspec-core && npx vitest run tests/tree-reconciler.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement tree reconciler**

Create `packages/formspec-core/src/tree-reconciler.ts`.

Extract `_rebuildComponentTree` (lines 1837-2084) and `_defaultComponent` (lines 2093-2114) from `raw-project.ts` into pure functions. The key changes:

1. `_defaultComponent` → `export function defaultComponentType(item: FormItem): string` (same logic, no instance access)
2. `_rebuildComponentTree` → `export function reconcileComponentTree(definition: FormDefinition, currentTree: unknown, theme: ThemeState): TreeNode` (same logic, takes inputs as arguments instead of reading `this._state`)

The internal `TreeNode` type, `WrapperSnapshot`, `snapshotWrappers`, `collectExisting`, `buildNode`, `findInTree`, `updateWrapperChildren` all move verbatim, with `this._defaultComponent(item)` replaced by `defaultComponentType(item)` and `this._state.definition` replaced by the `definition` parameter.

- [ ] **Step 4: Run tests — verify they pass**

Run: `cd packages/formspec-core && npx vitest run tests/tree-reconciler.test.ts`
Expected: PASS

- [ ] **Step 5: Wire reconciler into RawProject, remove _rebuildComponentTree and _defaultComponent**

1. Import: `import { reconcileComponentTree } from './tree-reconciler.js';`
2. Update `_execute`'s reconcile callback:
   ```typescript
   (clone) => {
     if (!hasAuthoredComponentTree(clone.component)) {
       clone.generatedComponent.tree = reconcileComponentTree(
         clone.definition,
         clone.generatedComponent.tree,
         clone.theme,
       );
       (clone.generatedComponent as Record<string, unknown>)['x-studio-generated'] = true;
     }
   }
   ```
3. Update the constructor's initial tree build to use the pure function too. The constructor must also set the `x-studio-generated` marker:
   ```typescript
   this._state.generatedComponent.tree = reconcileComponentTree(
     this._state.definition,
     this._state.generatedComponent.tree,
     this._state.theme,
   );
   (this._state.generatedComponent as Record<string, unknown>)['x-studio-generated'] = true;
   ```
4. Delete `_rebuildComponentTree()`, `_defaultComponent()`, and `_markGeneratedComponentDoc()` methods from `RawProject`.

- [ ] **Step 6: Run ALL tests**

Run: `cd packages/formspec-core && npm test`
Expected: All passing.

Run: `cd packages/formspec-studio-core && npm test`
Expected: 222 passing.

- [ ] **Step 7: Commit**

```bash
git add packages/formspec-core/src/tree-reconciler.ts packages/formspec-core/tests/tree-reconciler.test.ts packages/formspec-core/src/raw-project.ts
git commit -m "refactor: extract tree reconciler as pure function

reconcileComponentTree() takes definition + existing tree + theme and returns
new tree. No instance state access. Eliminates the _state swap hack."
```

### Task 9: Extract `normalizeState`

**Files:**
- Create: `packages/formspec-core/src/state-normalizer.ts`
- Create: `packages/formspec-core/tests/state-normalizer.test.ts`
- Modify: `packages/formspec-core/src/raw-project.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { normalizeState } from '../src/state-normalizer.js';

function makeState(overrides: any = {}) {
  return {
    definition: { url: 'urn:formspec:test', ...overrides.definition },
    component: { targetDefinition: { url: '' }, ...overrides.component },
    generatedComponent: { 'x-studio-generated': true, targetDefinition: { url: '' }, ...overrides.generatedComponent },
    theme: { targetDefinition: { url: '' }, ...overrides.theme },
    mapping: {},
    extensions: { registries: [] },
    versioning: { baseline: {} as any, releases: [] },
  } as any;
}

describe('normalizeState', () => {
  it('syncs targetDefinition URLs from definition', () => {
    const state = makeState();
    normalizeState(state);
    expect(state.component.targetDefinition.url).toBe('urn:formspec:test');
    expect(state.generatedComponent.targetDefinition.url).toBe('urn:formspec:test');
    expect(state.theme.targetDefinition.url).toBe('urn:formspec:test');
  });

  it('sorts theme breakpoints by minWidth', () => {
    const state = makeState({
      theme: { targetDefinition: { url: '' }, breakpoints: { lg: 1024, sm: 640, md: 768 } },
    });
    normalizeState(state);
    const keys = Object.keys(state.theme.breakpoints);
    expect(keys).toEqual(['sm', 'md', 'lg']);
  });

  it('inherits component breakpoints from theme when not set', () => {
    const state = makeState({
      theme: { targetDefinition: { url: '' }, breakpoints: { sm: 640 } },
      component: { targetDefinition: { url: '' } },
    });
    normalizeState(state);
    expect(state.component.breakpoints).toEqual({ sm: 640 });
  });
});
```

- [ ] **Step 2: Run — verify fail**

Expected: FAIL — `state-normalizer.ts` doesn't exist.

- [ ] **Step 3: Implement `normalizeState`**

Create `packages/formspec-core/src/state-normalizer.ts`:

```typescript
import type { ProjectState } from './types.js';

/**
 * Enforce cross-artifact invariants on a mutable state object.
 * Runs after every dispatch, batch, and execute cycle.
 * Undo/redo bypass this — snapshots were already normalized.
 */
export function normalizeState(state: ProjectState): void {
  const url = state.definition.url;

  if (state.component.targetDefinition) {
    state.component.targetDefinition.url = url;
  }
  if (state.generatedComponent.targetDefinition) {
    state.generatedComponent.targetDefinition.url = url;
  }
  if ((state.theme as any).targetDefinition) {
    (state.theme as any).targetDefinition.url = url;
  }

  const themeBp = (state.theme as any).breakpoints;
  if (themeBp) {
    const sorted = Object.entries(themeBp).sort(
      (a, b) => (a[1] as number) - (b[1] as number),
    );
    const fresh: Record<string, number> = {};
    for (const [name, minWidth] of sorted) fresh[name] = minWidth as number;
    (state.theme as any).breakpoints = fresh;
  }

  if (!state.component.breakpoints && themeBp) {
    state.component.breakpoints = { ...(state.theme as any).breakpoints };
  }
}
```

- [ ] **Step 4: Run tests — verify pass**

- [ ] **Step 5: Wire into RawProject, remove `_normalize`**

1. Import: `import { normalizeState } from './state-normalizer.js';`
2. In `_execute`, replace the temporary `_normalize` swap block with a direct call: `normalizeState(newState)` (called before the state swap, on the clone — no swap needed since `normalizeState` takes state as a parameter).
3. If `_execute` doesn't exist yet (Tasks 7-9 can be done before or after Task 6), update each dispatch method (`_dispatchSingle`, `_dispatchArray`, `batchWithRebuild`, `batch`) replacing `this._normalize()` with `normalizeState(this._state)`.
4. Delete `_normalize()` method from RawProject.

- [ ] **Step 6: Run ALL tests**

Expected: All passing.

- [ ] **Step 7: Commit**

```bash
git add packages/formspec-core/src/state-normalizer.ts packages/formspec-core/tests/state-normalizer.test.ts packages/formspec-core/src/raw-project.ts
git commit -m "refactor: extract normalizeState as pure function"
```

---

## Chunk 4: JSON-Native State (Step 5)

Do this BEFORE query extraction (Step 4 in spec) to avoid extracting queries that use Map APIs and then immediately changing them.

### Task 10: Replace `ResolvedCatalog` Map with Record

**Files:**
- Modify: `packages/formspec-core/src/types.ts`
- Modify: `packages/formspec-core/src/handlers/project.ts`
- Modify: `packages/formspec-core/src/raw-project.ts`
- Modify: `packages/formspec-core/src/index.ts`
- Modify: `packages/formspec-core/tests/project-commands.test.ts` (if needed)

- [ ] **Step 1: Write failing test — JSON round-trip**

In `packages/formspec-core/tests/raw-project.test.ts`:

```typescript
describe('JSON-native state', () => {
  it('state round-trips through JSON.stringify', () => {
    const raw = createRawProject();
    raw.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'f1' } });
    const json = JSON.stringify(raw.state);
    const parsed = JSON.parse(json);
    expect(parsed.definition.items).toHaveLength(1);
    expect(parsed.definition.items[0].key).toBe('f1');
    // Extensions should serialize cleanly
    expect(() => JSON.stringify(parsed.extensions)).not.toThrow();
  });

  it('state with loaded registry round-trips through JSON', () => {
    const raw = createRawProject();
    raw.dispatch({
      type: 'project.loadRegistry',
      payload: {
        registry: {
          url: 'https://example.org/registry',
          entries: [{ name: 'x-test', category: 'dataType' }],
        },
      },
    });
    const json = JSON.stringify(raw.state);
    const parsed = JSON.parse(json);
    expect(parsed.extensions.registries).toHaveLength(1);
    expect(parsed.extensions.registries[0].entries['x-test']).toBeDefined();
  });
});
```

- [ ] **Step 2: Run — verify fail**

Expected: FAIL — `Map` doesn't serialize with `JSON.stringify`.

- [ ] **Step 3: Update types**

In `types.ts`:

1. Remove `ResolvedCatalog` interface entirely.
2. Update `LoadedRegistry`:
   ```typescript
   export interface LoadedRegistry {
     url: string;
     document: unknown;
     /** Extension entries keyed by name. Plain object — JSON-serializable. */
     entries: Record<string, unknown>;
   }
   ```

- [ ] **Step 4: Update `project.ts` handler — `project.loadRegistry`**

The handler currently builds a `Map`. Change to build a `Record`:

```typescript
const entries: Record<string, unknown> = {};
for (const entry of (registry.entries ?? []) as any[]) {
  if (entry.name) entries[entry.name] = entry;
}
// Replace: catalog: { entries: new Map(...) }
// With:
state.extensions.registries.push({
  url: registry.url,
  document: registry,
  entries,
});
```

- [ ] **Step 5: Update all `Map` API calls on registry entries**

Search for `.entries.get(`, `.entries.has(`, `.entries.forEach(`, `.entries.set(` across the codebase and update to `Record` access patterns:

- `reg.catalog.entries.get(name)` → `reg.entries[name]`
- `reg.catalog.entries.has(name)` → `name in reg.entries` or `reg.entries[name] !== undefined`
- `reg.catalog.entries.forEach((v, k) => ...)` → `Object.entries(reg.entries).forEach(([k, v]) => ...)`
- `reg.catalog` references → `reg` (catalog is removed)

These will mostly be in `raw-project.ts` query methods and `handlers/project.ts`.

- [ ] **Step 6: Add private registry index cache to RawProject**

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

Invalidate in `_execute` after state swap: `this._registryIndex = null;`

- [ ] **Step 7: Update `createDefaultState` seed handling**

If `options?.seed?.extensions?.registries` is provided, normalize entries from any format:

```typescript
function indexRegistry(registry: any): LoadedRegistry {
  // Already indexed (new shape: top-level entries as Record)
  if (registry.entries && typeof registry.entries === 'object' && !Array.isArray(registry.entries)) {
    return registry as LoadedRegistry;
  }
  // Raw registry document: entries is an array of { name, ... } objects
  const rawEntries: any[] = registry.entries ?? [];
  const entries: Record<string, unknown> = {};
  for (const entry of rawEntries) {
    if (entry.name) entries[entry.name] = entry;
  }
  return { url: registry.url, document: registry.document ?? registry, entries };
}
```

- [ ] **Step 8: Remove `ResolvedCatalog` from `index.ts` exports**

- [ ] **Step 9: Run ALL tests**

Expected: All passing.

Also verify studio-core:
Run: `cd packages/formspec-studio-core && npm test`

- [ ] **Step 10: Commit**

```bash
git add packages/formspec-core/src/types.ts packages/formspec-core/src/handlers/project.ts packages/formspec-core/src/raw-project.ts packages/formspec-core/src/index.ts packages/formspec-core/tests/
git commit -m "refactor: JSON-native state — replace Map with Record in LoadedRegistry

ResolvedCatalog removed. LoadedRegistry.entries is now Record<string, unknown>.
Private _registryIndex cache provides O(1) lookup. JSON.stringify(state) works."
```

---

## Chunk 5: Extract Query Functions (Step 4)

Move ~30 read-only methods from `RawProject` into `queries/` modules. RawProject keeps thin wrappers for IProjectCore compliance.

### Task 11: Extract field and item queries

**Files:**
- Create: `packages/formspec-core/src/queries/field-queries.ts`
- Modify: `packages/formspec-core/src/raw-project.ts`

- [ ] **Step 1: Verify existing tests are green (baseline)**

Run: `cd packages/formspec-core && npx vitest run tests/queries.test.ts`
Expected: All passing.

- [ ] **Step 2: Extract query functions**

Move the following methods from `RawProject` to `queries/field-queries.ts` as standalone functions.

**Imports needed beyond types:** `getEditableComponentDocument`, `getCurrentComponentDocument` from `../component-documents.js` (used by `unboundItems`, `componentFor`). Also `itemAtPath`, `normalizeIndexedPath` from `formspec-engine`. Also `resolveThemeCascade` from `../theme-cascade.js` (for `effectivePresentation`, if placed here — see note below).

```typescript
import type { ProjectState, ItemFilter, DataTypeInfo, ResponseSchemaRow } from '../types.js';
import { getEditableComponentDocument } from '../component-documents.js';

export function fieldPaths(state: ProjectState): string[] { ... }
export function searchItems(state: ProjectState, filter: ItemFilter): any[] { ... }
export function availableDataTypes(state: ProjectState): DataTypeInfo[] { ... }
export function responseSchemaRows(state: ProjectState): ResponseSchemaRow[] { ... }
export function itemAt(state: ProjectState, path: string): any { ... }
export function instanceNames(state: ProjectState): string[] { ... }
export function variableNames(state: ProjectState): string[] { ... }
export function optionSetUsage(state: ProjectState, name: string): string[] { ... }
export function unboundItems(state: ProjectState): string[] { ... }
export function bindFor(state: ProjectState, path: string): Record<string, unknown> | undefined { ... }
export function componentFor(state: ProjectState, fieldKey: string): Record<string, unknown> | undefined { ... }
export function resolveToken(state: ProjectState, key: string): string | number | undefined { ... }
```

Replace each method body in `RawProject` with a delegation:
```typescript
fieldPaths(): string[] { return fieldPaths(this._state); }
```

- [ ] **Step 3: Run tests — verify they still pass**

Run: `cd packages/formspec-core && npx vitest run tests/queries.test.ts`
Expected: PASS (behavior unchanged).

- [ ] **Step 4: Commit**

```bash
git add packages/formspec-core/src/queries/ packages/formspec-core/src/raw-project.ts
git commit -m "refactor: extract field and item queries to queries/field-queries.ts"
```

### Task 12: Extract remaining query modules

**Files:**
- Create: `packages/formspec-core/src/queries/diagnostics.ts`
- Create: `packages/formspec-core/src/queries/dependency-graph.ts`
- Create: `packages/formspec-core/src/queries/expression-index.ts`
- Create: `packages/formspec-core/src/queries/statistics.ts`
- Create: `packages/formspec-core/src/queries/versioning.ts`
- Create: `packages/formspec-core/src/queries/registry-queries.ts`
- Modify: `packages/formspec-core/src/raw-project.ts`

Apply the same pattern as Task 11 for each module:

- [ ] **Step 1: Extract `queries/expression-index.ts`**

Functions: `allExpressions`, `parseFEL`, `availableReferences`, `expressionDependencies`, and private helpers `_analyzeExpression`, `_resolveParseContext`.

**Imports needed:** `analyzeFEL`, `getBuiltinFELFunctionCatalog`, `getFELDependencies`, `itemAtPath` from `formspec-engine`. Also `getCurrentComponentDocument` from `../component-documents.js` (used by `allExpressions` to walk component tree expressions).

- [ ] **Step 2: Extract `queries/dependency-graph.ts`**

Functions: `fieldDependents`, `variableDependents`, `dependencyGraph`.

- [ ] **Step 3: Extract `queries/statistics.ts`**

Function: `statistics`. Imports: `allExpressions` from `./expression-index.js`, `getCurrentComponentDocument` from `../component-documents.js`.

- [ ] **Step 4: Extract `queries/diagnostics.ts`**

Function: `diagnose`. Receives `schemaValidator` as a parameter.

- [ ] **Step 5: Extract `queries/versioning.ts`**

Functions: `diffFromBaseline`, `previewChangelog`.

- [ ] **Step 6: Extract `queries/registry-queries.ts`**

Functions: `listRegistries`, `browseExtensions`, `resolveExtension`, `felFunctionCatalog`.

Note: `resolveExtension` reads from `registries[].entries` (now `Record`, not `Map`).

`effectivePresentation` uses `resolveThemeCascade` and `itemAt` — it's a theme query, not a registry query. Place it in `field-queries.ts` alongside `componentFor` and `bindFor` (all field-key-scoped lookups).

- [ ] **Step 7: Run ALL tests**

Run: `cd packages/formspec-core && npm test`
Expected: All passing.

Run: `cd packages/formspec-studio-core && npm test`

- [ ] **Step 8: Commit**

```bash
git add packages/formspec-core/src/queries/ packages/formspec-core/src/raw-project.ts
git commit -m "refactor: extract all query methods to queries/ modules

RawProject retains thin wrappers for IProjectCore compliance.
Query functions are pure: (ProjectState, ...) => result."
```

### Task 13: Export query utilities and verify `RawProject` is ~300 lines

**Files:**
- Modify: `packages/formspec-core/src/raw-project.ts`
- Modify: `packages/formspec-core/src/index.ts`

- [ ] **Step 1: Verify RawProject line count**

Run: `wc -l packages/formspec-core/src/raw-project.ts`
Expected: ~300-400 lines. If significantly higher, identify what still needs extraction.

- [ ] **Step 2: Also extract `export()` method body if it's large**

The `export()` method (ProjectBundle generation) can stay inline if it's <20 lines.

- [ ] **Step 3: Optionally export query functions from `index.ts`**

Only if consumers need direct access. For now, they go through `IProjectCore` wrappers.

- [ ] **Step 4: Run final full test suite**

Run: `cd packages/formspec-core && npm test`
Run: `cd packages/formspec-studio-core && npm test`
Run: `cd packages/formspec-types && npm test`

- [ ] **Step 5: Commit**

```bash
git add packages/formspec-core/
git commit -m "refactor: complete RawProject decomposition — facade is ~300 lines

Subsystems: CommandPipeline, HistoryManager, tree-reconciler, state-normalizer.
Queries in queries/ modules. No behavioral changes to IProjectCore."
```

---

## Verification Checklist

After all tasks are complete:

- [ ] `cd packages/formspec-core && npm test` — All passing (except pre-existing 3)
- [ ] `cd packages/formspec-studio-core && npm test` — 222 passing
- [ ] `cd packages/formspec-types && npm test` — 11 passing
- [ ] `cd packages/formspec-core && npx tsc --noEmit` — Clean
- [ ] `cd packages/formspec-studio-core && npx tsc --noEmit` — Clean
- [ ] `wc -l packages/formspec-core/src/raw-project.ts` — ~300 lines
- [ ] `ls packages/formspec-core/src/handler-registry.ts` — File does not exist
- [ ] `ls packages/formspec-core/src/handlers.ts` — File does not exist (replaced by handlers/index.ts)
- [ ] `grep -r "new Map" packages/formspec-core/src/types.ts` — No Map in public types
- [ ] `JSON.stringify(project.state)` test passes — State is fully serializable
