# Rust Rewrite Inventory

Status: **In Progress** — FEL core complete, remaining components catalogued.

## Overview

Replace `packages/formspec-engine/` (TypeScript) and `src/formspec/` (Python) with a single Rust implementation compiled to WASM (browser) and native (CLI/server), with `wasm-bindgen` and `PyO3` bindings.

## Completed

### FEL Core (`crates/fel-core/`) — 91 tests passing

| Component | TS Source | Python Source | Rust File |
|-----------|-----------|--------------|-----------|
| Lexer | `fel/lexer.ts` | (inline in parser.py) | `src/lexer.rs` |
| Parser | `fel/parser.ts` | `fel/parser.py` | `src/parser.rs` |
| AST Nodes | (CST via chevrotain) | `fel/ast_nodes.py` | `src/ast.rs` |
| Evaluator (40+ stdlib) | `fel/interpreter.ts` | `fel/evaluator.py` | `src/evaluator.rs` |
| Runtime Types | (JS primitives) | `fel/types.py` | `src/types.rs` |
| Errors & Diagnostics | (inline) | `fel/errors.py` | `src/error.rs` |
| Dependency Extraction | `fel/dependency-visitor.ts` | `fel/dependencies.py` | `src/dependencies.rs` |

Zero external dependencies — pure Rust std library. Uses f64 for numbers (swap to `rust_decimal` when crates.io is available for spec-compliant 34-digit precision).

## Remaining — TypeScript Engine (`packages/formspec-engine/src/`)

### FormEngine (`index.ts`, ~27K lines) — Very High Complexity

The core reactive state engine. Manages form state via Preact Signals:

- Field values, relevance (visibility), required/readonly state
- Validation results, repeat group counts, option lists, computed variables
- 4-phase processing: rebuild → recalculate → revalidate → apply NRB
- Bind constraints (field-level: required, readonly, calculate, constraint, relevance)
- Shape evaluation (cross-field validation rules)
- Repeat group lifecycle (add/remove instances, min/max cardinality)
- Response serialization, version migrations, remote options fetching, screener evaluation

**Rust consideration:** Needs a reactivity system to replace `@preact/signals-core`. Options: custom signal graph, or a dependency-tracking approach using the existing FEL dependency extractor.

### Assembler (`assembler.ts`, 696 lines) — Medium

- Resolves `$ref` inclusions to produce self-contained definitions
- Key prefix application, circular reference detection, key collision handling
- FEL path rewriting in binds/shapes/variables for imported fragments

### FEL Analysis (`fel/analysis.ts`, 200 lines) — Medium

- Static analysis: `analyzeFEL(expression)` → references, variables, functions, errors
- FEL path rewriting: callbacks for rewriting field paths, variables, instance names
- Used by assembler for `$ref` fragment imports

### Path Utils (`path-utils.ts`, 72 lines) — Low

- Dotted path normalization, repeat index handling
- Tree navigation by path (find item at path, resolve parent/index/item triples)
- Generic over `TreeItemLike` interface

### Schema Validator (`schema-validator.ts`, 348 lines) — Medium

- JSON Schema (2020-12) validation for all Formspec artifact types
- Uses AJV; Rust equivalent would need `jsonschema` crate or similar
- Document type auto-detection, per-node validation strategy for components

### Runtime Mapping (`runtime-mapping.ts`, 221 lines) — Medium

- Bidirectional rule-based data transforms (forward/reverse)
- Priority-ordered rules with FEL condition guards
- Transform types: drop, constant, valueMap, coerce, preserve
- Per-rule reverse overrides

### Extension Analysis (`extension-analysis.ts`, 98 lines) — Low

- Validates x-extension usage against a registry catalog
- Checks for unresolved, retired, and deprecated extensions

## Remaining — Python Backend (`src/formspec/`)

### FEL Subsystem (completes FEL)

| Component | File | Complexity | Description |
|-----------|------|------------|-------------|
| Environment | `fel/environment.py` | Medium | Field path resolution against instance data, let-scope stack, RepeatContext (`@current`/`@index`/`@count`), MipState lookups, `@instance('name')` |
| Extensions | `fel/extensions.py` | Low | User-defined function registration (null-propagating, no shadowing builtins) |

### Definition Evaluator (`evaluator.py`) — High

Server-side form processor implementing 4-phase batch evaluation:
1. Rebuild item tree (ItemInfo nodes)
2. Recalculate computed values (topological order)
3. Revalidate constraints and shapes
4. Apply NRB (non-relevant blanking)

Manages MIP state tracking, FEL evaluation in field context, repeat groups, decimal precision.

### Registry (`registry.py`) — Medium

