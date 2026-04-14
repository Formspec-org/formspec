# API Spec v3 — Phase 2: Reuse-First Refactoring & Architectural Alignment

This phase is not a "move logic into the engine" exercise.

The goal is to converge on shared semantic primitives where duplication is real, while keeping `formspec-studio-core` responsible for editor-facing orchestration and bundle-level queries.

Use existing engine functionality where it already models the spec correctly. If sharing requires a large abstraction or engine awareness of studio workflows, do not do it.

---

## Status Update (2026-03-10)

- Implemented Slice 1 and Slice 2 scope end-to-end with tests.
- Completed Slice 3 scope (`allExpressions`, `availableReferences`, `felFunctionCatalog`, diff/changelog fidelity, diagnostics expansion) with tests.
- Added parser-context support in `Project.parseFEL(expression, context?)` and shared engine helpers for function catalog + extension usage validation.
- Added Ajv-backed structural diagnostics (opt-in by artifact shape) and recorded performance sanity measurements.

---

## Tooling Decisions

- [x] **Keep the existing FEL parser stack**
  - [x] Continue using Chevrotain for FEL lexer/parser/CST work.
  - [x] Build new analysis and rewriting primitives on top of the existing Chevrotain-based pipeline rather than introducing a second parser stack.
  - [x] Do not adopt a new language workbench or parser generator for Phase 2 unless the goal changes from targeted reuse to a full parser/toolchain rewrite.

- [x] **Use Ajv where schema validation is required**
  - [x] Use Ajv for JSON Schema-backed structural diagnostics if and where structural validation is brought into scope.
  - [x] Prefer Ajv over custom schema-validation logic.
  - [x] Keep Ajv scoped to schema validation; do not treat it as part of the FEL analysis/rewrite problem.

---

## Phase 2 Principles

- [x] **Reuse before rewrite**
  - [x] Prefer exporting or lightly adapting existing `formspec-engine` logic over re-implementing it in Studio.
  - [x] Only create new shared primitives when both packages genuinely need the same spec semantics.
  - [x] Do not move code into the engine just to reduce line count in Studio.

- [x] **Red-Green TDD always**
  - [x] For every Phase 2 slice, start with one failing test that captures the semantic gap or regression risk.
  - [x] Make the smallest change that turns the test green before broadening the implementation.
  - [x] Add edge-case and cross-artifact coverage only after the minimal path passes.
  - [x] Run the relevant package suite after each slice and the full `formspec-studio-core` suite before considering the slice done.

- [x] **Keep responsibilities clean**
  - [x] `formspec-engine` owns reusable spec semantics: FEL parsing/analysis, path semantics, mapping execution, and other artifact-agnostic primitives.
  - [x] `formspec-studio-core` owns orchestration: project queries, command dispatch, editor context assembly, changelog presentation, and cross-artifact UX surfaces.
  - [x] Do not make the engine depend on Studio concepts like command payloads, UI contexts, or Project state shape.

- [x] **Prefer narrow seams**
  - [x] Export small APIs such as `analyzeFEL(...)`, `rewriteFELReferences(...)`, `itemAtPath(...)`, or `validateExtensionUsage(...)` instead of exposing raw parser internals.
  - [x] Reuse the engine's runtime implementations where they already exist instead of creating "preview-only" approximations in Studio.
  - [x] Avoid introducing a shared abstraction unless its input/output contract is obvious from the spec.

---

## FEL Analysis: Reuse Existing Parser Infrastructure

- [x] **Create a reusable engine FEL analysis surface**
  - [x] Add a small engine API on top of the existing lexer/parser/dependency visitor rather than making Studio use Chevrotain primitives directly.
  - [x] Base the new API on the existing FEL pipeline already used by `formspec-engine`.
  - [x] Define the engine analysis contract up front before any Studio migration work begins.
  - [x] Start from an explicit API shape such as:

    ```ts
    interface FELAnalysisError {
      message: string;
      offset?: number;
      line?: number;
      column?: number;
    }

    interface FELAnalysis {
      valid: boolean;
      errors: FELAnalysisError[];
      references: string[];
      variables: string[];
      functions: string[];
      cst?: unknown;
    }

    function analyzeFEL(expression: string): FELAnalysis;
    function getFELDependencies(expression: string): string[];
    ```

  - [x] Keep `cst` opaque if it must be exposed at all; do not make Chevrotain node shapes part of the long-term public contract unless there is a clear need.
  - [x] Preserve comment and string-literal correctness by relying on lexer/parser behavior, not regexes.
  - [x] Treat export-surface work as real work: the relevant FEL parser utilities are currently private, so Slice 1 includes designing and exporting the right engine primitives rather than assuming they already exist.

