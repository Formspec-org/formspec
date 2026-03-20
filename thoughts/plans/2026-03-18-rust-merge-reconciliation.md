# Rust Rewrite — Master Plan

Status: **Phases 1–5 + Steps 0–11 complete** — 6 crates, **1,009 Rust tests**, **2,201 Python tests** (all passing, verified 2026-03-19). All Rust code written. WASM builds (wasm-opt disabled for toolchain compat). PyO3 module built and installed via maturin. Rust FEL backend auto-selected as default in both TS (via WasmFelRuntime) and Python (via RustFelRuntime). Factory functions wired into all production call sites. Interface gaps fixed. Branch cleanup done.

**Last verified:** 2026-03-19
- `cargo test --workspace --exclude formspec-py` — 1,009 tests (364 fel-core + 260 formspec-core + 95 formspec-eval + 249 formspec-lint + 41 formspec-wasm)
- `python3 -m pytest tests/ -v` — 2,201 passed, 4 skipped (Rust FEL backend active)
- `npx tsc --noEmit` in formspec-engine — clean compile with WASM bridge

## Overview

Build a **Rust shared kernel** that eliminates the TS↔Python logic duplication without replacing the TypeScript engine's reactivity model.

**Strategy:**
- `packages/formspec-engine/src/index.ts` keeps Preact Signals for reactive UI state — it is the only file in the engine that stays TypeScript.
- Every other file in `packages/formspec-engine/src/` moves to Rust. None of them touch `@preact/signals-core`.
- Rust is also the single implementation for all batch processors (Definition Evaluator, Linter) that TS currently lacks entirely.
- WASM bindings expose the Rust crates to TypeScript (`index.ts` calls WASM internally; public API stays identical). PyO3 bindings expose them to Python.
- Once WASM is wired: delete the TS source files. Once PyO3 is wired: delete the Python FEL source files.

**What stays TypeScript:** `index.ts` only — FormEngine class, Preact Signals reactive state. Plus new interface files (`interfaces.ts`, `fel/runtime.ts`, `fel/chevrotain-runtime.ts`).
**What stays Python:** Adapters (JSON, XML, CSV serialization) and artifact orchestrator (`validate.py`). Everything else moves to Rust.
**What moves to Rust:** Every non-reactive TS file + all batch processors + mapping engine + registry client + changelog.

**Conventions:** Completed work uses "Phase" labels (historical). Remaining work uses "Step" labels (actionable). All remaining work targets `main` directly.

### Execution Order

```
Steps 0–5 (lint) ✅ ──────┐
                           ├──→ Step 9a (WASM bindings) ✅ ──→ Step 8.5 (interfaces) ✅ ──→ Step 8.6 (factories) ✅ ──→ Step 9b (TS WASM wiring) ✅ ──→ Step 11 (cleanup) ✅
Steps 6–8 (scope exp.) ✅ ─┘     Step 10 bindings ✅ ──→ Step 10 wiring ✅
```

**All steps complete.** TS file deletion (Step 9c) deferred — see "Decommission Status" below for rationale.

---

## Current State

### Crate Status (verified 2026-03-19)

| Crate | Lines | Contents | Tests |
|-------|-------|----------|-------|
| `crates/fel-core` | 4,543 | FEL lexer, parser, evaluator (rust_decimal), environment, extensions, dependencies, printer | 364 |
| `crates/formspec-core` | 6,427 | FEL analysis, path utils, schema validator, extension analysis, runtime mapping (10 transforms), assembler, registry client, changelog | 260 |
| `crates/formspec-eval` | 3,042 | Definition Evaluator — 4-phase batch processor with topo sort, inheritance, NRB, wildcards | 95 |
| `crates/formspec-lint` | 6,372 | 8-module linter: tree, references, extensions, expressions, dependencies, component_matrix, pass_theme, pass_component — 35 error codes | 249 |
| `crates/formspec-wasm` | 1,248 | WASM bindings via wasm-bindgen → TypeScript (all capabilities + registry, changelog, mapping doc) | 41 |
| `crates/formspec-py` | 1,690 | PyO3 bindings → Python (all capabilities + registry, changelog, mapping doc) | — (linker-only, needs Python dev headers) |
| **Total** | **23,322** | | **1,009** |

### TypeScript File Disposition

| File | Lines | Destination | Status |
|------|-------|-------------|--------|
| `src/index.ts` | 2,454 | **Stays TS** — only Preact Signals consumer | — |
| `src/interfaces.ts` | ~240 | **Stays TS** — `IFormEngine`, `IRuntimeMappingEngine`, `MappingDiagnostic` | NEW (9811f3f) |
| `src/fel/runtime.ts` | ~100 | **Stays TS** — `IFelRuntime`, `ICompiledExpression`, `IFelEngineContext`, `FelContext` | NEW (9811f3f + 20b1f04) |
| `src/fel/chevrotain-runtime.ts` | ~83 | **Stays TS** — adapter wrapping Chevrotain pipeline, implements `IFelRuntime` | NEW (9811f3f) |
| `src/fel/lexer.ts` | 255 | `crates/fel-core` | ✅ Rust done, delete when WASM wired |
| `src/fel/parser.ts` | 368 | `crates/fel-core` | ✅ Rust done, delete when WASM wired |
| `src/fel/interpreter.ts` | 1,314 | `crates/fel-core` | ✅ Rust done, delete when WASM wired |
| `src/fel/dependency-visitor.ts` | 97 | `crates/fel-core` | ✅ Rust done, delete when WASM wired |
| `src/fel/analysis.ts` | 435 | `crates/formspec-core` | ✅ Rust done, delete when WASM wired (but see `IFelAnalyzer` gap — Studio needs this) |
| `src/path-utils.ts` | 71 | `crates/formspec-core` | ✅ Rust done, delete when WASM wired |
| `src/schema-validator.ts` | 347 | `crates/formspec-core` | ✅ Rust done, delete when WASM wired |
| `src/extension-analysis.ts` | 97 | `crates/formspec-core` | ✅ Rust done, delete when WASM wired |
| `src/runtime-mapping.ts` | 220 | `crates/formspec-core` | ✅ Rust done, delete when WASM wired |
| `src/assembler.ts` | 695 | `crates/formspec-core` | ✅ Rust done, delete when WASM wired |

### WASM Binary Optimization (landed on `main` — 2026-03-19)

Commit `5cd7d88` optimized the WASM release profile and build pipeline:

- **`Cargo.toml` release profile:** `lto = true`, `codegen-units = 1`, `opt-level = "s"`, `strip = true`
- **Build pipeline fix:** Rust 1.89's LLVM emits `memory.copy`/`memory.fill` bulk memory ops that `wasm-pack`'s bundled `wasm-opt` doesn't recognize. Split build into `wasm-pack build --no-opt` + manual `wasm-opt -Os --enable-bulk-memory --enable-nontrapping-float-to-int`.
- **New build dependency:** `binaryen` (provides `wasm-opt`) must be installed on the build machine (`brew install binaryen`).

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Raw binary | 1.8 MB | 1.4 MB | -22% |
| Gzipped (transfer) | 650 KB | 538 KB | -17% |

**Size breakdown (pre-wasm-opt, named symbols):**
- `regex` + `aho-corasick`: 664 KB (28%) — only used by FEL `matches()` function
- `.rodata` (static data, mostly regex Unicode tables): 501 KB (21%)
- `fel-core`: 141 KB, `formspec-core`: 104 KB, `formspec-lint`: 74 KB
- **Next optimization:** swap `regex` crate for `regex-lite` (~10 KB) to eliminate ~600 KB+ of regex engine and Unicode tables

### `main` Branch (compiles, 1,009 tests pass — verified 2026-03-19)

- `fel-core`: 11 source files including printer — **no touch**
- `formspec-core`: 9 source files (added `registry_client.rs`, `changelog.rs`; expanded `runtime_mapping.rs` with 4 new transforms + MappingDocument) — **Steps 6–8 complete**
- `formspec-eval`: 1 file (`lib.rs` with 28 tests) — **no touch**
- `formspec-lint`: 10 source files (8 typed modules replaced `passes.rs`, 35 error codes, 211 tests) — **Steps 0–5 complete**
- `formspec-wasm`: 1 file (7 new exports: registry, changelog, mapping doc) — **Step 9a complete**
- `formspec-py`: 1 file (6 new exports: registry, changelog, mapping doc) — **Step 10 bindings complete**

### Dependency Inversion (landed on `main` — 2026-03-19)

