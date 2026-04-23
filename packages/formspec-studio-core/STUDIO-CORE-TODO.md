# Refactoring Audit: `packages/formspec-studio-core/`

## Inventory

| Metric | Count |
|--------|-------|
| Source files | 38 (`src/**/*.ts`) |
| Test files | 29 (`tests/**/*.ts`) |
| Total source lines | ~11,000 (`src/` only; approximate) |
| Largest file | `project.ts` (~1,113 lines) |
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
| H1: Dispatch-and-return boilerplate (46 functions) | Created `lib/dispatch-helpers.ts` with `DispatchSpec<P>`, `exec()`, and `execBatch()` (`ExecBatchSpec` for multi-command batches). All delegate helpers in `project-theme.ts` (15/15), `project-mapping.ts` (14/14), and `project-screener.ts` (16/16) use descriptor-driven dispatch; batch summaries receive `project` when the summary depends on pre-mutation state (e.g. `unmapField` rule counts). | 2026-04-23 |
| M3: Hand-maintained widget aliases | Removed 15 hand-written camelCase overlays from `buildWidgetAliasMap()`; `resolveWidget()` now delegates to `widgetTokenToComponent()` from `@formspec-org/types` which handles normalization (lowercase, strip separators) against the canonical `SPEC_WIDGET_TO_COMPONENT` map. `widgetHintFor()` updated to use the same resolution path. | 2026-04-23 |
| M4: Naive token extraction | Replaced hand-rolled whitespace-split + `$` prefix check in `buildExpressionDiagnostics` with WASM `analyzeFEL` which correctly handles string literals, comments, and all FEL syntax. New `extractRootRefs()` helper wraps the WASM call with error handling. | 2026-04-23 |
| M6: Hand-rolled XML/CSV serializers | Fixed `escapeXml()` to include `&apos;` escaping. Fixed CSV to collect headers from all rows (not just first row), fixing inconsistent key sets. Renamed `rows_data` to `rows`. Added tests for apostrophe escaping and inconsistent-key handling. | 2026-04-23 |
| L3: `isTextareaWidget` single-string check | Removed function, inlined `widget === 'textarea'` at the single call site in `project.ts:695`. Removed barrel re-export from `index.ts`. | 2026-04-23 |
| L4: Hardcoded workspace names in `keyboard.ts` | Extracted `'Editor'` and `'Layout'` to `DELETE_ALLOWED_WORKSPACES` set constant. Added `WorkspaceName` type export. | 2026-04-23 |
| L5: `LayoutArrangement` derived from `_LAYOUT_MAP` | Created `_LAYOUT_ENTRIES` const object with `as const satisfies Record<LayoutArrangement, ...>`; `_LAYOUT_MAP` is now derived from it. Added `LAYOUT_ARRANGEMENTS` array constant alongside the type in `helper-types.ts`. | 2026-04-23 |
| C1: God class decomposition | Migrated definition, layout, and FEL logic to standalone modules; `project.ts` reduced by 64% | 2026-04-23 |
| H4: FEL condition parse duplicated outside WASM | `parseFELToGroup` uses only `tryLiftConditionGroup` (tools WASM via `@formspec-org/engine`). No hand-rolled condition parser in TS. Lift implementation: `crates/formspec-core/src/fel_condition_group_lift.rs`. Round-trip coverage in `tests/fel-condition-builder.test.ts`. Callers must `await initFormspecEngine()` then `await initFormspecEngineTools()` before calling (documented on `parseFELToGroup` and in `API.llm.md`). | 2026-04-23 |

---

## Critical Findings (architectural)

### ~~C1. `project.ts` God class~~ — DONE

The `Project` class is now a lean facade (~1,113 lines) delegating all authoring operations to specialized modules: `project-definition.ts`, `project-layout.ts`, `project-theme.ts`, `project-mapping.ts`, `project-screener.ts`, `project-variables.ts`, `project-component-tree.ts`, `project-preview.ts`, and `project-fel.ts`. All internal helpers have been moved to their respective modules or module-local scope, and `ProjectInternals` has been purified to a minimal state interface.

### ~~C2. `_LAYOUT_MAP` is duplicated~~ — DONE

Dead copy removed from `project.ts`. Only `project-layout.ts` defines `_LAYOUT_MAP`.

### ~~C3. `_PRESENTATION_BLOCK_KEYS` is duplicated~~ — DONE

Dead copy deleted from `project.ts`. Active copy in `project-layout.ts` renamed to `_STYLE_ROUTING_PRESENTATION_KEYS`.

---

## High-Severity Findings (DRY / tech debt)

### ~~H1. Dispatch-and-return boilerplate (46 functions)~~ — DONE

Created `lib/dispatch-helpers.ts` with `DispatchSpec<P>` + `exec()` + `execBatch()`. Every `HelperResult`-returning delegate in `project-theme.ts`, `project-mapping.ts`, and `project-screener.ts` uses descriptors (`previewMapping` still delegates to `core.previewMapping` only). Remaining ad-hoc `dispatch` call sites live in layout, component-tree, and definition slices per C1.

### ~~H2. `project: any` across 77 function signatures~~ — DONE

All 77 functions now accept `project: ProjectInternals`. Full compile-time type safety.

### ~~H3. Sample data duplication~~ — DONE

`sampleValueForField` delegates to the richer `sampleFieldValue` with min/max awareness.

### ~~H4. FEL parser re-implemented outside WASM~~ — DONE

`parseFELToGroup` delegates exclusively to **`tryLiftConditionGroup`** (tools WASM). The former hand-rolled `parseSingleCondition` path is removed. **Future work** (not H4): extend `fel_condition_group_lift.rs` if the UI needs to lift additional FEL shapes; keep `conditionToFEL` / `groupToFEL` aligned with lift output and extend round-trip tests when adding operators.

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

**Status:** Done — implemented generic signatures for `dispatch`, `batch`, and `batchWithRebuild` in `IProjectCore` and `RawProject`. Updated `AnyCommand` to `Command<string, any>` and swept the studio-core package to remove over 50 redundant `as AnyCommand` manual casts.

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
| Critical | C1: God class decomposition | **Done** | ~1,113-line `project.ts` facade | Architectural |
| High | H4: FEL condition parse (WASM-only `parseFELToGroup`) | **Done** | — | Correctness + single source of truth in Rust lift |
| Low | L1: Meaningful `affectedPaths` | **Done** | ~50 lines | Correctness |
| Low | L2: Typed dispatch overload | **Done** | Cross-package | Clarity |
