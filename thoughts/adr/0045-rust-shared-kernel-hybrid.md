# ADR 0045 — Rust Shared Kernel (Hybrid Strategy)

**Status:** Accepted
**Date:** 2026-03-17

## Context

The TypeScript engine (`packages/formspec-engine/`) and Python backend (`src/formspec/`) share a large surface of pure logic — FEL evaluation, dependency extraction, path resolution, assembler, schema validation. This duplication means:

- Behavioral divergence: the same expression or path edge case can produce different results in each implementation.
- Double the maintenance: every FEL stdlib fix or assembler change must land in two places.
- Gaps: the Definition Evaluator and Linter only exist in Python, so TypeScript tooling (MCP server, Studio) has to shell out to Python or skip them entirely.

The original plan was a full Rust rewrite replacing both packages. During planning it became clear that the TypeScript engine's reactivity model — Preact Signals, computed signal memoization, glitch-free propagation — is the right tool for reactive UI state and would be expensive to rebuild correctly in Rust for uncertain gain.

## Decision

Build a **Rust shared kernel** rather than a full replacement.

- **`index.ts` is the only TypeScript file that stays.** It owns Preact Signals reactive state (FormEngine, repeat group tracking, signal-driven validation). No other file in `packages/formspec-engine/src/` touches `@preact/signals-core`.
- **Every other TS engine file moves to Rust.** `fel/lexer.ts`, `fel/parser.ts`, `fel/interpreter.ts`, `fel/dependency-visitor.ts` (already in `crates/fel-core`); plus `fel/analysis.ts`, `path-utils.ts`, `schema-validator.ts`, `extension-analysis.ts`, `runtime-mapping.ts`, `assembler.ts` (all going into `crates/formspec-core`).
- **Batch processors move to Rust too:** Definition Evaluator (`crates/formspec-eval`) and Linter (`crates/formspec-lint`) — Python-only today, Rust gives TS access for the first time.
- **WASM bindings** (`crates/formspec-wasm`) expose all Rust crates to TypeScript. `index.ts` calls WASM internally; its public API surface is unchanged.
- **PyO3 bindings** (`crates/formspec-py`) expose the same crates to Python. Python FEL is deleted once wired.
- **What stays Python:** Mapping Engine, Adapters, Changelog, Registry, Artifact Orchestrator. Server-side only, no cross-platform pressure.

## Consequences

**Positive:**
- Single FEL implementation — behavioral divergence between TS and Python becomes impossible.
- TS gains Definition Evaluator and Linter (via WASM) without a Python dependency. MCP server and Studio can run the full linter in-process.
- Python test suite (`tests/`) continues to work unchanged via PyO3 — same behavior, different runtime.
- ~3,900 lines of non-reactive TS deleted once WASM is wired (`fel/` + `assembler.ts` + `path-utils.ts` + `schema-validator.ts` + `extension-analysis.ts` + `runtime-mapping.ts` + `fel/analysis.ts`).
- ~800 lines of Python FEL deleted once PyO3 is wired.

**Negative / Risks:**
- WASM call overhead on the FEL hot path (per-keystroke reactive evaluation). Mitigate by caching compiled ASTs on the Rust side — only call `evaluate()` per change, not `compile()`.
- Two "engine" layers remain: Rust batch processor (Definition Evaluator) + TypeScript reactive engine (FormEngine). They implement the same 4-phase processing model independently. Behavioral parity for edge cases (NRB, repeat groups, null propagation) must be enforced via shared conformance tests, not by sharing code.
- WASM binary size added to the browser bundle. Acceptable for the Studio context; may need lazy loading for the public-facing webcomponent.

## Crate Plan

```
crates/
  fel-core/          ✓ done (needs rust_decimal swap)
  formspec-core/     path utils, FEL analysis, assembler,
                     schema validator, extension analysis,
                     runtime mapping
  formspec-eval/     Definition Evaluator (batch)
  formspec-lint/     7-pass linter
  formspec-wasm/     wasm-bindgen bindings → TypeScript (index.ts)
  formspec-py/       PyO3 bindings → Python backend
```

## Not Decided Here

- Whether the Mapping Engine, Adapters, Changelog, or Registry eventually move to Rust. That decision should be made when cross-platform access to those becomes a real need.
- WASM loading strategy for `formspec-webcomponent` (lazy vs. bundled). Defer until the bundle size impact is measured.