- [x] **Refactor Studio queries to consume engine FEL analysis**
  - [x] Update `Project.parseFEL` to use the engine analysis API instead of regex extraction.
  - [x] Update `Project.expressionDependencies` to use parser-backed dependency extraction.
  - [x] Update `Project.dependencyGraph` to use parser-backed dependency extraction.
  - [x] Update `Project.fieldDependents` and `Project.variableDependents` to analyze references structurally rather than using substring matching.
  - [x] Build project-level dependency graphs in Studio using engine FEL analysis as the input.
  - [x] Implement dependency-cycle detection in Studio as part of graph construction, unless a general reusable graph helper falls out naturally.
  - [x] Use a straightforward, well-understood algorithm and keep the outward result shape stable.

- [x] **Keep Studio-owned editor context in Studio**
  - [x] Keep `Project.parseFEL(expression, context?)` as the Studio-facing API.
  - [x] Implement `targetPath` and `mappingContext` support in Studio by feeding context into shared engine analysis primitives where appropriate.
  - [x] Keep editor/autocomplete assembly in Studio; only share the underlying semantic analysis.

---

## FEL Rewriting: Extract a General Primitive, Do Not Reuse Assembly-Specific Code Directly

- [x] **Introduce a reusable engine rewriter**
  - [x] Extract a new engine-level FEL rewriting primitive for targeted renames.
  - [x] Be explicit about the Phase 2 choice: build one new parser-aware engine rewriter and converge both Studio rename flows and assembler rewriting onto it.
  - [x] Treat the current assembler `rewriteFEL` as legacy behavior to replace, not as a permanent parallel path.
  - [x] Design the new rewriter API around generic reference rewriting semantics rather than Studio-specific rename commands or assembler-specific `RewriteMap` assumptions.
  - [x] Ensure rewriting is parser-aware so names inside strings and comments are not modified.
  - [x] Migrate incrementally: land the new primitive with direct tests first, then switch Studio rename flows, then switch assembler rewriting once parity is proven.

- [x] **Adopt the shared rewriter in Studio**
  - [x] Replace `rewriteFieldRef` in Studio with the shared engine rewriter.
  - [x] Update `definition.renameItem` to rewrite references using path-aware semantics, not bare substring/key replacement.
  - [x] Update `definition.renameInstance` to use the shared rewriter for `@instance(...)` references.
  - [x] Cover binds, shapes, variables, mapping rules, and any other FEL-bearing artifacts enumerated by the spec.

- [x] **Adopt the shared rewriter in the assembler**
  - [x] Replace the current regex-based assembler rewrite path with the shared engine rewriter once behavior is covered by tests.
  - [x] Preserve existing assembly semantics for fragment-root rewrites, `@current` paths, and navigation helpers while changing the implementation underneath.
  - [x] Treat assembler migration as part of Phase 2, not as an optional follow-up.

- [x] **Guard against over-coupling**
  - [x] Do not let assembler-specific `RewriteMap` concerns leak into the core rewriter contract.
  - [x] Keep rename orchestration in Studio and assembly orchestration in the assembler; share only the FEL rewrite primitive itself.

---

## Tree Traversal & Path Semantics: Share the Primitive, Not the Project API

- [x] **Extract shared item-tree utilities**
  - [x] Extract the read-only path traversal primitive behind Studio `itemAt` and engine `findItem` into engine utilities.
  - [x] Keep mutation-oriented location metadata (`parent`, `index`, `item`) as a Studio wrapper around the shared traversal primitive unless a richer location helper proves cleanly reusable.
  - [x] Support consistent handling of dotted paths and indexed repeat segments.
  - [x] Expose a small utility layer that both packages can call without importing each other's state types.

- [x] **Unify path semantics**
  - [x] Standardize indexed path normalization rules across engine and Studio.
  - [x] Standardize wildcard handling (`[*]`) only where the same semantics are actually needed in both packages.
  - [x] Use the shared utility in Studio handlers where it simplifies code without forcing Project-specific concerns into the engine.

- [x] **Keep orchestration local**
  - [x] Leave Studio command behavior, parent insertion logic, and Project query composition in Studio.
  - [x] Only share path resolution and traversal rules that are clearly artifact-agnostic.

