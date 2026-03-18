---
title: "One codebase, every platform: the Rust shared kernel"
description: "Formspec had two implementations of the same logic — TypeScript for the browser, Python for the server. We rewrote the shared core in Rust and compile it to both. Here's what we built, why we didn't do a full rewrite, and what happens next."
date: 2026-03-18
tags: ["rust", "architecture", "deep-dive"]
author: "Formspec Team"
---

The [FEL design post](/blog/fel-design) ended with a promise: a Rust rewrite that eliminates the cost of maintaining two implementations. That rewrite is done — six Rust crates, 10,931 lines, 239 tests. WASM bindings for TypeScript, PyO3 bindings for Python, both covering every capability.

But we didn't do a full rewrite. We did something more targeted.

## The problem: two implementations, one specification

Formspec has a TypeScript engine for the browser and a Python backend for server-side validation, linting, and data transformation. Both implement the same specification. Both parse FEL expressions, resolve field paths, assemble definitions from `$ref` inclusions, evaluate validation shapes.

Two implementations of the same logic means:

- **Behavioral divergence.** The same FEL expression or path edge case can produce different results in each language. The spec says what's correct; the implementations disagree about edge cases the spec doesn't explicitly cover.
- **Double maintenance.** Every FEL stdlib fix, every assembler change, every path resolution tweak has to land in both codebases. Miss one and the implementations silently drift.
- **Capability gaps.** The Definition Evaluator (batch processing of an entire form) and the static linter (35 diagnostic codes across 7 passes) only existed in Python. The TypeScript MCP server and visual studio had to shell out to Python or skip them entirely.

This is the classic "two implementations of one spec" problem. It gets worse over time, never better.

## Why not a full Rust rewrite?

The original plan was a clean-slate Rust replacement for both the TypeScript engine and the Python backend. During planning, one thing became clear: the TypeScript engine's reactivity model is the wrong thing to rewrite.

