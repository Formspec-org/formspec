# Design: Split formspec-studio-core into formspec-core and formspec-studio-core

**Date:** 2026-03-15
**Status:** Design approved

---

## Problem

`formspec-studio-core` conflates two distinct concerns:

1. **Raw mutation engine** — command dispatch, state management, undo/redo, all handler modules (document-aware primitives)
2. **Semantic authoring layer** — document-agnostic business logic, ergonomic helper API, cross-artifact orchestration

These belong in separate packages. A CLI tool or LLM agent should be able to depend only on the primitives. The authoring helpers are an optional layer on top.

Additionally, `Project extends RawProject` (inheritance) creates tight coupling between the two concerns. Any consumer of `Project` has a transitive dependency on the `RawProject` concrete class.

---

## Solution

Split into two packages with a clean dependency-inversion boundary:

- **`formspec-core`** — document-aware primitives: `RawProject`, `IProjectCore` interface, all handler modules, all document utilities
- **`formspec-studio-core`** — document-agnostic semantic layer: `Project` class (composition over `IProjectCore`), `HelperError`, helper prop types, field type aliases, evaluation helpers

Dependency chain: `formspec-studio-core → formspec-core → formspec-engine`

---

## Package Boundaries

### formspec-core (new package)

**What it contains:**

| File | Description |
|------|-------------|
| `src/types.ts` | All core types: `ProjectState`, `Command`, `CommandResult`, `ProjectOptions`, `ChangeListener`, etc. |
| `src/raw-project.ts` | `RawProject` class — command dispatch pipeline, state cloning, undo/redo, change notifications, query methods |
| `src/project-core.ts` | `IProjectCore` interface — the abstraction `Project` depends on |
| `src/handler-registry.ts` | `registerHandler` / `getHandler` — self-registration infrastructure |
| `src/handlers.ts` | Aggregates all 21 handler module imports (side-effect: registers all handlers) |
| `src/handlers/` | All 21 handler modules — document mutations (definition, component, theme, mapping, project-level) |
| `src/normalization.ts` | `normalizeDefinition` — legacy shape normalization |
| `src/component-documents.ts` | Component document state management, `splitComponentState` |
| `src/page-resolution.ts` | `resolvePageStructure` — theme page structure resolution |
| `src/theme-cascade.ts` | `resolveThemeCascade` — theme token cascade resolution |
| `src/index.ts` | Exports: `RawProject`, `IProjectCore`, `createRawProject`, all types and utilities |

**Dependencies:** `formspec-engine`, `ajv`

**What it does NOT contain:** `Project`, `HelperError`, `HelperResult`, field type aliases, `previewForm`, `validateResponse`

---

### formspec-studio-core (trimmed)

**What it contains:**

| File | Description |
|------|-------------|
| `src/project.ts` | `Project` class — composes `IProjectCore`, exposes 51 document-agnostic helper methods |
| `src/helper-types.ts` | `HelperError`, `HelperResult`, `HelperWarning`, `FieldProps`, `GroupProps`, etc. |
| `src/field-type-aliases.ts` | Type alias resolution (`email` → `{dataType, constraint}`), widget alias resolution |
| `src/evaluation-helpers.ts` | `previewForm`, `validateResponse` |
| `src/index.ts` | Exports: `Project`, `createProject`, `HelperError`, `HelperResult`, `previewForm`, `validateResponse`, plus re-exports everything from `formspec-core` |

**Dependencies:** `formspec-core`, `formspec-engine`

---

## IProjectCore Interface

`IProjectCore` is defined in `formspec-core` and is the seam between packages. `RawProject` implements it. `Project` depends on it.

The interface is extracted directly from `RawProject`'s existing public API — no method renaming. Key signatures (illustrative; full interface includes all ~40 public methods):

```typescript
// formspec-core/src/project-core.ts
export interface IProjectCore {
  // State getters (preserved verbatim from RawProject)
  get state(): ProjectState;
  get definition(): DefinitionDocument;
  get theme(): ThemeDocument;
  get component(): ComponentDocument | undefined;
  get generatedComponent(): ComponentDocument;
  get artifactComponent(): Readonly<FormspecComponentDocument>;
  get mapping(): MappingDocument;

  // Command dispatch (both overloads)
  dispatch(command: AnyCommand): CommandResult;
  dispatch(command: AnyCommand[]): CommandResult[];

  // Batch operations (actual RawProject signatures)
  batch(commands: AnyCommand[]): CommandResult[];
  batchWithRebuild(phase1: AnyCommand[], phase2: AnyCommand[]): CommandResult[];

  // History
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  resetHistory(): void;

  // Change notifications (cleanup-function pattern)
  onChange(listener: ChangeListener): () => void;

  // Query methods (representative sample — full set extracted verbatim from RawProject)
  itemAt(path: string): ItemNode | undefined;
  fieldPaths(): string[];
  statistics(): ProjectStatistics;
  diagnose(): DiagnosticReport;
  export(): ProjectBundle;
  parseFEL(expr: string): FELParseResult;
  fieldDependents(path: string): FieldDependents;
  // ... all remaining ~30 query methods
}
```

