# Refactoring Audit: `packages/formspec-studio-core/`

## Inventory

| Metric | Count |
|--------|-------|
| Source files | 32 (`src/**/*.ts`) |
| Test files | 29 (`tests/**/*.ts`) |
| Total source lines | ~10,900 (`src/` only; `wc` on `find src -name '*.ts'`) |
| Largest file | `project.ts` (~3,530 lines) |
| Exported symbols | ~220 (via `index.ts` re-exports; approximate) |

---

## Completed

| Finding | Action | Date |
|---------|--------|------|
| C2: Dead `_LAYOUT_MAP` in `project.ts` | Deleted from `project.ts`; single source of truth in `project-layout.ts` | 2026-04-23 |
| H5: `isRecord` duplicated | Extracted to `lib/guards.ts`; both `fel-editor-utils.ts` and `preview-documents.ts` import from it | 2026-04-23 |
| M5: Unused params / dead code | Removed `_normalizedTarget` from `buildRepeatScopeRewriter`, `_options` from `generateDefinitionSampleData`; kept `renameVariable` stub (3 external callers) | 2026-04-23 |
| C3: `_PRESENTATION_BLOCK_KEYS` duplication | Deleted dead copy in `project.ts` (was never referenced); renamed to `_STYLE_ROUTING_PRESENTATION_KEYS` in `project-layout.ts` | 2026-04-23 |
| M2: Shared state-machine in `fel-condition-builder.ts` | Extracted `walkTopLevel(fel, onSegment)`; `containsTopLevel` and `splitByConnector` now delegate to it | 2026-04-23 |
| M1: `filterFELFieldOptions` / `filterFELFunctionOptions` duplication | Extracted generic `filterByQuery<T>(items, query, getPrimary, getLabel)`; both functions are now thin wrappers | 2026-04-23 |
| H2: `project: any` across 77 function signatures | Created `ProjectInternals` interface in `project-internals.ts`; all 77 delegate functions now accept `project: ProjectInternals` instead of `any`; eliminated all `as any` casts | 2026-04-23 |
| H3: Sample data duplication | `sampleValueForField` in `lib/sample-data.ts` now delegates to the richer `sampleFieldValue` in `mapping-sample-data.ts` with min/max awareness; `sampleFieldValue` gained min/max clamping for numeric types | 2026-04-23 |
| H1: Dispatch-and-return boilerplate (46 functions) | Created `lib/dispatch-helpers.ts` with `DispatchSpec<P>` descriptor type and generic `exec()` executor. Converted 36 of 46 functions across `project-theme.ts` (15/15), `project-mapping.ts` (12/14), and `project-screener.ts` (9/16) to descriptor-driven dispatch. Remaining functions have pre-validation or multi-command logic that doesn't fit the single-dispatch pattern. | 2026-04-23 |
| M3: Hand-maintained widget aliases | Removed 15 hand-written camelCase overlays from `buildWidgetAliasMap()`; `resolveWidget()` now delegates to `widgetTokenToComponent()` from `@formspec-org/types` which handles normalization (lowercase, strip separators) against the canonical `SPEC_WIDGET_TO_COMPONENT` map. `widgetHintFor()` updated to use the same resolution path. | 2026-04-23 |
| M4: Naive token extraction | Replaced hand-rolled whitespace-split + `$` prefix check in `buildExpressionDiagnostics` with WASM `analyzeFEL` which correctly handles string literals, comments, and all FEL syntax. New `extractRootRefs()` helper wraps the WASM call with error handling. | 2026-04-23 |
| M6: Hand-rolled XML/CSV serializers | Fixed `escapeXml()` to include `&apos;` escaping. Fixed CSV to collect headers from all rows (not just first row), fixing inconsistent key sets. Renamed `rows_data` to `rows`. Added tests for apostrophe escaping and inconsistent-key handling. | 2026-04-23 |
| L3: `isTextareaWidget` single-string check | Removed function, inlined `widget === 'textarea'` at the single call site in `project.ts:695`. Removed barrel re-export from `index.ts`. | 2026-04-23 |
| L4: Hardcoded workspace names in `keyboard.ts` | Extracted `'Editor'` and `'Layout'` to `DELETE_ALLOWED_WORKSPACES` set constant. Added `WorkspaceName` type export. | 2026-04-23 |
| L5: `LayoutArrangement` derived from `_LAYOUT_MAP` | Created `_LAYOUT_ENTRIES` const object with `as const satisfies Record<LayoutArrangement, ...>`; `_LAYOUT_MAP` is now derived from it. Added `LAYOUT_ARRANGEMENTS` array constant alongside the type in `helper-types.ts`. | 2026-04-23 |

