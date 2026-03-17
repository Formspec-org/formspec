# Rust Rewrite Inventory

Status: **In Progress** — FEL core complete, remaining components catalogued.

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

| File | Lines | Destination | Delete when |
|------|-------|-------------|-------------|
| `src/index.ts` | 2,454 | **Stays TS** — only Preact Signals consumer | — |
| `src/fel/lexer.ts` | 255 | `crates/fel-core` ✓ done | WASM wired |
| `src/fel/parser.ts` | 368 | `crates/fel-core` ✓ done | WASM wired |
| `src/fel/interpreter.ts` | 1,314 | `crates/fel-core` ✓ done | WASM wired |
| `src/fel/dependency-visitor.ts` | 97 | `crates/fel-core` ✓ done | WASM wired |
| `src/fel/analysis.ts` | 435 | `crates/formspec-core` | WASM wired |
| `src/path-utils.ts` | 71 | `crates/formspec-core` | WASM wired |
| `src/schema-validator.ts` | 347 | `crates/formspec-core` | WASM wired |
| `src/extension-analysis.ts` | 97 | `crates/formspec-core` | WASM wired |
| `src/runtime-mapping.ts` | 220 | `crates/formspec-core` | WASM wired |
| `src/assembler.ts` | 695 | `crates/formspec-core` | WASM wired |

### Crate Plan

| Crate | Contents | Depends on |
|-------|----------|------------|
| `crates/fel-core` | ✓ done — FEL lexer, parser, evaluator (~61 stdlib), dependency extraction | — |
| `crates/formspec-core` | Path utils, FEL analysis, assembler, schema validator, extension analysis, runtime mapping | `fel-core` |
| `crates/formspec-eval` | Definition Evaluator (batch 4-phase processor) | `fel-core`, `formspec-core` |
| `crates/formspec-lint` | 7-pass static analysis linter | `fel-core`, `formspec-core` |
| `crates/formspec-wasm` | WASM bindings — all above → TypeScript (`index.ts`) | all above |
| `crates/formspec-py` | PyO3 bindings — all above → Python backend | all above |

### Decommission Milestones

**After `crates/formspec-wasm` wired into `index.ts`:** delete all of:
- `src/fel/lexer.ts`, `src/fel/parser.ts`, `src/fel/interpreter.ts`, `src/fel/dependency-visitor.ts`
- `src/fel/analysis.ts`
- `src/path-utils.ts`, `src/schema-validator.ts`, `src/extension-analysis.ts`, `src/runtime-mapping.ts`, `src/assembler.ts`

**After `crates/formspec-py` wired into Python backend:** delete:
- `src/formspec/fel/` (lexer, parser, evaluator, ast_nodes, types, errors, dependencies, environment, extensions)

---

## Completed

### FEL Core (`crates/fel-core/`) — 91 tests passing

| Component | TS Source | Python Source | Rust File |
|-----------|-----------|--------------|-----------|
| Lexer | `fel/lexer.ts` | (inline in parser.py) | `src/lexer.rs` |
| Parser | `fel/parser.ts` | `fel/parser.py` | `src/parser.rs` |
| AST Nodes | (CST via chevrotain) | `fel/ast_nodes.py` | `src/ast.rs` |
| Evaluator (~61 stdlib) | `fel/interpreter.ts` | `fel/evaluator.py` | `src/evaluator.rs` |
| Runtime Types | (JS primitives) | `fel/types.py` | `src/types.rs` |
| Errors & Diagnostics | (inline) | `fel/errors.py` | `src/error.rs` |
| Dependency Extraction | `fel/dependency-visitor.ts` | `fel/dependencies.py` | `src/dependencies.rs` |

**⚠ Precision gap:** Currently uses `f64` (15-17 significant digits). Core spec S3.4.1 requires **minimum 18 significant decimal digits** with base-10 (not binary) arithmetic and banker's rounding. `f64` does NOT conform. Swap to `rust_decimal` is Phase 1, item 1.

---

## Remaining — `crates/formspec-core` (from TS)

### FEL Analysis (`fel/analysis.ts` → `src/fel_analysis.rs`) — Medium

- Static analysis: `analyzeFEL(expression)` → references, variables, functions, errors
- FEL path rewriting: callbacks for rewriting field paths, variables, instance names
- Used by assembler for `$ref` fragment imports

### Path Utils (`path-utils.ts` → `src/path_utils.rs`) — Low

- Dotted path normalization, repeat index handling
- Tree navigation by path (find item at path, resolve parent/index/item triples)

### Schema Validator (`schema-validator.ts` → `src/schema_validator.rs`) — Medium

- JSON Schema (2020-12) validation for all Formspec artifact types
- Uses AJV in TS; Rust equivalent needs `jsonschema` crate
- Document type auto-detection, per-node validation strategy for components
- Required BEFORE referential integrity checks (Component spec S12.1)

### Extension Analysis (`extension-analysis.ts` → `src/extension_analysis.rs`) — Low

- Validates x-extension usage against a registry catalog
- Checks for unresolved, retired, and deprecated extensions

### Runtime Mapping (`runtime-mapping.ts` → `src/runtime_mapping.rs`) — Medium