Commits `9811f3f` and `20b1f04` extracted pluggable interfaces so the engine depends on abstractions, not concrete implementations:

**TypeScript (formspec-engine):**
- `IFelRuntime` + `ICompiledExpression` + `FelContext` — FEL compilation/evaluation contract (`fel/runtime.ts`)
- `IFelEngineContext` — minimal engine surface for FEL stdlib: signals, getInstanceData, getVariableValue (`fel/runtime.ts`)
- `ChevrotainFelRuntime` — adapter wrapping existing Chevrotain pipeline (`fel/chevrotain-runtime.ts`)
- `IFormEngine` + `IRuntimeMappingEngine` — full engine/mapping interfaces (`interfaces.ts`)
- `MappingDiagnostic`, `RuntimeMappingResult` — moved to interface layer
- `FormEngine` accepts `felRuntime` via `FormEngineRuntimeContext`, defaults to Chevrotain
- `RuntimeMappingEngine` accepts `IFelRuntime` via constructor injection
- `BehaviorContext.engine` typed as `IFormEngine` (not concrete `FormEngine`)

**Python (formspec):**
- `FelRuntime` protocol + `DefaultFelRuntime` class (`fel/runtime.py`)
- `FormProcessor`, `FormValidator`, `MappingProcessor`, `DataAdapter` protocols (`protocols.py`)
- `DefinitionEvaluator`, `Linter`, `MappingEngine` accept `fel_runtime` kwarg

**Fix-up (20b1f04):**
- `IFelEngineContext` was too narrow — added `signals`, `relevantSignals`, `requiredSignals`, `readonlySignals`, `validationResults` (MIP lookup needs these)
- `RuntimeMappingResult.diagnostics` typed as `string[]` in interface but `MappingDiagnostic[]` in impl — fixed
- `FELBuiltinFunctionCatalogEntry` missing `signature` + `description` fields — added

### Branch Status (updated 2026-03-19 — post-cleanup)

| Branch | Status |
|--------|--------|
| `main` | Active — 1,009 Rust tests, 2,201 Python tests, WASM + PyO3 wired |
| `feature/rust-rewrite` | Deleted |
| `rust_merged` | Deleted |
| `claude/rust-formspec-rewrite-JysP8` | Deleted (remote) |
| `claude/refactor-formspec-interfaces-StbWv` | Deleted (merged to main) |

**Worktrees:** None active (all stale worktrees pruned).

---

## Completed

### Phase 1: FEL Precision + Environment ✅

1. ✅ **Swap `f64` → `rust_decimal`** — base-10 arithmetic, 28-29 significant digits (exceeds spec S3.4.1 18-digit minimum). Eliminates `float_eq` tolerance hacks and custom `bankers_round`. Native `MidpointNearestEven` rounding. `0.1 + 0.2 = 0.3` exact.
2. ✅ **FEL Environment** (`crates/fel-core/src/environment.rs`) — `FormspecEnvironment` with field resolution, `RepeatContext` (@current/@index/@count with push/pop nesting), `MipState` per field, named instances via @instance('name'), definition variables via @name.
3. ✅ **FEL Extensions** (`crates/fel-core/src/extensions.rs`) — `ExtensionRegistry` with null-propagating user-defined functions, shadow prevention against reserved words and 40+ builtins.
4. ✅ **FEL Analysis** (`crates/formspec-core/src/fel_analysis.rs`) — `analyze_fel()` extracts references, variables, functions. `rewrite_fel_references()` with callback-based AST rewriting for field paths, variables, instance names.

### Phase 2: formspec-core ✅

5. ✅ **Path Utils** (`src/path_utils.rs`) — `normalize_indexed_path`, `split_normalized_path`, `item_at_path`, `item_location_at_path`, `parent_path`, `leaf_key`. Generic `TreeItem` trait for tree traversal.
6. ✅ **Schema Validator** (`src/schema_validator.rs`) — `detect_document_type` for all 8 artifact types (marker fields + heuristic fallback). `JsonSchemaValidator` trait for dependency inversion (host provides JSON Schema engine). `json_pointer_to_jsonpath` converter.
7. ✅ **Extension Analysis** (`src/extension_analysis.rs`) — `validate_extension_usage` with `RegistryLookup` trait. Detects unresolved (error), retired (warning), deprecated (info) extensions. Tree walk with path accumulation.
8. ✅ **Runtime Mapping** (`src/runtime_mapping.rs`) — `execute_mapping` with bidirectional transforms: preserve, drop, constant, valueMap (auto-invert for reverse), coerce (string/number/integer/boolean/date/datetime), expression (FEL with source field access). Priority-ordered rules, condition guards, nested path output.
9. ✅ **Assembler** (`src/assembler.rs`) — `assemble_definition` with `RefResolver` trait. Key prefix application, circular ref detection, bind/shape/variable import with proper AST-based FEL path rewriting (parse → transform → print).
10. ✅ **FEL Printer** (`crates/fel-core/src/printer.rs`) — `print_expr()` serializes AST back to valid FEL source. 15 round-trip tests verify parse → print → reparse identity.

### Phase 3: WASM Bindings ✅

11. ✅ **`crates/formspec-wasm`** — wasm-bindgen layer exposing all capabilities:
    - FEL: `evalFEL`, `parseFEL`, `printFEL`, `getFELDependencies`, `extractDependencies`, `analyzeFEL`
    - Path: `normalizeIndexedPath`
    - Schema: `detectDocumentType`
    - Lint: `lintDocument`, `lintDocumentWithRegistries`
    - Eval: `evaluateDefinition`
    - Assembly: `assembleDefinition`
    - Mapping: `executeMapping`

### Phase 4: Batch Processors ✅

12. ✅ **Definition Evaluator** (`crates/formspec-eval`) — 4-phase pipeline:
    - Rebuild: item tree from definition, bind index merge (object + array styles)
    - Recalculate: whitespace normalization → variable evaluation (topo-sorted with cycle detection) → relevance (AND inheritance) → readonly (OR inheritance) → required (no inheritance) → calculate (continues when non-relevant per S5.6)
    - Revalidate: required/constraint/shape with null context defaults per S3.8.1, activeWhen guards
    - Notify: NRB modes (remove/empty/keep) with lookup precedence (exact → wildcard → stripped → parent → definition default)
    - Wildcard bind expansion against actual repeat data

13. ✅ **Linter** (`crates/formspec-lint`) — 8-module pipeline with 35 error codes, 199 tests:
    - `tree.rs`: E200/E201 — ItemTreeIndex with duplicate key/path detection
    - `references.rs`: E300/E301/E302/W300 — bind path + shape target + optionSet validation
    - `extensions.rs`: E600/E601/E602 — extension resolution via MapRegistry
    - `expressions.rs`: E400 — CompiledExpression for all FEL slots (binds, shapes, screener, variables, composed shapes)
    - `dependencies.rs`: E500 — DFS cycle detection with canonical dedup
    - `component_matrix.rs`: 12 input component compatibility rules
    - `pass_theme.rs`: W700–W707/W711/E710 — token validation, reference integrity, cross-artifact, page semantics
    - `pass_component.rs`: E800–E807/W800–W804 — tree validation, type compatibility, bind resolution, custom cycles
    - Pass gating, LintMode (Authoring/Runtime) with W300+W802 suppressions, diagnostic sorting, `definition_document` for cross-artifact checks

### Phase 5: PyO3 Bindings ✅

14. ✅ **`crates/formspec-py`** — PyO3 module `formspec_rust` exposing: `eval_fel`, `parse_fel`, `get_dependencies`, `extract_deps`, `analyze_expression`, `detect_type`, `lint_document`, `evaluate_def`. Full Python↔Rust type conversion (None/bool/int/float/str/list/dict ↔ FelValue).

### Phase 6: Scope Expansion ✅

15. ✅ **Mapping Engine expansion** (`runtime_mapping.rs`) — 4 new transforms (flatten, nest, concat, split), `MappingDocument` with autoMap + defaults, per-rule `default` and `bidirectional` flag. All 10 transform types now implemented.
16. ✅ **Registry Client** (`registry_client.rs`) — `Registry::from_json()`, semver constraint matching, lifecycle state machine validation, well-known URL construction, `RegistryLookup` implementation. 35 tests, validates against real `formspec-common.registry.json`.
17. ✅ **Changelog** (`changelog.rs`) — `generate_changelog()` with section-by-section diff, impact classification (Breaking/Compatible/Cosmetic), semver impact computation. 36 integration tests.
18. ✅ **WASM bindings updated** — 7 new exports: `parseRegistry`, `findRegistryEntry`, `validateLifecycleTransition`, `wellKnownRegistryUrl`, `generateChangelog`, `executeMappingDoc`. All 10 transform types in WASM parser.
19. ✅ **PyO3 bindings updated** — 6 new exports: `parse_registry`, `find_registry_entry`, `validate_lifecycle`, `well_known_url`, `generate_changelog`, `execute_mapping_doc`.