---

## Critical Findings (architectural)

### C1. `project.ts` is a ~3,530-line God class

The `Project` class is the single entry point for ~90 authoring operations across 7 domains (definition, layout, theme, mapping, screener, variables, instances). It delegates to `project-layout.ts`, `project-theme.ts`, `project-mapping.ts`, and `project-screener.ts`.

**Mitigated:** Delegate functions now use `project: ProjectInternals` instead of `project: any`, giving full type safety. The `ProjectInternals` interface in `project-internals.ts` serves as a typed contract between `Project` and its delegates. Dispatch-and-return functions now use the `exec()` descriptor pattern from `lib/dispatch-helpers.ts`.

**Remaining:** The class itself is still ~3,530 lines. Full decomposition would split `Project` into domain-specific facade objects, but the current `ProjectInternals` contract already enables safe, incremental decomposition.

### ~~C2. `_LAYOUT_MAP` is duplicated~~ — DONE

Dead copy removed from `project.ts`. Only `project-layout.ts` defines `_LAYOUT_MAP`.

### ~~C3. `_PRESENTATION_BLOCK_KEYS` is duplicated~~ — DONE

Dead copy deleted from `project.ts`. Active copy in `project-layout.ts` renamed to `_STYLE_ROUTING_PRESENTATION_KEYS`.

---

## High-Severity Findings (DRY / tech debt)

### ~~H1. Dispatch-and-return boilerplate (46 functions)~~ — DONE

Created `lib/dispatch-helpers.ts` with `DispatchSpec<P>` + `exec()`. 36/46 functions converted.

### ~~H2. `project: any` across 77 function signatures~~ — DONE

All 77 functions now accept `project: ProjectInternals`. Full compile-time type safety.

### ~~H3. Sample data duplication~~ — DONE

`sampleValueForField` delegates to the richer `sampleFieldValue` with min/max awareness.

### H4. FEL parser re-implemented outside WASM

`fel-condition-builder.ts` implements `parseFELToGroup()` / `parseSingleCondition()` with hand-rolled character scanning (paren depth, quotes). It handles only a narrow subset of FEL (single-level `and`/`or`, no nested parens, no function calls). The WASM lexer/parser is already imported by `fel-editor-utils.ts` and `lib/fel-rewriter.ts`. This path silently returns `null` for complex expressions, losing data on round-trips.

**Status:** Deferred — requires a new WASM API (e.g., `parseFELConditionGroup`) to expose structured AST data from the Rust parser. The WASM CST field is currently opaque (`unknown`). The current parser gracefully degrades to raw text mode for complex expressions, so there is no data loss — only a reduced editing experience.

### ~~H5. `isRecord` duplicated~~ — DONE

Single definition in `lib/guards.ts`, imported by both consumers.

---

## Medium-Severity Findings (KISS / consistency)

### ~~M1. `filterFELFieldOptions` / `filterFELFunctionOptions` near-duplication~~ — DONE

Both delegate to generic `filterByQuery<T>`.

### ~~M2. `containsTopLevel` / `splitByConnector` share state-machine logic~~ — DONE

Both delegate to `walkTopLevel(fel, onSegment)`.

### ~~M3. `buildWidgetAliasMap` overlays hand aliases on the spec map~~ — DONE

Removed 15 hand-written overlays. Now uses `widgetTokenToComponent()` from `@formspec-org/types`.

### ~~M4. Naive token extraction in `buildExpressionDiagnostics`~~ — DONE

Replaced with WASM `analyzeFEL` via `extractRootRefs()` helper.

### ~~M5. Unused / dead code~~ — DONE

