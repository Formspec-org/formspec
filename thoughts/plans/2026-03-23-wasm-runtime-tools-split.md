# Implementation plan: WASM runtime / tools split (ADR 0050)

**ADR:** [0050-wasm-runtime-tools-split.md](../adr/0050-wasm-runtime-tools-split.md)  
**Status:** Draft plan (execution not started)  
**Date:** 2026-03-23

## 1. Goal

Ship two separately built and loaded WASM artifacts:

| Artifact | Role |
|----------|------|
| **Runtime** | Default `initFormspecEngine()` / `createFormEngine()` path — definition evaluation, FEL, coercion, migrations, option-set inlining, path/item helpers, screener. Keeps `registryDocuments` evaluation contract; **no** `jsonschema` / full lint crate in the binary. |
| **Tools** | Lazy-loaded — lint/schema planning, registry document helpers, changelog, mapping execution, definition assembly, FEL authoring helpers (tokenize, print, catalog, rewrites, `validateExtensionUsage`). |

Public TypeScript entrypoints on `formspec-engine` stay stable; internals route to runtime vs tools and lazy-init tools on first use.

## 2. Phase 0 — Baseline (before any split)

Record **evidence** for ADR acceptance criteria §Measure and gate.

- [ ] Monolith `wasm-pkg/formspec_wasm_bg.wasm`: raw bytes, gzip, brotli (same `wasm-opt` flags as today).
- [ ] Time from `initFormspecEngine()` completing through first `createFormEngine()` and first definition evaluation (`_evaluate()` or equivalent) — same sequence as ADR acceptance criteria (browser + Node if both matter).
- [ ] Optional: `cargo bloat` / `twiggy` on `formspec-wasm` for Rust-side intuition (not a gate by itself).

Store numbers in this plan or a sibling `thoughts/reviews/2026-03-23-wasm-split-baseline.md` and link from ADR implementation notes when done.

## 3. Rust: crate layout (pick one, document in PR)

ADR allows either **two crates** or **one crate + features + two `wasm-pack` builds**.

**Recommended default:** two crates for clarity and to avoid accidental feature unification:

| Crate | Depends on | Excludes |
|-------|------------|----------|
| `formspec-wasm-runtime` | `fel-core`, `formspec-core`, `formspec-eval` | `formspec-lint` |
| `formspec-wasm-tools` | runtime crate **or** shared `formspec-wasm-core` glue + `formspec-lint` + mapping/assembly/registry/changelog modules | N/A (full surface) |

**Alternative:** single `formspec-wasm` with `default = ["full"]`, `runtime = []`, and two `wasm-pack` invocations with `--no-default-features --features runtime` vs full. Higher risk of `cfg` drift; only choose if duplication is worse than discipline.

**Concrete tasks:**

- [ ] List every `#[wasm_bindgen]` export in current `crates/formspec-wasm/src/*.rs` and assign **runtime** vs **tools** (must match §5 matrix).
- [ ] Ensure **runtime** build still compiles `formspec-eval` paths that use `registryDocuments` / extension constraints. **Invariant:** extension validation required during batch definition evaluation stays in **runtime** WASM (Rust eval path). The TS wrapper `wasmValidateExtensionUsage` belongs in **tools** only if it is diagnostics/authoring-only and not invoked on the `FormEngine` hot path; grep call sites before locking the matrix.
- [x] Confirm `formspec-eval` does **not** depend on `formspec-lint` (verified in `crates/formspec-eval/Cargo.toml` — runtime split is structurally viable).
- [ ] `formspec-py` / native consumers: grep for `formspec-wasm`; update if they embed the monolith; document which artifact(s) each consumer loads.

## 4. Export ownership matrix (`wasm-bridge.ts` → WASM)

Lock ambiguous rows (**especially `wasmParseFEL`**, which may overlap runtime compilation) with repo-wide grep **before** splitting implementation; treat that lock as part of Phase 0 or the first task in this section.

**Runtime (eager)** — required for `FormEngine` hot path and definition setup:

| TS wrapper | Notes |
|------------|--------|
| `wasmEvalFEL` | Public / tests |
| `wasmEvalFELWithContext` | Engine |
| `wasmPrepareFelExpression` | FEL pipeline |
| `wasmResolveOptionSetsOnDefinition` | `definition-setup` |
| `wasmApplyMigrationsToResponseData` | Response migration |
| `wasmCoerceFieldValue` | `setValue` path |
| `wasmGetFELDependencies` | Dependency wiring |
| `wasmAnalyzeFEL` | Variable + calculate bind setup |
| `wasmNormalizeIndexedPath` | Path helpers |
| `wasmItemAtPath`, `wasmItemLocationAtPath` | Engine helpers |
| `wasmEvaluateDefinition` | Core eval loop |
| `wasmEvaluateScreener` | Screener routing |
| `wasmEvaluateDefinitionPayload` | Lives in `wasm-fel.ts`; stays on runtime |

