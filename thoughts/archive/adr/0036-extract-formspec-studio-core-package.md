# ADR 0036: Extract `formspec-studio-core` Package

## Status

Superseded — the signal-free reusable package goal was met, but via a command-dispatch architecture (`@formspec-org/core` + `@formspec-org/studio-core`), not the ADR's `MutationResult`/`wrapMutation` pattern. No `mutations/` directory, no `MutationResult` interface, no `normalize.ts`. `formspec-studio-core` exists as a `Project` facade over `@formspec-org/core` with ~50 behavior-driven helper methods delegating to command-dispatch internally.

## Context

The form-builder's `src/state/` directory mixes pure JSON document manipulation logic with Preact Signal-based reactive state management. This makes it impossible to reuse the builder logic in CLI tools, importers, or alternative UIs without pulling in `@preact/signals`. The goal is dependency inversion: extract all pure logic into `packages/formspec-studio-core/`, leaving form-builder as a thin reactive UI shell.

### Current state of the boundary

An audit of `form-builder/src/state/` confirms the extraction seam is clean:

| File | Signal usage | Pure? |
|------|-------------|-------|
| `mutations.ts` (3,646 lines) | `import type { Signal }` — type-only | Logic is pure; the `commitProject` wrapper is the only signal touch point |
| `wiring.ts` | None | Yes |
| `field-widgets.ts` | None | Yes |
| `versioning.ts` | None | Yes |
| `extensions.ts` | None | Yes |
| `import-export.ts` | None | Yes |
| `project.ts` | `import { signal }` — creates singleton | Mixed: types + initializers are pure, singleton is reactive |
| `derived.ts` | `import { computed, untracked }` | No — reactive by design |
| `history.ts` | `import type { Signal }` — type-only | Stateful (module-level stacks) but no signal creation |

All 78 domain-logic mutations go through `commitProject`, which handles clone → mutate → normalize → optional tree rebuild → optional history push → signal write. Two outliers: `importArtifacts` bypasses `commitProject` entirely (intentional full-project replace), and `undoProject`/`redoProject` write signals directly (snapshot restore).

## Package Structure

```
packages/formspec-studio-core/
  package.json
  tsconfig.json
  vitest.config.ts
  src/
    index.ts                  # Barrel re-exports
    types.ts                  # All interfaces/types from project.ts (no signals)
    project.ts                # Pure initializer functions (createInitialDefinition, etc.)
    normalize.ts              # normalizeProjectState + helpers (post-mutation normalization)
    wiring.ts                 # Path/tree utilities (moved unchanged)
    field-widgets.ts          # Widget resolution (moved unchanged)
    versioning.ts             # Changelog/semver (moved unchanged)
    import-export.ts          # Bundle serialization (moved unchanged)
    extensions.ts             # Registry parsing/catalog (moved unchanged)
    mutations/
      index.ts                # Barrel re-exports all mutation modules
      types.ts                # MutationResult, input interfaces
      items.ts                # addItem, deleteItem, renameItem, moveItem, reorderItem, duplicateItem
      binds.ts                # setBind, setPresentation, setItemProperty, setItemText, etc.
      pages.ts                # addPage, deletePage, reorderPage, setActivePage, setFormPresentationProperty
      variables.ts            # addVariable, setVariableName, setVariableExpression, deleteVariable, etc.
      shapes.ts               # addShape, setShapeProperty, deleteShape, setShapeComposition, etc.
      mapping.ts              # setMappingProperty, addMappingRule, setMappingRuleProperty, etc.
      theme.ts                # setThemeToken, addThemeSelector, setThemeBreakpoint, etc.
      component.ts            # setComponentRegistry, setFieldWidgetComponent, setGroupRepeatable, etc.
      instances.ts            # addInstance, setInstanceProperty, renameInstance, deleteInstance
      import.ts               # importArtifacts, importSubform (returns ProjectState, not MutationResult)
      _helpers.ts             # Private shared helpers: findItemLocation, resolveItemArray, ensureUniqueSiblingKey, etc.
  tests/
    mutations.test.ts         # Core mutation tests (no signals)
    extensions.test.ts        # Moved from form-builder
    wiring.test.ts
```