---

## Steps 0–5: Lint Reconciliation ✅

**Completed 2026-03-18.** All 8 lint modules written from scratch against `main`'s architecture, informed by `rust_merged` diff. `passes.rs` deleted entirely.

**Results:** 27 → 199 tests, 12 → 35 error codes, 1,392 → 5,341 lines.

### Modules implemented

| Module | Error codes | Tests | What it does |
|--------|-------------|-------|-------------|
| `tree.rs` | E200, E201 | 9 | ItemTreeIndex with by_key/by_full_path/repeatable_groups/ambiguous_keys |
| `references.rs` | E300, E301, E302, W300 | 19 | Bind path + shape target validation against ItemTreeIndex |
| `extensions.rs` | E600, E601, E602 | 15 | Extension resolution via MapRegistry from registry documents |
| `expressions.rs` | E400 | 17 | CompiledExpression with bind_target for all FEL slots |
| `dependencies.rs` | E500 | 12 | Cycle detection with canonical dedup on CompiledExpression graph |
| `component_matrix.rs` | — | 13 | 12 input component compatibility rules (data-only, no diagnostics) |
| `pass_theme.rs` | W700–W707, W711, E710 | 54 | Token validation, reference integrity, cross-artifact, page semantics |
| `pass_component.rs` | E800–E807, W800–W804 | 34 | Tree validation, type compatibility, bind resolution, custom cycles |

### Key decisions made during implementation

- **Binds format:** Kept `main`'s binds-as-object convention (not schema-correct arrays). All new modules handle `binds` as `{path: {slots}}`.
- **W700 semantics:** Old W700 (token ref checking) replaced with proper color validation. Token ref checking moved to W704.
- **W802 suppression:** Added to `suppressed_in` in authoring mode. E802 always fires regardless of mode.
- **`definition_document`:** Added as `Option<Value>` to `LintOptions`. Cross-artifact checks in pass_theme (W705–W707) and pass_component (W800, E802–E803) are conditional.
- **LintDiagnostic constructors:** Added `error()`, `warning()`, `info()` convenience methods.

---

## Steps 6–8: Scope Expansion ✅

**Completed 2026-03-18.** All three modules ported to Rust.

### Step 6: Mapping Engine ✅

Expanded `runtime_mapping.rs` (738 → ~900 lines, 27 tests):
- [x] 4 new `TransformType` variants: `Flatten { separator }`, `Nest { separator }`, `Concat(String)`, `Split(String)`
- [x] `MappingDocument` struct with `rules`, `defaults`, `auto_map`
- [x] `execute_mapping_doc()` — document-level entry point with defaults + autoMap
- [x] Per-rule `default: Option<Value>` — fallback when source is null/absent
- [x] Per-rule `bidirectional: bool` — skip rule in reverse when false
- [x] Backwards compatible: existing `execute_mapping()` unchanged

All 10 transform types now implemented: preserve, drop, constant, valueMap, coerce, expression, flatten, nest, concat, split.

### Step 7: Registry Client ✅

New `registry_client.rs` (965 lines, 35 tests):
- [x] `Registry::from_json()` — parse registry document from JSON
- [x] `Registry::find()` / `find_one()` — query by name + semver constraint, sorted version-descending
- [x] `Registry::list_by_category()` / `list_by_status()`
- [x] `Registry::validate()` — structural validation (name pattern, deprecation notice, category fields)
- [x] `impl RegistryLookup for Registry` — bridges to `RegistryEntryInfo`
- [x] `validate_lifecycle_transition()` — spec-compliant state machine (draft→stable→deprecated→retired + un-deprecation)
- [x] `well_known_url()` — `/.well-known/formspec-registry.json`
- [x] `version_satisfies()` — semver constraint matching with `>=`, `<=`, `>`, `<`, exact, compound AND
- [x] Passes validation against real `formspec-common.registry.json`

### Step 8: Changelog ✅

New `changelog.rs` (602 lines) + `tests/changelog_test.rs` (568 lines, 36 tests):
- [x] `generate_changelog()` — section-by-section diff (items, binds, shapes, optionSets, dataSources, screener, migrations, metadata)
- [x] Impact classification: Breaking/Compatible/Cosmetic per change type and target
- [x] Semver impact: max(Breaking→Major, Compatible→Minor, Cosmetic→Patch)
- [x] Change objects with type, target, path, impact, key, before/after, migration hints

---

## Step 8.5: Interface Gap Fixes ✅

**Completed 2026-03-19.** All P0 and P1 gaps resolved in the extracted interfaces.

### P0 — Architectural Blocker (Resolved)

| # | Gap | Resolution |
|---|-----|------------|
| 1 | **Preact Signal coupling in `IFormEngine`** | **Option 1 chosen**: signals stay on `IFormEngine` — it's a TS-consumer contract, not a backend-swap contract. `index.ts` stays TS and owns reactivity. Rust provides pure computation via WASM. |

### P1 — Spec-Normative Gaps (All Fixed)

| # | Gap | Status |
|---|-----|--------|
| 2 | External validation injection | ✅ `injectExternalValidation()` + `clearExternalValidation()` on `IFormEngine` (optional) |
| 3 | Extension function registration | ✅ `registerFunction()` on `IFelRuntime` |
| 4 | Registry entry loading | ✅ `setRegistryEntries()` on `IFormEngine` (optional) |
| 5 | Standalone dependency extraction | ✅ `extractDependencies()` on `IFelRuntime` |
| 6 | 2 mapping error codes | ✅ `VERSION_MISMATCH` + `INVALID_FEL` added to `MappingDiagnostic.errorCode` union |

### P2 — Tooling Gaps (not spec-mandated, but needed for Studio)

| # | Gap | Spec | Interface | Fix |
|---|-----|------|-----------|-----|
| 7 | **`IFelAnalyzer` needed for Studio** | Not spec-mandated | New interface | `analyzeFEL()`, `rewriteFELReferences()`, `tokenize()` (syntax highlighting) all depend on Chevrotain internals. Create `IFelAnalyzer` interface with `analyze()`, `rewrite()`, `tokenize()`. Priority 2 in transition plan. |
| 8 | **Host function data sources not abstracted** | S2.1.7 | `IFormEngine` | `formspec-fn:` URI host callbacks have no interface contract. Currently internal to `index.ts`. Acceptable for now since `index.ts` stays TS. |

### P3 — Nice-to-have

| # | Gap | Spec | Interface | Decision |
|---|-----|------|-----------|----------|
| 9 | Mapping direction not queryable | Mapping S3.1.2 | `IRuntimeMappingEngine` | **Defer.** Implementation validates internally. |
| 10 | Conformance level not queryable | Mapping S1.5 | `IRuntimeMappingEngine` | **Defer.** Not needed for wiring. |

---

## Step 8.6: Factory Functions (from transition plan Phase 1)

**Status: NOT STARTED.** The original transition plan (`2026-03-17-rust-backend-transition.md`) calls for factory functions as the last refactoring step before Rust wiring. Neither `factories.ts` nor `factories.py` exists yet.

### TypeScript ✅

`packages/formspec-engine/src/factories.ts` exists with WASM auto-injection:
- `createFormEngine()` — checks `isWasmReady()`, injects `wasmFelRuntime` when available
- `createMappingEngine()` — same WASM auto-injection pattern

All production call sites use factories:
- [x] `formspec-webcomponent/src/element.ts` → `createFormEngine`
- [x] `formspec-studio/.../BehaviorPreview.tsx` → `createFormEngine`
- [x] `formspec-studio/.../TestResponse.tsx` → `createFormEngine`
- [x] `formspec-studio-core/src/evaluation-helpers.ts` → `createFormEngine`
- [x] `formspec-core/src/queries/mapping-queries.ts` → `createMappingEngine`
- [x] `formspec-studio/.../MappingPreview.tsx` → `createFormEngine`

Test files use `new FormEngine(...)` directly — intentional for test control.

