# Review: WASM / fel split vs “logic in Rust” rule

**Date:** 2026-03-24  
**Rule:** Spec **business logic** lives in **Rust** (and Python for server/tooling); TypeScript **orchestrates** and **bridges** to WASM.

## Verdict

The **WASM runtime/tools split**, **`fel-api-runtime` / `fel-api-tools`**, **`init-formspec-engine` lazy tools load**, **`formspec-engine/render`**, **`formspec-core` subpath imports**, and **Playwright network tests** **do not add** new normative behavior in TypeScript. They are packaging, module graph, re-exports, harness glue, and assertions on load order.

## File-by-file (this workstream)

| Area | Rust-first? | Notes |
|------|-------------|--------|
| `fel-api-runtime.ts` | Yes | Passthrough to `wasm-bridge-runtime`; `analyzeFEL` only normalizes error **shape** for TS consumers. `splitNormalizedPath` delegates normalization to `wasmNormalizeIndexedPath`. `itemLocationAtPath` is **host tree navigation** (find item by key), not FEL evaluation. `normalizePathSegment` is a small exported string helper; Rust has `formspec_core::path_utils::normalize_path_segment` — keep behavior aligned or route through WASM if the spec treats segment normalization as normative. |
| `fel-api-tools.ts` | Yes | Passthrough + `rewriteFELReferences` / `validateExtensionUsage` **orchestration** (callbacks, walking items to collect extension names) then **WASM** does rewrite/validation. |
| `fel-api.ts` | Yes | Re-export barrel only. |
| `init-formspec-engine.ts` | Yes | Module load / init order only. |
| `engine-render-entry.ts` | Yes | Public surface only. |
| `FormEngine` / `wasm-fel` / engine chain → `wasm-bridge-runtime` | Yes | Already reviewed earlier; eval path is WASM. |
| `formspec-core` import changes | Yes | No logic change. |
| E2E harness / Playwright | Yes | Test infrastructure. |
| `CLAUDE.md` / `AGENTS.md` logic ownership | Yes | Documents the rule. |

## Pre-existing debt (not introduced here)

- **Historical:** the repo once carried a Chevrotain-based TS FEL lexer/parser/interpreter for client-side wiring. That stack is **removed** from `formspec-engine`; parse/deps/analysis/eval for the engine go through **Rust + runtime WASM** (`getFELDependencies`, `analyzeFEL`, `wasmEvalFELWithContext`, etc.). **`compileExpression`** is a reactive wrapper around WASM eval, not a TS interpreter.
- **`normalizePathSegment`** in `fel-api-runtime.ts` remains a TS convenience export; **`normalizeIndexedPath` / `splitNormalizedPath`** use WASM. Align `normalizePathSegment` with **`formspec_core::normalize_path_segment`** (or expose it from WASM) if callers need strict parity on odd segments.

## Doc alignment (post-review)

`packages/formspec-engine/README.md`, **`CLAUDE.md`**, and **`AGENTS.md`** now describe **Rust/WASM as authoritative** for FEL, the **`fel-api-runtime` / `fel-api-tools`** glue layout, and **`compileExpression`** — and no longer list a Chevrotain pipeline under `src/fel/`.