### Why split mutations by domain

The current `mutations.ts` is 3,646 lines with 78 exported functions and 54 private helpers. Extracting it as a single file just relocates the monolith. Since every function is being touched anyway (removing signal parameters, returning `MutationResult`), this is the natural moment to split. The domain grouping mirrors the form-builder's inspector panel sections and makes each file independently comprehensible (~200-500 lines each).

## Core Mutation API

### Standard mutations: pure functions returning `MutationResult`

Each mutation takes `state: ProjectState` as its first argument, mutates it in-place, and returns flags:

```typescript
export interface MutationResult {
  rebuildComponentTree: boolean;
}

// Example — core package (mutations/items.ts)
export function addItem(state: ProjectState, input: AddItemInput): MutationResult & { insertedPath: string } {
  // pure state manipulation on the passed-in state object
  return { rebuildComponentTree: true, insertedPath: '...' };
}
```

~63 mutations follow this pattern. The caller (form-builder adapter) is responsible for cloning before and normalizing after.

### Import mutations: full-state builders

`importArtifacts` and `importSubform` don't fit the `MutationResult` pattern — they build or replace a `ProjectState` rather than mutating one. These live in `mutations/import.ts` and return a `ProjectState` directly:

```typescript
// core package (mutations/import.ts)
export function importArtifacts(input: ImportArtifactsInput): ImportArtifactsResult & { state: ProjectState } {
  // builds a full ProjectState from imported artifacts
}
```

The adapter handles these specially: direct signal write + history clear, no clone/normalize cycle.

### UI-state mutations stay in form-builder

15 mutations exclusively touch `state.uiState.*` — selection, panel toggles, preview width, active breakpoint, JSON editor state, inspector mode. These are UI concerns with no document semantics and no value to CLI tools or importers. They stay in form-builder's `mutations.ts` and use `commitProject` with `{ skipHistory: true }` as they do today.

Functions staying in form-builder: `setSelection`, `setInspectorSectionOpen`, `setPreviewWidth`, `setActiveBreakpoint`, `setJsonEditorOpen`, `toggleJsonEditor`, `setJsonEditorTab`, `toggleStructurePanel`, `toggleInspectorMode`, `setInspectorMode`, `toggleDiagnosticsOpen`, `setMobilePanel`, `togglePreviewMode`.

### Adapter pattern: generic `wrapMutation` + custom overrides

Most mutations return only `MutationResult` (no extra fields). A generic wrapper eliminates ~45 hand-written adapter functions:

```typescript
// form-builder adapter (mutations.ts)
import * as core from 'formspec-studio-core/mutations';

function wrapMutation<A extends unknown[]>(
  fn: (state: ProjectState, ...args: A) => MutationResult
): (project: Signal<ProjectState>, ...args: A) => void {
  return (project = projectSignal, ...args) => {
    commitProject(project, (draft) => fn(draft, ...args));
  };
}

// ~45 mutations with no extra return values
export const deleteItem = wrapMutation(core.deleteItem);
export const renameItem = wrapMutation(core.renameItem);
export const setBind = wrapMutation(core.setBind);
// ...

// ~18 mutations with extra return values need custom wrappers
export function addItem(project = projectSignal, input: AddItemInput): string {
  let insertedPath = '';
  commitProject(project, (draft) => {
    const result = core.addItem(draft, input);
    insertedPath = result.insertedPath;
    return result;
  });
  return insertedPath;
}

// Import mutations bypass commitProject entirely
export function importArtifacts(project = projectSignal, input: ImportArtifactsInput): ImportArtifactsResult {
  const result = core.importArtifacts(input);
  clearHistory();
  project.value = result.state;
  return result;
}
```