- Extension registry client: parse, query, validate registry documents
- Semver constraint matching (`_version_satisfies`)
- Lifecycle state machine validation (draft → active → deprecated → retired)
- Well-known discovery URL construction

### Changelog (`changelog.py`) — Medium

- Diff two definition versions into a semver-classified changelog
- Walks items, binds, shapes, optionSets, dataSources, screener, migrations
- Classifies changes as breaking/compatible/cosmetic
- Computes major/minor/patch impact

### Mapping Engine (`mapping/`) — Medium-High

| Component | File | Description |
|-----------|------|-------------|
| Engine | `mapping/engine.py` | Bidirectional rule-based transforms, FEL conditions, array descriptors, autoMap |
| Transforms | `mapping/transforms.py` | 10 pluggable transforms: preserve, drop, expression, coerce, valueMap, concat, split, nest, flatten, join |

### Adapters (`adapters/`) — Low to Medium

| Adapter | File | Description |
|---------|------|-------------|
| Base ABC | `adapters/base.py` | `serialize(JsonValue) -> bytes`, `deserialize(bytes) -> JsonValue` |
| JSON | `adapters/json_adapter.py` | Pretty/sort/null-handling options, Decimal serialization |
| XML | `adapters/xml_adapter.py` | Attributes (@-prefix), CDATA, namespaces, root element |
| CSV | `adapters/csv_adapter.py` | RFC 4180, repeat group row expansion, configurable delimiter/quote |

### Validator / Linter (`validator/`) — Medium

Multi-pass static analysis pipeline (9 passes):

| Pass | File | Code Range | Description |
|------|------|------------|-------------|
| Orchestrator | `linter.py` | — | Gates downstream passes on structural errors |
| 1. Schema | `schema.py` | E100-E101 | JSON Schema validation, document type detection |
| 2. Tree | `tree.py` | E200-E201 | Item tree flattening, duplicate key detection |
| 3. References | `references.py` | E300-E302, W300 | Bind/shape path validation, wildcard resolution |
| 4. Expressions | `expressions.py` | E400 | Parse all FEL slots in binds/shapes/screener |
| 5. Dependencies | `dependencies.py` | E500 | Dependency graph + DFS cycle detection |
| 6. Theme | `theme.py` | W700-E710 | Token validation, reference integrity, page layout |
| 7. Components | `component.py` | E800-W804 | Component tree, type compatibility, bind uniqueness |
| Supporting | `diagnostic.py` | — | Diagnostic record, severity, category types |
| Supporting | `policy.py` | — | Severity transform (authoring vs strict mode) |
| Supporting | `component_matrix.py` | — | Input component / dataType compatibility matrix |
| CLI | `__main__.py` | — | `python -m formspec.validate` entry point |

### Artifact Orchestrator (`validate.py`) — Medium

- Auto-discovers all Formspec JSON artifacts in a directory
- Runs 10 validation passes (lint, schema, runtime eval, mapping, changelog, registry, FEL)
- Report formatting and exit codes

## Recommended Build Order

### Phase 1: Complete FEL Subsystem
1. **FEL Environment** — field resolution, repeat context, MIP state
2. **FEL Extensions** — user-defined function registration
3. **FEL Analysis** — static analysis + path rewriting

### Phase 2: Engine Foundation
4. **Path Utils** — dotted path normalization, tree navigation
5. **Assembler** — `$ref` resolution, FEL path rewriting
6. **FormEngine** — reactive state, bind/shape evaluation, repeat groups

### Phase 3: Server-Side Processing
7. **Definition Evaluator** — 4-phase batch evaluation
8. **Mapping Engine + Transforms** — bidirectional data transforms
9. **Adapters** (JSON, XML, CSV) — wire format serialization

### Phase 4: Tooling
10. **Registry** — extension registry client
11. **Changelog** — definition version diffing
12. **Validator/Linter** — 9-pass static analysis pipeline

### Phase 5: Bindings (needs crates.io)
13. **WASM bindings** (`wasm-bindgen`) — browser deployment
14. **Python bindings** (`PyO3`) — server-side / conformance tests
15. Swap `f64` → `rust_decimal` for 34-digit precision

## Dependency Graph

```
FormEngine
├── FEL Core (done)
│   ├── Lexer, Parser, AST
│   ├── Evaluator + 40+ stdlib
│   ├── Dependencies
│   └── Environment (TODO)
├── FEL Analysis (TODO)
├── Path Utils (TODO)
├── Assembler (TODO)
└── Schema Validator (TODO)

Definition Evaluator
├── FormEngine
├── FEL Core
└── Registry (TODO)

Mapping Engine
├── FEL Core
├── Transforms (TODO)
└── Adapters (TODO)

Validator/Linter
├── FEL Core (parser + dependencies)
├── Schema Validator
└── Component Matrix (TODO)
```