---

## Diagnostics: Share Semantic Checks, Keep Bundle-Level Reporting in Studio

- [x] **Extract reusable semantic validators where they already make sense**
  - [x] Add an engine helper for extension usage validation if the logic can operate on plain definition items plus registry data.
  - [x] Reuse engine FEL analysis for expression diagnostics rather than duplicating parsing/error classification in Studio.
  - [x] Reuse engine mapping execution for mapping preview accuracy.

- [x] **Keep `Project.diagnose()` as the Studio aggregation layer**
  - [x] Keep grouped passes (`structural`, `expressions`, `extensions`, `consistency`) in Studio.
  - [x] Compose shared semantic helpers into Studio diagnostics rather than relocating the entire diagnostics surface.
  - [x] Keep cross-artifact checks in Studio unless they become clean shared utilities with no Studio-only assumptions.

- [x] **Tighten consistency checks pragmatically**
  - [x] Replace the current mapping preview approximation with `RuntimeMappingEngine`.
  - [x] Keep orphan component detection in Studio.
  - [x] Add stale cross-artifact reference checks only when the same path/reference semantics are already shared.
  - [x] Add theme-selector consistency checks only if they can be implemented cleanly on top of shared item traversal.

- [x] **Scope diagnostics explicitly**
  - [x] Expression diagnostics powered by shared FEL analysis are in scope for Phase 2.
  - [x] JSON Schema-backed structural diagnostics are only in scope if they can reuse an existing validation stack cleanly; do not let Phase 2 absorb a large new schema-validation integration by accident.
  - [x] If structural schema validation requires a substantial new dependency or architecture change, track it separately rather than folding it into the FEL/path reuse work.

---

## Command & Query Completeness: Improve the API Without Forcing It Into the Engine

- [x] **Finish incomplete Studio queries**
  - [x] Complete `Project.statistics()` using existing Studio bundle state plus shared helpers where useful.
  - [x] Expand `Project.allExpressions()` to enumerate all spec-promised FEL locations across definition, mapping, and component artifacts.
  - [x] Be explicit about currently missing expression locations before implementing the enumeration pass. Candidate gaps include:
    - [x] shape `context` map values
    - [x] bind `default` values when encoded as `=expression`
    - [x] item-level FEL-bearing properties such as `relevant`, `required`, `readonly`, `calculate`, `constraint`, and `initialValue` when expression-backed
    - [x] mapping rule expressions and conditions
    - [x] component/document expression slots such as `when`-style guards if present in the current spec/artifact shape
  - [x] Make `availableReferences()` scope-aware using shared path semantics plus Studio-owned context assembly.
  - [x] Expand `felFunctionCatalog()` to the full spec shape, sourcing function semantics from engine and registry data where possible.

- [x] **Finish incomplete Studio commands**
  - [x] Enhance `definition.addItem` payload handling without introducing engine coupling to Studio commands.
  - [x] Improve `definition.setItemProperty` path handling and applicability validation.
  - [x] Upgrade `mapping.preview` to delegate to engine runtime mapping rather than maintaining a parallel simplified executor.

- [x] **Keep versioning logic where it belongs**
  - [x] Keep `diffFromBaseline()` and `previewChangelog()` in Studio unless a clearly reusable diff primitive emerges.
  - [x] Improve diff fidelity for moved/renamed/modified changes without inventing an engine dependency on Studio versioning workflows.
  - [x] Share only low-level structural diff helpers if they are genuinely reusable outside Studio.

---

## Types & Public Contracts: Align, Then Delete Redundant Studio Types

- [x] **Make shared types canonical where appropriate**
  - [x] Audit which Studio payload/result types should come from `formspec-engine`.
  - [x] Add engine exports for semantic result types only when those types describe shared primitives rather than Studio APIs.
  - [x] Keep Project-specific query/result types in Studio if they aggregate multiple artifacts or editor concerns.
  - [x] Produce an explicit inventory of duplicated types and mark each as one of:
    - [x] migrate to engine export
    - [x] keep in Studio
    - [x] defer pending API design

- [x] **Reduce duplication deliberately**
  - [x] Remove redundant Studio redeclarations only after a shared type contract is stable.
  - [x] Avoid moving broad Studio surface types into engine when only a small subset is actually shared.
  - [x] Keep type ownership obvious: semantic primitive types in engine, orchestration types in Studio.

### Type Ownership Inventory (2026-03-10)

