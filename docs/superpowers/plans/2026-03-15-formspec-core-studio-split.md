# formspec-core / formspec-studio-core Split — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `packages/formspec-studio-core` into `formspec-core` (document-aware primitives: RawProject, all handlers, utilities) and a trimmed `formspec-studio-core` (document-agnostic semantic layer: Project + helper machinery), with a clean `IProjectCore` interface as the boundary.

**Architecture:** `formspec-core` exports `RawProject implements IProjectCore` and all handler/utility code. `formspec-studio-core` exports `Project implements IProjectCore` which composes an injected `IProjectCore` (dependency inversion, not inheritance). `formspec-studio-core` re-exports everything from `formspec-core` so consumers need no import changes.

**Tech Stack:** TypeScript 5, Vitest, `formspec-engine` (FEL/schema), `ajv` (moves to formspec-core)

**Spec:** `docs/superpowers/specs/2026-03-15-formspec-core-studio-split-design.md`

---

## File Map

### New package: `packages/formspec-core/`

| File | Action | Notes |
|------|--------|-------|
| `package.json` | Create | name: `formspec-core`, deps: `formspec-engine`, `ajv` |
| `tsconfig.json` | Create | Same compiler options as studio-core |
| `vitest.config.ts` | Create | Same alias pattern as studio-core |
| `src/project-core.ts` | Create | `IProjectCore` interface |
| `src/types.ts` | Move from studio-core | No changes needed |
| `src/raw-project.ts` | Move from studio-core | Add `implements IProjectCore` |
| `src/handler-registry.ts` | Move from studio-core | No changes needed |
| `src/handlers.ts` | Move from studio-core | No changes needed |
| `src/handlers/*.ts` | Move from studio-core | 17 files, no changes needed |
| `src/normalization.ts` | Move from studio-core | No changes needed |
| `src/component-documents.ts` | Move from studio-core | No changes needed |
| `src/page-resolution.ts` | Move from studio-core | No changes needed |
| `src/theme-cascade.ts` | Move from studio-core | No changes needed |
| `src/index.ts` | Create | Exports: all moved files |

### Trimmed: `packages/formspec-studio-core/`

| File | Action | Notes |
|------|--------|-------|
| `src/project.ts` | Delete | Dead orphan — old standalone class, superseded by project-wrapper.ts |
| `src/project-wrapper.ts` | Rename → `src/project.ts` | Refactor: composition replaces inheritance |
| `src/types.ts` | Delete | Moved to formspec-core |
| `src/raw-project.ts` | Delete | Moved to formspec-core |
| `src/handler-registry.ts` | Delete | Moved to formspec-core |
| `src/handlers.ts` | Delete | Moved to formspec-core |
| `src/handlers/` | Delete | Moved to formspec-core |
| `src/normalization.ts` | Delete | Moved to formspec-core |
| `src/component-documents.ts` | Delete | Moved to formspec-core |
| `src/page-resolution.ts` | Delete | Moved to formspec-core |
| `src/theme-cascade.ts` | Delete | Moved to formspec-core |
| `src/helper-types.ts` | Keep | No changes |
| `src/field-type-aliases.ts` | Keep | No changes |
| `src/evaluation-helpers.ts` | Keep | No changes |
| `src/index.ts` | Rewrite | Re-export from formspec-core + local exports |
| `package.json` | Update | Add `formspec-core: "*"`, remove `ajv` |

### Test redistribution

| Tests → `packages/formspec-core/tests/` | Tests → `packages/formspec-studio-core/tests/` |
|------------------------------------------|------------------------------------------------|
| `raw-project.test.ts` ⚠️ see note below | `project-methods.test.ts` |
| `project.test.ts` | `e2e.test.ts` |
| `history.test.ts` | `e2e-examples.test.ts` |
| `batch-and-notify.test.ts` | `cross-artifact.test.ts` |
| `project-commands.test.ts` | `evaluation-helpers.test.ts` |
| `definition-fields.test.ts` | `schema-cross-ref.test.ts` ⚠️ see note below |
| `definition-items.test.ts` | |
| `definition-instances.test.ts` | |
| `definition-migrations.test.ts` | |
| `definition-optionsets.test.ts` | |
| `definition-pages.test.ts` | |
| `definition-screener.test.ts` | |
| `definition-shapes-vars.test.ts` | |
| `component-tree.test.ts` | |
| `component-properties.test.ts` | |
| `theme.test.ts` | |
| `mapping.test.ts` | |
| `pages-handlers.test.ts` | |
| `page-resolution.test.ts` | |
| `theme-cascade.test.ts` | |
| `normalization.test.ts` | |
| `queries.test.ts` | |
| `diagnostics.test.ts` | |
| `breakpoint-sync.test.ts` | |
| `tree-sync.test.ts` | |
| `page-aware-rebuild.test.ts` | |