**Tools (lazy)** — load second module on first call:

| TS wrapper | Notes |
|------------|--------|
| `wasmPlanSchemaValidation` | Lint / schema planning |
| `wasmLintDocument`, `wasmLintDocumentWithRegistries` | Lint |
| `wasmAssembleDefinition` | `assembleDefinition` public API |
| `wasmExecuteMapping`, `wasmExecuteMappingDoc` | `RuntimeMappingEngine` / mapping |
| `wasmParseRegistry`, `wasmFindRegistryEntry`, `wasmValidateLifecycleTransition`, `wasmWellKnownRegistryUrl` | Registry **document** tooling |
| `wasmGenerateChangelog` | Changelog |
| `wasmCollectFELRewriteTargets`, `wasmRewriteFELReferences`, `wasmRewriteFelForAssembly`, `wasmRewriteMessageTemplate` | Assembly / FEL rewrite |
| `wasmPrintFEL`, `wasmListBuiltinFunctions` | `fel-api` |
| `wasmTokenizeFEL`, `wasmValidateExtensionUsage` | `fel-api` / `formspec-core` diagnostics (studio) |

**Ambiguous / verify before locking:**

| TS wrapper | Suggested bucket | Action |
|------------|------------------|--------|
| `wasmParseFEL` | Tools (authoring) if unused on render path | Grep monorepo callers; if only tooling, tools |
| `wasmExtractDependencies` | Tools vs runtime | Not re-exported from `index.ts` today; grep consumers; default **tools** if only MCP/studio |
| `wasmDetectDocumentType`, `wasmJsonPointerToJsonPath` | Tools | Used by document/lint stack; confirm no `FormEngine` import |

*Update this table if grep finds a runtime import — matrix is the contract.*

## 5. TypeScript bridge

- [ ] Add `packages/formspec-engine/wasm-pkg-runtime/` and `wasm-pkg-tools/` (names TBD — keep consistent with generated crate names, e.g. `formspec_wasm_runtime_*`). Record the final directory and generated module name prefix in one place (fences, docs, CI) to avoid drift.
- [ ] Reconcile **two `wasm-pack` outputs**: duplicate generated types / `InitInput` shapes if any; expose a **single** stable public type surface through the compatibility barrel (`wasm-bridge.ts`) so app code does not import both glue packages directly.
- [ ] Export a shared split-module compatibility constant from both generated JS glue packages (for example `FORMSPEC_WASM_SPLIT_ABI_VERSION`) and validate it before any tools wrapper becomes callable.
- [ ] Implement `initWasm()` → **runtime only** (current behavior for render-first apps).
- [ ] Implement `initWasmTools()` — idempotent promise, dynamic `import()` of tools JS glue; Node path mirrors current `readFileSync` + `initSync` resolution logic.
- [ ] `initWasmTools()` must verify runtime/tools compatibility before exposing tools APIs. On mismatch, fail fast with a targeted error that includes the runtime version, tools version, and artifact names.
- [ ] Split implementation files:
  - `wasm-bridge-runtime.ts` — runtime `_wasm` handle + runtime wrappers
  - `wasm-bridge-tools.ts` — tools `_wasmTools` + tools wrappers; each public function `await ensureWasmTools()` then delegate
  - `wasm-bridge.ts` — re-export **same** `wasmXxx` names as today (compatibility barrel per ADR)
- [ ] `createMappingEngine` / `assembleDefinition` / lint entrypoints: ensure first call triggers `initWasmTools()` only (never from `initFormspecEngine()` / `createFormEngine()` alone).
- [ ] Error messages: if tools API called before tools load fails, surface clear “tools WASM failed to load” vs “runtime not initialized”.

## 6. Build & packaging