`index.ts` — the FormEngine class — manages form state via [Preact Signals](https://preactjs.com/guide/v10/signals/). Computed signals auto-update when dependencies change. Glitch-free propagation means no intermediate invalid states. Signal memoization means unchanged values don't trigger downstream recalculations.

This is a reactive UI state management problem. Rust can solve it — but Preact Signals already solves it well, and the FormEngine's job is to wire signals together, not to evaluate expressions or validate schemas. Rebuilding the reactive layer in Rust would be expensive for uncertain gain.

So we asked a different question: what if only one file stays TypeScript?

## The hybrid: Rust kernel, TypeScript shell

Every file in the TypeScript engine falls into one of two categories:

1. **Reactive state management** — `index.ts` and nothing else. It imports `@preact/signals-core`. It owns the signal graph, the 4-phase processing cycle (rebuild, recalculate, revalidate, notify), repeat group tracking, and response serialization.
2. **Pure logic** — everything else. The FEL lexer, parser, interpreter. The dependency visitor. The assembler. Path utilities. Schema validation. Extension analysis. Runtime mapping. None of these touch signals.

Category 2 moves to Rust. Category 1 stays TypeScript. `index.ts` calls into Rust via WASM for all pure logic; its public API surface doesn't change.

The Python side goes further. FEL parsing and evaluation were the first to move, but the mapping engine, changelog diffing, and extension registry follow — all pure logic with no reason to stay language-specific. Only the format adapters (JSON, XML, CSV serialization) stay Python. They depend on Python's stdlib, serve a server-side-only export concern, and would add dependencies to the WASM binary for a capability the browser doesn't need.

## What we built

Six crates, organized by dependency:

```
index.ts (stays TypeScript — Preact Signals)
└── formspec-wasm (WASM boundary)
    ├── formspec-core
    │   ├── FEL Analysis
    │   ├── Path Utils
    │   ├── Schema Validator
    │   ├── Extension Analysis
    │   ├── Runtime Mapping
    │   ├── Assembler
    │   ├── Registry Client
    │   └── Changelog
    ├── formspec-eval (Definition Evaluator)
    ├── formspec-lint (7-pass static linter)
    └── fel-core
        ├── Lexer, Parser, AST
        ├── Evaluator + ~61 stdlib functions
        ├── Dependencies
        ├── Environment
        ├── Extensions
        └── Printer

formspec-py (PyO3 → Python)
└── all of the above
```

**`fel-core`** (4,731 lines, 123 tests) — the FEL language runtime. Lexer, parser, evaluator, dependency extraction, environment model with repeat-instance scoping, extension registry, and an AST printer for round-trip fidelity.

**`formspec-core`** (2,501 lines, 61 tests) — everything the engine and linter share. FEL analysis (extract references and rewrite paths), path utilities, schema document type detection, extension validation, runtime mapping execution, the definition assembler, and the extension registry client (semver matching, lifecycle validation, registry document parsing). Changelog diffing — comparing two definition versions and classifying changes as breaking, compatible, or cosmetic — also lives here.

**`formspec-eval`** (1,586 lines, 28 tests) — the Definition Evaluator, a 4-phase batch processor. Topological sort for variable evaluation order, AND/OR inheritance for relevance and readonly, non-relevant blanking with three modes, wildcard bind expansion. This previously existed only in Python.

**`formspec-lint`** — a 7-pass static analysis linter with 35 diagnostic codes. Duplicate key detection, bind path validation, FEL expression parsing, dependency cycle detection, extension resolution, theme token validation (color, spacing, font weight, line height), and component tree validation (input/dataType compatibility, custom component cycles, bind resolution). Pass gating stops analysis after structural errors. Authoring vs. runtime modes suppress diagnostics that don't apply to the current context. Cross-artifact checks validate theme tokens and component binds against a paired definition document. This previously existed only in Python.

**`formspec-wasm`** (390 lines) — wasm-bindgen layer exposing everything to TypeScript: `evalFEL`, `parseFEL`, `lintDocument`, `evaluateDefinition`, `assembleDefinition`, `executeMapping`, and more.

**`formspec-py`** (331 lines) — PyO3 module `formspec_rust` exposing the same capabilities to Python, with full bidirectional type conversion between Python and Rust values.

### The precision upgrade

The FEL spec requires at least 18 significant digits for decimal arithmetic. The TypeScript implementation uses IEEE 754 doubles — 15-17 significant digits. Close, but not compliant.

The Rust implementation uses `rust_decimal::Decimal` — 28-29 significant digits, base-10 arithmetic. `0.1 + 0.2 = 0.3` is exact, not `0.30000000000000004`. Banker's rounding is a native mode, not a custom function. The tolerance-based `float_eq` comparisons that littered the TypeScript tests are gone.

This is the kind of improvement that's nearly impossible to retrofit into an existing codebase but falls out naturally when you rewrite with the right primitives.

### Dependency inversion at the boundary

The Rust crates don't depend on any specific JSON Schema engine, HTTP client, or file system. Instead, they define traits:

- **`JsonSchemaValidator`** — the host provides the JSON Schema engine. WASM uses AJV; PyO3 uses `jsonschema-rs`.
- **`RegistryLookup`** — the host provides extension registry access. Different implementations for CLI tools, web apps, and test harnesses.
- **`RefResolver`** — the host resolves `$ref` URIs. The assembler doesn't care where definitions come from.

This keeps the Rust crates portable. They compile to WASM without pulling in `reqwest` or `jsonschema`. The host environment provides what it can.

## What TypeScript gains

Before the shared kernel, the TypeScript ecosystem (MCP server, visual studio, web component) had no access to the Definition Evaluator or the static linter. Both were Python-only.

After wiring WASM: the MCP server runs the full 7-pass linter in-process, with no Python dependency. The visual studio validates forms in real-time as authors edit. The web component can batch-evaluate a definition without a server round-trip. The registry client — previously Python-only — lets TypeScript tooling validate extensions, check lifecycle states, and resolve semver constraints directly. Changelog diffing works everywhere too.

This is the real payoff — not just eliminating duplication, but giving every platform access to every capability.

## What gets deleted

Once WASM is wired into `index.ts`:

- `fel/lexer.ts` (255 lines)
- `fel/parser.ts` (368 lines)
- `fel/interpreter.ts` (1,314 lines)
- `fel/dependency-visitor.ts` (97 lines)
- `fel/analysis.ts` (435 lines)
- `path-utils.ts` (71 lines)
- `schema-validator.ts` (347 lines)
- `extension-analysis.ts` (97 lines)
- `runtime-mapping.ts` (220 lines)
- `assembler.ts` (695 lines)

~3,900 lines of TypeScript. Gone.

Once PyO3 is wired into the Python backend:

- `src/formspec/fel/` — lexer, parser, evaluator, AST, types, errors, dependencies, environment, extensions
- `src/formspec/mapping/engine.py` — bidirectional rule-based transforms, FEL conditions, array descriptors
- `src/formspec/mapping/transforms.py` — 10 transform types (preserve, drop, expression, constant, coerce, valueMap, concat, split, nest, flatten)
- `src/formspec/registry.py` — extension registry client, semver matching, lifecycle validation
- `src/formspec/changelog.py` — definition version diffing, change classification

The format adapters (`adapters/json_adapter.py`, `adapters/xml_adapter.py`, `adapters/csv_adapter.py`) stay Python — they're server-side serialization glue with no cross-platform need.

One implementation replaces two. The conformance test suite validates one codebase against the spec, not two against each other.

## The honest tradeoffs

**WASM call overhead.** Every FEL evaluation crosses the JS-WASM boundary. On the hot path — per-keystroke reactive evaluation — this adds latency. The mitigation: cache compiled ASTs on the Rust side. Call `evaluate()` per change, not `parse()` + `evaluate()`. The parse is the expensive part; the evaluation is cheap.

**Two "engine" layers remain.** The Rust Definition Evaluator (batch) and the TypeScript FormEngine (reactive) both implement the same 4-phase processing model. They do it independently — one for batch evaluation of a complete form, one for reactive updates as users type. Behavioral parity for edge cases (non-relevant blanking, repeat groups, null propagation) is enforced by shared conformance tests, not by sharing code. This is a real maintenance surface.

**WASM binary size.** The compiled WASM adds to the browser bundle. Acceptable for the studio; may need lazy loading for the public-facing web component. We'll measure before deciding.

**Build complexity.** `cargo build` + `wasm-pack` + `maturin` + `npm` + `pip`. More tools in the chain. The tradeoff: one logical implementation instead of two, at the cost of a more involved build.

## What's next

The Rust crates compile and pass 239 tests. The WASM and PyO3 bindings expose every capability. What remains is wiring — connecting the compiled output to the TypeScript and Python consumers, then deleting the old code.

**Wire WASM into TypeScript.** Build the WASM package with `wasm-pack`, add it as an npm dependency, create a thin wrapper that loads WASM and re-exports typed functions, update `index.ts` to call WASM instead of the TypeScript implementations. Run the full Playwright E2E suite. Delete the old files.

**Wire PyO3 into Python.** Build with `maturin`, replace `from formspec.fel import ...` with `import formspec_rust` for FEL, then wire the mapping engine, registry, and changelog. Run the full Python conformance suite. Delete everything except the format adapters.

The [FEL design post](/blog/fel-design) said owning a custom language is sustainable only if you maintain one implementation. Six crates and two binding layers later, that's what we have. One codebase. Every platform. Same expression, same result.