**⚠️ `raw-project.test.ts` — must split, not move whole.** The file has three sections: (1) `HelperError` and field-type alias tests (imports `helper-types.js`, `field-type-aliases.js` — stay in studio-core), (2) `RawProject` tests (move to formspec-core), (3) `Project` wrapper tests (stay in studio-core — also needs updating since `Project` no longer extends `RawProject`). In Task 9, split this file into `formspec-core/tests/raw-project.test.ts` (section 2 only) and keep the rest in `formspec-studio-core/tests/`.

**⚠️ `schema-cross-ref.test.ts` — stays in studio-core.** It uses 30+ `Project` helper methods (`.addField()`, `.addGroup()`, `.updateItem()`, etc.) that only exist on `Project`, not `RawProject`.

---

## Chunk 1: Baseline + Cleanup

### Task 1: Establish green baseline and delete dead file

**Files:**
- Delete: `packages/formspec-studio-core/src/project.ts`

- [ ] **Step 1: Run full test suite — must be green before touching anything**

```bash
cd packages/formspec-studio-core && npm test
```

Expected: All tests pass. If any fail, stop and fix them first.

- [ ] **Step 2: Confirm project.ts is the dead file (not wired into index.ts)**

```bash
grep "project-wrapper\|from './project'" packages/formspec-studio-core/src/index.ts
```

Expected output: `export { Project, createProject } from './project-wrapper.js';`
(Confirms `project.ts` is not referenced.)

- [ ] **Step 3: Delete dead file**

```bash
git rm packages/formspec-studio-core/src/project.ts
```

- [ ] **Step 4: Run tests to confirm deletion didn't break anything**

```bash
cd packages/formspec-studio-core && npm test
```

Expected: All tests still pass.

- [ ] **Step 5: Commit**

```bash
git commit -m "refactor: delete unreferenced project.ts (superseded by project-wrapper.ts)"
```

---

### Task 2: Scaffold formspec-core package

**Files:**
- Create: `packages/formspec-core/package.json`
- Create: `packages/formspec-core/tsconfig.json`
- Create: `packages/formspec-core/vitest.config.ts`
- Create: `packages/formspec-core/src/index.ts` (placeholder)
- Create: `packages/formspec-core/tests/` (empty directory)

- [ ] **Step 1: Create package directory**

```bash
mkdir -p packages/formspec-core/src packages/formspec-core/tests
```

- [ ] **Step 2: Create package.json**

```json
// packages/formspec-core/package.json
{
  "name": "formspec-core",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "ajv": "^8.18.0",
    "formspec-engine": "*"
  },
  "devDependencies": {
    "vitest": "^3.2.4",
    "typescript": "^5.0.0"
  }
}
```

- [ ] **Step 3: Create tsconfig.json**

```json
// packages/formspec-core/tsconfig.json
{
  "compilerOptions": {
    "target": "es2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "declaration": true,
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 4: Create vitest.config.ts**

```typescript
// packages/formspec-core/vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      'formspec-engine': path.resolve(__dirname, '../formspec-engine/src/index.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 5: Create placeholder index.ts**

```typescript
// packages/formspec-core/src/index.ts
// Content will be added in Task 5
export {};
```

- [ ] **Step 6: Install dependencies**

Run from the **repo root** (not inside the package) so the workspace symlinks are set up correctly:

```bash
npm install
```

- [ ] **Step 7: Commit scaffold**

```bash
git add packages/formspec-core/
git commit -m "feat: scaffold formspec-core package"
```

---

## Chunk 2: Build formspec-core

### Task 3: Create IProjectCore interface

**Files:**
- Create: `packages/formspec-core/src/project-core.ts`

The interface is extracted verbatim from `RawProject`'s public API. Every public getter and method becomes an interface member. TypeScript will enforce this when we add `implements IProjectCore` to `RawProject` in Task 4.

- [ ] **Step 1: Create project-core.ts**