### Python ✅

`src/formspec/factories.py` exists:
- `create_form_processor()` — creates `DefinitionEvaluator` with optional `fel_runtime`
- `create_mapping_engine()` — creates `MappingEngine` with optional `fel_runtime`

All production call sites use factories:
- [x] `src/formspec/validate.py` → `create_form_processor`
- [x] `examples/refrences/server/main.py` → `create_form_processor`, `create_mapping_engine`

Test files use direct construction — intentional.

---

## Step 9: Wire WASM into TypeScript ✅

**9a. Update WASM bindings** ✅ (2026-03-18):
- [x] `parseRegistry`, `findRegistryEntry`, `validateLifecycleTransition`, `wellKnownRegistryUrl`
- [x] `generateChangelog`
- [x] `executeMappingDoc`
- [x] Updated `parse_mapping_rules` to handle all 10 transform types

**9b. WASM bridge + FEL runtime** ✅ (2026-03-19):
- [x] `wasm-pack build` with `wasm-opt = false` (system wasm-opt v128 lacks bulk-memory support)
- [x] `wasm-pkg/` output at `packages/formspec-engine/wasm-pkg/` — 1.5MB WASM binary
- [x] `npm run build:wasm` script in package.json
- [x] `src/wasm-bridge.ts` — lazy async initialization, typed wrappers for all 18 WASM exports
- [x] `src/fel/wasm-runtime.ts` — `WasmFelRuntime` implementing `IFelRuntime` via WASM
- [x] `factories.ts` auto-injects `wasmFelRuntime` when WASM is initialized
- [x] FEL evaluation via WASM (compile + evaluate + dependency extraction)
- [x] TypeScript compiles cleanly with WASM bridge

**9c. TS file deletion — DEFERRED (see Decommission Status below)**

## Step 10: Wire PyO3 into Python ✅

- [x] Install maturin: `pip install maturin` (v1.12.6)
- [x] Created `crates/formspec-py/pyproject.toml` for maturin build
- [x] Build: `maturin develop --manifest-path crates/formspec-py/Cargo.toml --release`
- [x] PyO3 module installed: `formspec_rust` with 15 exports
- [x] Binding exports (from 2026-03-18): `eval_fel`, `parse_fel`, `get_dependencies`, `extract_deps`, `analyze_expression`, `detect_type`, `lint_document`, `evaluate_def`, `parse_registry`, `find_registry_entry`, `validate_lifecycle`, `well_known_url`, `generate_changelog`, `execute_mapping_doc`
- [x] `RustFelRuntime` class in `src/formspec/fel/runtime.py` — implements `FelRuntime` protocol via `formspec_rust`
- [x] `default_fel_runtime()` auto-selects Rust when `formspec_rust` is installed
- [x] Package-level `evaluate()` and `extract_dependencies()` routed through runtime protocol
- [x] **2,201 Python tests pass** with Rust FEL backend active
- [x] Python FEL source files retained as `DefaultFelRuntime` fallback (see Decommission Status)

## Step 11: Cleanup ✅

**Completed 2026-03-19.**

- [x] Delete branch `claude/rust-formspec-rewrite-JysP8` — deleted from origin
- [x] Delete branch `rust_merged` — already gone (deleted in prior session)
- [x] Delete branch `feature/rust-rewrite` — already gone (deleted in prior session)
- [x] Delete local stale branches: `branch`, `worktree-fancy-leaping-puffin`, `claude/refactor-formspec-interfaces-StbWv`
- [x] Prune codex worktrees — already gone (no stale worktrees in `git worktree list`)
- [x] `git fetch --prune` to clean stale remote tracking refs

---

## Decommission Status

The goal is full replacement of TS and Python FEL/logic implementations with Rust. External consumers are the **migration target list**, not blockers.

### TS Migration Tiers

#### Tier 1 — In Progress (520/582 engine tests passing)

**Deleted:** `fel/interpreter.ts`, `fel/dependency-visitor.ts`, `fel/chevrotain-runtime.ts`

