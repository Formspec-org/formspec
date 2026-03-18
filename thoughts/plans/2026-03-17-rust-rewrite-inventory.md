# Rust Rewrite Inventory

Status: **Phases 1–5 complete, hardened** — 6 crates, 10,931 lines of Rust, 239 tests. WASM/PyO3 exports cover all capabilities. Wiring and decommission next.

## Overview

Build a **Rust shared kernel** that eliminates the TS↔Python logic duplication without replacing the TypeScript engine's reactivity model.

**Strategy:**
- `packages/formspec-engine/src/index.ts` keeps Preact Signals for reactive UI state — it is the only file in the engine that stays TypeScript.
- Every other file in `packages/formspec-engine/src/` moves to Rust. None of them touch `@preact/signals-core`.
- Rust is also the single implementation for all batch processors (Definition Evaluator, Linter) that TS currently lacks entirely.
- WASM bindings expose the Rust crates to TypeScript (`index.ts` calls WASM internally; public API stays identical). PyO3 bindings expose them to Python.
- Once WASM is wired: delete the TS source files. Once PyO3 is wired: delete the Python FEL source files.

**What stays TypeScript:** `index.ts` only — FormEngine class, Preact Signals reactive state.
**What stays Python:** Mapping Engine, Adapters, Changelog, Registry (server-side only, no cross-platform pressure yet).
**What moves to Rust:** Every non-reactive TS file + all batch processors.

### TypeScript File Disposition

| File | Lines | Destination | Status |
|------|-------|-------------|--------|
| `src/index.ts` | 2,454 | **Stays TS** — only Preact Signals consumer | — |
| `src/fel/lexer.ts` | 255 | `crates/fel-core` | ✅ Rust done, delete when WASM wired |
| `src/fel/parser.ts` | 368 | `crates/fel-core` | ✅ Rust done, delete when WASM wired |
| `src/fel/interpreter.ts` | 1,314 | `crates/fel-core` | ✅ Rust done, delete when WASM wired |
| `src/fel/dependency-visitor.ts` | 97 | `crates/fel-core` | ✅ Rust done, delete when WASM wired |
| `src/fel/analysis.ts` | 435 | `crates/formspec-core` | ✅ Rust done, delete when WASM wired |
| `src/path-utils.ts` | 71 | `crates/formspec-core` | ✅ Rust done, delete when WASM wired |
| `src/schema-validator.ts` | 347 | `crates/formspec-core` | ✅ Rust done, delete when WASM wired |
| `src/extension-analysis.ts` | 97 | `crates/formspec-core` | ✅ Rust done, delete when WASM wired |
| `src/runtime-mapping.ts` | 220 | `crates/formspec-core` | ✅ Rust done, delete when WASM wired |
| `src/assembler.ts` | 695 | `crates/formspec-core` | ✅ Rust done, delete when WASM wired |

### Crate Status

| Crate | Lines | Contents | Tests |
|-------|-------|----------|-------|
| `crates/fel-core` | 4,731 | FEL lexer, parser, evaluator (rust_decimal), environment, extensions, dependencies, printer | 123 |
| `crates/formspec-core` | 2,501 | FEL analysis, path utils, schema validator, extension analysis, runtime mapping, assembler | 61 |
| `crates/formspec-eval` | 1,586 | Definition Evaluator — 4-phase batch processor with topo sort, inheritance, NRB, wildcards | 28 |
| `crates/formspec-lint` | 1,392 | 7-pass static analysis linter with pass gating, LintMode, diagnostic sorting | 27 |
| `crates/formspec-wasm` | 390 | WASM bindings via wasm-bindgen → TypeScript (all capabilities) | — |
| `crates/formspec-py` | 331 | PyO3 bindings → Python (all capabilities) | — |
| **Total** | **10,931** | | **239** |

### Decommission Milestones

**After `crates/formspec-wasm` wired into `index.ts`:** delete all of:
- `src/fel/lexer.ts`, `src/fel/parser.ts`, `src/fel/interpreter.ts`, `src/fel/dependency-visitor.ts`
- `src/fel/analysis.ts`
- `src/path-utils.ts`, `src/schema-validator.ts`, `src/extension-analysis.ts`, `src/runtime-mapping.ts`, `src/assembler.ts`

**After `crates/formspec-py` wired into Python backend:** delete:
- `src/formspec/fel/` (lexer, parser, evaluator, ast_nodes, types, errors, dependencies, environment, extensions)

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

13. ✅ **Linter** (`crates/formspec-lint`) — 7-pass pipeline with modular architecture:
    - E100: document type detection
    - E200/E201: duplicate key detection
    - E300: bind path validation (including wildcard on repeatable groups)
    - E301: shape target validation
    - E302/W300: optionSet reference + dataType compatibility
    - E400: FEL expression parse validation (binds, shapes, screener routes)
    - E500: dependency cycle detection via DFS with rotation-based dedup
    - E600: extension resolution against registry documents
    - W700: theme token reference integrity
    - E800/W804: component tree validation, bind uniqueness
    - Pass gating (stop after structural errors)
    - LintMode (Authoring/Runtime) with suppressions
    - Diagnostic sorting (pass → severity → path)