`commitProject` stays in form-builder and handles: `structuredClone` → call mutation → `normalizeProjectState` → optional `rebuildComponentTree` → optional `pushHistory` → signal write.

## Implementation Steps

### Phase 1: Scaffold package

1. Create `packages/formspec-studio-core/package.json` (deps: `formspec-engine: "*"`, `ajv: "^8.17.1"`)
2. Create `packages/formspec-studio-core/tsconfig.json` (extends base, `resolveJsonModule: true`)
3. Create `packages/formspec-studio-core/vitest.config.ts`
4. Add vite alias in `form-builder/vite.config.ts`: `'formspec-studio-core' → packages/formspec-studio-core/src/index.ts`
5. Add `"formspec-studio-core": "*"` to form-builder's `package.json` dependencies
6. `npm install` to link workspace

### Phase 2: Move pure modules (no mutations yet)

7. Create `src/types.ts` — extract all interfaces/types from `form-builder/src/state/project.ts`
8. Move `wiring.ts` — already pure, update import paths only
9. Move `field-widgets.ts` — already pure, no changes
10. Move `versioning.ts` — update schema import path
11. Move `extensions.ts` — update schema + type import paths
12. Move `import-export.ts` — update imports to `./types` and `./project`
13. Create `src/project.ts` — pure initializers only; parameterize `createInitialProjectState` to accept optional registry data instead of hardcoding `commonRegistry` import
14. Create `src/normalize.ts` — extract `normalizeProjectState` (post-mutation normalization: sync URLs, normalize mapping/breakpoints/preview width, recompute active breakpoint)
15. Create `src/index.ts` barrel

### Phase 3: Extract mutations into domain modules

16. Create `src/mutations/types.ts` — `MutationResult` interface + all input types (`AddItemInput`, `MoveItemTarget`, etc.)
17. Create `src/mutations/_helpers.ts` — shared private helpers (`findItemLocation`, `resolveItemArray`, `ensureUniqueSiblingKey`, `buildItem`, `defaultKeyForType`, etc.)
18. Create domain modules (`items.ts`, `binds.ts`, `pages.ts`, `variables.ts`, `shapes.ts`, `mapping.ts`, `theme.ts`, `component.ts`, `instances.ts`, `import.ts`) — for each function:
    - Remove `project: Signal<ProjectState>` parameter → replace with `state: ProjectState`
    - Remove `commitProject` wrapper — the function body IS the callback
    - Return `MutationResult` (+ any extra return values)
    - Private helpers move with their callers; shared helpers go to `_helpers.ts`
19. Create `src/mutations/index.ts` barrel

### Phase 4: Rewire form-builder

20. Rewrite `form-builder/src/state/project.ts` — thin signal wrapper:
    - Re-export types from `formspec-studio-core`
    - Keep `projectSignal` singleton + `createProjectSignal()`
21. Rewrite `form-builder/src/state/mutations.ts` — adapter layer:
    - `wrapMutation` generic adapter for ~45 simple mutations
    - Custom wrappers for ~18 mutations with extra return values
    - Special handling for `importArtifacts`/`importSubform`
    - UI-state mutations stay inline (unchanged, `{ skipHistory: true }`)
    - Keep `commitProject`, `undoProject`, `redoProject`
22. Update `form-builder/src/state/derived.ts` — change imports to `formspec-studio-core`
23. Update `form-builder/src/state/history.ts` — update type imports only
24. Delete redundant files from form-builder: `wiring.ts`, `field-widgets.ts`, `versioning.ts`, `extensions.ts`, `import-export.ts`
25. Update `form-builder/src/index.ts` barrel if needed

### Phase 5: Tests

26. Create `packages/formspec-studio-core/tests/mutations.test.ts` — test core mutations directly on plain `ProjectState` objects (no signals, no history)
27. Move `extensions.unit.test.ts` to core package tests
28. Verify existing form-builder tests still pass (they test through the adapter layer)

### Phase 6: Verification