Read `packages/formspec-studio-core/src/raw-project.ts` to get exact type imports, then write:

```typescript
// packages/formspec-core/src/project-core.ts
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
 * Implemented by RawProject. Consumed by Project (formspec-studio-core).
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
  // canUndo/canRedo are getters on RawProject — interface uses readonly property
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly log: readonly LogEntry[];
  resetHistory(): void;

  // ── Change notifications ─────────────────────────────────────
  /** Subscribe to state changes. Returns an unsubscribe function. */
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
```

**Note:** The exact type imports will depend on what's available from `types.ts`. If you hit import errors, check `packages/formspec-studio-core/src/raw-project.ts` for the actual import statements used there and replicate them.

- [ ] **Step 2: Commit**

```bash
git add packages/formspec-core/src/project-core.ts
git commit -m "feat(formspec-core): add IProjectCore interface"
```

---

### Task 4: Move files to formspec-core

Move all files that belong in formspec-core. Use `git mv` to preserve history.

**Files to move** (from `packages/formspec-studio-core/src/` → `packages/formspec-core/src/`):
- `types.ts`
- `raw-project.ts`
- `handler-registry.ts`
- `handlers.ts`
- `handlers/` (entire directory — 17 files)
- `normalization.ts`
- `component-documents.ts`
- `page-resolution.ts`
- `theme-cascade.ts`

- [ ] **Step 1: Move files with git mv**

```bash
cd /path/to/formspec  # repo root

git mv packages/formspec-studio-core/src/types.ts packages/formspec-core/src/types.ts
git mv packages/formspec-studio-core/src/raw-project.ts packages/formspec-core/src/raw-project.ts
git mv packages/formspec-studio-core/src/handler-registry.ts packages/formspec-core/src/handler-registry.ts
git mv packages/formspec-studio-core/src/handlers.ts packages/formspec-core/src/handlers.ts
git mv packages/formspec-studio-core/src/handlers packages/formspec-core/src/handlers
git mv packages/formspec-studio-core/src/normalization.ts packages/formspec-core/src/normalization.ts
git mv packages/formspec-studio-core/src/component-documents.ts packages/formspec-core/src/component-documents.ts
git mv packages/formspec-studio-core/src/page-resolution.ts packages/formspec-core/src/page-resolution.ts
git mv packages/formspec-studio-core/src/theme-cascade.ts packages/formspec-core/src/theme-cascade.ts
```

- [ ] **Step 2: Verify the moves**

```bash
ls packages/formspec-core/src/
ls packages/formspec-studio-core/src/
```

Expected in formspec-core/src/: `types.ts raw-project.ts handler-registry.ts handlers.ts handlers/ normalization.ts component-documents.ts page-resolution.ts theme-cascade.ts project-core.ts index.ts`

Expected remaining in studio-core/src/: `project-wrapper.ts helper-types.ts field-type-aliases.ts evaluation-helpers.ts index.ts`

- [ ] **Step 3: Commit the move before making any further changes**

```bash
git add -A
git commit -m "refactor: move core files to formspec-core package"
```

---

### Task 5: Add implements IProjectCore to RawProject + create formspec-core index

**Files:**
- Modify: `packages/formspec-core/src/raw-project.ts`
- Modify: `packages/formspec-core/src/index.ts`

The import paths inside `raw-project.ts`, `handlers.ts`, `handlers/*.ts` etc. are all relative (`'./types.js'`, `'./handler-registry.js'`, `'./handlers/helpers.js'` etc.). Since all files moved together to the same directory structure, these relative imports are still valid — no changes needed inside the handler files.

- [ ] **Step 1: Add implements IProjectCore to RawProject**

Open `packages/formspec-core/src/raw-project.ts`. Find the class declaration:

```typescript
export class RawProject {
```

Change it to:

```typescript
import type { IProjectCore } from './project-core.js';
// ... (add this import near the top with other imports)

export class RawProject implements IProjectCore {
```

- [ ] **Step 2: Run tsc to let TypeScript find any interface gaps**

```bash
cd packages/formspec-core && npx tsc --noEmit
```

If TypeScript reports errors like "Property X is missing from type RawProject", it means the IProjectCore interface has a method that RawProject doesn't implement (or vice versa — a typo in the interface). Fix by:
- Correcting the interface method name to match RawProject, OR
- Confirming the method exists on RawProject and fixing the interface if it was listed wrong