- [ ] `packages/formspec-engine/package.json`: two `wasm-pack build` commands, same `wasm-opt` profile as today for apples-to-apples baseline.
- [ ] `Makefile` / root build scripts: update any target that assumes a single `formspec-wasm` artifact (including `make build` ordering if applicable).
- [ ] CI (e.g. `.github/workflows`): replace hardcoded monolith WASM paths or copy steps with both artifacts where needed.
- [ ] Publish layout: both artifact dirs under `formspec-engine` package (or document if tools is optional peer — default: bundle both in `formspec-engine`).
- [ ] Vite / Vitest: ensure dynamic import paths resolve in tests (may need `?url` or copy assets — mirror how monolith is consumed today).
- [ ] Update any consumer docs that reference a single `.wasm` filename (including Python/native embedders if they document WASM loading).

## 7. Dependency fences & repo hygiene

- [ ] `scripts/check-dep-fences.mjs`: extend `WASM_PATTERN` / owner rule so only `formspec-engine` may import `wasm-pkg-runtime`, `wasm-pkg-tools`, or generated module names (replace single `formspec_wasm` string with explicit allowlist).
- [ ] Grep repo for `formspec_wasm`, `wasm-pkg/formspec_wasm`, `formspec-wasm` in docs, scripts, and workflow YAML; update CI/build instructions.

## 8. Testing strategy

**Unit / integration (Vitest):**

- [ ] **Runtime isolation:** test that after `initFormspecEngine()` (or `initWasm()`) and through first `createFormEngine()` + minimal render/eval, tools JS glue module was **not** imported — e.g. Vitest mock on the dynamic import path, or assert no tools chunk is requested in the browser harness.
- [ ] **Lazy tools:** call `createMappingEngine` or `wasmLintDocument` once; assert tools module loads exactly once; second call reuses init.
- [ ] **Top-level API compatibility:** package-root imports for existing public APIs still resolve from `formspec-engine` without caller rewrites unless explicitly documented as a breaking change.
- [ ] **Compatibility guard:** intentionally mismatched runtime/tools artifacts fail with the expected targeted error before any tools call proceeds.
- [ ] **Regression:** full engine test suite + `formspec-webcomponent` tests unchanged in public API.
- [ ] **Registry:** fixture with `registryDocuments: [{ entries: [...] }]` still produces same eval / extension constraint behavior as baseline (snapshot or existing tests).

**Browser build / E2E:**

- [ ] Build a minimal runtime-first browser entry and verify the initial bundle/chunk graph does **not** include tools JS glue or tools `.wasm`.
- [ ] Load studio or a minimal Vite app: network tab shows only runtime artifacts until a tools feature is used.
- [ ] After first tools API call, tools JS glue and tools `.wasm` load once and are reused.

## 9. Completion checklist (maps to ADR acceptance criteria)

- [ ] `initFormspecEngine()` / `createFormEngine()` do not import, fetch, or initialize tools JS glue or tools WASM.
- [ ] `formspec-webcomponent` render path unchanged; no tools artifact is imported, fetched, or initialized.
- [ ] `formspec-layout` unchanged (still no engine/WASM).
- [ ] Package-root `formspec-engine` public APIs remain stable where ADR 0050 expects stability; tools-owned APIs still resolve from the top-level package and lazy-load internally.
- [ ] Baseline doc: runtime artifact strictly smaller than monolith (raw + compressed); timings recorded using the same sequence as Phase 0 (`initFormspecEngine()` → first `createFormEngine()` → first eval).
- [ ] Lint / registry / changelog / mapping / assembly behave the same once tools loaded.
- [ ] `registryDocuments` contract preserved for extension-aware evaluation.
- [ ] Runtime/tools compatibility mismatch fails early with a targeted error rather than surfacing as a late lazy-load failure.

## 10. Follow-ups (non-blocking, from ADR)

- Path-normalization: reduce regex use where hand parsing is simpler.
- After split: re-measure; then reconsider schema validator / `jsonschema` strategy if still too heavy in **tools** only.

## 11. Locked decisions for first implementation

1. **Supported packaging story**
   `formspec-engine` ships one package containing both generated artifacts:
   - runtime WASM + JS glue
   - tools WASM + JS glue

   The only supported consumer model in this phase is:
   - runtime loads by default
   - tools loads lazily on first tools API call

   We do **not** support a separate "tools re-exports the full public surface as a monolith replacement" mode in the first split. If embedders need a single CLI-sized artifact later, treat that as follow-up design work after the split lands and is measured.

2. **Versioning / compatibility**
   Runtime and tools artifacts version in **lockstep**. Both generated JS glue packages must expose the same split-module compatibility constant/version.

   `initWasmTools()` must verify that:
   - runtime can report its compatibility version
   - tools reports the same compatibility version

   If versions differ, fail fast with a targeted error that names both versions and tells the caller to align the package artifacts.
