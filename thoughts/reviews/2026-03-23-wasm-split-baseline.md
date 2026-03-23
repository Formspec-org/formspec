# WASM runtime/tools split — size & timing baseline (ADR 0050)

**Status:** Partial — sizes + Node timings including engine construction (2026-03-24)  
**Date:** 2026-03-23 (updated 2026-03-24)  
**Plan:** [2026-03-23-wasm-runtime-tools-split.md](../plans/2026-03-23-wasm-runtime-tools-split.md)

## Implementation note (current tree)

Runtime and tools artifacts are built from **`crates/formspec-wasm`** with two Cargo feature sets:

- **Runtime** — `wasm-pack … -- --no-default-features` (no `lint` feature → **no `formspec-lint`** link; `lintDocument` / `lintDocumentWithRegistries` are absent from the runtime `.wasm`).
- **Tools** — default features (`lint` on) — full surface including lint passes.

Further splits (e.g. moving schema-plan or mapping out of runtime) are optional follow-ups.

## Artifact sizes

Measured after `npm run build:wasm` in `packages/formspec-engine` (same `wasm-opt -Os` flags as `package.json`).

| Artifact | Raw bytes | gzip | brotli | Notes |
|----------|-----------|------|--------|--------|
| ~~Monolith~~ `wasm-pkg/formspec_wasm_bg.wasm` | — | — | — | Not re-recorded here; compare from a pre-split commit if a historical row is needed. |
| Runtime `wasm-pkg-runtime/formspec_wasm_runtime_bg.wasm` | **1,920,002** | **706,236** | **504,583** | `--no-default-features` build; darwin; `brotli` CLI. |
| Tools `wasm-pkg-tools/formspec_wasm_tools_bg.wasm` | 3,400,302 | 1,166,144 | 820,344 | Default features (`lint`); same `wasm-opt -Os` flags as runtime. |

## Timings (rough, Node cold process)

Sequence intent: `await initFormspecEngine()` → (optional) `await initFormspecEngineTools()`.

| Step | ms (approx.) | How measured |
|------|----------------|--------------|
| `initFormspecEngine()` only | **4.26** | Fresh `node --input-type=module` subprocess, `performance.now()` around await. |
| `initFormspecEngine()` + `initFormspecEngineTools()` | **8.62** | Fresh subprocess, both awaits. |
| `createFormEngine(kitchen-sink)` after runtime init | **19.77** | Fresh subprocess; `tests/e2e/fixtures/kitchen-sink-holistic/definition.v2.json`. |
| First `setValue('fullName', …)` after construction | **1.22** | Same subprocess as previous row. |

**Not yet recorded:** browser timings; explicit `_evaluate()` / full validation hot path microbench; monolith comparison on same machine.

## Commands (repeat measurements)

```bash
cd packages/formspec-engine
npm run build:wasm

wc -c wasm-pkg-runtime/formspec_wasm_runtime_bg.wasm wasm-pkg-tools/formspec_wasm_tools_bg.wasm
gzip -c wasm-pkg-runtime/formspec_wasm_runtime_bg.wasm | wc -c
gzip -c wasm-pkg-tools/formspec_wasm_tools_bg.wasm | wc -c
brotli -c wasm-pkg-runtime/formspec_wasm_runtime_bg.wasm | wc -c
brotli -c wasm-pkg-tools/formspec_wasm_tools_bg.wasm | wc -c
```

Link this file from the plan §Phase 0; extend with browser + eval sequence when gating ADR acceptance.