Do NOT add stub implementations to RawProject — every interface method must correspond to a real method.

- [ ] **Step 3: Write formspec-core/src/index.ts**

```typescript
// packages/formspec-core/src/index.ts
/**
 * @module formspec-core
 *
 * Raw form project state management: command dispatch, handler pipeline,
 * undo/redo, and the IProjectCore abstraction.
 *
 * For the behavior-driven authoring API, use formspec-studio-core.
 */

export type { IProjectCore } from './project-core.js';
export { RawProject, createRawProject } from './raw-project.js';
export { resolveItemLocation } from './handlers/helpers.js';
export { normalizeDefinition } from './normalization.js';
export { resolveThemeCascade } from './theme-cascade.js';
export type { ResolvedProperty } from './theme-cascade.js';
export { resolvePageStructure } from './page-resolution.js';
export type { ResolvedPageStructure, ResolvedPage, ResolvedRegion, PageDiagnostic } from './page-resolution.js';
export type {
  ProjectState,
  ProjectOptions,
  Command,
  AnyCommand,
  CommandResult,
  ChangeListener,
  ChangeEvent,
  LogEntry,
  Middleware,
  ProjectBundle,
  ProjectStatistics,
  FormspecComponentDocument,
  FormspecGeneratedLayoutDocument,
  FormspecThemeDocument,
  FormspecMappingDocument,
  ExtensionsState,
  VersioningState,
  ItemFilter,
  DataTypeInfo,
  RegistrySummary,
  ExtensionFilter,
  Change,
  FormspecChangelog,
  FELParseContext,
  FELMappingContext,
  FELParseResult,
  FELReferenceSet,
  FELFunctionEntry,
  ExpressionLocation,
  DependencyGraph,
  FieldDependents,
  Diagnostic,
  Diagnostics,
  ResponseSchemaRow,
} from './types.js';
```

- [ ] **Step 4: Build formspec-core**

```bash
cd packages/formspec-core && npm run build
```