29. `npm install`
30. `npm run test --workspace=formspec-studio-core`
31. `npm run test:unit` (form-builder)
32. `npm run test:integration` (form-builder component tests)
33. `npm run dev --workspace=form-builder` (manual smoke test)

## Key Files to Modify

| File | Action |
|------|--------|
| `form-builder/src/state/project.ts` | Split → core `types.ts` + core `project.ts` + thin signal wrapper |
| `form-builder/src/state/mutations.ts` | Extract pure logic → core `mutations/*`, keep adapter + UI-state mutations |
| `form-builder/src/state/wiring.ts` | Move to core |
| `form-builder/src/state/field-widgets.ts` | Move to core |
| `form-builder/src/state/versioning.ts` | Move to core |
| `form-builder/src/state/extensions.ts` | Move to core |
| `form-builder/src/state/import-export.ts` | Move to core |
| `form-builder/src/state/derived.ts` | Update imports (`collectFieldPaths` from core, `projectSignal` stays) |
| `form-builder/src/state/history.ts` | Update type imports only |
| `form-builder/src/state/__tests__/state-layer.unit.test.ts` | Update imports |
| `form-builder/src/state/__tests__/page-management.test.ts` | Update imports |
| `form-builder/vite.config.ts` | Add `formspec-studio-core` alias |
| `form-builder/package.json` | Add `formspec-studio-core` dependency |

## Design Decisions

- **No signal dependency in core** — zero imports from `@preact/signals`. The `Signal` type never appears in any core API.
- **Mutations split by domain** — the current 3,646-line monolith splits into ~10 focused modules (~200-500 lines each). Grouping mirrors inspector panel sections: items, binds, pages, variables, shapes, mapping, theme, component, instances, import.
- **UI-state mutations stay in form-builder** — 15 functions that only touch `uiState.*` have no document semantics. Extracting them would pollute the core API with UI concerns. Cleaner boundary: core = document mutations, form-builder = UI state + adapter.
- **Generic `wrapMutation` adapter** — eliminates ~45 hand-written wrappers. Only ~18 mutations with extra return values need custom adapters. Reduces the adapter from ~500 lines of boilerplate to ~100 lines of meaningful code.
- **`importArtifacts` returns `ProjectState` directly** — it builds a complete project from imported artifacts rather than mutating one. The adapter does signal write + history clear. This is explicitly a different pattern from standard mutations.
- **`commonRegistry` becomes a parameter** — `createInitialProjectState(options?: { registries? })` instead of hardcoded import.
- **`skipHistory` stays in adapter** — it's a UI concern, not part of `MutationResult`.
- **`normalizeProjectState` extracted to its own module** — the post-mutation normalization (URL sync, mapping normalization, breakpoint normalization, preview width clamping) is called by the adapter after every mutation. It's pure and testable on its own.
- **Core tests don't need AJV shim** — form-builder shims AJV for its Vite/Preact test env, but the core package has `ajv` as a real dependency and tests run in node environment.
- **No circular deps** — dependency graph: `formspec-engine ← formspec-studio-core ← form-builder`.
- **`assembleDefinitionSync` is a runtime dep** — `mutations.ts` imports this from `formspec-engine` (not just types), so `formspec-engine` is a real dependency of core.
- **`undoProject`/`redoProject` stay in form-builder** — they directly read/write `Signal.value` for snapshot restore; the adapter re-exports them unchanged.
- **Schema imports use vite/vitest aliases** — both `form-builder/vite.config.ts` and `formspec-studio-core/vitest.config.ts` define a `@formspec/schemas` alias pointing to the repo-root `schemas/` directory, avoiding fragile `../../../../schemas/` relative paths. The core `tsconfig.json` uses a matching `paths` entry for editor support.
- **`formspec-engine` resolved uniformly via workspace link** — both core (in tests) and form-builder (via vite alias) resolve `formspec-engine` through the npm workspace link. Form-builder's existing vite alias for `formspec-engine` continues to point to source for HMR; core's vitest config adds the same alias for test parity.