### Phase 5: PyO3 Bindings ✅

14. ✅ **`crates/formspec-py`** — PyO3 module `formspec_rust` exposing: `eval_fel`, `parse_fel`, `get_dependencies`, `extract_deps`, `analyze_expression`, `detect_type`, `lint_document`, `evaluate_def`. Full Python↔Rust type conversion (None/bool/int/float/str/list/dict ↔ FelValue).

---

## Remaining — Wiring + Decommission

### Phase 6: Wire WASM into TypeScript

- [ ] Install toolchain: `rustup target add wasm32-unknown-unknown` + `cargo install wasm-pack`
- [ ] Build WASM package: `wasm-pack build crates/formspec-wasm --target bundler`
- [ ] Add WASM package as npm dependency in `packages/formspec-engine/package.json`
- [ ] Create thin TS wrapper module that loads WASM and re-exports typed functions
- [ ] Wire `index.ts` to call WASM for:
  - [ ] FEL evaluation (`compileFEL`, `evaluateFEL`)
  - [ ] FEL dependency extraction (reactive signal wiring)
  - [ ] FEL analysis (`analyzeFEL`, `getFELDependencies`)
  - [ ] Assembly (`assembleDefinitionSync`)
  - [ ] Schema validation (`createSchemaValidator`)
  - [ ] Path utilities (`normalizeIndexedPath`)
  - [ ] Runtime mapping (`RuntimeMappingEngine`)
- [ ] Delete all non-reactive TS files (see Decommission Milestones)
- [ ] Run full Playwright E2E suite — verify zero regressions
- [ ] Run `npm run docs:check` — verify doc gates pass

### Phase 7: Wire PyO3 into Python

- [ ] Install maturin: `pip install maturin`
- [ ] Build: `maturin develop --release` in `crates/formspec-py`
- [ ] Wire Python backend — replace `from formspec.fel import ...` with `import formspec_rust`:
  - [ ] `formspec.fel.parser.parse` → `formspec_rust.parse_fel`
  - [ ] `formspec.fel.evaluator.evaluate` → `formspec_rust.eval_fel`
  - [ ] `formspec.fel.dependencies.extract_dependencies` → `formspec_rust.extract_deps`
  - [ ] `formspec.validator` → `formspec_rust.lint_document`
  - [ ] `formspec.evaluator` → `formspec_rust.evaluate_def`
- [ ] Delete `src/formspec/fel/`
- [ ] Run full Python conformance suite: `python3 -m pytest tests/ -v`

### Phase 8: Tooling (deferred)

- [ ] Registry client in Rust (currently Python-only)
- [ ] Changelog diffing in Rust (currently Python-only)

### Cleanup

- [ ] Delete superseded branch `claude/rust-formspec-rewrite-JysP8`
- [ ] Prune empty codex worktree `50af`
- [ ] Merge `feature/rust-rewrite` into main (or create PR)
- [ ] Remove `.worktrees/rust-rewrite` worktree after merge

---

## Remaining — `index.ts` (stays TypeScript)

### FormEngine — Very High Complexity

The only TypeScript file. Manages form state via Preact Signals:

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

Python keeps the components with no cross-platform pressure. All FEL is replaced by PyO3 calls to `crates/formspec-py`.

### Registry (`registry.py`) — stays Python, Medium

- Extension registry client: parse, query, validate registry documents
- Semver constraint matching (`_version_satisfies`)
- Lifecycle state machine validation (draft → active → deprecated → retired)
- Well-known discovery URL construction

### Changelog (`changelog.py`) — stays Python, Medium

- Diff two definition versions into a semver-classified changelog
- Classifies changes as breaking/compatible/cosmetic
- Computes major/minor/patch impact

### Mapping Engine (`mapping/`) — stays Python, Medium-High

| Component | File | Description |
|-----------|------|-------------|
| Engine | `mapping/engine.py` | Bidirectional rule-based transforms, FEL conditions, array descriptors, autoMap |
| Transforms | `mapping/transforms.py` | 10 types: preserve, drop, expression, **constant**, coerce, valueMap, concat, split, nest, flatten |

Note: `join` is a FEL function, not a transform type. `constant` (S4.9) injects fixed values — sourcePath not required, never reversible.

### Adapters (`adapters/`) — stays Python, Low to Medium

| Adapter | File | Description |
|---------|------|-------------|
| Base ABC | `adapters/base.py` | `serialize(JsonValue) -> bytes`, `deserialize(bytes) -> JsonValue` |
| JSON | `adapters/json_adapter.py` | Pretty/sort/null-handling options, Decimal serialization |
| XML | `adapters/xml_adapter.py` | Attributes (@-prefix), CDATA, namespaces, root element |
| CSV | `adapters/csv_adapter.py` | RFC 4180, repeat group row expansion, configurable delimiter/quote |

### Artifact Orchestrator (`validate.py`) — stays Python, Medium

- Auto-discovers all Formspec JSON artifacts in a directory
- Calls into `crates/formspec-py` for lint/eval passes
- Report formatting and exit codes

---

## Deferred / Out of Scope (Tier 2 & 3)