Expected: Clean build, no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add packages/formspec-core/
git commit -m "feat(formspec-core): add IProjectCore impl, complete index exports"
```

---

## Chunk 3: Refactor formspec-studio-core

### Task 6: Update studio-core package.json and dependencies

**Files:**
- Modify: `packages/formspec-studio-core/package.json`

- [ ] **Step 1: Update package.json**

```json
{
  "name": "formspec-studio-core",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "formspec-core": "*",
    "formspec-engine": "*"
  },
  "devDependencies": {
    "vitest": "^3.2.4",
    "typescript": "^5.0.0"
  }
}
```

(Removed `ajv` — moved with the handler code. Added `formspec-core`.)

- [ ] **Step 2: Update vitest.config.ts to alias formspec-core**

```typescript
// packages/formspec-studio-core/vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      'formspec-engine': path.resolve(__dirname, '../formspec-engine/src/index.ts'),
      'formspec-core': path.resolve(__dirname, '../formspec-core/src/index.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Install deps**

Run from the **repo root** so workspace symlinks resolve correctly:

```bash
npm install
```

- [ ] **Step 4: Commit**

```bash
git add packages/formspec-studio-core/package.json packages/formspec-studio-core/vitest.config.ts
git commit -m "refactor(studio-core): add formspec-core dep, remove ajv"
```

---

### Task 7: Refactor Project from inheritance to composition

**Files:**
- Rename: `packages/formspec-studio-core/src/project-wrapper.ts` → `packages/formspec-studio-core/src/project.ts`

**The key insight:** `Project` will `implement IProjectCore` by delegating every method to `this.core`. This means the 51 helper methods (`addField`, `addGroup`, etc.) that call `this.dispatch(...)`, `this.state`, `this.batch(...)` etc. **do not change at all** — they still work because `Project` now has those methods as delegates. Only the class scaffolding changes.

- [ ] **Step 1: Rename project-wrapper.ts**

```bash
git mv packages/formspec-studio-core/src/project-wrapper.ts packages/formspec-studio-core/src/project.ts
```

- [ ] **Step 1b: Update all remaining `project-wrapper.js` references**

```bash
grep -r "project-wrapper" packages/formspec-studio-core/
```

Expected: `evaluation-helpers.ts`, `evaluation-helpers.test.ts`, `project-methods.test.ts` (and possibly others).

Update each occurrence:
- `packages/formspec-studio-core/src/evaluation-helpers.ts`: `'./project-wrapper.js'` → `'./project.js'`
- `packages/formspec-studio-core/tests/evaluation-helpers.test.ts`: `'../src/project-wrapper.js'` → `'../src/project.js'`
- `packages/formspec-studio-core/tests/project-methods.test.ts`: `'../src/project-wrapper.js'` → `'../src/project.js'`

- [ ] **Step 2: Update the class header and imports**

Open `packages/formspec-studio-core/src/project.ts`. Change:

```typescript
import { RawProject } from './raw-project.js';
import type {
  ProjectOptions,
  AnyCommand,
} from './types.js';
```

To:

```typescript
import { createRawProject } from 'formspec-core';
import type {
  IProjectCore,
  ProjectOptions,
  ProjectState,
  AnyCommand,
  CommandResult,
  ChangeListener,
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
} from 'formspec-core';
import type { FormspecDefinition, FormspecItem } from 'formspec-engine';
```

**Important:** The existing `import { rewriteFELReferences } from 'formspec-engine'` line (value import, used by helper methods) must be kept. Only the imports shown above are being replaced.

- [ ] **Step 3: Replace the class declaration and add constructor + delegation**

Find:
```typescript
export class Project extends RawProject {
  /** Backwards-compatible self-reference (composition → inheritance migration). */
  get raw(): this { return this; }
```

Replace with:
```typescript
export class Project implements IProjectCore {
  constructor(private readonly core: IProjectCore) {}

  /** Exposes the underlying IProjectCore (e.g. for consumers that need raw dispatch). */
  get raw(): IProjectCore { return this.core; }

  // ── IProjectCore delegation ───────────────────────────────────
  get state(): Readonly<ProjectState> { return this.core.state; }
  get definition(): Readonly<FormspecDefinition> { return this.core.definition; }
  get component(): Readonly<FormspecComponentDocument> { return this.core.component; }
  get artifactComponent(): Readonly<FormspecComponentDocument> { return this.core.artifactComponent; }
  get generatedComponent(): Readonly<FormspecComponentDocument> { return this.core.generatedComponent; }
  get theme(): Readonly<FormspecThemeDocument> { return this.core.theme; }
  get mapping(): Readonly<FormspecMappingDocument> { return this.core.mapping; }

  dispatch(command: AnyCommand): CommandResult;
  dispatch(command: AnyCommand[]): CommandResult[];
  // TypeScript cannot resolve overloads through a generic interface call, so we
  // cast once here. This is safe: IProjectCore declares both overloads.
  dispatch(command: AnyCommand | AnyCommand[]): CommandResult | CommandResult[] {
    return (this.core.dispatch as (c: AnyCommand | AnyCommand[]) => CommandResult | CommandResult[])(command);
  }
  batch(commands: AnyCommand[]): CommandResult[] { return this.core.batch(commands); }
  batchWithRebuild(p1: AnyCommand[], p2: AnyCommand[]): CommandResult[] { return this.core.batchWithRebuild(p1, p2); }
  undo(): boolean { return this.core.undo(); }
  redo(): boolean { return this.core.redo(); }
  // canUndo/canRedo are getters on RawProject — delegate as getters, not methods
  get canUndo(): boolean { return this.core.canUndo; }
  get canRedo(): boolean { return this.core.canRedo; }
  get log(): readonly LogEntry[] { return this.core.log; }
  resetHistory(): void { this.core.resetHistory(); }
  onChange(listener: ChangeListener): () => void { return this.core.onChange(listener); }

  fieldPaths(): string[] { return this.core.fieldPaths(); }
  itemAt(path: string): FormspecItem | undefined { return this.core.itemAt(path); }
  responseSchemaRows(): ResponseSchemaRow[] { return this.core.responseSchemaRows(); }
  statistics(): ProjectStatistics { return this.core.statistics(); }
  instanceNames(): string[] { return this.core.instanceNames(); }
  variableNames(): string[] { return this.core.variableNames(); }
  optionSetUsage(name: string): string[] { return this.core.optionSetUsage(name); }
  searchItems(filter: ItemFilter): FormspecItem[] { return this.core.searchItems(filter); }
  effectivePresentation(k: string): Record<string, unknown> { return this.core.effectivePresentation(k); }
  bindFor(path: string): Record<string, unknown> | undefined { return this.core.bindFor(path); }
  componentFor(k: string): Record<string, unknown> | undefined { return this.core.componentFor(k); }
  resolveExtension(name: string): Record<string, unknown> | undefined { return this.core.resolveExtension(name); }
  unboundItems(): string[] { return this.core.unboundItems(); }
  resolveToken(key: string): string | number | undefined { return this.core.resolveToken(key); }
  allDataTypes(): DataTypeInfo[] { return this.core.allDataTypes(); }
  parseFEL(expr: string, ctx?: FELParseContext): FELParseResult { return this.core.parseFEL(expr, ctx); }
  felFunctionCatalog(): FELFunctionEntry[] { return this.core.felFunctionCatalog(); }
  availableReferences(ctx?: string | FELParseContext): FELReferenceSet { return this.core.availableReferences(ctx); }
  allExpressions(): ExpressionLocation[] { return this.core.allExpressions(); }
  expressionDependencies(expr: string): string[] { return this.core.expressionDependencies(expr); }
  fieldDependents(path: string): FieldDependents { return this.core.fieldDependents(path); }
  variableDependents(name: string): string[] { return this.core.variableDependents(name); }
  dependencyGraph(): DependencyGraph { return this.core.dependencyGraph(); }
  listRegistries(): RegistrySummary[] { return this.core.listRegistries(); }
  browseExtensions(f?: ExtensionFilter): Record<string, unknown>[] { return this.core.browseExtensions(f); }
  diffFromBaseline(v?: string): Change[] { return this.core.diffFromBaseline(v); }
  previewChangelog(): FormspecChangelog { return this.core.previewChangelog(); }
  diagnose(): Diagnostics { return this.core.diagnose(); }
  export(): ProjectBundle { return this.core.export(); }
```

**Note on the constructor:** The overloaded constructor allows both `new Project(rawProjectInstance)` for DI and `new Project(options)` for convenience. The factory `createProject(options)` uses the options path.

- [ ] **Step 4: Update createProject factory (near end of file)**

Find:
```typescript
export function createProject(options?: ProjectOptions): Project {
  return new Project(options);
}
```

Change to:
```typescript
export function createProject(options?: ProjectOptions): Project {
  return new Project(createRawProject(options));
}
```

The factory creates the `RawProject` and injects it. `Project`'s constructor now takes `IProjectCore` only.

- [ ] **Step 5: Run tsc to catch any remaining issues**

```bash
cd packages/formspec-studio-core && npx tsc --noEmit
```

Expected: Clean. If you get errors referencing removed imports (`./raw-project.js`, `./types.js`), update those import paths to `'formspec-core'`.

- [ ] **Step 6: Run tests**

```bash
cd packages/formspec-studio-core && npm test
```

Expected: All tests pass. (Tests that import `createProject` or `createRawProject` from the old index will need the index updated — do that in the next task.)

- [ ] **Step 7: Commit**

```bash
git add packages/formspec-studio-core/src/project.ts
git commit -m "refactor(studio-core): Project — inheritance → composition via IProjectCore"
```

---

### Task 8: Rewrite formspec-studio-core index.ts

**Files:**
- Modify: `packages/formspec-studio-core/src/index.ts`

- [ ] **Step 1: Rewrite index.ts**

```typescript
// packages/formspec-studio-core/src/index.ts
/**
 * @module formspec-studio-core
 *
 * Document-agnostic semantic authoring API for Formspec.
 * Project composes IProjectCore (from formspec-core) and exposes
 * 51 behavior-driven helper methods for form authoring.
 *
 * Re-exports all of formspec-core for consumer convenience.
 */

// Re-export everything from formspec-core so consumers need no import changes
export * from 'formspec-core';

// Local exports
export { Project, createProject } from './project.js';
export { HelperError } from './helper-types.js';
export type {
  HelperResult,
  HelperWarning,
  FieldProps,
  GroupProps,
  RepeatProps,
  BranchPath,
  LayoutArrangement,
  PlacementOptions,
  FlowProps,
  ValidationOptions,
  InstanceProps,
  ChoiceOption,
  ItemChanges,
  MetadataChanges,
} from './helper-types.js';
export { resolveFieldType, resolveWidget, widgetHintFor, isTextareaWidget } from './field-type-aliases.js';
export type { ResolvedFieldType } from './field-type-aliases.js';
export { previewForm, validateResponse } from './evaluation-helpers.js';
```

- [ ] **Step 2: Run tsc**

```bash
cd packages/formspec-studio-core && npx tsc --noEmit
```

Expected: Clean.

- [ ] **Step 3: Run tests**

```bash
cd packages/formspec-studio-core && npm test
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/formspec-studio-core/src/index.ts
git commit -m "refactor(studio-core): rewrite index — re-export formspec-core, local exports only"
```

---

## Chunk 4: Tests and Verification

### Task 9: Move tests to formspec-core

**Files:**
- Move 27 test files from `packages/formspec-studio-core/tests/` → `packages/formspec-core/tests/`

Tests in formspec-core cannot import from formspec-studio-core. Most tests use `createProject` or `createRawProject`. After the move:
- Tests that use `createProject` to test handler/dispatch behavior: change import to `createRawProject` from `'../src/index.js'`
- Tests that use `createProject` but only access `dispatch`/state APIs: switch to `createRawProject`

- [ ] **Step 1: Split raw-project.test.ts**

`raw-project.test.ts` mixes three concerns. Read the file and identify the section boundaries:
- Section 1: `HelperError` and field-type alias tests (imports from `helper-types.js`, `field-type-aliases.js`)
- Section 2: `RawProject` tests (the section to extract into formspec-core)
- Section 3: `Project` wrapper tests (checks `instanceof RawProject`, `instanceof Project`)

Create `packages/formspec-core/tests/raw-project.test.ts` containing only Section 2 (the RawProject tests), with imports updated to `'../src/index.js'`.

Keep Sections 1 and 3 in `packages/formspec-studio-core/tests/raw-project.test.ts` (update imports for Section 3 since `Project` no longer extends `RawProject` — the `instanceof RawProject` check will need removing or updating).

- [ ] **Step 2: Move the remaining test files**

```bash
git mv packages/formspec-studio-core/tests/project.test.ts packages/formspec-core/tests/
git mv packages/formspec-studio-core/tests/history.test.ts packages/formspec-core/tests/
git mv packages/formspec-studio-core/tests/batch-and-notify.test.ts packages/formspec-core/tests/
git mv packages/formspec-studio-core/tests/project-commands.test.ts packages/formspec-core/tests/
git mv packages/formspec-studio-core/tests/definition-fields.test.ts packages/formspec-core/tests/
git mv packages/formspec-studio-core/tests/definition-items.test.ts packages/formspec-core/tests/
git mv packages/formspec-studio-core/tests/definition-instances.test.ts packages/formspec-core/tests/
git mv packages/formspec-studio-core/tests/definition-migrations.test.ts packages/formspec-core/tests/
git mv packages/formspec-studio-core/tests/definition-optionsets.test.ts packages/formspec-core/tests/
git mv packages/formspec-studio-core/tests/definition-pages.test.ts packages/formspec-core/tests/
git mv packages/formspec-studio-core/tests/definition-screener.test.ts packages/formspec-core/tests/
git mv packages/formspec-studio-core/tests/definition-shapes-vars.test.ts packages/formspec-core/tests/
git mv packages/formspec-studio-core/tests/component-tree.test.ts packages/formspec-core/tests/
git mv packages/formspec-studio-core/tests/component-properties.test.ts packages/formspec-core/tests/
git mv packages/formspec-studio-core/tests/theme.test.ts packages/formspec-core/tests/
git mv packages/formspec-studio-core/tests/mapping.test.ts packages/formspec-core/tests/
git mv packages/formspec-studio-core/tests/pages-handlers.test.ts packages/formspec-core/tests/
git mv packages/formspec-studio-core/tests/page-resolution.test.ts packages/formspec-core/tests/
git mv packages/formspec-studio-core/tests/theme-cascade.test.ts packages/formspec-core/tests/
git mv packages/formspec-studio-core/tests/normalization.test.ts packages/formspec-core/tests/
git mv packages/formspec-studio-core/tests/queries.test.ts packages/formspec-core/tests/
git mv packages/formspec-studio-core/tests/diagnostics.test.ts packages/formspec-core/tests/
git mv packages/formspec-studio-core/tests/breakpoint-sync.test.ts packages/formspec-core/tests/
git mv packages/formspec-studio-core/tests/tree-sync.test.ts packages/formspec-core/tests/
git mv packages/formspec-studio-core/tests/page-aware-rebuild.test.ts packages/formspec-core/tests/
```

Note: `schema-cross-ref.test.ts` stays in studio-core — it uses Project helper methods.

- [ ] **Step 2: Update imports in moved tests**

Each moved test file imports using patterns like:

```typescript
import { createProject } from '../src/index.js';
// or
import { createRawProject } from '../src/index.js';
```

After the move, `'../src/index.js'` still works (files are in `formspec-core/tests/` → `formspec-core/src/index.ts`).

The only change needed: any test that imports `createProject` should switch to `createRawProject` since `Project` is not in formspec-core.

Replace `createProject` with `createRawProject` across all moved tests in one pass:

```bash
# Replace all occurrences in moved test files
find packages/formspec-core/tests/ -name "*.test.ts" \
  -exec sed -i '' 's/createProject/createRawProject/g' {} +

# Verify no stray createProject references remain
grep -r "createProject" packages/formspec-core/tests/
```

Expected: No output (no remaining `createProject` references). The import statements and call sites are both updated by the sed pass since the symbol name is the same in both.

**Important:** If a test uses `Project`-specific helper methods (`.addField()`, `.addGroup()` etc.), it should NOT be in formspec-core. Move it back to formspec-studio-core tests if you find this.

- [ ] **Step 3: Run formspec-core tests**

```bash
cd packages/formspec-core && npm test
```

Expected: All moved tests pass. Fix any remaining import issues.

- [ ] **Step 4: Run formspec-studio-core tests (remaining 5 files)**

```bash
cd packages/formspec-studio-core && npm test
```

Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: move handler/core tests to formspec-core"
```

---

### Task 10: Full build and verification

- [ ] **Step 1: Build formspec-core**

```bash
cd packages/formspec-core && npm run build
```

Expected: Clean build in `dist/`.

- [ ] **Step 2: Build formspec-studio-core**

```bash
cd packages/formspec-studio-core && npm run build
```

Expected: Clean build in `dist/`.

- [ ] **Step 3: Run all tests in both packages**

```bash
cd packages/formspec-core && npm test
cd packages/formspec-studio-core && npm test
```

Expected: All tests pass in both packages.

- [ ] **Step 4: Build formspec-engine (shouldn't be affected, but verify)**

```bash
cd packages/formspec-engine && npm run build
```

- [ ] **Step 5: Verify consumers build (formspec-shared, formspec-chat, formspec-studio if present)**

```bash
# For each consumer package:
ls packages/
# Then for each that exists:
cd packages/<consumer> && npm run build 2>&1 | head -20
```

Expected: Clean builds. If any consumer fails with "Cannot find module 'formspec-studio-core'", it's because the dist hasn't been linked. Run `npm install` in the repo root first.

- [ ] **Step 6: Regenerate API.llm.md for both packages**

```bash
make api-docs
```

This regenerates the colocated `API.llm.md` files for both packages. If `make api-docs` isn't available for the new package yet, run the TypeDoc command directly:

```bash
cd packages/formspec-core && npx typedoc src/index.ts --out ../../docs/api/formspec-core
cd packages/formspec-studio-core && npx typedoc src/index.ts --out ../../docs/api/formspec-studio-core
```

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: complete formspec-core / formspec-studio-core split"
```

---

### Task 11: Update MEMORY.md

- [ ] **Step 1: Update memory with split outcome**

Update `/Users/mikewolfd/.claude/projects/-Users-mikewolfd-Work-formspec/memory/MEMORY.md` to reflect:
- `formspec-core` now exists with `RawProject`, `IProjectCore`, all handlers
- `formspec-studio-core` now uses composition: `Project implements IProjectCore` wrapping an injected core
- `formspec-studio-core` re-exports everything from `formspec-core`
- `project-wrapper.ts` is now `project.ts`
- Dead `project.ts` (old standalone) is deleted

---

## Troubleshooting

**TypeScript error: "Property X missing from IProjectCore"**
RawProject has a public method not listed in IProjectCore. Add it to the interface. Do not add it only to RawProject — the interface must be complete.

**TypeScript error: "Property X missing from Project"**
A method in IProjectCore was not delegated in Project. Add the one-liner delegation.

**Test error: "createProject is not exported"**
A moved test still uses `createProject`. Replace with `createRawProject`.

**Import error: "Cannot find module './raw-project.js'"** in studio-core
A file in studio-core still imports from files that moved to formspec-core. Update the import to `'formspec-core'`.

**Build error: "Cannot find module 'ajv'"** in formspec-core
Run `npm install` in `packages/formspec-core/`.