**`component` / `generatedComponent` / `artifactComponent` getters:**
- `component` — user-authored component tree (undefined when not yet authored)
- `generatedComponent` — auto-generated layout synthesized from the definition
- `artifactComponent` — convenience getter: returns `component` if authored, else `generatedComponent`

All three are part of `IProjectCore` since `Project` helper methods may need any of them.

**Implementation note:** During the split, `IProjectCore` is extracted by transcribing every public property and method signature off `RawProject` verbatim. `RawProject` then adds `implements IProjectCore` and TypeScript enforces the contract. No API changes to `RawProject` are required.

---

## Project Class (Dependency Inversion)

`Project` uses composition, injecting `IProjectCore`. The `raw` getter is restored as a meaningful accessor.

```typescript
// formspec-studio-core/src/project.ts
export class Project {
  constructor(private core: IProjectCore) {}

  get raw(): IProjectCore {
    return this.core;
  }

  // Example helper method — document-agnostic
  addField(path: string, props: FieldProps): HelperResult {
    const resolved = resolveFieldType(props.type ?? 'text');
    return this.core.dispatch({
      type: 'definition.addItem',
      path,
      dataType: resolved.dataType,
      // ...
    });
  }

  // ... 50 more helper methods
}
```

---

## Factory Functions

```typescript
// formspec-core
export function createRawProject(options?: ProjectOptions): RawProject

// formspec-studio-core
export function createProject(options?: ProjectOptions): Project {
  const core = createRawProject(options);
  return new Project(core);
}
```

---

## Re-export Strategy

`formspec-studio-core/src/index.ts` re-exports everything from `formspec-core`. Existing consumers that import from `formspec-studio-core` continue to work without changes. Consumers that only need the primitives can install `formspec-core` directly.

```typescript
// formspec-studio-core/src/index.ts
export * from 'formspec-core';                   // re-export all primitives
export { Project, createProject } from './project';
export { HelperError, HelperResult } from './helper-types';
export { previewForm, validateResponse } from './evaluation-helpers';
```

---

## Test Distribution

Tests move with their modules:

| Package | Tests |
|---------|-------|
| `formspec-core/tests/` | `raw-project.test.ts`, `history.test.ts`, `batch-and-notify.test.ts`, `project-commands.test.ts`, `definition-*.test.ts` (8 files), `component-*.test.ts` (3 files), `theme.test.ts`, `mapping.test.ts`, `pages-handlers.test.ts`, `page-resolution.test.ts`, `theme-cascade.test.ts`, `normalization.test.ts`, `queries.test.ts`, `diagnostics.test.ts`, `schema-cross-ref.test.ts` |
| `formspec-studio-core/tests/` | `project-methods.test.ts`, `e2e.test.ts`, `e2e-examples.test.ts`, `cross-artifact.test.ts`, `evaluation-helpers.test.ts`, `breakpoint-sync.test.ts`, `tree-sync.test.ts`, `page-aware-rebuild.test.ts` |

Rough split: ~500 tests to `formspec-core`, ~117 to `formspec-studio-core`.

---

## Cleanup Opportunities (Boy Scout)

1. **Delete the unreferenced `project.ts` draft** — `src/project.ts` is a 2206-line standalone `Project` class that does not extend `RawProject` and is not wired into `index.ts` (which exports from `project-wrapper.ts`). Evaluate for any newer helper implementations, extract if useful, then delete. Do not carry dead code into the split.
2. **Delete `get raw(): this`** — was a self-referential no-op under inheritance; becomes a meaningful `IProjectCore` accessor under composition
3. **Remove `ajv` from `formspec-studio-core`** — moves to `formspec-core` with the handler modules that use it
4. **Rename `project-wrapper.ts` → `project.ts`** — clearer name now that it's the only thing in the package
5. **Review `handlers/helpers.ts`** (26 lines) — small shared utility; absorb into `handlers/definition-items.ts` or keep as-is

---

## Consumer Impact

Three packages depend on `formspec-studio-core`: `formspec-shared`, `formspec-chat`, `formspec-studio`.

Because `formspec-studio-core` re-exports everything from `formspec-core`, these consumers need no import changes. If a consumer later wants to depend only on primitives (e.g., a CLI tool), it can install `formspec-core` directly.

---

## Monorepo Changes

- Add `packages/formspec-core/` with `package.json`, `tsconfig.json`, `vitest.config.ts`
- Update `packages/formspec-studio-core/package.json` — add `formspec-core` dependency, remove `ajv`
- Update root `package.json` workspaces if needed
- Update build scripts — `formspec-core` must build before `formspec-studio-core`
- Regenerate `API.llm.md` for both packages after split