- **Theme Processor** — selector cascade (6 levels), 12-column layout, token resolution, widget-dataType compatibility matrix (33 widgets). Currently in the webcomponent layer.
- **Component Tree Resolver** — slot binding, `when` conditional rendering (FEL), custom instantiation, progressive-to-core fallback, responsive merge. Currently in the webcomponent layer.

---

## Conformance Traps

### Dual Indexing (S4.3.3 + FEL Grammar S6.2)
- **Bind paths and ValidationResult paths**: **0-based**. `items[0].field`
- **FEL expressions**: **1-based**. `$items[1].field` is the first instance. Out-of-bounds signals an error.

### Context-Sensitive Null Propagation (S3.8.1)
| Bind type | null treatment |
|-----------|---------------|
| `relevant` | `true` (show the field) |
| `required` | `false` (not required) |
| `readonly` | `false` (allow editing) |
| `constraint` | `true` (passes validation) |
| `if()` condition | **error** |

### Bind Inheritance Rules (S4.3.2)
- `relevant`: logical AND (child can't be relevant if parent isn't)
- `readonly`: logical OR (child can't be editable if parent is readonly)
- `required`, `calculate`, `constraint`: **no inheritance**

### NRB Calculation Continuation (S5.6)
`calculate` binds MUST continue to evaluate when non-relevant. Only validation and required checks are suppressed.

### Element-Wise Array Operations (S3.9)
- Equal-length arrays: element-wise operation; different lengths: error; scalar+array: broadcast.

### `let`/`in` Parser Ambiguity (FEL Grammar)
`in` inside `let`-value position needs parens: `let x = (1 in $arr) in ...`

### Wildcard Dependency Tracking (S3.6.4)
`$repeat[*].field` — dependency is on the collection, not per-instance. Add/remove instances marks dirty.

### Whitespace Normalization (S4.3.1)
`whitespace` bind applied BEFORE storage and BEFORE constraint evaluation. Integer/decimal always trimmed regardless.

### `money` Type Serialization (S3.4.1)
Money amounts MUST be serialized as JSON strings. `moneyAmount()` returns a string, not a number.

### Deferred Processing (S2.4)
Batch operations accumulate writes; one cycle runs at end with union of dirty nodes.

---

## Architecture Decisions Made

### ADR: rust_decimal over f64 (Phase 1)
- `f64` gives 15-17 significant digits; spec requires 18 minimum
- `rust_decimal::Decimal` gives 28-29 significant digits, base-10 arithmetic
- Native `MidpointNearestEven` rounding strategy replaces custom `bankers_round`
- Exact equality (`==`) replaces tolerance-based `float_eq`
- `0.1 + 0.2 = 0.3` is exact (would fail with f64)
- Scientific notation (`1e3`) falls back through f64 in the lexer (lossless for integer results)
- `power()` falls back to f64 for fractional exponents (inherently imprecise)

### ADR: Dependency Inversion for Schema Validation (Phase 2)
- `JsonSchemaValidator` trait in `formspec-core` — host provides the actual JSON Schema engine
- WASM layer can use AJV; PyO3 layer can use `jsonschema-rs`
- Keeps `formspec-core` free of heavy JSON Schema validator dependencies
- `formspec-core` provides: document type detection, path translation, component tree walk strategy

### ADR: Trait-based Registry Lookup (Phase 2)
- `RegistryLookup` trait for extension validation
- `RefResolver` trait for assembler
- Both allow different implementations per binding layer
- Test implementations use simple `HashMap` wrappers

---

## Build History

### Iteration 1 (2026-03-18)
Built all 6 crates from scratch. 175 tests.
- `fel-core`: decimal migration, environment, extensions
- `formspec-core`: all 6 modules
- `formspec-eval`, `formspec-lint`: initial implementations
- `formspec-wasm`, `formspec-py`: binding layers

### Iteration 2 (2026-03-18)
Deepened eval and lint. 239 tests (↑64).
- `fel-core`: added FEL printer (15 round-trip tests)
- `formspec-core`: fixed assembler FEL rewriting (AST-based), improved runtime mapping expression transform
- `formspec-eval`: added topo sort, AND/OR inheritance, wildcard expansion, NRB modes, whitespace normalization (6→28 tests)
- `formspec-lint`: added E302/W300/E301/E600, wildcard validation, screener parsing, pass gating, LintMode, diagnostic sorting (9→27 tests)

### Iteration 3 (2026-03-18)
Expanded WASM bindings. 239 tests (maintained).
- `formspec-wasm`: added linter, evaluator, assembler, printer exports — all processing capabilities now exposed to TypeScript

---

## Dependency Graph

```
index.ts (stays TS — Preact Signals)
└── crates/formspec-wasm (WASM boundary) ✅
    ├── crates/formspec-core ✅
    │   ├── FEL Analysis ✅
    │   ├── Path Utils ✅
    │   ├── Schema Validator ✅
    │   ├── Extension Analysis ✅
    │   ├── Runtime Mapping ✅
    │   └── Assembler ✅
    ├── crates/formspec-eval ✅
    ├── crates/formspec-lint ✅
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