- `migrate to engine export`
  - FEL semantic primitives: `FELAnalysis`, `FELAnalysisError`, parser-backed dependency/rewrite helpers.
  - Tree/path primitives: `itemAtPath`, `itemLocationAtPath`, indexed-path normalization helpers.
  - Shared semantic diagnostics helper: `validateExtensionUsage(...)` + issue/result types.
  - Built-in FEL function catalog surface: `getBuiltinFELFunctionCatalog()`.
- `keep in Studio`
  - Orchestration/result aggregates: `FELParseResult`, `FELReferenceSet`, `Diagnostics`, `Change`, `FormspecChangelog`, query aggregation payloads.
  - Studio-owned editor context contracts: `FELParseContext`, `FELMappingContext`.
- `defer pending API design`
  - Rich structural-schema diagnostic result typing that spans partial authoring docs vs fully schema-authored artifacts.
  - Cross-artifact changelog presentation schemas beyond low-level diff primitives.

---

## Delivery Order

- [x] **Slice 1: Reuse obvious existing primitives**
  - [x] Begin with failing tests that lock in reuse targets before changing implementation.
  - [x] Timebox: roughly 2-3 days.
  - [x] Replace `mapping.preview` with engine runtime mapping.
  - [x] Extract shared tree/path helpers from existing implementations.
  - [x] Add a minimal engine FEL analysis API over the existing parser infrastructure.

- [x] **Slice 2: Replace brittle Studio placeholders**
  - [x] Begin with failing tests for false positives, nested-path rewrites, and other current placeholder behavior.
  - [x] Timebox: roughly 3-5 days.
  - [x] Migrate `parseFEL`, `expressionDependencies`, `fieldDependents`, `variableDependents`, and `dependencyGraph` off regex/substring logic.
  - [x] Add parser-aware rename rewriting for item and instance renames.

- [x] **Slice 3: Fill out Studio-facing completeness**
  - [x] Begin with failing tests for each missing query/diagnostic contract before filling in behavior.
  - [x] Timebox aggressively; this is the slice most likely to balloon.
  - [x] Complete `allExpressions`, `statistics`, `availableReferences`, and `felFunctionCatalog`.
  - [x] Expand diagnostics using the new shared primitives.
  - [x] Improve diff/changelog fidelity.
  - [x] Stop and split follow-up work if this slice starts introducing large new dependencies, major schema-validation work, or broad spec-surface expansion unrelated to the Phase 2 reuse seams.

---

## Verification & Exit Criteria

- [x] **Red-Green coverage**
  - [x] Add tests proving parser-backed analysis avoids false positives in comments and strings.
  - [x] Add tests for path-aware rename rewriting, especially nested-item cases.
  - [x] Add tests for dependency-cycle detection.
  - [x] Add tests for repeat-scope and mapping-scope reference availability.
  - [x] Add tests showing `mapping.preview` matches `RuntimeMappingEngine` behavior.
  - [x] Add tests for richer diff/changelog behavior where implemented.
  - [x] Add tests for shared extension validation and expression diagnostics where implemented.
  - [x] Run the full existing suite after each slice; if a test was passing only because of broken regex/substr behavior, fix the test to match the correct semantics rather than preserving the bug.

- [x] **Performance sanity checks**
  - [x] Measure parser-backed analysis latency on forms with large expression counts before and after migration.
  - [x] Watch `diagnose()`, `dependencyGraph()`, and other bundle-wide queries for obvious regressions once regex paths are removed.

### Performance Snapshot (2026-03-10, local workstation)

- Parser-backed `parseFEL` batch over 1,000 expressions: avg ~14.94ms (min 10.87ms, max 21.53ms).
- `dependencyGraph()` on a 400-field/798-expression project: avg ~10.21ms (min 9.01ms, max 11.46ms).
- `diagnose()` on the same project: avg ~8.51ms (min 8.24ms, max 9.11ms).
- `allExpressions()` enumeration on the same project: avg ~0.14ms (min 0.13ms, max 0.17ms).

- [x] **Architectural exit criteria**
  - [x] No new engine APIs depend on Studio `Project` state or command shapes.
  - [x] Studio no longer contains regex/substr-based FEL analysis where parser-backed logic is available.
  - [x] Studio no longer maintains a second simplified mapping executor.
  - [x] Shared primitives have clear ownership and are reused from both sides where appropriate.
  - [x] Any logic intentionally left in Studio is left there explicitly because it is orchestration, not because the seam was unclear.