**What was done:**
- Added `evalFELWithContext` WASM export using `FormspecEnvironment` (fields, variables, MIP states, repeat context, instances)
- Added path resolution to `WasmCompiledExpression` (sibling, repeat scope rebase, root-relative) — mirrors the Chevrotain interpreter's `candidateLookupPaths` strategy
- Added wildcard `[*]` dep expansion — reconstructs tree-structured instance arrays from flat FormEngine signals for the Rust evaluator
- Added `hasSelfRef` (bare `$`) and `contextRefs` (`@variable`) handling with base-name splitting (`@source.name` → variable `source`)
- Added `instanceRefs` forwarding — `@instance('name')` data passed via `WasmFelContext.instances`
- Fixed Rust `FormspecEnvironment.resolve_field` to check data map for empty key (bare `$`)
- Inlined dependency extraction into `analysis.ts` using existing `walkCst` + `readFieldRefPath`
- Added Node.js WASM init via `initSync` + `fs.readFileSync` (browser `fetch()` doesn't work in Node)
- Test setup file (`tests/setup.mjs`) initializes WASM before test run; `package.json` test command updated with `--import ./tests/setup.mjs`
- Removed `FelUnsupportedFunctionError` usage from FormEngine (dead code with WASM-only runtime)
- Updated `RuntimeMappingEngine` default from `chevrotainFelRuntime` to `wasmFelRuntime`
- Updated stale JSDoc references to Chevrotain/DependencyVisitor across parser.ts, runtime.ts, index.ts
- Cleaned up `wasm-bridge.ts`: extracted `WasmModule` type alias, removed unnecessary `as any` casts, simplified `wasmDetectDocumentType`

**Remaining gaps (62 test failures) by category:**

*Repeat context (8 tests):* `@current`, `prev()`, `next()`, `parent()`, `@count`, `@index`, 1-based explicit indices. The `WasmCompiledExpression` only populates `repeatContext` when the expression references `@index`/`@count`/`@current`, but the repeat context `current` value is the field value (not the row object), and `prev()`/`next()`/`parent()` need the collection array which isn't populated.

*Money arithmetic (4 tests):* `money + number`, `money - number`, `money % number`, `money / number`. Rust evaluator returns null — likely a type coercion difference where Chevrotain auto-coerced numbers to money amounts.

*Variable chains involving money (6 tests):* `@totalDirect`, `@indirectCosts`, `@grandTotal`, `@projectPhasesTotal`. These use `moneyAdd()`, `moneySubtract()` etc. with variable-to-variable chains. Likely blocked by the money arithmetic gap above.

*FEL type discipline (3 tests):* `conditional operators reject non-boolean conditions`, `logical operators reject non-boolean operands`, `unary not rejects non-boolean`. Chevrotain threw errors; Rust returns null.

*Function catalog (4 tests):* `getBuiltinFELFunctionCatalog`, `catalog entries include signature/description`, `contains vs selected descriptions`, `dateDiff signature`. `WasmFelRuntime.listBuiltInFunctions()` returns `[]` — need Rust export of stdlib function metadata.

*Specific FEL functions (8 tests):* `today()`, `dateAdd()`, `isNull()`, `abs()`, `matches()`, `number()`, `year()`, `countWhere()`. These likely work in isolation but fail in FormEngine context — probably blocked by variable chain or path resolution issues.

*Display calculate (4 tests):* Display items with calculate binds. Likely blocked by upstream variable/money issues.

*Instance resolution (3 tests):* `instance()` reads, writable instance loading. Instance data is now forwarded but may need deeper wiring.

*Integration/complex fixtures (10 tests):* Kitchen-sink, shared suite, grant app screener, replay, tax fixture. These exercise multiple features and likely fail due to cascading effects from above gaps.

*Test-specific (2 tests):* `unknown FEL functions throw explicit unsupported-function error` — test expects `FelUnsupportedFunctionError` class (deleted). `FEL runtime error emits FEL_RUNTIME diagnostic` — mapping-specific error handling.

**Key architectural finding:** The Chevrotain interpreter resolved field paths lazily at eval time via `getSignalValue` callbacks, giving it access to the full FormEngine signal graph. The WASM evaluator is a pure function — all values must be pre-resolved and serialized as JSON before crossing the WASM boundary. This creates a fundamental impedance mismatch for features that need runtime JS callbacks (MIP queries on arbitrary paths, dynamic instance lookups, repeat row navigation with collection data).

**NOT Tier 1:** `assembler.ts` stays — WASM `wasmAssembleDefinition(definition, fragments)` takes pre-resolved fragments; TS `assembleDefinition(definition, resolver)` takes an async resolver callback with recursive $ref resolution, provenance tracking, and bind/shape FEL rewriting. Different API.

#### Tier 2 — Needs Consumer Adaptation (WASM bridge exists, but API shape differs)

| TS File                  | WASM Bridge Function(s)                                | Gap                                                                                                           | Consumers                      |
| ------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `extension-analysis.ts`  | `wasmLintDocument()` (lint pass E600)                  | No standalone extension check — consumers must use full lint pipeline or a new `wasmValidateExtensionUsage()` | `formspec-core/diagnostics`    |
| `runtime-mapping.ts`     | `wasmExecuteMapping()`, `wasmExecuteMappingDoc()`      | TS class is stateful (holds FEL runtime + document); WASM is stateless. Consumer needs adapted from class to function calls | `formspec-core`                |
| `schema-validator.ts`    | `wasmLintDocument()` (schema validation is internal)   | No standalone schema-only result — consumers use full lint pipeline instead of AJV                            | `formspec-mcp`, `formspec-core` |

**Note:** `wasm-bridge.ts` also lacks wrappers for 7 additional lib.rs exports: `printFEL`, `lintDocumentWithRegistries`, `parseRegistry`, `findRegistryEntry`, `validateLifecycleTransition`, `wellKnownRegistryUrl`, `generateChangelog`. These need thin TS wrappers before consumers can use them.

#### Tier 3 — Needs New Rust Exports (functionality gap)

| TS File            | What Consumers Need                                                            | Gap                                                                      |
| ------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `fel/analysis.ts`  | `analyzeFEL()` exists, `rewriteFELReferences()` does not                       | Add `rewrite_fel_references()` to `fel-core` + WASM export               |
| `path-utils.ts`    | `normalizeIndexedPath()` exists, `itemAtPath()` and `itemLocationAtPath()` do not | Add definition-tree traversal to `formspec-core` + WASM export           |

Consumers: `formspec-core` (6 files), `formspec-studio-core`

#### Tier 4 — Architecturally Hard (Chevrotain-specific)

| TS File          | What Consumers Need                                            | Why It's Hard                                                                                                    |
| ---------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `fel/lexer.ts`   | `FelLexer` — Chevrotain token objects with position/type metadata | Studio syntax highlighting needs positioned token stream; Rust lexer would need to serialize token spans to JSON |
| `fel/parser.ts`  | `parser` — Chevrotain CST for editor utils                     | Studio needs structured CST for bracket matching, error recovery, completion; would require serializing Rust AST to a JS-consumable format |

Consumer: `formspec-studio` (`src/lib/fel-editor-utils.ts`)

**Options for Tier 4:**
1. Add `wasmTokenizeFEL()` returning `{ type, text, startOffset, endOffset }[]` — covers syntax highlighting
2. Add `wasmParseFELToAST()` returning serialized AST — covers editor utils
3. Keep Chevrotain for Studio editor tooling only (smallest scope, but leaves the dependency)

#### TS Files That Stay (architectural seams, not migration targets)

| TS File                       | Role                                                           |
| ----------------------------- | -------------------------------------------------------------- |
| `interfaces.ts`               | `IFormEngine`, `IRuntimeMappingEngine`, supporting types        |
| `factories.ts`                | `createFormEngine()`, `createMappingEngine()` — backend selection |
| `fel/runtime.ts`              | `IFelRuntime`, `ICompiledExpression`, `FelContext` interfaces   |
| `fel/wasm-runtime.ts`         | `WasmFelRuntime` — adapts WASM exports to `IFelRuntime` + path resolution |
| `wasm-bridge.ts`              | Lazy init + typed wrappers for all WASM exports                |
| `index.ts`                    | `FormEngine` — Preact Signals reactivity, stays TS (see below) |

#### Live Consumer Inventory (verified 2026-03-19)

| Consumer package | Imports from `formspec-engine` | Decommission impact |
| ---------------- | ------------------------------ | ------------------- |
| `formspec-webcomponent` | `createFormEngine`, `IFormEngine` | Not a blocker. Already on the stable engine/factory surface. |
| `formspec-core` | `itemAtPath`, `itemLocationAtPath`, `rewriteFELReferences`, `getBuiltinFELFunctionCatalog`, `createSchemaValidator`, `createMappingEngine` | Main blocker for Tiers 2-3. Needs path utils exports, rewrite support, catalog metadata, and schema/mapping adaptation. |
| `formspec-studio-core` | `analyzeFEL`, `rewriteFELReferences` | Tier 3 blocker only. Studio-core can move once rewrite is available from Rust/WASM. |
| `formspec-studio` | `getBuiltinFELFunctionCatalog`, `FelLexer`, `parser` | Tier 1 metadata gap plus Tier 4 editor-tooling dependency. This is the only package that still truly needs Chevrotain today. |
| `formspec-mcp` | `createSchemaValidator`, `SchemaValidationError`, `DocumentType` | Tier 2 blocker. Needs either a schema-only WASM wrapper or migration to lint-driven validation. |

**Interpretation:** runtime decommission and tooling decommission are now separate tracks. The FEL runtime can be fully Rust-backed without immediately deleting the editor-oriented Chevrotain parser/lexer stack.

#### Recommended Next Sequence

1. **Finish Tier 1 parity inside `formspec-engine`.** Do not migrate more consumers while 62 engine tests still fail. The immediate work is repeat context, writable instances, money arithmetic, function catalog metadata, and mapping diagnostics.
2. **Add missing thin wrappers in `wasm-bridge.ts`.** This is low-risk surface area and unblocks Tier 2 consumers without touching engine semantics.
3. **Add Tier 3 Rust exports.** `rewrite_fel_references`, `item_at_path`, and `item_location_at_path` remove the biggest `formspec-core` and `formspec-studio-core` blockers.
4. **Migrate package consumers in dependency order.** `formspec-core` first, then `formspec-mcp`, then `formspec-studio-core`.
5. **Decide Studio editor strategy explicitly.** Either build Rust token/AST exports or declare Chevrotain a permanent dev-tooling dependency. Do not let Tier 4 ambiguity block the runtime path.

#### TS Deletion Gates

| File family | Delete when | Current status |
| ----------- | ----------- | -------------- |
| `fel/interpreter.ts`, `fel/dependency-visitor.ts`, `fel/chevrotain-runtime.ts` | Engine test parity is restored | **Already deleted in working tree** |
| `runtime-mapping.ts` stateful path | `formspec-core` has switched to stateless WASM mapping wrappers and parity tests are green | Blocked on Tier 2 consumer adaptation |
| `schema-validator.ts` | `formspec-core` + `formspec-mcp` no longer require AJV-shaped results from TS | Blocked on Tier 2 consumer adaptation |
| `extension-analysis.ts` | consumers accept full lint-based validation or a dedicated Rust wrapper exists | Blocked on Tier 2 consumer adaptation |
| `path-utils.ts` | `itemAtPath` / `itemLocationAtPath` exist in Rust/WASM and all consumers switch | Blocked on Tier 3 export gap |
| `fel/analysis.ts` rewrite path | Rust/WASM exposes `rewriteFELReferences()` and consumers migrate | Blocked on Tier 3 export gap |
| `fel/lexer.ts`, `fel/parser.ts` | Studio editor tooling no longer depends on Chevrotain tokens/CST | Blocked on Tier 4 decision |

### Python Migration Status

The `RustFelRuntime` is the default FEL backend (auto-selected when `formspec_rust` is installed). Full decommission requires:

1. ~~Rewrite FEL-specific tests to be backend-agnostic~~ — Done. All 2,201 tests use the public `evaluate()` API.
2. **Make `formspec_rust` a hard dependency** — requires proper `pyproject.toml` for the `formspec` package + CI must build/install PyO3 module (Rust toolchain + maturin in Python test job).
3. **Migrate `__init__.py` exports** — `fel/__init__.py` re-exports Python internals (`parse`, `Evaluator`, `Environment`, `build_default_registry`, `DependencySet`) that have no PyO3 equivalents. Either expose from Rust or drop from public API.
4. **Delete Python FEL implementation files** — `parser.py`, `evaluator.py`, `environment.py`, `functions.py`, `dependencies.py`, `ast_nodes.py` — once steps 2-3 are complete.
5. **Evaluate remaining FEL support files** — `types.py` (FEL value types, converters), `errors.py` (exception hierarchy, `Diagnostic`, `SourcePos`), `extensions.py` (`register_extension`) are needed by the `FelRuntime` protocol and `EvalResult`/`DependencySet` return types. These stay until Rust exposes equivalent types via PyO3. `runtime.py` stays — it defines the `FelRuntime` protocol and runtime selection.

#### Python Deletion Gates

| Python file group | Delete when | Current status |
| ----------------- | ----------- | -------------- |
| `fel/parser.py`, `fel/evaluator.py`, `fel/environment.py`, `fel/functions.py`, `fel/dependencies.py`, `fel/ast_nodes.py` | `formspec_rust` is mandatory and package exports no longer expose Python-only parser/evaluator internals | Blocked on packaging + public API decision |
| `fel/__init__.py` internals re-exports | Rust/PyO3 provides equivalent exports or we intentionally narrow the public API | Blocked on API design decision |
| `fel/types.py`, `fel/errors.py`, `fel/extensions.py` | PyO3 surface returns rich typed objects and extension registration no longer depends on Python helpers | Not a near-term target |

**Practical stopping point:** for Python, "decommissioned" should mean "Rust is the only execution backend." It does **not** need to mean "the entire `src/formspec/fel/` package disappears." The protocol layer and Python-native adapter/error/value helpers can remain if they are just binding glue.

---

## Remaining — `index.ts` (stays TypeScript)

### FormEngine — Very High Complexity

The core engine file among several TS files that remain. Manages form state via Preact Signals:

- Field values, relevance (visibility), required/readonly state
- Validation results, repeat group counts, option lists, computed variables
- **Option Sets (S4.6)**: named reusable option lists, dynamic filtering, conditional options
- **Variables (S4.5)**: `@name` references, lexical scoping via `scope`, DAG-ordered recalculation
- **Data Sources (S2.1.7)**: inline `data`, URL `source`, host callbacks via `formspec-fn:` URI scheme; schema declarations, fallback behavior, read-only enforcement
- **4-phase processing** (S2.4): Rebuild → Recalculate → Revalidate → **Notify**
  - NRB (non-relevant blanking) is part of Recalculate and Response serialization, NOT a separate phase
  - Deferred processing: batch writes accumulate, one cycle runs with union of dirty nodes
- Bind constraints (field-level: required, readonly, calculate, constraint, relevance)
- Shape evaluation: composition operators (`and`/`or`/`not`/`xone`), per-shape `timing`, `code`, `context`, `activeWhen`
- Repeat group lifecycle (add/remove instances, min/max cardinality)
- **Response serialization**: `nonRelevantBehavior` modes (`remove`/`empty`/`keep`), per-bind `excludedValue` override
- Version migrations, screener evaluation, `disabledDisplay` presentation hints
- **Validation modes (S5.5)**: `continuous`, `deferred`, `disabled`
- **External validation results (S5.7)**: inject/clear with `source: "external"`, idempotent merge

`index.ts` calls WASM for all pure logic (FEL evaluation, assembly, schema validation, path resolution). Its job is signal wiring, reactivity, and the notify phase only.

**Host callbacks:** `formspec-fn:` URIs call back into the JS host. Data source loading can be async — the spec requires fetching before the first Rebuild phase.

---

## Remaining — Python Backend (`src/formspec/`)

After Steps 6-10, format adapters, the artifact orchestrator, and the FEL runtime protocol layer stay Python:

| Module                 | File                     | Why it stays                                         |
| ---------------------- | ------------------------ | ---------------------------------------------------- |
| FEL runtime protocol   | `fel/runtime.py`         | `FelRuntime` protocol, `RustFelRuntime`, `DefaultFelRuntime`, runtime selection |
| FEL types              | `fel/types.py`           | `FelValue` union, converters — needed by `EvalResult` return type |
| FEL errors             | `fel/errors.py`          | `Diagnostic`, `SourcePos`, exception hierarchy — needed by protocol |
| FEL extensions         | `fel/extensions.py`      | `register_extension()` — registry integration        |
| FEL public API         | `fel/__init__.py`        | Re-exports, `evaluate()` and `extract_dependencies()` convenience functions |
| Base adapter ABC       | `adapters/base.py`       | Python abstract interface for format adapters         |
| JSON adapter           | `adapters/json_adapter.py` | Server-side serialization, Python `json` stdlib     |
| XML adapter            | `adapters/xml_adapter.py`  | Server-side serialization, `xml.etree` stdlib       |
| CSV adapter            | `adapters/csv_adapter.py`  | Server-side serialization, `csv` stdlib             |
| Artifact Orchestrator  | `validate.py`            | CLI entry point, calls into Rust via PyO3             |

### Adapter Details

| Adapter  | File                       | Description                                                       |
| -------- | -------------------------- | ----------------------------------------------------------------- |
| Base ABC | `adapters/base.py`         | `serialize(JsonValue) -> bytes`, `deserialize(bytes) -> JsonValue` |
| JSON     | `adapters/json_adapter.py` | Pretty/sort/null-handling options, Decimal serialization          |
| XML      | `adapters/xml_adapter.py`  | Attributes (@-prefix), CDATA, namespaces, root element            |
| CSV      | `adapters/csv_adapter.py`  | RFC 4180, repeat group row expansion, configurable delimiter/quote |

---

## Deferred / Out of Scope (Tier 2 & 3)

- **Theme Processor** — selector cascade (6 levels), 12-column layout, token resolution, widget-dataType compatibility matrix (33 widgets). Currently in the webcomponent layer.
- **Component Tree Resolver** — slot binding, `when` conditional rendering (FEL), custom instantiation, progressive-to-core fallback, responsive merge. Currently in the webcomponent layer.

---

## Reference

### Error Code Inventory (35 total ✅)

**Errors (20):** E100, E200, E201, E300, E301, E302, E400, E500, E600, E601, E602, E710, E800, E801, E802, E803, E804, E805, E806, E807

**Warnings (15):** W300, W700, W701, W702, W703, W704, W705, W706, W707, W711, W800, W801, W802, W803, W804

### Known Gaps (from spec review + spec-expert analysis 2026-03-19)

#### Rust/Lint Gaps (from Steps 0–5)

| # | Gap | Risk | Decision |
|---|-----|------|----------|
| 1 | **E101 (JSON Schema validation)** — Python linter validates documents against JSON Schema via `jsonschema` and uses E101 errors for pass gating. Rust has no equivalent. | Medium | **Accept.** Rust linter's value is in semantic passes 2-7. Caller can do schema validation externally. Pass gating in Rust uses E200/E201 structural errors instead. |
| 2 | **`when` expression FEL validation** — Component spec says `when` is a FEL boolean expression, but neither Python nor Rust validates `when` in component trees. Malformed `when` silently passes lint. | Low | **Defer.** Presentation-only, no data semantics impact. Add as future enhancement. |
| 3 | **`decimal` vs `number` vocabulary** — Spec prose says "number" in compatibility matrix, schema uses `decimal`. | Low | **Follow schema.** Python reference already uses `decimal`. Rust must match. (Addressed in Step 3.1.) |
| 4 | **WASM/PyO3 binding gap** — Adding `definition_document` to `LintOptions` compiles cleanly (defaults to `None`), but cross-artifact checks (W705-W707, W800-W804) are unreachable from WASM/Python until bindings are updated to pass `definition_document`. | Low | **Defer.** Follow-up adds `lintDocumentWithContext(doc, registries, definition)` to WASM and equivalent to PyO3. |

#### Interface Gaps (from spec-expert review 2026-03-19) — see Step 8.5

| # | Gap | Spec | Severity | Decision |
|---|-----|------|----------|----------|
| 5 | **Preact Signal coupling in `IFormEngine`** | S2.4 Phase 4 | P0 Architectural | **Accept for now.** `index.ts` stays TS and owns reactivity; `IFormEngine` is a TS-consumer contract, not a backend-swap contract. Rust provides pure computation via WASM. |
| 6 | **External validation injection missing** | S5.7 (MUST) | P1 Normative | **Fix in Step 8.5.** Add `injectExternalValidation()` / `clearExternalValidation()` to `IFormEngine`. |
| 7 | **Extension function registration missing from `IFelRuntime`** | S3.12 (SHOULD) | P1 Normative | **Fix in Step 8.5.** Add `registerFunction()` to `IFelRuntime`. |
| 8 | **Registry entry loading missing from `IFormEngine`** | S8.1 | P1 | **Fix in Step 8.5** or document as constructor-time only. |
| 9 | **Standalone dependency extraction missing from TS `IFelRuntime`** | S3.6.1 (MUST) | P1 Normative | **Fix in Step 8.5.** Python protocol already has it; add `extractDependencies()` to TS `IFelRuntime`. |
| 10 | **2 mapping error codes missing** (`VERSION_MISMATCH`, `INVALID_FEL`) | Mapping S7.2 | P1 | **Fix in Step 8.5.** Add to `MappingDiagnostic.errorCode` union. |
| 11 | **`IFelAnalyzer` needed for Studio tooling** | Not spec-mandated | P2 Tooling | **Defer to Step 8.5 P2.** `analyzeFEL`, `rewriteFELReferences`, `tokenize` need their own interface. |
| 12 | **Host function data sources not abstracted** | S2.1.7 | P2 | **Accept.** Internal to `index.ts` which stays TS. |
| 13 | **Mapping direction/conformance not queryable** | Mapping S3.1.2, S1.5 | P3 | **Defer.** Not needed for wiring. |

### What NOT to do

- Don't `git merge` or `git cherry-pick` from `rust_merged` — the branches have diverged too much
- Don't copy files verbatim — they use old types (`diagnostic::LintDiagnostic`, `policy::LintMode`) that don't exist on `main`
- Don't copy bind-walking code from either branch without understanding the shape — `rust_merged` uses binds-as-array (schema-correct), `main` uses binds-as-object (deviation). Decide which shape to target.
- Don't try to make the old test files compile as-is — they reference old module names and APIs
- Don't replace the new orchestrator with the old one — `main`'s `lib.rs` has pass gating and LintMode
- Don't touch `fel-core`, `formspec-core`, `formspec-wasm`, `formspec-py` — those are clean
- Don't touch `formspec-eval` during lint reconciliation (Steps 0–5) — `main`'s `lib.rs` is strictly better than the old `evaluator.rs`

### Conformance Traps

#### Dual Indexing (S4.3.3 + FEL Grammar S6.2) ⚠️ SPEC CONTRADICTION
- **Bind paths and ValidationResult paths**: **0-based**. `items[0].field`
- **FEL expressions**: **1-based**. `$items[1].field` is the first instance. Out-of-bounds signals an error.
- **`@index`**: **1-based** per FEL grammar S6.1 and both TS/Rust implementations.
- **CONTRADICTION**: Core spec S3.2.2 says FEL uses **0-based** indexing (`$lineItems[0].amount`) and `@index` is 0-based. FEL grammar S6.1/S6.2 says **1-based**. Both implementations use 1-based. **FEL grammar is authoritative for FEL semantics; core spec S3.2.2 needs amendment.**

#### Context-Sensitive Null Propagation (S3.8.1)

| Bind type        | null treatment            |
| ---------------- | ------------------------- |
| `relevant`       | `true` (show the field)   |
| `required`       | `false` (not required)    |
| `readonly`       | `false` (allow editing)   |
| `constraint`     | `true` (passes validation) |
| `if()` condition | **error**                 |

#### Bind Inheritance Rules (S4.3.2)
- `relevant`: logical AND (child can't be relevant if parent isn't)
- `readonly`: logical OR (child can't be editable if parent is readonly)
- `required`, `calculate`, `constraint`: **no inheritance**

#### NRB Calculation Continuation (S5.6)
`calculate` binds MUST continue to evaluate when non-relevant. Validation, required checks, and type checks are suppressed. `excludedValue` controls what downstream expressions see for non-relevant user-input fields: `"preserve"` (default — last value) or `"null"`.

#### Element-Wise Array Operations (S3.9)
- Equal-length arrays: element-wise operation; different lengths: error; scalar+array: broadcast.
- Null elements within arrays follow per-element null propagation: null in position N produces null at position N (not whole-array null).

#### `let`/`in` Parser Ambiguity (FEL Grammar S4)
`in` inside `let`-value position needs parens: `let x = (1 in $arr) in ...`. The normative grammar's `LetValue` production says `IfExpr` but a prose comment says "Membership omitted" — this requires a custom production chain that skips the Membership level. The informative grammar in core spec S3.7 does NOT have this disambiguation.

#### Wildcard Dependency Tracking (S3.6.4)
`$repeat[*].field` — dependency is on the collection, not per-instance. Both field value changes within any instance AND add/remove of instances mark the wildcard-dependent expression as dirty.

#### Whitespace Normalization (S4.3.1)
`whitespace` bind applied BEFORE storage and BEFORE constraint evaluation. Integer/decimal always trimmed regardless.

#### `money` Type Serialization (S3.4.1)
Money amounts MUST be serialized as **JSON strings** (not JSON numbers) to preserve precision. However, `moneyAmount()` (S3.5.7) returns a **number** for arithmetic use — do not confuse serialization format with FEL runtime type.

#### Deferred Processing (S2.4)
Batch operations accumulate writes; one cycle runs at end with union of dirty nodes. **Conformance requirement:** the processor MUST produce the same final state regardless of whether changes are processed individually or in a batch.

#### `calculate` Implies `readonly` (S4.3.1)
A node with a `calculate` bind is **implicitly `readonly`** unless `readonly` is explicitly set to `"false"`. Easy to miss — affects how the engine handles user input on calculated fields.

#### Circular Dependency Detection is Mandatory (S2.4 Phase 1)
If a cycle is detected during Rebuild, the processor **MUST signal a definition error and MUST NOT proceed** to Phase 2. This is a hard halt, not a warning or graceful degradation.

#### `required` Treats Empty Array as Unsatisfied (S4.3.1)
A value is "empty" if it is `null`, empty string `""`, or empty array `[]`. The `[]` case is easy to miss — `required` on a multiChoice field means "at least one selection."

#### Evaluation Errors Produce `null` + Diagnostic (S3.10.2)
Runtime evaluation errors (type mismatches, division by zero, index OOB, etc.) produce `null` and a diagnostic — they do **NOT** halt processing. The form continues working. The `null` then propagates per S3.8.1 context-sensitive rules.

#### `excludedValue` vs `nonRelevantBehavior` Dual Control (S4.3.1 + S5.6)
Two separate mechanisms for non-relevant fields that operate independently:
- `excludedValue` (`"preserve"` / `"null"`) — controls what **in-memory expressions** see for the non-relevant field's value
- `nonRelevantBehavior` (`"remove"` / `"empty"` / `"keep"`) — controls the **serialized output** (response/submission)

An implementor could easily conflate them or implement only one.

#### Shape Composition Circular References (S5.2.2)
Composed shapes referencing each other circularly are a **definition error**. Must be detected during shape evaluation setup, not at runtime.

#### `if()` Function vs `if...then...else` Keyword (FEL Grammar S4)
FEL has two distinct `if` forms: `if(cond, a, b)` (function-call syntax via the `IfCall` production) and `if cond then a else b` (keyword syntax via the `IfExpr` production). Both are valid. The function form uses the reserved word `if` through a special grammar production — it is NOT a regular user-defined function.

### Architecture Decisions Made

#### ADR: rust_decimal over f64 (Phase 1)
- `f64` gives 15-17 significant digits; spec requires 18 minimum
- `rust_decimal::Decimal` gives 28-29 significant digits, base-10 arithmetic
- Native `MidpointNearestEven` rounding strategy replaces custom `bankers_round`
- Exact equality (`==`) replaces tolerance-based `float_eq`
- `0.1 + 0.2 = 0.3` is exact (would fail with f64)
- Scientific notation (`1e3`) falls back through f64 in the lexer (lossless for integer results)
- `power()` falls back to f64 for fractional exponents (inherently imprecise)

#### ADR: Dependency Inversion for Schema Validation (Phase 2)
- `JsonSchemaValidator` trait in `formspec-core` — host provides the actual JSON Schema engine
- WASM layer can use AJV; PyO3 layer can use `jsonschema-rs`
- Keeps `formspec-core` free of heavy JSON Schema validator dependencies
- `formspec-core` provides: document type detection, path translation, component tree walk strategy

#### ADR: Trait-based Registry Lookup (Phase 2)
- `RegistryLookup` trait for extension validation
- `RefResolver` trait for assembler
- Both allow different implementations per binding layer
- Test implementations use simple `HashMap` wrappers

### Build History

#### Iteration 1 (2026-03-18)
Built all 6 crates from scratch. 175 tests.
- `fel-core`: decimal migration, environment, extensions
- `formspec-core`: all 6 modules
- `formspec-eval`, `formspec-lint`: initial implementations
- `formspec-wasm`, `formspec-py`: binding layers

#### Iteration 2 (2026-03-18)
Deepened eval and lint. 239 tests (↑64).
- `fel-core`: added FEL printer (15 round-trip tests)
- `formspec-core`: fixed assembler FEL rewriting (AST-based), improved runtime mapping expression transform
- `formspec-eval`: added topo sort, AND/OR inheritance, wildcard expansion, NRB modes, whitespace normalization (6→28 tests)
- `formspec-lint`: added E302/W300/E301/E600, wildcard validation, screener parsing, pass gating, LintMode, diagnostic sorting (9→27 tests)

#### Iteration 3 (2026-03-18)
Expanded WASM bindings. 239 tests (maintained).
- `formspec-wasm`: added linter, evaluator, assembler, printer exports — all processing capabilities now exposed to TypeScript

#### Iteration 4 (2026-03-18)
Lint reconciliation (Steps 0–5). 239→494 tests (↑255).
- `formspec-lint`: replaced monolithic `passes.rs` with 8 typed modules. 27→199 tests, 12→35 error codes, 1,392→5,341 lines. Deleted `passes.rs`.
- Added `definition_document` to `LintOptions` for cross-artifact validation.
- Added `LintDiagnostic` convenience constructors, W802 authoring suppression.

#### Iteration 5 (2026-03-18)
Scope expansion (Steps 6–8) + binding updates. 494 tests (maintained test count, expanded scope).
- `formspec-core`: added `registry_client.rs` (35 tests), `changelog.rs` (36 integration tests). Expanded `runtime_mapping.rs` with 4 new transforms + MappingDocument + autoMap + defaults.
- `formspec-wasm`: 7 new WASM exports (registry, changelog, mapping doc). Fixed transform parser for all 10 types.
- `formspec-py`: 6 new PyO3 exports (registry, changelog, mapping doc).

#### Iteration 6 (2026-03-19)
Dependency inversion + interface extraction. 518 tests (↑24 from test count correction).
- `formspec-engine`: extracted `IFelRuntime`, `ICompiledExpression`, `IFelEngineContext`, `FelContext` (`fel/runtime.ts`), `ChevrotainFelRuntime` adapter (`fel/chevrotain-runtime.ts`), `IFormEngine`, `IRuntimeMappingEngine`, `MappingDiagnostic` (`interfaces.ts`)
- `formspec` (Python): `FelRuntime` protocol + `DefaultFelRuntime` (`fel/runtime.py`), `FormProcessor`/`FormValidator`/`MappingProcessor`/`DataAdapter` protocols (`protocols.py`)
- Fix-up: `IFelEngineContext` signal properties, `MappingDiagnostic` type alignment, `BehaviorContext.engine` → `IFormEngine`
- Spec-expert review: identified 11 interface gaps (6 normative, 5 tooling/nice-to-have)

#### Iteration 7 (2026-03-19)
Test expansion + WASM binary optimization. 518 → 1,009 tests (↑491).
- All 6 crates received comprehensive test additions per audit findings (commits 4133081–4594e76, 698cba2)
- `Cargo.toml`: added `[profile.release]` — `lto = true`, `codegen-units = 1`, `opt-level = "s"`, `strip = true`
- `Makefile` + `package.json`: split build into `wasm-pack --no-opt` + manual `wasm-opt -Os --enable-bulk-memory --enable-nontrapping-float-to-int` (Rust 1.89 LLVM / wasm-pack compatibility fix)
- WASM binary: 1.8 MB → 1.4 MB raw, 650 KB → 538 KB gzipped (-22% / -17%)
- Size analysis: `regex` crate is 28% of binary (664 KB) for a single `matches()` FEL function — next optimization target

#### Iteration 8 (2026-03-19)
Wiring + cleanup. Steps 8.5–11 complete. Both TS and Python consume Rust.
- **Step 8.5**: Verified all P0/P1 interface gaps already resolved (`VERSION_MISMATCH`/`INVALID_FEL` in error code union, `registerFunction`/`extractDependencies`/`setRegistryEntries`/`injectExternalValidation`/`clearExternalValidation` all present)
- **Step 8.6**: Reference server (`examples/refrences/server/main.py`) updated from direct construction to `create_form_processor`/`create_mapping_engine` factories
- **Step 9b**: WASM rebuilt with `wasm-opt = false` in `Cargo.toml` (system wasm-opt v128 lacks bulk-memory). `wasm-bridge.ts` init function typing fixed. `build:wasm` npm script added. TS compiles cleanly.
- **Step 10**: `maturin` installed (v1.12.6). `pyproject.toml` created for PyO3 crate. `formspec_rust` native module built and installed. `RustFelRuntime` class created implementing `FelRuntime` protocol via Rust. `default_fel_runtime()` auto-selects Rust. Package-level `evaluate()`/`extract_dependencies()` routed through protocol. **2,201 Python tests pass with Rust FEL backend.**
- **Step 11**: `claude/rust-formspec-rewrite-JysP8` remote branch deleted. Stale local branches pruned (`branch`, `worktree-fancy-leaping-puffin`, `claude/refactor-formspec-interfaces-StbWv`). Remote refs pruned.
- **Decommission analysis**: TS file deletion deferred — external packages (formspec-core, formspec-studio) depend on Chevrotain tokens, typed object traversal, AJV, and FEL analysis exports. Python file deletion deferred — Rust FEL is default but Python remains as fallback.

#### Iteration 9 (2026-03-19)

Tier 1 decommission — Chevrotain FEL runtime removal. 520/582 engine tests passing (62 remaining).

**Deleted files:**
- `fel/interpreter.ts` (1,304 lines — Chevrotain CstVisitor, FEL stdlib, eval engine)
- `fel/dependency-visitor.ts` (98 lines — CST field reference walker)
- `fel/chevrotain-runtime.ts` (103 lines — IFelRuntime adapter wrapping above two)

**Rust changes:**
- `fel-core/environment.rs`: `FormspecEnvironment.resolve_field` now checks data map for empty key (bare `$` support)
- `formspec-wasm/lib.rs`: new `evalFELWithContext` export using `FormspecEnvironment` instead of `MapEnvironment` — accepts `{ fields, variables, mipStates, repeatContext, instances }`

**TS changes:**
- `wasm-bridge.ts`: `WasmFelContext` interface + `wasmEvalFELWithContext` wrapper; Node.js `initSync` path via `readFileSync`; `WasmModule` type alias; removed `as any` casts
- `fel/wasm-runtime.ts`: path resolution (`resolveFieldPath` with sibling, repeat scope rebase, root-relative strategies); wildcard `[*]` tree reconstruction; variable `@name` base-name extraction; `instanceRefs` forwarding; guarded repeat context population; MIP state gathering
- `fel/analysis.ts`: `collectFieldReferences` inlined using existing `walkCst` + `readFieldRefPath` (replaces `dependencyVisitor` import)
- `index.ts`: all Chevrotain imports/exports removed; `FormEngine` defaults to `wasmFelRuntime`; removed `FelUnsupportedFunctionError` dead code
- `runtime-mapping.ts`: default runtime changed from `chevrotainFelRuntime` to `wasmFelRuntime`
- `factories.ts`: already used `wasmFelRuntime` (no change needed)
- `tests/setup.mjs`: WASM init before test run; `package.json` test command updated

### Dependency Graph

```
index.ts (stays TS — Preact Signals)
└── crates/formspec-wasm (WASM boundary) ✅
    ├── crates/formspec-core ✅
    │   ├── FEL Analysis ✅
    │   ├── Path Utils ✅
    │   ├── Schema Validator ✅
    │   ├── Extension Analysis ✅
    │   ├── Runtime Mapping (10 transforms + MappingDocument) ✅
    │   ├── Assembler ✅
    │   ├── Registry Client (semver, lifecycle, RegistryLookup) ✅  ← NEW
    │   └── Changelog (diff, impact classification) ✅  ← NEW
    ├── crates/formspec-eval ✅
    ├── crates/formspec-lint (8 modules, 35 codes, 199 tests) ✅  ← EXPANDED
    └── crates/fel-core ✅
        ├── Lexer, Parser, AST (rust_decimal) ✅
        ├── Evaluator + ~61 stdlib ✅
        ├── Dependencies ✅
        ├── Environment ✅
        ├── Extensions ✅
        └── Printer ✅

crates/formspec-py ✅
└── all of the above ✅
```