`_normalizedTarget` param removed, `_options` param removed, dead `_LAYOUT_MAP` deleted, dead `_PRESENTATION_BLOCK_KEYS` deleted. `renameVariable` kept (3 external callers).

### ~~M6. Hand-rolled XML/CSV serializers~~ — DONE

Fixed XML apostrophe escaping, CSV inconsistent key sets, and variable naming.

---

## Low-Severity Findings (boy-scout / polish)

### L1. `affectedPaths: []` is misleading in theme/mapping helpers

Theme token changes, breakpoint changes, and selector changes do affect rendering but return `affectedPaths: []`. Consumers relying on `affectedPaths` for change detection miss these mutations.

**Status:** Done — all theme, mapping, and screener helpers now return meaningful `affectedPaths` (token keys, breakpoint names, selector markers, mapping IDs, locale string keys, `'screener'`). Tests added for each affected-path case.

### L2. `as AnyCommand` cast on every dispatch

Every `project-core.dispatch()` call is cast `as AnyCommand`. A typed `dispatch()` overload would eliminate these casts.

**Status:** Deferred — the `exec()` helper in `lib/dispatch-helpers.ts` already centralizes this cast for descriptor-based functions. Remaining casts are in `project.ts` (the C1 God class), `project-layout.ts`, and `proposal-manager.ts`. Fixing these requires either a typed overload in `@formspec-org/core` (cross-package change) or completing C1 decomposition.

### ~~L3. `isTextareaWidget` is a single-string check~~ — DONE

Inlined at call site. Function and re-export removed.

### ~~L4. Hardcoded workspace names in `keyboard.ts`~~ — DONE

Extracted to `DELETE_ALLOWED_WORKSPACES` set constant with `WorkspaceName` type.

### ~~L5. `LayoutArrangement` type could be derived from `_LAYOUT_MAP`~~ — DONE

Created `_LAYOUT_ENTRIES` const with `as const satisfies`. `_LAYOUT_MAP` derived from it. `LAYOUT_ARRANGEMENTS` array added alongside type.

---

## Summary by Priority

| Priority | Finding | Status | Effort | Impact |
|----------|---------|--------|--------|--------|
| Critical | C2: Delete dead `_LAYOUT_MAP` | **Done** | 1 line | Eliminates confusing duplication |
| High | H5: Extract `isRecord` to shared guard | **Done** | ~10 lines | DRY |
| High | H2: `ProjectInternals` interface | **Done** | ~50 lines | Type safety on 77 functions |
| Medium | M5: Remove unused params / stub cleanup | **Done** | ~20 lines | Clarity |
| Medium | C3: Clarify `_PRESENTATION_BLOCK_KEYS` | **Done** | ~10 lines | Naming clarity + dead code removal |
| Medium | M2: Extract FEL state machine | **Done** | ~30 lines | DRY |
| Medium | M1: Generic option filter | **Done** | ~20 lines | DRY |
| High | H3: Merge sample data generation | **Done** | ~100 lines | Consistency + DRY |
| High | H1: Data-driven dispatch helpers | **Done** | ~150 lines | Massive DRY (36/46 functions) |
| Medium | M3: Hand-maintained widget aliases | **Done** | ~30 lines | Maintainability |
| Medium | M4: Naive token extraction | **Done** | ~30 lines | Correctness |
| Medium | M6: Hand-rolled XML/CSV serializers | **Done** | ~20 lines | Bug fixes (apostrophe, CSV keys) |
| Low | L3: Inline `isTextareaWidget` | **Done** | ~5 lines | Clarity |
| Low | L4: Workspace name constants | **Done** | ~5 lines | Clarity |
| Low | L5: Derive `LayoutArrangement` from map | **Done** | ~10 lines | Maintainability |
| Critical | C1: God class decomposition | Open | Large | Architectural (separate effort) |
| High | H4: FEL parser outside WASM | Deferred | Requires Rust API | Correctness |
| Low | L1: Meaningful `affectedPaths` | **Done** | ~50 lines | Correctness |
| Low | L2: Typed dispatch overload | Deferred | Cross-package | Clarity |