- Bidirectional rule-based data transforms (forward/reverse)
- Priority-ordered rules with FEL condition guards
- Transform types: drop, constant, valueMap, coerce, preserve
- Per-rule reverse overrides

### Assembler (`assembler.ts` → `src/assembler.rs`) — Medium

- Resolves `$ref` inclusions to produce self-contained definitions
- Key prefix application, circular reference detection, key collision handling
- FEL path rewriting in binds/shapes/variables for imported fragments

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

### FEL Subsystem — replaced by PyO3

Currently in `src/formspec/fel/`. Deleted once `crates/formspec-py` is wired.

Two remaining pieces needed in `crates/fel-core` first:

| Component | File | Complexity | Description |
|-----------|------|------------|-------------|
| Environment | `fel/environment.py` | Medium | Field path resolution, let-scope stack, RepeatContext (`@current`/`@index`/`@count`), MIP state, `@instance('name')` |
| Extensions | `fel/extensions.py` | Low | User-defined function registration (null-propagating, no shadowing builtins) |

### Definition Evaluator (`evaluator.py` → `crates/formspec-eval`) — High

Moves to Rust. Server-side 4-phase batch processor:
1. Rebuild item tree (ItemInfo nodes)
2. Recalculate computed values (topological order)
3. Revalidate constraints and shapes
4. Notify (NRB during step 2 and at Response serialization)

Dependencies beyond FEL Core:
- Option Set resolution (S4.6)
- Data Source loading including `formspec-fn:` callbacks (S2.1.7, S4.4)
- Variable evaluation with lexical scoping (S4.5)
- Migration application when loading pinned responses (S6.7)
- Extension resolution against registries

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

### Validator / Linter (`validator/` → `crates/formspec-lint`) — High

Moves to Rust. 7-pass pipeline; passes 1-5 for definitions, pass 6 for themes, pass 7 for components.

| Pass | Code Range | Description |
|------|------------|-------------|
| 1. Schema | E100-E101 | JSON Schema validation, document type detection |
| 2. Tree | E200-E201 | Item tree flattening, duplicate key detection |
| 3. References | E300-E302, W300 | Bind/shape path validation, wildcard resolution |
| 4. Expressions | E400 | Parse all FEL slots in binds/shapes/screener |
| 5. Dependencies | E500 | Dependency graph + DFS cycle detection |
| 6. Theme | W700-E710 | Token validation, reference integrity, page layout |
| 7. Components | E800-W804 | Component tree, type compatibility, bind uniqueness |

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

## Recommended Build Order

### Phase 1: FEL Precision + Environment
1. **Swap `f64` → `rust_decimal`** — f64 fails the 18-digit minimum. Do before any higher-level tests.
2. **FEL Environment** (`crates/fel-core`) — field resolution, repeat context, MIP state
3. **FEL Extensions** (`crates/fel-core`) — user-defined function registration
4. **FEL Analysis** (`crates/formspec-core`) — static analysis + path rewriting

### Phase 2: formspec-core (replaces TS non-reactive files)
5. **Path Utils** — dotted path normalization, tree navigation
6. **Schema Validator** — JSON Schema 2020-12 validation, document type detection
7. **Extension Analysis** — registry-based extension validation
8. **Runtime Mapping** — bidirectional transforms (drop, constant, valueMap, coerce, preserve)
9. **Assembler** — `$ref` resolution, FEL path rewriting

### Phase 3: WASM bindings + TS decommission
10. **`crates/formspec-wasm`** — expose formspec-core + fel-core to TypeScript
11. **Wire `index.ts`** to call WASM for FEL eval, assembly, schema validation, path resolution
12. **Delete** all non-reactive TS files (see Decommission Milestones above)

### Phase 4: Batch Processors
13. **Definition Evaluator** (`crates/formspec-eval`) — 4-phase batch evaluation
14. **Linter** (`crates/formspec-lint`) — 7-pass static analysis pipeline

### Phase 5: PyO3 bindings + Python decommission
15. **`crates/formspec-py`** — expose all crates to Python
16. **Wire Python backend** to call PyO3 for FEL eval, lint, eval passes
17. **Delete** `src/formspec/fel/`

### Phase 6: Tooling (deferred, needs crates.io)
18. **Registry** — extension registry client
19. **Changelog** — definition version diffing

---

## Dependency Graph

```
index.ts (stays TS — Preact Signals)
└── crates/formspec-wasm (WASM boundary)
    ├── crates/formspec-core
    │   ├── FEL Analysis
    │   ├── Path Utils
    │   ├── Schema Validator
    │   ├── Extension Analysis
    │   ├── Runtime Mapping
    │   └── Assembler
    └── crates/fel-core (done — rust_decimal pending)
        ├── Lexer, Parser, AST
        ├── Evaluator + ~61 stdlib
        ├── Dependencies
        └── Environment (TODO)

crates/formspec-eval (Definition Evaluator)
├── crates/formspec-core
├── crates/fel-core
└── Registry (TODO)

crates/formspec-lint (Linter)
├── crates/formspec-core
└── crates/fel-core

crates/formspec-wasm / crates/formspec-py
└── all of the above
```
